const express = require("express");
const { body, validationResult } = require("express-validator");
const PromotionEngine = require("../models/PromotionEngine");
const GhanaStudent = require("../models/GhanaStudent");
const GhanaClass = require("../models/GhanaClass");
const GhanaReportCard = require("../models/GhanaReportCard");
const GhanaAttendance = require("../models/GhanaAttendance");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const User = require("../models/User");
const { auth, authorizeRoles } = require("../middleware/auth");
const { rbac } = require("../middleware/rbac");

const router = express.Router();

// ============= PROMOTION ENGINE SETUP =============

// Create promotion engine for academic period
router.post(
  "/create",
  auth,
  rbac("academic", "managePromotions"),
  [
    body("academicYearId").isMongoId().withMessage("Valid academic year ID required"),
    body("termId").isMongoId().withMessage("Valid term ID required"),
    body("promotionSettings.minimumAverageScore").isInt({ min: 0, max: 100 }),
    body("promotionSettings.minimumGPA").isFloat({ min: 0, max: 4.0 }),
    body("promotionSettings.maximumFailedSubjects").isInt({ min: 0 }),
    body("promotionSettings.minimumAttendanceRate").isInt({ min: 0, max: 100 }),
    body("promotionSettings.minimumConductGrade").isIn(["Excellent", "Very Good", "Good", "Fair"]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { academicYearId, termId, promotionSettings } = req.body;

      // Verify academic year and term
      const academicYear = await AcademicYear.findById(academicYearId);
      const term = await Term.findById(termId);
      
      if (!academicYear || !term) {
        return res.status(404).json({ message: "Academic year or term not found" });
      }

      // Check if promotion engine already exists for this period
      const existingEngine = await PromotionEngine.findOne({
        academicYear: academicYearId,
        term: termId,
      });

      if (existingEngine) {
        return res.status(400).json({ 
          message: "Promotion engine already exists for this academic period" 
        });
      }

      // Create promotion engine
      const engine = await PromotionEngine.createPromotionEngine(
        academicYearId,
        termId,
        promotionSettings,
        req.user._id
      );

      const populatedEngine = await PromotionEngine.findById(engine._id)
        .populate("academicYear", "name")
        .populate("term", "name")
        .populate("createdBy", "firstName lastName");

      res.status(201).json({
        message: "Promotion engine created successfully",
        engine: populatedEngine,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get promotion engines
router.get(
  "/",
  auth,
  rbac("academic", "read"),
  async (req, res) => {
    try {
      const { academicYearId, termId, status } = req.query;
      
      const filter = {};
      if (academicYearId) filter.academicYear = academicYearId;
      if (termId) filter.term = termId;
      if (status) filter.status = status;

      const engines = await PromotionEngine.find(filter)
        .populate("academicYear", "name")
        .populate("term", "name")
        .populate("createdBy", "firstName lastName")
        .populate("lastModifiedBy", "firstName lastName")
        .sort({ createdAt: -1 });

      res.json(engines);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= PROMOTION EVALUATION =============

// Run promotion evaluation for a class
router.post(
  "/evaluate-class/:classId",
  auth,
  rbac("academic", "managePromotions"),
  [
    body("engineId").isMongoId().withMessage("Valid promotion engine ID required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { classId, engineId } = req.params;

      // Verify class exists
      const classInfo = await GhanaClass.findById(classId);
      if (!classInfo) {
        return res.status(404).json({ message: "Class not found" });
      }

      // Verify promotion engine exists
      const engine = await PromotionEngine.findById(engineId);
      if (!engine) {
        return res.status(404).json({ message: "Promotion engine not found" });
      }

      // Check if engine can be modified
      if (engine.status === "Archived") {
        return res.status(400).json({ message: "Cannot evaluate archived promotion engine" });
      }

      // Update engine status
      engine.status = "In Progress";
      engine.lastModifiedBy = req.user._id;
      await engine.save();

      // Run class promotion
      const results = await engine.runClassPromotion(classId, engine.promotionSettings);

      res.json({
        message: "Class promotion evaluation completed",
        engineId: engine._id,
        results,
        summary: engine.summary,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Run promotion evaluation for entire school
router.post(
  "/evaluate-school",
  auth,
  rbac("academic", "managePromotions"),
  [
    body("engineId").isMongoId().withMessage("Valid promotion engine ID required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { engineId } = req.body;

      // Verify promotion engine exists
      const engine = await PromotionEngine.findById(engineId);
      if (!engine) {
        return res.status(404).json({ message: "Promotion engine not found" });
      }

      // Check if engine can be modified
      if (engine.status === "Archived") {
        return res.status(400).json({ message: "Cannot evaluate archived promotion engine" });
      }

      // Update engine status
      engine.status = "In Progress";
      engine.lastModifiedBy = req.user._id;
      await engine.save();

      // Get all classes
      const classes = await GhanaClass.find({ status: "Active" });
      
      const allResults = {
        successful: [],
        failed: [],
        summary: {
          totalClasses: classes.length,
          totalStudents: 0,
          evaluated: 0,
          errors: 0,
        },
      };

      // Run promotion for each class
      for (const classInfo of classes) {
        try {
          const classResults = await engine.runClassPromotion(
            classInfo._id,
            engine.promotionSettings
          );

          allResults.successful.push({
            classId: classInfo._id,
            className: classInfo.name,
            results: classResults,
          });

          allResults.summary.evaluated += classResults.length;
        } catch (err) {
          allResults.failed.push({
            classId: classInfo._id,
            className: classInfo.name,
            error: err.message,
          });
          allResults.summary.errors++;
        }
      }

      // Update final summary
      engine.summary.totalStudents = allResults.summary.evaluated;
      engine.summary.promoted = engine.promotionResults.filter(r => r.promotionDecision.promoted).length;
      engine.summary.retained = engine.summary.totalStudents - engine.summary.promoted;
      engine.summary.promotionRate = engine.summary.totalStudents > 0 
        ? Math.round((engine.summary.promoted / engine.summary.totalStudents) * 100)
        : 0;

      engine.status = "Under Review";
      engine.lastModifiedBy = req.user._id;
      await engine.save();

      res.json({
        message: "School-wide promotion evaluation completed",
        engineId: engine._id,
        results: allResults,
        summary: engine.summary,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get promotion results for a student
router.get(
  "/results/:studentId",
  auth,
  rbac("academic", "read"),
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const { academicYearId, termId } = req.query;

      // Check access permissions
      if (req.user.role === "parent") {
        const student = await GhanaStudent.findOne({
          _id: studentId,
          "guardians.userId": req.user._id,
        });
        
        if (!student) {
          return res.status(403).json({ message: "Not authorized to view this student's promotion results" });
        }
      } else if (req.user.role === "student") {
        if (studentId !== req.user._id.toString()) {
          return res.status(403).json({ message: "Not authorized to view these promotion results" });
        }
      }

      const filter = { "promotionResults.student": studentId };
      if (academicYearId) filter.academicYear = academicYearId;
      if (termId) filter.term = termId;

      const engines = await PromotionEngine.find(filter)
        .populate("academicYear", "name")
        .populate("term", "name")
        .populate("promotionResults.currentClass", "name level section")
        .populate("promotionResults.nextClass", "name level section")
        .populate("promotionResults.evaluatedBy", "firstName lastName")
        .sort({ createdAt: -1 });

      const promotionHistory = engines.map(engine => ({
        academicYear: engine.academicYear.name,
        term: engine.term.name,
        evaluatedAt: engine.createdAt,
        result: engine.promotionResults.find(r => r.student.toString() === studentId),
      }));

      res.json({
        student: await GhanaStudent.findById(studentId, "firstName lastName studentId currentLevel"),
        promotionHistory,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get promotion results for a class
router.get(
  "/results/class/:classId/:engineId",
  auth,
  rbac("academic", "read"),
  async (req, res) => {
    try {
      const { classId, engineId } = req.params;

      const engine = await PromotionEngine.findById(engineId)
        .populate("academicYear", "name")
        .populate("term", "name")
        .populate("promotionResults.student", "firstName lastName studentId")
        .populate("promotionResults.currentClass", "name level section")
        .populate("promotionResults.nextClass", "name level section");

      if (!engine) {
        return res.status(404).json({ message: "Promotion engine not found" });
      }

      const classResults = engine.promotionResults.filter(
        result => result.currentClass.toString() === classId
      );

      const classInfo = await GhanaClass.findById(classId, "name level section");

      res.json({
        class: classInfo,
        academicYear: engine.academicYear,
        term: engine.term,
        results: classResults,
        summary: {
          totalStudents: classResults.length,
          promoted: classResults.filter(r => r.promotionDecision.promoted).length,
          retained: classResults.filter(r => !r.promotionDecision.promoted).length,
          conditional: classResults.filter(r => r.promotionDecision.promotionType === "Conditional").length,
          promotionRate: classResults.length > 0 
            ? Math.round((classResults.filter(r => r.promotionDecision.promoted).length / classResults.length) * 100)
            : 0,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= APPROVAL WORKFLOW =============

// Review promotion results
router.post(
  "/review/:engineId",
  auth,
  rbac("academic", "approve"),
  [
    body("action").isIn(["approve", "reject"]).withMessage("Valid action required"),
    body("studentIds").isArray().withMessage("Student IDs array required"),
    body("rejectionReason").optional().trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { engineId } = req.params;
      const { action, studentIds, rejectionReason } = req.body;

      const engine = await PromotionEngine.findById(engineId);
      if (!engine) {
        return res.status(404).json({ message: "Promotion engine not found" });
      }

      if (engine.status !== "Under Review") {
        return res.status(400).json({ 
          message: `Cannot review promotion engine in ${engine.status} status` 
        });
      }

      const results = {
        successful: [],
        failed: [],
      };

      for (const studentId of studentIds) {
        try {
          const resultIndex = engine.promotionResults.findIndex(
            r => r.student.toString() === studentId
          );

          if (resultIndex === -1) {
            results.failed.push({
              studentId,
              error: "Student not found in promotion results",
            });
            continue;
          }

          const result = engine.promotionResults[resultIndex];

          if (action === "approve") {
            result.approval.status = "Approved";
            result.approval.approvedBy = req.user._id;
            result.approval.approvedAt = new Date();
          } else {
            result.approval.status = "Rejected";
            result.approval.rejectionReason = rejectionReason;
            result.approval.reviewedBy = req.user._id;
            result.approval.reviewedAt = new Date();
            
            // Override promotion decision if rejected
            result.promotionDecision.promoted = false;
            result.promotionDecision.promotionType = "Retained";
          }

          results.successful.push({
            studentId,
            action,
            status: result.approval.status,
          });
        } catch (err) {
          results.failed.push({
            studentId,
            error: err.message,
          });
        }
      }

      engine.lastModifiedBy = req.user._id;
      await engine.save();

      res.json({
        message: `Promotion results ${action}d successfully`,
        results,
        summary: {
          total: studentIds.length,
          successful: results.successful.length,
          failed: results.failed.length,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Approve entire promotion engine
router.post(
  "/approve/:engineId",
  auth,
  rbac("academic", "approve"),
  async (req, res) => {
    try {
      const { engineId } = req.params;

      const engine = await PromotionEngine.findById(engineId);
      if (!engine) {
        return res.status(404).json({ message: "Promotion engine not found" });
      }

      if (engine.status !== "Under Review") {
        return res.status(400).json({ 
          message: `Cannot approve promotion engine in ${engine.status} status` 
        });
      }

      // Approve all pending results
      engine.promotionResults.forEach(result => {
        if (result.approval.status === "Pending") {
          result.approval.status = "Approved";
          result.approval.approvedBy = req.user._id;
          result.approval.approvedAt = new Date();
        }
      });

      engine.status = "Approved";
      engine.lastModifiedBy = req.user._id;
      await engine.save();

      res.json({
        message: "Promotion engine approved successfully",
        engineId: engine._id,
        summary: engine.summary,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= PROMOTION IMPLEMENTATION =============

// Implement promotion decisions
router.post(
  "/implement/:engineId",
  auth,
  rbac("academic", "managePromotions"),
  [
    body("studentIds").isArray().withMessage("Student IDs array required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { engineId } = req.params;
      const { studentIds } = req.body;

      const engine = await PromotionEngine.findById(engineId);
      if (!engine) {
        return res.status(404).json({ message: "Promotion engine not found" });
      }

      if (engine.status !== "Approved") {
        return res.status(400).json({ 
          message: `Cannot implement promotions for engine in ${engine.status} status` 
        });
      }

      const results = {
        successful: [],
        failed: [],
      };

      for (const studentId of studentIds) {
        try {
          const resultIndex = engine.promotionResults.findIndex(
            r => r.student.toString() === studentId
          );

          if (resultIndex === -1) {
            results.failed.push({
              studentId,
              error: "Student not found in promotion results",
            });
            continue;
          }

          const result = engine.promotionResults[resultIndex];

          if (!result.promotionDecision.promoted) {
            results.failed.push({
              studentId,
              error: "Student not promoted",
            });
            continue;
          }

          // Update student's class
          const student = await GhanaStudent.findById(studentId);
          if (student) {
            student.currentClass = result.promotionDecision.nextClass;
            student.currentLevel = result.promotionDecision.nextLevel;
            student.lastModifiedBy = req.user._id;
            await student.save();
          }

          // Update implementation tracking
          result.implementation.promotedOn = new Date();
          result.implementation.newClassAssigned = true;
          result.implementation.recordsUpdated = true;

          results.successful.push({
            studentId,
            previousClass: result.currentClass,
            newClass: result.promotionDecision.nextClass,
          });
        } catch (err) {
          results.failed.push({
            studentId,
            error: err.message,
          });
        }
      }

      engine.status = "Implemented";
      engine.lastModifiedBy = req.user._id;
      await engine.save();

      res.json({
        message: "Promotion implementation completed",
        results,
        summary: {
          total: studentIds.length,
          successful: results.successful.length,
          failed: results.failed.length,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= PARENTAL CONSENT =============

// Submit parental consent
router.post(
  "/parental-consent/:studentId/:engineId",
  auth,
  rbac("student", "viewOwn"),
  [
    body("consentGiven").isBoolean().withMessage("Consent decision required"),
    body("method").isIn(["Written", "Electronic", "Verbal"]).withMessage("Consent method required"),
    body("notes").optional().trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { studentId, engineId } = req.params;
      const { consentGiven, method, notes } = req.body;

      // Verify parent authorization
      const student = await GhanaStudent.findOne({
        _id: studentId,
        "guardians.userId": req.user._id,
      });

      if (!student) {
        return res.status(403).json({ message: "Not authorized for this student" });
      }

      const engine = await PromotionEngine.findById(engineId);
      if (!engine) {
        return res.status(404).json({ message: "Promotion engine not found" });
      }

      const resultIndex = engine.promotionResults.findIndex(
        r => r.student.toString() === studentId
      );

      if (resultIndex === -1) {
        return res.status(404).json({ message: "Promotion result not found for this student" });
      }

      const result = engine.promotionResults[resultIndex];

      // Update parental consent
      result.approval.parentalConsent.given = consentGiven;
      result.approval.parentalConsent.givenBy = req.user._id;
      result.approval.parentalConsent.givenAt = new Date();
      result.approval.parentalConsent.method = method;

      if (notes) {
        result.notes = notes;
      }

      engine.lastModifiedBy = req.user._id;
      await engine.save();

      res.json({
        message: "Parental consent submitted successfully",
        consent: {
          given: consentGiven,
          method,
          givenAt: result.approval.parentalConsent.givenAt,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= ARCHIVAL AND REPORTS =============

// Archive promotion engine
router.post(
  "/archive/:engineId",
  auth,
  rbac("academic", "managePromotions"),
  [
    body("reason").trim().isLength({ min: 10, max: 500 }).withMessage("Archive reason required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { engineId } = req.params;
      const { reason } = req.body;

      const engine = await PromotionEngine.findById(engineId);
      if (!engine) {
        return res.status(404).json({ message: "Promotion engine not found" });
      }

      if (engine.status === "Archived") {
        return res.status(400).json({ message: "Promotion engine already archived" });
      }

      engine.status = "Archived";
      engine.archiveInfo.archivedBy = req.user._id;
      engine.archiveInfo.archivedAt = new Date();
      engine.archiveInfo.archiveReason = reason;
      engine.archiveInfo.isLocked = true;
      engine.lastModifiedBy = req.user._id;

      await engine.save();

      res.json({
        message: "Promotion engine archived successfully",
        engine,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Generate promotion report
router.get(
  "/report/:engineId",
  auth,
  rbac("academic", "read"),
  async (req, res) => {
    try {
      const { engineId } = req.params;
      const { format } = req.query;

      const engine = await PromotionEngine.findById(engineId)
        .populate("academicYear", "name")
        .populate("term", "name")
        .populate("promotionResults.student", "firstName lastName studentId")
        .populate("promotionResults.currentClass", "name level section")
        .populate("promotionResults.nextClass", "name level section")
        .populate("promotionResults.evaluatedBy", "firstName lastName");

      if (!engine) {
        return res.status(404).json({ message: "Promotion engine not found" });
      }

      // Generate comprehensive report data
      const reportData = {
        period: {
          academicYear: engine.academicYear,
          term: engine.term,
        },
        settings: engine.promotionSettings,
        summary: engine.summary,
        results: engine.promotionResults.map(result => ({
          student: result.student,
          currentClass: result.currentClass,
          nextClass: result.nextClass,
          promotionDecision: result.promotionDecision,
          academicEvaluation: result.academicEvaluation,
          attendanceEvaluation: result.attendanceEvaluation,
          conductEvaluation: result.conductEvaluation,
          approval: result.approval,
          implementation: result.implementation,
        })),
        generatedAt: new Date(),
        generatedBy: `${req.user.firstName} ${req.user.lastName}`,
      };

      if (format === "csv") {
        // Generate CSV (placeholder - would use a CSV library)
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="promotion-report-${engineId}.csv"`);
        return res.json({ message: "CSV generation would be implemented here", data: reportData });
      }

      res.json(reportData);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

module.exports = router;
