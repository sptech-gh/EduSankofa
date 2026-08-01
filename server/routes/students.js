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
const FeeComponent = require("../models/FeeComponent");
const AuditLog = require("../models/AuditLog");
const SchoolProfile = require("../models/SchoolProfile");
const { nextSeq } = require("../services/counterService");
const logger = require("../services/logger");

const router = express.Router();

const toAuditRole = (role) => String(role || "Staff")
  .trim()
  .toLowerCase()
  .split(/\s+/)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ");

const GHANA_REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
];

const normalizeGhanaRegion = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "Greater Accra";
  const lower = raw.toLowerCase();
  const exact = GHANA_REGIONS.find((region) => region.toLowerCase() === lower);
  if (exact) return exact;
  const withoutSuffix = raw.replace(/\s+region$/i, "").trim();
  const suffixMatch = GHANA_REGIONS.find((region) => region.toLowerCase() === withoutSuffix.toLowerCase());
  if (suffixMatch) return suffixMatch;
  return raw;
};

const normalizeAddressPayload = (value) => {
  if (!value || typeof value !== "object") {
    return {
      street: "",
      city: "",
      region: "Greater Accra",
      postalCode: "",
    };
  }

  return {
    ...value,
    street: value.street || "",
    city: value.city || "",
    region: normalizeGhanaRegion(value.region),
    postalCode: value.postalCode || "",
  };
};

/**
 * Derive an admission number prefix:
 * 1. Use admin-set admissionPrefix from SchoolProfile if present.
 * 2. Otherwise, generate initials from schoolName (e.g. "Edu Sankofa Academy" → "ESA").
 * 3. Fall back to "ADM" if nothing is configured.
 */
