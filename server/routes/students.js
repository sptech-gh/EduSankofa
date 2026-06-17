// ============================================================
// FILE: server/routes/students.js
// STATUS: Full replacement
// DEPENDS ON: models/GhanaStudent, models/GhanaClass, models/StudentLedger, models/TeacherAssignment, models/AcademicYear, models/Term, services/counterService
// TESTED AGAINST: Domain 2 Student Management specifications
// ============================================================

const express = require("express");
const mongoose = require("mongoose");
const { auth, authorizeRoles } = require("../middleware/auth");
const GhanaStudent = require("../models/GhanaStudent");
const GhanaClass = require("../models/GhanaClass");
const StudentLedger = require("../models/StudentLedger");
const TeacherAssignment = require("../models/TeacherAssignment");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const GhanaFeeStructure = require("../models/GhanaFeeStructure");
const AuditLog = require("../models/AuditLog");
const { nextSeq } = require("../services/counterService");
const logger = require("../services/logger");

const router = express.Router();

// Helper to convert Flat form data to GhanaStudent nested schema format
const mapBodyToGhanaStudent = (body, creatorId) => {
  const guardians = [];
  if (body.guardians && Array.isArray(body.guardians)) {
    body.guardians.forEach((g, idx) => {
      const names = String(g.name || "").trim().split(/\s+/);
      const firstName = names[0] || "";
      const lastName = names.slice(1).join(" ") || "Guardian";
      guardians.push({
        type: idx === 0 ? "Father" : "Mother", // fallback role mapping
        firstName,
        lastName,
        phone: g.phone || "",
        email: g.email || "",
        occupation: g.occupation || "",
        isPrimary: idx === 0,
      });
    });
  } else {
    // Map from father/mother details if provided in flat format
    if (body.fatherDetails && body.fatherDetails.firstName) {
      guardians.push({
        type: "Father",
        firstName: body.fatherDetails.firstName,
        lastName: body.fatherDetails.lastName || "Guardian",
        phone: body.fatherDetails.phone || "",
        email: body.fatherDetails.email || "",
        occupation: body.fatherDetails.occupation || "",
        isPrimary: true,
      });
    }
    if (body.motherDetails && body.motherDetails.firstName) {
      guardians.push({
        type: "Mother",
        firstName: body.motherDetails.firstName,
        lastName: body.motherDetails.lastName || "Guardian",
        phone: body.motherDetails.phone || "",
        email: body.motherDetails.email || "",
        occupation: body.motherDetails.occupation || "",
        isPrimary: guardians.length === 0,
      });
    }
  }

  // Address mapping
  const address = typeof body.address === "object" ? body.address : {
    street: body.address || "",
    city: body.city || "",
    region: body.region || "",
    postalCode: body.postalCode || "",
  };

  return {
    firstName: body.firstName,
    lastName: body.lastName,
    middleName: body.middleName || "",
    otherNames: body.otherNames || "",
    email: body.email ? String(body.email).toLowerCase().trim() : undefined,
    dateOfBirth: new Date(body.dateOfBirth),
    gender: body.gender,
    placeOfBirth: body.placeOfBirth || "Accra",
    regionOfBirth: body.region || "Greater Accra",
    nationality: body.nationality || "Ghanaian",
    currentClass: body.classId || body.class,
    academicYear: body.academicYearId || body.academicYear,
    term: body.termId || body.term,
    phone: body.phone || "0000000000",
    guardians,
    address,
    birthCertificate: {
      certificateNumber: body.birthCertificateNumber || "",
      issueDate: body.birthCertificateIssueDate ? new Date(body.birthCertificateIssueDate) : undefined,
      issuingAuthority: "Registry Dept",
    },
    nhis: {
      cardNumber: body.nhisNumber || "",
      expiryDate: body.nhisExpiryDate ? new Date(body.nhisExpiryDate) : undefined,
    },
    ghanaCard: (body.identityType === "National ID" || body.identityType === "ghana-card") ? {
      cardNumber: body.identityNumber || "",
      pinNumber: body.identityNumber || "",
      expiryDate: body.identityExpiryDate ? new Date(body.identityExpiryDate) : undefined,
    } : undefined,
    status: body.status || "Active",
    createdBy: creatorId,
  };
};

