const express = require("express");
const { body, validationResult } = require("express-validator");
const { auth, authorizeRoles } = require("../middleware/auth");
const Student = require("../models/Student");
const Enrollment = require("../models/Enrollment");
const ClassModel = require("../models/Class");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const ReportCard = require("../models/ReportCard");

const router = express.Router();

// Helper function to determine next grade
const getNextGrade = (currentGrade) => {
  if (!currentGrade) return null;
  
  const gradeMap = {
    "Creche": "KG1",
    "KG1": "KG2", 
    "KG2": "Class 1",
    "Class 1": "Class 2",
    "Class 2": "Class 3",
    "Class 3": "Class 4",
    "Class 4": "Class 5",
    "Class 5": "Class 6",
    "Class 6": "JHS 1",
    "JHS 1": "JHS 2",
    "JHS 2": "JHS 3",
    "JHS 3": null, // Terminal grade
  };
  
  return gradeMap[currentGrade] || null;
};

// Helper function to check if student should be promoted
const shouldPromoteStudent = (student, reportCards, promotionCriteria) => {
  // If no report cards, cannot promote
  if (!reportCards || reportCards.length === 0) {
    return { shouldPromote: false, reason: "No report cards available" };
  }
  
  // Get the most recent report card
  const latestReportCard = reportCards.sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  )[0];
  
  // Check if student failed core subjects
  const failedSubjects = latestReportCard.subjects.filter(subject => {
    const grade = subject.letterGrade;
    return grade === 'F' || (subject.totalScore !== undefined && subject.totalScore < 40);
  });
  
  if (failedSubjects.length > promotionCriteria.maxFailedSubjects) {
    return { 
      shouldPromote: false, 
      reason: `Failed ${failedSubjects.length} subjects (max allowed: ${promotionCriteria.maxFailedSubjects})` 
    };
  }
  
  // Check minimum average score
  if (latestReportCard.averageScore < promotionCriteria.minAverageScore) {
    return { 
      shouldPromote: false, 
      reason: `Average score ${latestReportCard.averageScore} below minimum ${promotionCriteria.minAverageScore}` 
    };
  }
  
  // Check attendance
  if (latestReportCard.attendance && latestReportCard.attendance.attendancePercentage < promotionCriteria.minAttendance) {
    return { 
      shouldPromote: false, 
      reason: `Attendance ${latestReportCard.attendance.attendancePercentage}% below minimum ${promotionCriteria.minAttendance}%` 
    };
  }
  
  return { shouldPromote: true, reason: "Meets promotion criteria" };
};

// Get promotion settings
const getPromotionCriteria = async () => {
  // Default promotion criteria - could be made configurable
  return {
    minAverageScore: 40,
    maxFailedSubjects: 2,
    minAttendance: 75,
  };
};