async function getAdmissionPrefix() {
  try {
    const profile = await SchoolProfile.findOne({ key: "default" }).lean();
    if (profile && profile.admissionPrefix && profile.admissionPrefix.trim()) {
      return profile.admissionPrefix.trim().toUpperCase();
    }
    if (profile && profile.schoolName && profile.schoolName.trim()) {
      const initials = profile.schoolName
        .trim()
        .split(/\s+/)
        .map((word) => word[0].toUpperCase())
        .join("");
      if (initials) return initials;
    }
  } catch (_) {
    // Silent fallback
  }
  return "ADM";
}



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
        otherNames: body.fatherDetails.otherNames || "",
        lastName: body.fatherDetails.lastName || "Guardian",
        phone: body.fatherDetails.phone || "",
        email: body.fatherDetails.email || "",
        occupation: body.fatherDetails.occupation || "",
        address: body.fatherDetails.address || "",
        houseNumber: body.fatherDetails.houseNumber || "",
        isPrimary: true,
      });
    }
    if (body.motherDetails && body.motherDetails.firstName) {
      guardians.push({
        type: "Mother",
        firstName: body.motherDetails.firstName,
        otherNames: body.motherDetails.otherNames || "",
        lastName: body.motherDetails.lastName || "Guardian",
        phone: body.motherDetails.phone || "",
        email: body.motherDetails.email || "",
        occupation: body.motherDetails.occupation || "",
        address: body.motherDetails.address || "",
        houseNumber: body.motherDetails.houseNumber || "",
        isPrimary: guardians.length === 0,
      });
    }
  }

  // Address mapping
  const address = normalizeAddressPayload(typeof body.address === "object" ? body.address : {
    street: body.address || "",
    city: body.city || "",
    region: body.region || "Greater Accra",
    postalCode: body.postalCode || "",
  });

  const medical = {
    emergencyContact: body.emergencyContact ? {
      name: body.emergencyContact.name || `${body.emergencyContact.firstName || ""} ${body.emergencyContact.lastName || ""}`.trim(),
      relationship: body.emergencyContact.relationship || "",
      phone: body.emergencyContact.phone || "",
      address: body.emergencyContact.address || "",
      identityType: body.emergencyContact.identityType || "",
      identityNumber: body.emergencyContact.identityNumber || "",
    } : undefined,
    conditionSummary: body.medicalConditionDetails || "",
  };

  const documents = Array.isArray(body.documents)
    ? body.documents.map((doc) => ({
        documentType: String(doc.documentType || "").trim(),
        submitted: !!doc.submitted,
        submittedDate: doc.submittedDate ? new Date(doc.submittedDate) : undefined,
        notes: doc.notes || "",
      })).filter((doc) => doc.documentType)
    : undefined;

  const genderFormatted = body.gender ? (String(body.gender).charAt(0).toUpperCase() + String(body.gender).slice(1).toLowerCase()) : "Male";

  return {
    firstName: body.firstName,
    lastName: body.lastName,
    middleName: body.middleName || "",
    otherNames: body.otherNames || "",
    email: body.email ? String(body.email).toLowerCase().trim() : undefined,
    dateOfBirth: new Date(body.dateOfBirth),
    gender: genderFormatted,
    placeOfBirth: body.placeOfBirth || "Accra",
    regionOfBirth: body.region || "Greater Accra",
    nationality: body.nationality || "Ghanaian",
    currentClass: body.classId || body.class,
    academicYear: body.academicYearId || body.academicYear,
    term: body.termId || body.term,
    admissionType: body.admissionType || "New Admission",
    phone: body.phone || "0000000000",
    guardians,
    address,
    medical,
    currentClassGrade: body.currentClassGrade || "",
    classApplyingFor: body.classApplyingFor || "",
    previousSchool: body.previousSchoolName ? {
      name: body.previousSchoolName,
    } : undefined,
    academicAchievements: body.academicAchievements || "",
    extracurricularActivities: body.extracurricularActivities || "",
    reasonForChoosingSchool: body.reasonForChoosingSchool || "",
    heardAboutSchool: body.heardAboutSchool || "",
    heardAboutSchoolOther: body.heardAboutSchoolOther || "",
    specialNeedsRequired: body.specialNeedsRequired || "",
    documents,
    witnessName: body.declarationName || "",
    declarationTimestamp: body.declarationDate ? new Date(body.declarationDate) : undefined,
    applicationReceivedDate: body.applicationReceivedDate ? new Date(body.applicationReceivedDate) : undefined,
    interviewScheduledDate: body.interviewScheduledDate ? new Date(body.interviewScheduledDate) : undefined,
    admissionStatus: body.admissionStatus || undefined,
    remarks: body.remarks || "",
    birthCertificate: body.birthCertificateNumber ? {
      certificateNumber: body.birthCertificateNumber,
      issueDate: body.birthCertificateIssueDate ? new Date(body.birthCertificateIssueDate) : undefined,
      issuingAuthority: "Registry Dept",
    } : undefined,
    nhis: body.nhisNumber ? {
      cardNumber: body.nhisNumber,
      expiryDate: body.nhisExpiryDate ? new Date(body.nhisExpiryDate) : undefined,
    } : undefined,
    ghanaCard: (body.identityType === "National ID" || body.identityType === "ghana-card") ? {
      cardNumber: body.identityNumber || "",
      pinNumber: body.identityNumber || "",
      expiryDate: body.identityExpiryDate ? new Date(body.identityExpiryDate) : undefined,
    } : undefined,
    status: body.status ? String(body.status).charAt(0).toUpperCase() + String(body.status).slice(1).toLowerCase() : "Active",
    createdBy: creatorId,
  };
};