// 2.1 POST /api/students — Create a new student
router.post(
  "/",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    const startTime = Date.now();

    try {
      const { classId, academicYearId } = req.body;
      const effectiveClassId = classId || req.body.class;
      const effectiveAcademicYearId = academicYearId || req.body.academicYear;

      if (!effectiveClassId || !mongoose.Types.ObjectId.isValid(effectiveClassId)) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Valid classId is required" });
      }

      if (!effectiveAcademicYearId || !mongoose.Types.ObjectId.isValid(effectiveAcademicYearId)) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Valid academicYearId is required" });
      }

      // Verify class exists
      const cls = await GhanaClass.findById(effectiveClassId).session(session);
      if (!cls) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Class not found" });
      }

      // Verify active year
      const activeYear = await AcademicYear.findOne({ _id: effectiveAcademicYearId }).session(session);
      if (!activeYear) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Academic year not found" });
      }

      // Find active term for the year
      const activeTerm = await Term.findOne({ academicYear: activeYear._id, isActive: true }).session(session);
      if (!activeTerm) {
        await session.abortTransaction();
        return res.status(400).json({ message: "No active term found for this academic year. Please activate a term first." });
      }

      // Find matching fee structure
      const feeStructure = await GhanaFeeStructure.findOne({
        academicYear: activeYear._id,
        term: activeTerm._id,
        $or: [
          { applicableClasses: cls._id },
          { applicableLevels: cls.level }
        ]
      }).session(session);

      if (!feeStructure) {
        await session.abortTransaction();
        return res.status(400).json({ message: "No fee structure found for this class and academic year. Please set up a fee structure first." });
      }

      // Generate IDs atomically using Counter
      const year = new Date().getFullYear();
      const studentSeq = await nextSeq(`studentId-${year}`, session);
      const studentId = `EDU${year}${String(studentSeq).padStart(4, "0")}`;

      const admissionSeq = await nextSeq(`admissionNumber-${year}`, session);
      const admissionNumber = `ADM${year}${String(admissionSeq).padStart(4, "0")}`;

      const mappedData = mapBodyToGhanaStudent(req.body, req.user._id);
      mappedData.studentId = studentId;
      mappedData.admissionNumber = admissionNumber;
      mappedData.academicYear = activeYear._id;
      mappedData.term = activeTerm._id;

      // 1. Create Student
      const student = new GhanaStudent(mappedData);
      await student.save({ session });

      // 2. Create Ledger
      const feeBreakdown = feeStructure.feeItems.map(item => ({
        feeItemName: item.name,
        category: item.category,
        amount: item.amount,
        paid: 0,
        balance: item.amount,
        isMandatory: item.isMandatory,
        dueDate: feeStructure.dueDate,
      }));
      const totalFees = feeBreakdown.reduce((sum, item) => sum + (item.isMandatory ? item.amount : 0), 0);

      const ledger = new StudentLedger({
        student: student._id,
        academicYear: activeYear._id,
        term: activeTerm._id,
        feeStructure: feeStructure._id,
        totalFees,
        totalPaid: 0,
        balance: totalFees,
        currency: "GHS",
        feeBreakdown,
        transactions: [],
        status: "Active",
        createdBy: req.user._id,
        studentName: `${student.firstName} ${student.lastName}`,
        studentId: student.studentId,
        className: cls.name,
      });
      await ledger.save({ session });

      // 3. Update Class roster
      cls.students.push(student._id);
      cls.currentEnrollment = cls.students.length;
      await cls.save({ session });

      // Create Audit Log
      await AuditLog.create([{
        user: req.user._id,
        userRole: req.user.role === "super admin" ? "Super Admin" : "Staff",
        userName: req.user.name,
        action: "CREATE",
        resource: `Student: ${studentId}`,
        resourceType: "Student",
        resourceId: student._id,
        method: "POST",
        url: req.originalUrl,
        statusCode: 201,
        ipAddress: req.ip,
        duration: Date.now() - startTime,
      }], { session });

      await session.commitTransaction();

      res.status(201).json({
        success: true,
        data: student,
      });
    } catch (err) {
      await session.abortTransaction();
      next(err);
    } finally {
      session.endSession();
    }
  }
);

