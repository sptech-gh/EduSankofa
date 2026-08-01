const express = require("express");
const { body, validationResult } = require("express-validator");
const GhanaReportCard = require("../models/GhanaReportCard");
const GhanaStudent = require("../models/GhanaStudent");
const GhanaClass = require("../models/GhanaClass");
const GhanaSubject = require("../models/GhanaSubject");
const GhanaAttendance = require("../models/GhanaAttendance");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const User = require("../models/User");
const { auth, authorizeRoles } = require("../middleware/auth");
const { rbac } = require("../middleware/rbac");

const router = express.Router();

// ============= SCORE ENTRY =============

// Enter subject scores for a student
router.post(
  "/enter-scores",
  auth,
  rbac("academic", "update"),
  [
    body("studentId").isMongoId().withMessage("Valid student ID is required"),
    body("academicYearId").isMongoId().withMessage("Valid academic year ID is required"),
    body("termId").isMongoId().withMessage("Valid term ID is required"),
    body("subjectId").isMongoId().withMessage("Valid subject ID is required"),
    body("continuousAssessment.classWork.score").isInt({ min: 0, max: 20 }).withMessage("Class work score must be 0-20"),
    body("continuousAssessment.assignments.score").isInt({ min: 0, max: 10 }).withMessage("Assignment score must be 0-10"),
    body("continuousAssessment.tests.score").isInt({ min: 0, max: 10 }).withMessage("Test score must be 0-10"),
    body("continuousAssessment.projects.score").optional().isInt({ min: 0, max: 40 }).withMessage("Project score must be 0-40"),
    body("examination.score").isInt({ min: 0, max: 60 }).withMessage("Exam score must be 0-60"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        studentId,
        academicYearId,
        termId,
        subjectId,
        continuousAssessment,
        examination,
        remarks,
      } = req.body;

      // Verify student exists and is enrolled
      const student = await GhanaStudent.findById(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Verify academic year and term
      const academicYear = await AcademicYear.findById(academicYearId);
      const term = await Term.findById(termId);
      if (!academicYear || !term) {
        return res.status(404).json({ message: "Academic year or term not found" });
      }

      // Verify subject
      const subject = await GhanaSubject.findById(subjectId);
      if (!subject) {
        return res.status(404).json({ message: "Subject not found" });
      }

      // Check if teacher is assigned to this class
      if (req.user.role === "teacher") {
        const isAssigned = await GhanaClass.findOne({
          _id: student.currentClass,
          $or: [
            { classTeacher: req.user._id },
            { assistantTeachers: req.user._id }
          ]
        });
        
        if (!isAssigned) {
          return res.status(403).json({ message: "Not authorized to enter scores for this class" });
        }
      }

      // Find or create report card
      let reportCard = await GhanaReportCard.findOne({
        student: studentId,
        academicYear: academicYearId,
        term: termId,
      });

      if (!reportCard) {
        reportCard = new GhanaReportCard({
          student: studentId,
          academicYear: academicYearId,
          term: termId,
          class: student.currentClass,
          termName: term.name,
          generatedBy: req.user._id,
          studentName: `${student.firstName} ${student.lastName}`,
          studentId: student.studentId,
          className: (await GhanaClass.findById(student.currentClass))?.name || "",
          academicYearName: academicYear.name,
          termNumber: term.order,
        });
      }

      // Check if report card can be edited
      if (!reportCard.canEdit()) {
        return res.status(400).json({ 
          message: `Report card cannot be edited in ${reportCard.status} status` 
        });
      }

      // Find existing subject entry or create new one
      const subjectIndex = reportCard.subjects.findIndex(
        s => s.subject.toString() === subjectId
      );

      const subjectData = {
        subject: subjectId,
        subjectName: subject.name,
        subjectCode: subject.code,
        continuousAssessment: {
          classWork: {
            score: continuousAssessment.classWork.score || 0,
            weight: 20,
            remarks: continuousAssessment.classWork.remarks || "",
          },
          assignments: {
            score: continuousAssessment.assignments.score || 0,
            weight: 10,
            remarks: continuousAssessment.assignments.remarks || "",
          },
          tests: {
            score: continuousAssessment.tests.score || 0,
            weight: 10,
            remarks: continuousAssessment.tests.remarks || "",
          },
          projects: {
            score: continuousAssessment.projects?.score || 0,
            weight: 0,
            remarks: continuousAssessment.projects?.remarks || "",
          },
        },
        examination: {
          score: examination.score || 0,
          weight: 60,
          remarks: examination.remarks || "",
        },
        remarks: remarks || "",
        subjectTeacher: req.user._id,
        teacherName: `${req.user.firstName} ${req.user.lastName}`,
      };

      if (subjectIndex >= 0) {
        // Update existing subject
        reportCard.subjects[subjectIndex] = {
          ...reportCard.subjects[subjectIndex],
          ...subjectData,
        };
      } else {
        // Add new subject
        reportCard.subjects.push(subjectData);
      }

      reportCard.lastModifiedBy = req.user._id;
      await reportCard.save();

      const populatedReportCard = await GhanaReportCard.findById(reportCard._id)
        .populate("student", "firstName lastName studentId")
        .populate("academicYear", "name")
        .populate("term", "name")
        .populate("class", "name level section")
        .populate("subjects.subject", "name code");

      res.json({
        message: "Scores entered successfully",
        reportCard: populatedReportCard,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Bulk score entry for entire class
router.post(
  "/bulk-enter-scores",
  auth,
  rbac("academic", "update"),
  [
    body("classId").isMongoId().withMessage("Valid class ID is required"),
    body("academicYearId").isMongoId().withMessage("Valid academic year ID is required"),
    body("termId").isMongoId().withMessage("Valid term ID is required"),
    body("subjectId").isMongoId().withMessage("Valid subject ID is required"),
    body("scores").isArray({ min: 1 }).withMessage("Scores array is required"),
    body("scores.*.studentId").isMongoId().withMessage("Valid student ID required"),
    body("scores.*.continuousAssessment.classWork.score").isInt({ min: 0, max: 20 }),
    body("scores.*.examination.score").isInt({ min: 0, max: 60 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { classId, academicYearId, termId, subjectId, scores } = req.body;

      // Verify class exists
      const classInfo = await GhanaClass.findById(classId).populate("students");
      if (!classInfo) {
        return res.status(404).json({ message: "Class not found" });
      }

      // Verify teacher authorization
      if (req.user.role === "teacher") {
        const isAssigned = await GhanaClass.findOne({
          _id: classId,
          $or: [
            { classTeacher: req.user._id },
            { assistantTeachers: req.user._id }
          ]
        });
        
        if (!isAssigned) {
          return res.status(403).json({ message: "Not authorized for this class" });
        }
      }

      const results = {
        successful: [],
        failed: [],
      };

      for (const scoreData of scores) {
        try {
          // Create or update report card for each student
          let reportCard = await GhanaReportCard.findOne({
            student: scoreData.studentId,
            academicYear: academicYearId,
            term: termId,
          });

          if (!reportCard) {
            const student = await GhanaStudent.findById(scoreData.studentId);
            const academicYear = await AcademicYear.findById(academicYearId);
            const term = await Term.findById(termId);
            const subject = await GhanaSubject.findById(subjectId);

            reportCard = new GhanaReportCard({
              student: scoreData.studentId,
              academicYear: academicYearId,
              term: termId,
              class: classId,
              termName: term.name,
              generatedBy: req.user._id,
              studentName: `${student.firstName} ${student.lastName}`,
              studentId: student.studentId,
              className: classInfo.name,
              academicYearName: academicYear.name,
              termNumber: term.order,
            });
          }

          if (!reportCard.canEdit()) {
            results.failed.push({
              studentId: scoreData.studentId,
              error: `Report card in ${reportCard.status} status`,
            });
            continue;
          }

          // Update subject scores
          const subjectIndex = reportCard.subjects.findIndex(
            s => s.subject.toString() === subjectId
          );

          const subjectData = {
            subject: subjectId,
            subjectName: (await GhanaSubject.findById(subjectId))?.name || "",
            continuousAssessment: scoreData.continuousAssessment,
            examination: scoreData.examination,
            remarks: scoreData.remarks || "",
            subjectTeacher: req.user._id,
            teacherName: `${req.user.firstName} ${req.user.lastName}`,
          };

          if (subjectIndex >= 0) {
            reportCard.subjects[subjectIndex] = {
              ...reportCard.subjects[subjectIndex],
              ...subjectData,
            };
          } else {
            reportCard.subjects.push(subjectData);
          }

          reportCard.lastModifiedBy = req.user._id;
          await reportCard.save();

          results.successful.push({
            studentId: scoreData.studentId,
            reportCardId: reportCard._id,
          });
        } catch (err) {
          results.failed.push({
            studentId: scoreData.studentId,
            error: err.message,
          });
        }
      }

      res.json({
        message: "Bulk score entry completed",
        results,
        summary: {
          total: scores.length,
          successful: results.successful.length,
          failed: results.failed.length,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= APPROVAL WORKFLOW =============

// Submit report card for review
router.post(
  "/:reportCardId/submit",
  auth,
  rbac("academic", "update"),
  async (req, res) => {
    try {
      const { reportCardId } = req.params;

      const reportCard = await GhanaReportCard.findById(reportCardId);
      if (!reportCard) {
        return res.status(404).json({ message: "Report card not found" });
      }

      if (reportCard.status !== "Draft") {
        return res.status(400).json({ 
          message: `Cannot submit report card in ${reportCard.status} status` 
        });
      }

      // Verify all subjects have scores
      if (reportCard.subjects.length === 0) {
        return res.status(400).json({ 
          message: "Cannot submit report card without subject scores" 
        });
      }

      reportCard.status = "Submitted";
      reportCard.approval.submittedBy = req.user._id;
      reportCard.approval.submittedAt = new Date();
      reportCard.lastModifiedBy = req.user._id;

      await reportCard.save();

      res.json({
        message: "Report card submitted for review",
        reportCard,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Approve report card
router.post(
  "/:reportCardId/approve",
  auth,
  rbac("academic", "approve"),
  [
    body("action").isIn(["approve", "reject"]).withMessage("Valid action required"),
    body("remarks").optional().trim().isLength({ max: 500 }).withMessage("Remarks too long"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reportCardId } = req.params;
      const { action, remarks } = req.body;

      const reportCard = await GhanaReportCard.findById(reportCardId);
      if (!reportCard) {
        return res.status(404).json({ message: "Report card not found" });
      }

      if (!reportCard.canApprove()) {
        return res.status(400).json({ 
          message: `Cannot approve report card in ${reportCard.status} status` 
        });
      }

      if (action === "approve") {
        reportCard.status = "Approved";
        reportCard.approval.approvedBy = req.user._id;
        reportCard.approval.approvedAt = new Date();
        
        // Calculate class positions
        await GhanaReportCard.calculateClassPositions(
          reportCard.class,
          reportCard.academicYear,
          reportCard.term
        );
      } else {
        reportCard.status = "Draft";
        reportCard.approval.reviewedBy = req.user._id;
        reportCard.approval.reviewedAt = new Date();
      }

      reportCard.lastModifiedBy = req.user._id;
      await reportCard.save();

      res.json({
        message: `Report card ${action}d successfully`,
        reportCard,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Publish report card
router.post(
  "/:reportCardId/publish",
  auth,
  rbac("academic", "approve"),
  async (req, res) => {
    try {
      const { reportCardId } = req.params;

      const reportCard = await GhanaReportCard.findById(reportCardId);
      if (!reportCard) {
        return res.status(404).json({ message: "Report card not found" });
      }

      if (!["Draft", "Approved"].includes(reportCard.status)) {
        return res.status(400).json({
          message: `Only draft or approved report cards can be published (current: ${reportCard.status})`,
        });
      }

      reportCard.status = "Published";
      reportCard.approval.publishedBy = req.user._id;
      reportCard.approval.publishedAt = new Date();
      reportCard.lastModifiedBy = req.user._id;

      await reportCard.save();

      res.json({
        message: "Report card published successfully",
        reportCard,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Lock report card (prevent further editing)
router.post(
  "/:reportCardId/lock",
  auth,
  rbac("academic", "approve"),
  async (req, res) => {
    try {
      const { reportCardId } = req.params;

      const reportCard = await GhanaReportCard.findById(reportCardId);
      if (!reportCard) {
        return res.status(404).json({ message: "Report card not found" });
      }

      if (reportCard.status !== "Published") {
        return res.status(400).json({ 
          message: "Only published report cards can be locked" 
        });
      }

      await reportCard.lock(req.user._id);

      res.json({
        message: "Report card locked successfully",
        reportCard,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= CLASS-WIDE OPERATIONS =============

// Generate report cards for entire class
router.post(
  "/generate-class",
  auth,
  rbac("academic", "create"),
  [
    body("classId").isMongoId().withMessage("Valid class ID is required"),
    body("academicYearId").isMongoId().withMessage("Valid academic year ID is required"),
    body("termId").isMongoId().withMessage("Valid term ID is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { classId, academicYearId, termId } = req.body;

      // Verify class exists
      const classInfo = await GhanaClass.findById(classId).populate("students");
      if (!classInfo) {
        return res.status(404).json({ message: "Class not found" });
      }

      // Verify authorization
      if (req.user.role === "teacher") {
        const isAssigned = await GhanaClass.findOne({
          _id: classId,
          $or: [
            { classTeacher: req.user._id },
            { subjectTeachers: req.user._id }
          ]
        });
        
        if (!isAssigned) {
          return res.status(403).json({ message: "Not authorized for this class" });
        }
      }

      const results = {
        successful: [],
        failed: [],
      };

      for (const student of classInfo.students) {
        try {
          // Check if report card already exists
          const existingCard = await GhanaReportCard.findOne({
            student: student._id,
            academicYear: academicYearId,
            term: termId,
          });

          if (existingCard) {
            results.failed.push({
              studentId: student._id,
              error: "Report card already exists",
            });
            continue;
          }

          // Create new report card
          const academicYear = await AcademicYear.findById(academicYearId);
          const term = await Term.findById(termId);

          const reportCard = new GhanaReportCard({
            student: student._id,
            academicYear: academicYearId,
            term: termId,
            class: classId,
            termName: term.name,
            generatedBy: req.user._id,
            studentName: `${student.firstName} ${student.lastName}`,
            studentId: student.studentId,
            className: classInfo.name,
            academicYearName: academicYear.name,
            termNumber: term.order,
          });

          await reportCard.save();
          results.successful.push({
            studentId: student._id,
            reportCardId: reportCard._id,
          });
        } catch (err) {
          results.failed.push({
            studentId: student._id,
            error: err.message,
          });
        }
      }

      res.json({
        message: "Class report cards generated",
        results,
        summary: {
          total: classInfo.students.length,
          successful: results.successful.length,
          failed: results.failed.length,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Publish all report cards for a class
router.post(
  "/publish-class",
  auth,
  rbac("academic", "approve"),
  [
    body("classId").isMongoId().withMessage("Valid class ID is required"),
    body("academicYearId").isMongoId().withMessage("Valid academic year ID is required"),
    body("termId").isMongoId().withMessage("Valid term ID is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { classId, academicYearId, termId } = req.body;

      const reportCards = await GhanaReportCard.find({
        class: classId,
        academicYear: academicYearId,
        term: termId,
        status: { $in: ["Draft", "Approved"] },
      });

      const results = {
        successful: [],
        failed: [],
      };

      for (const reportCard of reportCards) {
        try {
          reportCard.status = "Published";
          reportCard.approval.publishedBy = req.user._id;
          reportCard.approval.publishedAt = new Date();
          await reportCard.save();

          results.successful.push({
            reportCardId: reportCard._id,
            studentId: reportCard.student,
          });
        } catch (err) {
          results.failed.push({
            reportCardId: reportCard._id,
            error: err.message,
          });
        }
      }

      // Calculate class positions after publishing
      await GhanaReportCard.calculateClassPositions(classId, academicYearId, termId);

      res.json({
        message: "Class report cards published",
        results,
        summary: {
          total: reportCards.length,
          successful: results.successful.length,
          failed: results.failed.length,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= REPORT CARD RETRIEVAL =============

// Get report card by ID
router.get(
  "/:reportCardId",
  auth,
  async (req, res) => {
    try {
      const { reportCardId } = req.params;

      const reportCard = await GhanaReportCard.findById(reportCardId)
        .populate("student", "firstName lastName studentId dateOfBirth gender")
        .populate("academicYear", "name")
        .populate("term", "name")
        .populate("class", "name level section")
        .populate("subjects.subject", "name code")
        .populate("subjects.subjectTeacher", "firstName lastName")
        .populate("generatedBy", "firstName lastName")
        .populate("lastModifiedBy", "firstName lastName");

      if (!reportCard) {
        return res.status(404).json({ message: "Report card not found" });
      }

      // Check access permissions
      if (req.user.role === "parent") {
        // Parent can only view their children's report cards
        const student = await GhanaStudent.findOne({
          _id: reportCard.student._id,
          "guardians.userId": req.user._id,
        });
        
        if (!student) {
          return res.status(403).json({ message: "Not authorized to view this report card" });
        }

        if (!["Approved", "Published"].includes(reportCard.status)) {
          return res.status(403).json({ message: "Report card not yet available. Awaiting Headteacher approval." });
        }
      } else if (req.user.role === "student") {
        // Student can only view their own report card
        if (reportCard.student._id.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: "Not authorized to view this report card" });
        }

        if (!["Approved", "Published"].includes(reportCard.status)) {
          return res.status(403).json({ message: "Report card not yet available. Awaiting Headteacher approval." });
        }
      }

      res.json(reportCard);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get report cards for a student
router.get(
  "/student/:studentId",
  auth,
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const { academicYearId, termId, status } = req.query;

      // Check access permissions
      if (req.user.role === "parent") {
        const student = await GhanaStudent.findOne({
          _id: studentId,
          "guardians.userId": req.user._id,
        });
        
        if (!student) {
          return res.status(403).json({ message: "Not authorized to view this student's report cards" });
        }
      } else if (req.user.role === "student") {
        if (studentId !== req.user._id.toString()) {
          return res.status(403).json({ message: "Not authorized to view this student's report cards" });
        }
      }

      const filter = { student: studentId };
      if (academicYearId) filter.academicYear = academicYearId;
      if (termId) filter.term = termId;
      if (status) {
        filter.status = status;
      } else if (["parent", "student"].includes(req.user.role)) {
        filter.status = { $in: ["Approved", "Published"] };
      }

      const reportCards = await GhanaReportCard.find(filter)
        .populate("academicYear", "name")
        .populate("term", "name")
        .populate("class", "name level section")
        .sort({ academicYear: -1, term: 1 });

      res.json(reportCards);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get class report cards summary
router.get(
  "/class/:classId/summary",
  auth,
  rbac("academic", "read"),
  async (req, res) => {
    try {
      const { classId } = req.params;
      const { academicYearId, termId } = req.query;

      if (!academicYearId || !termId) {
        return res.status(400).json({ 
          message: "Academic year and term are required" 
        });
      }

      const summary = await GhanaReportCard.getClassSummary(classId, academicYearId, termId);

      res.json({
        class: await GhanaClass.findById(classId, "name level section"),
        academicYear: await AcademicYear.findById(academicYearId, "name"),
        term: await Term.findById(termId, "name"),
        summary,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= PDF GENERATION =============

// Generate PDF report card
router.get(
  "/:reportCardId/pdf",
  auth,
  async (req, res) => {
    try {
      const { reportCardId } = req.params;

      const reportCard = await GhanaReportCard.findById(reportCardId)
        .populate("student", "firstName lastName studentId")
        .populate("academicYear", "name")
        .populate("term", "name")
        .populate("class", "name level section")
        .populate("subjects.subject", "name code");

      if (!reportCard) {
        return res.status(404).json({ message: "Report card not found" });
      }

      // Check access permissions
      if (req.user.role === "parent") {
        const student = await GhanaStudent.findOne({
          _id: reportCard.student._id,
          "guardians.userId": req.user._id,
        });
        
        if (!student) {
          return res.status(403).json({ message: "Not authorized to download this report card" });
        }
      }

      // Verify report card is approved and released
      if (reportCard.status !== "Published") {
        return res.status(403).json({ 
          message: "Report card is not yet available for download. Status: " + reportCard.status 
        });
      }

      // Get school profile
      const SchoolProfile = require("../models/SchoolProfile");
      const school = await SchoolProfile.findOne({ key: "default" });

      if (!school) {
        return res.status(500).json({ message: "School profile not configured" });
      }

      // Get full student object
      const student = reportCard.student;

      // Generate PDF
      const { generateReportCardPDF } = require("../services/pdfService");
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ReportCard_${student.studentId}_${reportCard.termName}_${reportCard.academicYearName}.pdf"`
      );

      generateReportCardPDF(res, reportCard, school, student);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Generate class PDF report cards (batch zip download)
router.get(
  "/class/:classId/pdf-batch",
  auth,
  rbac("academic", "read"),
  async (req, res) => {
    try {
      const { classId } = req.params;
      const { academicYearId, termId } = req.query;

      if (!academicYearId || !termId) {
        return res.status(400).json({ 
          message: "Academic year and term are required" 
        });
      }

      const reportCards = await GhanaReportCard.find({
        class: classId,
        academicYear: academicYearId,
        term: termId,
        status: "Published",
      })
        .populate("student", "firstName lastName studentId")
        .populate("academicYear", "name")
        .populate("term", "name")
        .populate("class", "name level section")
        .populate("subjects.subject", "name code");

      if (reportCards.length === 0) {
        return res.status(404).json({ 
          message: "No published report cards found for this class and term" 
        });
      }

      // Get school profile
      const SchoolProfile = require("../models/SchoolProfile");
      const school = await SchoolProfile.findOne({ key: "default" });

      if (!school) {
        return res.status(500).json({ message: "School profile not configured" });
      }

      // For batch download, create a zip archive of all PDFs
      const archiver = require("archiver");
      const { generateReportCardPDF } = require("../services/pdfService");
      const { PassThrough } = require("stream");

      const archive = archiver("zip", { zlib: { level: 9 } });
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ReportCards_${reportCards[0].className}_${reportCards[0].termName}_${reportCards[0].academicYearName}.zip"`
      );

      archive.pipe(res);

      // Add each report card PDF to the archive
      for (const reportCard of reportCards) {
        const student = reportCard.student;
        const pdfStream = new PassThrough();
        
        generateReportCardPDF(pdfStream, reportCard, school, student);
        
        archive.append(pdfStream, { 
          name: `ReportCard_${student.studentId}_${student.firstName}_${student.lastName}.pdf` 
        });
      }

      await archive.finalize();
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

module.exports = router;