// @route   POST /api/promotion/calculate
// @desc    Calculate promotion recommendations for students
// @access  Private (Admin, Staff)
router.post(
  "/calculate",
  [
    auth,
    authorizeRoles("admin", "staff"),
    [
      body("academicYearId").isMongoId().withMessage("Valid academic year ID is required"),
      body("termId").isMongoId().withMessage("Valid term ID is required"),
      body("classId").optional().isMongoId().withMessage("Valid class ID is required"),
    ],
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { academicYearId, termId, classId } = req.body;
      const promotionCriteria = await getPromotionCriteria();

      // Get enrollments for the academic year
      const enrollmentFilter = { academicYear: academicYearId, status: "active" };
      if (classId) enrollmentFilter.class = classId;

      const enrollments = await Enrollment.find(enrollmentFilter)
        .populate("student")
        .populate("class");

      const promotionResults = [];

      for (const enrollment of enrollments) {
        const student = enrollment.student;
        const currentClass = enrollment.class;

        // Get student's report cards for the academic year
        const reportCards = await ReportCard.find({
          student: student._id,
          academicYearId,
          status: "published"
        });

        const promotionDecision = shouldPromoteStudent(student, reportCards, promotionCriteria);
        const nextGrade = getNextGrade(currentClass.grade);

        const result = {
          studentId: student._id,
          studentName: `${student.firstName} ${student.lastName}`,
          currentClass: currentClass.name,
          currentGrade: currentClass.grade,
          nextGrade: nextGrade,
          shouldPromote: promotionDecision.shouldPromote,
          reason: promotionDecision.reason,
          reportCardCount: reportCards.length,
          averageScore: reportCards.length > 0 ? reportCards[0].averageScore : null,
          attendancePercentage: reportCards.length > 0 && reportCards[0].attendance 
            ? reportCards[0].attendance.attendancePercentage 
            : null,
        };

        promotionResults.push(result);
      }

      // Summary statistics
      const summary = {
        totalStudents: promotionResults.length,
        recommendedForPromotion: promotionResults.filter(r => r.shouldPromote).length,
        recommendedForRetention: promotionResults.filter(r => !r.shouldPromote).length,
        promotionRate: promotionResults.length > 0 
          ? (promotionResults.filter(r => r.shouldPromote).length / promotionResults.length * 100).toFixed(2)
          : 0,
      };

      res.json({
        promotionCriteria,
        results: promotionResults,
        summary,
        academicYearId,
        termId,
        classId,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   POST /api/promotion/execute
// @desc    Execute student promotions
// @access  Private (Admin only)
router.post(
  "/execute",
  [
    auth,
    authorizeRoles("admin"),
    [
      body("academicYearId").isMongoId().withMessage("Valid academic year ID is required"),
      body("termId").isMongoId().withMessage("Valid term ID is required"),
      body("promotions").isArray().withMessage("Promotions array is required"),
      body("promotions.*.studentId").isMongoId().withMessage("Valid student ID is required"),
      body("promotions.*.shouldPromote").isBoolean().withMessage("Should promote must be boolean"),
    ],
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { academicYearId, termId, promotions } = req.body;
      
      // Get next academic year
      const currentAcademicYear = await AcademicYear.findById(academicYearId);
      if (!currentAcademicYear) {
        return res.status(404).json({ message: "Academic year not found" });
      }

      // Find or create next academic year
      const currentYearNum = parseInt(currentAcademicYear.name.split('/')[0]);
      const nextYearName = `${currentYearNum + 1}/${currentYearNum + 2}`;
      
      let nextAcademicYear = await AcademicYear.findOne({ name: nextYearName });
      if (!nextAcademicYear) {
        nextAcademicYear = new AcademicYear({
          name: nextYearName,
          startDate: new Date(currentYearNum + 1, 8, 1), // September 1st
          endDate: new Date(currentYearNum + 2, 7, 31), // July 31st
          isActive: false,
        });
        await nextAcademicYear.save();
      }

      const executionResults = [];

      for (const promotion of promotions) {
        try {
          const { studentId, shouldPromote, manualOverride, overrideReason } = promotion;
          
          // Get current enrollment
          const currentEnrollment = await Enrollment.findOne({
            student: studentId,
            academicYear: academicYearId,
            status: "active"
          }).populate("class");

          if (!currentEnrollment) {
            executionResults.push({
              studentId,
              success: false,
              error: "Current enrollment not found",
            });
            continue;
          }

          if (shouldPromote || manualOverride) {
            // Get next grade
            const nextGrade = getNextGrade(currentEnrollment.class.grade);
            
            if (!nextGrade) {
              executionResults.push({
                studentId,
                success: false,
                error: "No next grade available (terminal grade)",
              });
              continue;
            }

            // Find next class
            const nextClass = await ClassModel.findOne({
              grade: nextGrade,
              academicYear: nextAcademicYear._id
            });

            if (!nextClass) {
              executionResults.push({
                studentId,
                success: false,
                error: `Next class for grade ${nextGrade} not found`,
              });
              continue;
            }

            // Create new enrollment for next academic year
            const newEnrollment = new Enrollment({
              student: studentId,
              class: nextClass._id,
              academicYear: nextAcademicYear._id,
              status: "active",
              enrollmentDate: new Date(),
            });

            await newEnrollment.save();

            // Archive current enrollment
            currentEnrollment.status = "archived";
            currentEnrollment.archivedDate = new Date();
            await currentEnrollment.save();

            executionResults.push({
              studentId,
              success: true,
              action: "promoted",
              fromGrade: currentEnrollment.class.grade,
              toGrade: nextGrade,
              fromClass: currentEnrollment.class.name,
              toClass: nextClass.name,
              manualOverride: manualOverride || false,
              overrideReason: overrideReason || null,
            });
          } else {
            // Retain student - create new enrollment for same grade
            const sameGradeClass = await ClassModel.findOne({
              grade: currentEnrollment.class.grade,
              academicYear: nextAcademicYear._id
            });

            if (!sameGradeClass) {
              executionResults.push({
                studentId,
                success: false,
                error: `Class for grade ${currentEnrollment.class.grade} in next academic year not found`,
              });
              continue;
            }

            const newEnrollment = new Enrollment({
              student: studentId,
              class: sameGradeClass._id,
              academicYear: nextAcademicYear._id,
              status: "active",
              enrollmentDate: new Date(),
            });

            await newEnrollment.save();

            // Archive current enrollment
            currentEnrollment.status = "archived";
            currentEnrollment.archivedDate = new Date();
            await currentEnrollment.save();

            executionResults.push({
              studentId,
              success: true,
              action: "retained",
              grade: currentEnrollment.class.grade,
              fromClass: currentEnrollment.class.name,
              toClass: sameGradeClass.name,
            });
          }
        } catch (err) {
          console.error(`Error processing promotion for student ${promotion.studentId}:`, err);
          executionResults.push({
            studentId: promotion.studentId,
            success: false,
            error: err.message,
          });
        }
      }

      // Summary of execution
      const summary = {
        totalProcessed: promotions.length,
        successful: executionResults.filter(r => r.success).length,
        failed: executionResults.filter(r => !r.success).length,
        promoted: executionResults.filter(r => r.success && r.action === "promoted").length,
        retained: executionResults.filter(r => r.success && r.action === "retained").length,
      };

      res.json({
        success: true,
        summary,
        results: executionResults,
        nextAcademicYear: {
          _id: nextAcademicYear._id,
          name: nextAcademicYear.name,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   GET /api/promotion/history
// @desc    Get promotion history
// @access  Private (Admin, Staff)
router.get(
  "/history",
  [
    auth,
    authorizeRoles("admin", "staff"),
  ],
  async (req, res) => {
    try {
      const { academicYearId, studentId } = req.query;
      
      // Get archived enrollments
      const filter = { status: "archived" };
      if (academicYearId) filter.academicYear = academicYearId;
      if (studentId) filter.student = studentId;

      const archivedEnrollments = await Enrollment.find(filter)
        .populate("student", "firstName lastName email")
        .populate("class", "name grade")
        .populate("academicYear", "name")
        .sort({ archivedDate: -1 });

      res.json(archivedEnrollments);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   GET /api/promotion/settings
// @desc    Get promotion settings
// @access  Private (Admin, Staff)
router.get(
  "/settings",
  [
    auth,
    authorizeRoles("admin", "staff"),
  ],
  async (req, res) => {
    try {
      const promotionCriteria = await getPromotionCriteria();
      res.json(promotionCriteria);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