// 2.2 GET /api/students — List students (paginated, filterable)
router.get(
  "/",
  auth,
  async (req, res, next) => {
    try {
      const { classId, academicYearId, search, status } = req.query;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const skip = (page - 1) * limit;

      const filter = {};

      if (status) filter.status = status;
      if (classId) filter.currentClass = classId;
      if (academicYearId) filter.academicYear = academicYearId;

      if (search) {
        filter.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { studentId: { $regex: search, $options: "i" } },
        ];
      }

      // Enforce RBAC restrictions
      const userRole = String(req.user.role).toLowerCase();
      if (userRole === "teacher") {
        const assignments = await TeacherAssignment.find({ teacher: req.user._id });
        const classIds = assignments.map(a => a.class);
        filter.currentClass = { $in: classIds };
      } else if (userRole === "parent") {
        filter["guardians.userId"] = req.user._id;
      } else if (userRole === "student") {
        return res.status(403).json({ message: "Access denied" });
      }

      const total = await GhanaStudent.countDocuments(filter);
      const students = await GhanaStudent.find(filter)
        .populate("currentClass", "name level section")
        .populate("academicYear", "name")
        .skip(skip)
        .limit(limit)
        .sort({ lastName: 1, firstName: 1 })
        .lean();

      // Format output for frontend compatibility
      const data = students.map(s => ({
        _id: s._id,
        firstName: s.firstName,
        middleName: s.middleName,
        otherNames: s.otherNames,
        lastName: s.lastName,
        email: s.email,
        studentId: s.studentId,
        admissionNumber: s.admissionNumber,
        class: s.currentClass ? s.currentClass.name : "",
        status: s.status ? s.status.toLowerCase() : "active",
        enrollmentDate: s.enrollmentDate,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));

      res.setHeader("X-Pagination-Page", String(page));
      res.setHeader("X-Pagination-Limit", String(limit));
      res.setHeader("X-Pagination-Total", String(total));
      res.setHeader("X-Pagination-Pages", String(Math.ceil(total / limit)));

      res.json({
        success: true,
        data,
        total,
        page,
        pages: Math.ceil(total / limit),
      });
    } catch (err) {
      next(err);
    }
  }
);