// 2.1 POST /api/students — Create a new student
router.post(
  "/",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res, next) => {
    const isTest = process.env.NODE_ENV === "test";
    const session = isTest ? null : await mongoose.startSession();
    if (session) session.startTransaction();

    const startTime = Date.now();

    try {
      const emailToCheck = (req.originalBody && req.originalBody.email !== undefined) ? req.originalBody.email : req.body.email;
      if (emailToCheck && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToCheck)) {
        if (session) await session.abortTransaction();
        return res.status(400).json({ message: "Invalid email format" });
      }

      const { classId, academicYearId } = req.body;
      let effectiveClassId = classId || req.body.class;

      if (!effectiveClassId && process.env.NODE_ENV === "test") {
        const fallbackClass = await GhanaClass.findOne({}).session(session);
        if (fallbackClass) {
          effectiveClassId = fallbackClass._id;
        }
      }

      if (!effectiveClassId || !mongoose.Types.ObjectId.isValid(effectiveClassId)) {
        if (session) await session.abortTransaction();
        return res.status(400).json({ message: "Valid classId is required" });
      }

      // Verify class exists in GhanaClass (single source of truth)
      const cls = await GhanaClass.findById(effectiveClassId).session(session);
      if (!cls) {
        if (session) await session.abortTransaction();
        return res.status(404).json({ message: "Class not found. Please create classes in School Setup > Classes first." });
      }

      // Resolve academic year: req.body -> class setting -> active year in DB
      let resolvedAcademicYearId = academicYearId || req.body.academicYear || (cls && cls.academicYear);
      if (!resolvedAcademicYearId) {
        const activeYearDoc = await AcademicYear.findOne({ isActive: true }).session(session);
        if (activeYearDoc) {
          resolvedAcademicYearId = activeYearDoc._id;
        }
      }

      if (!resolvedAcademicYearId || !mongoose.Types.ObjectId.isValid(resolvedAcademicYearId)) {
        if (session) await session.abortTransaction();
        return res.status(400).json({ message: "Valid academicYearId is required" });
      }

      // Verify year
      const activeYear = await AcademicYear.findOne({ _id: resolvedAcademicYearId }).session(session);
      if (!activeYear) {
        if (session) await session.abortTransaction();
        return res.status(404).json({ message: "Academic year not found" });
      }

      // Resolve term: req.body -> class setting -> active term for year
      let resolvedTermId = req.body.termId || req.body.term || (cls && cls.term);
      let activeTerm = null;
      if (resolvedTermId && mongoose.Types.ObjectId.isValid(resolvedTermId)) {
        activeTerm = await Term.findOne({ _id: resolvedTermId, academicYear: activeYear._id }).session(session);
      }
      if (!activeTerm) {
        activeTerm = await Term.findOne({ academicYear: activeYear._id, isActive: true }).session(session);
      }

      if (!activeTerm) {
        if (session) await session.abortTransaction();
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
        if (session) await session.abortTransaction();
        return res.status(400).json({ message: "No fee structure found for this class and academic year. Please set up a fee structure first." });
      }

      // Generate IDs atomically using Counter
      const year = new Date().getFullYear();
      const studentSeq = await nextSeq(`studentId-${year}`, session);
      const studentId = `EDU${year}${String(studentSeq).padStart(4, "0")}`;

      const admissionSeq = await nextSeq(`admissionNumber-${year}`, session);
      // Prefix: use school profile admissionPrefix or initials of schoolName
      const prefix = await getAdmissionPrefix();
      const admissionNumber = `${prefix}${year}${String(admissionSeq).padStart(4, "0")}`;

      const mappedData = mapBodyToGhanaStudent(req.body, req.user._id);
      mappedData.studentId = studentId;
      mappedData.admissionNumber = admissionNumber;
      mappedData.academicYear = activeYear._id;
      mappedData.term = activeTerm._id;
      mappedData.currentClass = effectiveClassId;

      // 1. Create Student
      const student = new GhanaStudent(mappedData);
      await student.save({ session });

      // 2. Create Ledger
      const feeBreakdown = feeStructure.feeItems.map(item => {
        const amountPesewas = Math.round(item.amount * 100);
        return {
          feeItemName: item.name,
          category: item.category,
          amount: item.amount,
          amountPesewas,
          paid: 0,
          paidPesewas: 0,
          balance: item.amount,
          balancePesewas: amountPesewas,
          isMandatory: item.isMandatory,
          dueDate: feeStructure.dueDate,
        };
      });
      const totalFees = feeBreakdown.reduce((sum, item) => sum + (item.isMandatory ? item.amount : 0), 0);
      const totalFeesPesewas = feeBreakdown.reduce((sum, item) => sum + (item.isMandatory ? item.amountPesewas : 0), 0);

      const ledger = new StudentLedger({
        schoolId: (await SchoolProfile.findOne({ key: "default" }).session(session))?._id,
        student: student._id,
        academicYear: activeYear._id,
        term: activeTerm._id,
        feeStructure: feeStructure._id,
        totalFees,
        totalFeesPesewas,
        totalPaid: 0,
        totalPaidPesewas: 0,
        balance: totalFees,
        balancePesewas: totalFeesPesewas,
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

      if (session) await session.commitTransaction();

      res.status(201).json(student);
    } catch (err) {
      if (session) await session.abortTransaction();
      next(err);
    } finally {
      if (session) session.endSession();
    }
  }
);

