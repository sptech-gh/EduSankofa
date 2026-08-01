const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { auth } = require("../middleware/auth");
const GhanaStudent = require("../models/GhanaStudent");
const StudentBill = require("../models/StudentBill");
const Payment = require("../models/Payment");
const SchoolProfile = require("../models/SchoolProfile");
const { generateBillPDF, generateReceiptPDF } = require("../services/pdfService");
const GhanaAttendance = require("../models/GhanaAttendance");
const GhanaReportCard = require("../models/GhanaReportCard");
const GhanaAnnouncement = require("../models/GhanaAnnouncement");

// Helper to fetch/ensure school ID for the tenant context
async function getSchoolId() {
  // 1. Prefer tenant context from authenticated user (AsyncLocalStorage)
  const { getTenantSchoolId } = require("../middleware/tenantContext");
  const tenantSchoolId = getTenantSchoolId();
  if (tenantSchoolId) return tenantSchoolId;

  // 2. Fallback: default profile (single-school databases)
  const profile = await SchoolProfile.findOne({ key: "default" });
  if (profile) return profile._id;

  // 3. Hard fail — never use a hardcoded ObjectId
  throw new Error("School not configured");
}

// Guard: verify the parent has access to the requested student
async function verifyParentStudentRelation(parentUserId, studentId) {
  const student = await GhanaStudent.findOne({
    _id: studentId,
    "guardians.userId": parentUserId,
  });
  return student;
}

// @route   GET /api/parent-portal/students
// @desc    List all students linked to the authenticated parent account
router.get(
  "/students",
  auth,
  async (req, res, next) => {
    try {
      const students = await GhanaStudent.find({
        "guardians.userId": req.user._id,
      }).populate("currentClass");

      res.json(students);
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/parent-portal/students/:studentId/bills
// @desc    List all bills for a student (filter by academicYear, term)
router.get(
  "/students/:studentId/bills",
  auth,
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const student = await verifyParentStudentRelation(req.user._id, req.params.studentId);
      if (!student) {
        return res.status(403).json({ message: "Access Denied: Student not linked to parent account." });
      }

      const query = {
        schoolId,
        studentId: req.params.studentId,
        status: { $ne: "DRAFT" }, // Hide DRAFT bills from parents
      };

      if (req.query.academicYear) query.academicYear = req.query.academicYear;
      if (req.query.term) query.term = parseInt(req.query.term, 10);

      const bills = await StudentBill.find(query).sort({ createdAt: -1 });
      res.json(bills);
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/parent-portal/students/:studentId/bills/:billId
// @desc    Get a single bill with line items and payment transactions
router.get(
  "/students/:studentId/bills/:billId",
  auth,
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const student = await verifyParentStudentRelation(req.user._id, req.params.studentId);
      if (!student) {
        return res.status(403).json({ message: "Access Denied: Student not linked to parent account." });
      }

      const bill = await StudentBill.findOne({
        _id: req.params.billId,
        schoolId,
        studentId: req.params.studentId,
        status: { $ne: "DRAFT" },
      });

      if (!bill) {
        return res.status(404).json({ message: "Bill not found" });
      }

      // Fetch payment transactions against this bill
      const payments = await Payment.find({
        schoolId,
        billId: bill._id,
      }).sort({ paymentDate: -1 });

      res.json({ bill, payments });
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/parent-portal/students/:studentId/bills/:billId/pdf
// @desc    Download student bill PDF
router.get(
  "/students/:studentId/bills/:billId/pdf",
  auth,
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const student = await verifyParentStudentRelation(req.user._id, req.params.studentId);
      if (!student) {
        return res.status(403).json({ message: "Access Denied" });
      }

      const bill = await StudentBill.findOne({
        _id: req.params.billId,
        schoolId,
        studentId: req.params.studentId,
        status: { $ne: "DRAFT" },
      });

      if (!bill) {
        return res.status(404).json({ message: "Bill not found" });
      }

      const school = await SchoolProfile.findById(schoolId);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=bill-${bill._id.toString().substring(18).toUpperCase()}.pdf`
      );

      generateBillPDF(res, bill, school || {}, student);
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/parent-portal/payments/:paymentId/receipt/pdf
// @desc    Download payment receipt PDF
router.get(
  "/payments/:paymentId/receipt/pdf",
  auth,
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const payment = await Payment.findOne({
        _id: req.params.paymentId,
        schoolId,
      });

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const student = await verifyParentStudentRelation(req.user._id, payment.studentId);
      if (!student) {
        return res.status(403).json({ message: "Access Denied" });
      }

      const school = await SchoolProfile.findById(schoolId);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=receipt-${payment.receiptNumber}.pdf`
      );

      generateReceiptPDF(res, payment, school || {}, student);
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/parent-portal/students/:studentId/attendance
// @desc    Get attendance summary + monthly calendar for a linked student
router.get(
  "/students/:studentId/attendance",
  auth,
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const student = await verifyParentStudentRelation(req.user._id, req.params.studentId);
      if (!student) return res.status(403).json({ message: "Access Denied: Student not linked to parent account." });

      const { academicYear, term } = req.query;
      const query = { schoolId, studentId: req.params.studentId };
      if (academicYear) query.academicYear = academicYear;
      if (term) query.term = parseInt(term, 10);

      // Try GhanaAttendance model (may have per-student records)
      let attendanceRecords = [];
      try {
        attendanceRecords = await GhanaAttendance.find(query).sort({ date: 1 }).lean();
      } catch (_) {}

      // Compute summary
      const totalDays = attendanceRecords.length;
      const presentDays = attendanceRecords.filter(r => r.status === "Present" || r.present === true).length;
      const absentDays = totalDays - presentDays;
      const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null;

      res.json({
        studentId: req.params.studentId,
        summary: { totalDays, presentDays, absentDays, attendancePct },
        records: attendanceRecords,
      });
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/parent-portal/students/:studentId/results
// @desc    Get released report cards for a linked student
router.get(
  "/students/:studentId/results",
  auth,
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const student = await verifyParentStudentRelation(req.user._id, req.params.studentId);
      if (!student) return res.status(403).json({ message: "Access Denied: Student not linked to parent account." });

      // Only released report cards are visible to parents
      const query = { schoolId, studentId: req.params.studentId };

      let reportCards = [];
      try {
        // GhanaReportCard may have a 'released' or 'status' field
        reportCards = await GhanaReportCard.find({
          ...query,
          $or: [{ released: true }, { status: "RELEASED" }],
        })
          .sort({ createdAt: -1 })
          .lean();
      } catch (_) {}

      res.json(reportCards);
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/parent-portal/notices
// @desc    List school announcements published to parents
router.get(
  "/notices",
  auth,
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const { page = 1, pageSize = 20 } = req.query;
      const skip = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

      let notices = [];
      try {
        notices = await GhanaAnnouncement.find({
          schoolId,
          $or: [
            { targetAudience: { $in: ["parents", "all", "PARENTS", "ALL"] } },
            { isPublic: true },
          ],
          isActive: { $ne: false },
        })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(pageSize, 10))
          .lean();
      } catch (_) {}

      res.json(notices);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