// 2.3 GET /api/students/:id — Get single student profile
router.get(
  "/:id",
  auth,
  async (req, res, next) => {
    try {
      const student = await GhanaStudent.findById(req.params.id)
        .populate("currentClass", "name level section")
        .populate("academicYear", "name");

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // RBAC check
      const userRole = String(req.user.role).toLowerCase();
      if (userRole === "teacher") {
        const hasAssignment = await TeacherAssignment.findOne({ teacher: req.user._id, class: student.currentClass?._id });
        if (!hasAssignment) return res.status(403).json({ message: "Access denied" });
      } else if (userRole === "parent") {
        const isChild = student.guardians.some(g => g.userId && String(g.userId) === String(req.user._id));
        if (!isChild) return res.status(403).json({ message: "Access denied" });
      }

      // Fetch student ledger details
      const ledger = await StudentLedger.findOne({ student: student._id }).sort({ createdAt: -1 });

      const payload = student.toJSON();
      payload.ledgerSummary = ledger ? {
        totalFees: ledger.totalFees,
        totalPaid: ledger.totalPaid,
        balance: ledger.balance,
      } : { totalFees: 0, totalPaid: 0, balance: 0 };

      res.json({
        success: true,
        data: payload,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 2.4 PATCH /api/students/:id — Update student profile
router.patch(
  "/:id",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res, next) => {
    const startTime = Date.now();
    try {
      const student = await GhanaStudent.findById(req.params.id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Prevent modifications to studentId, admissionNumber, currentClass
      const forbidden = ["studentId", "admissionNumber", "currentClass", "academicYear", "term"];
      forbidden.forEach(field => {
        if (req.body[field] !== undefined) delete req.body[field];
      });

      // Update allowed values
      const updatable = [
        "firstName", "lastName", "middleName", "otherNames", "email",
        "dateOfBirth", "gender", "placeOfBirth", "phone", "address"
      ];

      updatable.forEach(field => {
        if (req.body[field] !== undefined) student[field] = req.body[field];
      });

      if (req.body.guardians) {
        student.guardians = req.body.guardians;
      }

      await student.save();

      // Audit Log
      await AuditLog.create({
        user: req.user._id,
        userRole: req.user.role === "super admin" ? "Super Admin" : "Staff",
        userName: req.user.name,
        action: "UPDATE",
        resource: `Student: ${student.studentId}`,
        resourceType: "Student",
        resourceId: student._id,
        method: "PATCH",
        url: req.originalUrl,
        statusCode: 200,
        ipAddress: req.ip,
        duration: Date.now() - startTime,
      });

      res.json({
        success: true,
        data: student,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 2.5 POST /api/students/:id/enroll — Enroll/transfer student to a class
router.post(
  "/:id/enroll",
  auth,
  authorizeRoles("admin"),
  async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    const startTime = Date.now();

    try {
      const { classId, academicYearId, reason } = req.body;

      if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Valid classId is required" });
      }

      if (!academicYearId || !mongoose.Types.ObjectId.isValid(academicYearId)) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Valid academicYearId is required" });
      }

      const student = await GhanaStudent.findById(req.params.id).session(session);
      if (!student) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Student not found" });
      }

      // Check if student is already enrolled in the class for the same academic year
      if (String(student.currentClass) === String(classId) && String(student.academicYear) === String(academicYearId)) {
        await session.abortTransaction();
        return res.status(409).json({ message: "Student is already enrolled in this class for the academic year" });
      }

      // Verify class exists
      const targetClass = await GhanaClass.findById(classId).session(session);
      if (!targetClass) {
        await session.abortTransaction();
        return res.status(404).json({ message: "Target class not found" });
      }

      // Remove from old class
      if (student.currentClass) {
        await GhanaClass.findByIdAndUpdate(
          student.currentClass,
          { $pull: { students: student._id }, $inc: { currentEnrollment: -1 } }
        ).session(session);
      }

      // Update student
      student.currentClass = targetClass._id;
      student.academicYear = academicYearId;
      await student.save({ session });

      // Add to new class roster
      targetClass.students.push(student._id);
      targetClass.currentEnrollment = targetClass.students.length;
      await targetClass.save({ session });

      // Audit Log
      await AuditLog.create([{
        user: req.user._id,
        userRole: "Super Admin", // Only admin can call this
        userName: req.user.name,
        action: "UPDATE",
        resource: `Student Transfer: ${student.studentId}`,
        resourceType: "Student",
        resourceId: student._id,
        method: "POST",
        url: req.originalUrl,
        statusCode: 200,
        ipAddress: req.ip,
        notes: reason || "Class transfer",
        duration: Date.now() - startTime,
      }], { session });

      await session.commitTransaction();

      res.json({
        success: true,
        message: "Student transferred successfully",
        data: student,
      });
    } catch (err) {
      await session.abortTransaction();
      next(err);
    } finally {
      session.endSession();
    }
  }
);

module.exports = router;