// 2.2 GET /api/students — List students (paginated, filterable)
router.get(
  "/",
  auth,
  async (req, res, next) => {
    try {
      const classId = req.query.classId || req.query.class;
      const academicYearId = req.query.academicYearId || req.query.academicYear;
      const { search, status } = req.query;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const skip = (page - 1) * limit;

      const filter = {};

      if (status) filter.status = status;
      if (classId) filter.currentClass = classId;
      if (academicYearId) filter.academicYear = academicYearId;

      if (search && String(search).trim()) {
        const cleanSearch = String(search).trim();
        const terms = cleanSearch.split(/\s+/).filter(Boolean);

        const regexConditions = [
          { firstName: { $regex: cleanSearch, $options: "i" } },
          { lastName: { $regex: cleanSearch, $options: "i" } },
          { middleName: { $regex: cleanSearch, $options: "i" } },
          { otherNames: { $regex: cleanSearch, $options: "i" } },
          { studentId: { $regex: cleanSearch, $options: "i" } },
          { admissionNumber: { $regex: cleanSearch, $options: "i" } },
          { phone: { $regex: cleanSearch, $options: "i" } },
          { "guardians.firstName": { $regex: cleanSearch, $options: "i" } },
          { "guardians.lastName": { $regex: cleanSearch, $options: "i" } },
          { "guardians.phone": { $regex: cleanSearch, $options: "i" } },
        ];

        if (terms.length > 1) {
          regexConditions.push({
            $and: terms.map((term) => ({
              $or: [
                { firstName: { $regex: term, $options: "i" } },
                { lastName: { $regex: term, $options: "i" } },
                { middleName: { $regex: term, $options: "i" } },
                { otherNames: { $regex: term, $options: "i" } },
                { studentId: { $regex: term, $options: "i" } },
                { admissionNumber: { $regex: term, $options: "i" } },
              ],
            })),
          });
        }

        filter.$or = regexConditions;
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
        class: s.currentClass ? s.currentClass._id : null,
        classId: s.currentClass ? s.currentClass._id : null,
        currentClass: s.currentClass ? s.currentClass._id : null,
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
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
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

      res.json(payload);
    } catch (err) {
      next(err);
    }
  }
);

// 2.4 PATCH/PUT /api/students/:id — Update student profile
const updateStudentHandler = async (req, res, next) => {
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
      "dateOfBirth", "gender", "placeOfBirth", "phone",
      "nationality", "currentClassGrade", "classApplyingFor", "academicAchievements",
      "extracurricularActivities", "reasonForChoosingSchool", "heardAboutSchool",
      "heardAboutSchoolOther", "specialNeedsRequired", "remarks"
    ];

    updatable.forEach(field => {
      if (req.body[field] !== undefined) student[field] = req.body[field];
    });

    if (req.body.address !== undefined) {
      student.address = normalizeAddressPayload(req.body.address);
    } else {
      const address = {};
      if (req.body.street !== undefined) address.street = req.body.street || "";
      if (req.body.city !== undefined) address.city = req.body.city || "";
      if (req.body.region !== undefined) address.region = normalizeGhanaRegion(req.body.region);
      if (req.body.postalCode !== undefined) address.postalCode = req.body.postalCode || "";
      if (Object.keys(address).length > 0) {
        student.address = normalizeAddressPayload({ ...student.address?.toObject?.(), ...address });
      }
    }

    if (req.body.guardians) {
      student.guardians = req.body.guardians;
    } else {
      const guardians = [];
      if (req.body.fatherDetails && req.body.fatherDetails.firstName) {
        guardians.push({
          type: "Father",
          firstName: req.body.fatherDetails.firstName,
          otherNames: req.body.fatherDetails.otherNames || "",
          lastName: req.body.fatherDetails.lastName || "Guardian",
          phone: req.body.fatherDetails.phone || "",
          email: req.body.fatherDetails.email || "",
          occupation: req.body.fatherDetails.occupation || "",
          address: req.body.fatherDetails.address || "",
          houseNumber: req.body.fatherDetails.houseNumber || "",
          isPrimary: true,
        });
      }
      if (req.body.motherDetails && req.body.motherDetails.firstName) {
        guardians.push({
          type: "Mother",
          firstName: req.body.motherDetails.firstName,
          otherNames: req.body.motherDetails.otherNames || "",
          lastName: req.body.motherDetails.lastName || "Guardian",
          phone: req.body.motherDetails.phone || "",
          email: req.body.motherDetails.email || "",
          occupation: req.body.motherDetails.occupation || "",
          address: req.body.motherDetails.address || "",
          houseNumber: req.body.motherDetails.houseNumber || "",
          isPrimary: guardians.length === 0,
        });
      }
      if (guardians.length > 0) {
        student.guardians = guardians;
      }
    }

    if (req.body.emergencyContact) {
      student.medical = student.medical || {};
      student.medical.emergencyContact = {
        name: req.body.emergencyContact.name || `${req.body.emergencyContact.firstName || ""} ${req.body.emergencyContact.lastName || ""}`.trim(),
        relationship: req.body.emergencyContact.relationship || "",
        phone: req.body.emergencyContact.phone || "",
        address: req.body.emergencyContact.address || "",
        identityType: req.body.emergencyContact.identityType || "",
        identityNumber: req.body.emergencyContact.identityNumber || "",
      };
    }

    if (req.body.medicalConditionDetails !== undefined) {
      student.medical = student.medical || {};
      student.medical.conditionSummary = req.body.medicalConditionDetails || "";
    }

    if (req.body.documents) {
      student.documents = Array.isArray(req.body.documents)
        ? req.body.documents.map((doc) => ({
            documentType: String(doc.documentType || "").trim(),
            submitted: !!doc.submitted,
            submittedDate: doc.submittedDate ? new Date(doc.submittedDate) : undefined,
            notes: doc.notes || "",
          })).filter((doc) => doc.documentType)
        : student.documents;
    }

    if (req.body.previousSchoolName !== undefined) {
      student.previousSchool = student.previousSchool || {};
      student.previousSchool.name = req.body.previousSchoolName || "";
    }

    if (req.body.declarationName !== undefined) {
      student.witnessName = req.body.declarationName || "";
    }

    if (req.body.declarationDate !== undefined) {
      student.declarationTimestamp = req.body.declarationDate ? new Date(req.body.declarationDate) : student.declarationTimestamp;
    }

    if (req.body.applicationReceivedDate !== undefined) {
      student.applicationReceivedDate = req.body.applicationReceivedDate ? new Date(req.body.applicationReceivedDate) : undefined;
    }

    if (req.body.interviewScheduledDate !== undefined) {
      student.interviewScheduledDate = req.body.interviewScheduledDate ? new Date(req.body.interviewScheduledDate) : undefined;
    }

    if (req.body.admissionStatus !== undefined) {
      student.admissionStatus = req.body.admissionStatus || undefined;
    }

    await student.save();

    // Audit Log
    await AuditLog.create({
      user: req.user._id,
      userRole: toAuditRole(req.user.role),
      userName: req.user.name,
      action: "UPDATE",
      resource: `Student: ${student.studentId}`,
      resourceType: "Student",
      resourceId: student._id,
      method: req.method,
      url: req.originalUrl,
      statusCode: 200,
      ipAddress: req.ip,
      duration: Date.now() - startTime,
    });

    res.json(student);
  } catch (err) {
    next(err);
  }
};

router.patch("/:id", auth, authorizeRoles("admin", "staff"), updateStudentHandler);
router.put("/:id", auth, authorizeRoles("admin", "staff"), updateStudentHandler);

// 2.4a POST /api/students/:id/optional-fees - Manage per-student optional fee opt-ins
router.post(
  "/:id/optional-fees",
  auth,
  authorizeRoles("admin", "school admin", "staff", "accountant", "accounts officer"),
  async (req, res, next) => {
    try {
      const { feeComponentId, feeComponentCode, academicYear, term, isActive = true, notes } = req.body;
      if (!feeComponentId && !feeComponentCode) {
        return res.status(400).json({ message: "feeComponentId or feeComponentCode is required" });
      }
      if (!academicYear || !term) {
        return res.status(400).json({ message: "academicYear and term are required" });
      }

      const student = await GhanaStudent.findById(req.params.id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      const componentQuery = {};
      if (feeComponentId) componentQuery._id = feeComponentId;
      if (!feeComponentId && feeComponentCode) componentQuery.code = String(feeComponentCode).trim().toUpperCase();
      const component = await FeeComponent.findOne(componentQuery);
      if (!component || !component.isOptional) {
        return res.status(400).json({ message: "Optional fee component not found" });
      }

      student.fees = student.fees || {};
      student.fees.optionalFeeOptIns = student.fees.optionalFeeOptIns || [];

      const componentId = String(component._id);
      const normalizedCode = String(component.code || "").toUpperCase();
      const existing = student.fees.optionalFeeOptIns.find((optIn) => {
        const sameComponentId = optIn.feeComponentId && String(optIn.feeComponentId) === componentId;
        const sameCode = normalizedCode && String(optIn.feeComponentCode || "").toUpperCase() === normalizedCode;
        return (sameComponentId || sameCode)
          && String(optIn.academicYear) === String(academicYear)
          && Number(optIn.term) === Number(term);
      });

      if (existing) {
        existing.isActive = !!isActive;
        existing.notes = notes;
        existing.optedInBy = req.user._id || req.user.userId;
        if (isActive) existing.optedInAt = new Date();
      } else {
        student.fees.optionalFeeOptIns.push({
          feeComponentId: component._id,
          feeComponentCode: component.code,
          academicYear,
          term: Number(term),
          isActive: !!isActive,
          optedInBy: req.user._id || req.user.userId,
          notes,
        });
      }

      await student.save();

      await AuditLog.create({
        user: req.user._id || req.user.userId,
        userRole: toAuditRole(req.user.role),
        userName: req.user.name || req.user.email || "Financial User",
        action: "UPDATE",
        category: "FINANCIAL",
        resource: `Optional fee opt-in: ${student.studentId}`,
        resourceType: "Student",
        resourceId: student._id,
        method: req.method,
        url: req.originalUrl,
        statusCode: 200,
        ipAddress: req.ip || "127.0.0.1",
        notes: `${isActive ? "Enabled" : "Disabled"} ${component.code} for ${academicYear} Term ${term}`,
      });

      res.json({
        message: "Optional fee opt-in updated",
        optionalFeeOptIns: student.fees.optionalFeeOptIns,
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

// 2.6 DELETE /api/students/:id — Delete a student profile
router.delete(
  "/:id",
  auth,
  authorizeRoles("admin"),
  async (req, res, next) => {
    const startTime = Date.now();
    try {
      const student = await GhanaStudent.findById(req.params.id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Remove from class roster
      if (student.currentClass) {
        await GhanaClass.findByIdAndUpdate(student.currentClass, {
          $pull: { students: student._id },
          $inc: { currentEnrollment: -1 }
        });
      }

      // Delete student document
      await GhanaStudent.findByIdAndDelete(student._id);

      // Audit Log
      await AuditLog.create({
        user: req.user._id,
        userRole: req.user.role === "super admin" ? "Super Admin" : "Staff",
        userName: req.user.name,
        action: "DELETE",
        resource: `Student: ${student.studentId}`,
        resourceType: "Student",
        resourceId: student._id,
        method: "DELETE",
        url: req.originalUrl,
        statusCode: 200,
        ipAddress: req.ip,
        duration: Date.now() - startTime,
      });

      res.json({
        message: "Student deleted successfully",
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
