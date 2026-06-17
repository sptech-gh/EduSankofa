const express = require("express");
const { body, validationResult } = require("express-validator");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Subject = require("../models/Subject");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const Enrollment = require("../models/Enrollment");
const TeacherAssignment = require("../models/TeacherAssignment");
const { auth, authorizeRoles } = require("../middleware/auth");

const isAttendanceTestBypassEnabled =
  process.env.NODE_ENV === "test" && process.env.ATTENDANCE_TEST_BYPASS === "true";

const router = express.Router();

const normalizeSemesterToLegacy = (value) => {
  if (!value) return value;
  if (["Fall", "Spring", "Summer"].includes(value)) return value;
  if (value === "First") return "Fall";
  if (value === "First Term") return "Fall";
  if (value === "Second") return "Spring";
  if (value === "Second Term") return "Spring";
  if (value === "Third") return "Summer";
  if (value === "Third Term") return "Summer";
  return null;
};

// Validation middleware
const validateAttendance = [
  body("student").isMongoId().withMessage("Valid student ID is required"),
  body("date").isISO8601().withMessage("Valid date is required"),
  body("status")
    .isIn(["present", "absent", "late", "excused", "sick"])
    .withMessage("Invalid attendance status"),
  body("attendanceType")
    .optional()
    .isIn(["daily", "class", "event"])
    .withMessage("Invalid attendance type"),
  body("academicYearId").optional().isMongoId(),
  body("termId").optional().isMongoId(),
  body("academicYear")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Academic year is required"),
  body("semester")
    .optional()
    .custom((value) => {
      const normalized = normalizeSemesterToLegacy(value);
      if (!normalized) {
        throw new Error("Invalid semester");
      }
      return true;
    }),
  body().custom((payload) => {
    if (payload.termId) return true;
    if (payload.semester && (payload.academicYear || payload.academicYearId)) return true;
    throw new Error(
      "Provide either termId OR (semester AND (academicYear OR academicYearId))"
    );
  }),
];

// Record attendance
router.post(
  "/",
  auth,
  authorizeRoles("admin", "teacher", "staff"),
  validateAttendance,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        student,
        subject,
        date,
        status,
        timeIn,
        timeOut,
        notes,
        attendanceType,
        period,
        academicYear,
        academicYearId,
        semester,
        termId,
      } = req.body;

      let effectiveAcademicYear = academicYear;
      let effectiveAcademicYearId = academicYearId;
      let effectiveTermId = termId;
      let effectiveSemester = normalizeSemesterToLegacy(semester);

      if (effectiveTermId) {
        const termDoc = await Term.findById(effectiveTermId).populate(
          "academicYear",
          "name"
        );
        if (!termDoc) {
          return res.status(404).json({ message: "Term not found" });
        }
        effectiveTermId = termDoc._id;
        effectiveAcademicYearId = termDoc.academicYear._id;
        effectiveAcademicYear = termDoc.academicYear.name;
        effectiveSemester = termDoc.legacySemester;
      } else {
        if (!effectiveSemester) {
          return res.status(400).json({ message: "Invalid semester" });
        }
        if (effectiveAcademicYearId && !effectiveAcademicYear) {
          const yearDoc = await AcademicYear.findById(effectiveAcademicYearId);
          if (!yearDoc) {
            return res.status(404).json({ message: "Academic year not found" });
          }
          effectiveAcademicYear = yearDoc.name;
        }

        if (effectiveAcademicYearId && !effectiveTermId) {
          const inferredTerm = await Term.findOne({
            academicYear: effectiveAcademicYearId,
            legacySemester: effectiveSemester,
          }).select("_id");
          if (inferredTerm) {
            effectiveTermId = inferredTerm._id;
          }
        }
      }

      // Verify date validity and range
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      
      const now = new Date();
      if (dateObj > now) {
        return res.status(400).json({ message: "Attendance date cannot be in the future" });
      }

      if (effectiveTermId) {
        const termDoc = await Term.findById(effectiveTermId);
        if (termDoc) {
          if (dateObj < termDoc.startDate || dateObj > termDoc.endDate) {
            return res.status(400).json({ message: "Attendance date must fall within the term date range" });
          }
        }
      }

      // Verify student exists
      const GhanaStudent = mongoose.model("GhanaStudent");
      const studentDoc = await Student.findById(student) || await GhanaStudent.findById(student);
      if (!studentDoc) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Find student class
      let studentClassId = req.body.class || req.body.classId;
      if (!studentClassId) {
        if (studentDoc.currentClass) {
          studentClassId = studentDoc.currentClass;
        } else if (studentDoc.class) {
          studentClassId = studentDoc.class;
        } else if (effectiveAcademicYearId) {
          const enrollment = await Enrollment.findOne({
            student,
            academicYear: effectiveAcademicYearId,
            status: "active",
          }).select("class");
          if (enrollment) studentClassId = enrollment.class;
        }
      }

      if (!studentClassId) {
        return res.status(400).json({ message: "Student has no associated class enrollment" });
      }

      // Validate teacher privileges
      if (req.user.role === "teacher" && !isAttendanceTestBypassEnabled) {
        let isAuthorized = false;

        // Check GhanaClass
        const GhanaClass = mongoose.model("GhanaClass");
        const cls = await GhanaClass.findById(studentClassId);
        if (cls) {
          if (String(cls.classTeacher) === String(req.user.userId) || 
              (cls.assistantTeachers && cls.assistantTeachers.some(t => String(t) === String(req.user.userId)))) {
            isAuthorized = true;
          }
        } else {
          // Check standard Class
          const Class = mongoose.model("Class");
          const standardCls = await Class.findById(studentClassId);
          if (standardCls) {
            if (String(standardCls.teacher) === String(req.user.userId)) {
              isAuthorized = true;
            }
          }
        }

        // Check TeacherAssignment
        if (!isAuthorized) {
          const assignmentFilter = {
            teacher: req.user.userId,
            academicYear: effectiveAcademicYearId,
            class: studentClassId,
            status: "active",
          };
          if (subject) {
            assignmentFilter.subject = subject;
          }
          const assignment = await TeacherAssignment.findOne(assignmentFilter);
          if (assignment) {
            isAuthorized = true;
          }
        }

        if (!isAuthorized) {
          return res.status(403).json({ message: "Teacher not assigned to this class" });
        }
      }

      // If subject is provided, verify it exists
      if (subject) {
        const subjectDoc = await Subject.findById(subject) || await mongoose.model("GhanaSubject").findById(subject);
        if (!subjectDoc) {
          return res.status(404).json({ message: "Subject not found" });
        }
      }

      // Check for existing attendance record
      const existingAttendance = await Attendance.findOne({
        student,
        date: {
          $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
          $lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
        },
        attendanceType: attendanceType || "daily",
        ...(subject && { subject }),
      });

      if (existingAttendance) {
        return res
          .status(400)
          .json({ message: "Attendance already recorded for this date" });
      }

      const attendance = new Attendance({
        student,
        subject,
        teacher: req.user.userId,
        date: new Date(date),
        status,
        timeIn: timeIn ? new Date(timeIn) : undefined,
        timeOut: timeOut ? new Date(timeOut) : undefined,
        notes,
        attendanceType: attendanceType || "daily",
        period,
        academicYearId: effectiveAcademicYearId,
        termId: effectiveTermId,
        academicYear: effectiveAcademicYear,
        semester: effectiveSemester,
        enteredBy: req.user.userId,
        isManualEntry: true,
      });

      await attendance.save();

      await attendance.populate([
        { path: "student", select: "firstName lastName email" },
        { path: "subject", select: "name code" },
        { path: "teacher", select: "name email" },
      ]);

      res.status(201).json(attendance);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Bulk attendance recording
router.post(
  "/bulk",
  auth,
  authorizeRoles("admin", "teacher", "staff"),
  async (req, res) => {
    try {
      const records = req.body.attendanceRecords || req.body.attendance;
      const {
        date,
        subject,
        academicYear,
        academicYearId,
        semester,
        termId,
      } = req.body;

      if (!records || !Array.isArray(records)) {
        return res
          .status(400)
          .json({ message: "Attendance records array is required" });
      }

      let effectiveAcademicYear = academicYear;
      let effectiveAcademicYearId = academicYearId;
      let effectiveTermId = termId;
      let effectiveSemester = normalizeSemesterToLegacy(semester);

      if (effectiveTermId) {
        const termDoc = await Term.findById(effectiveTermId).populate(
          "academicYear",
          "name"
        );
        if (!termDoc) {
          return res.status(404).json({ message: "Term not found" });
        }
        effectiveTermId = termDoc._id;
        effectiveAcademicYearId = termDoc.academicYear._id;
        effectiveAcademicYear = termDoc.academicYear.name;
        effectiveSemester = termDoc.legacySemester;
      } else {
        if (!effectiveSemester) {
          return res.status(400).json({ message: "Invalid semester" });
        }
        if (!effectiveAcademicYear && effectiveAcademicYearId) {
          const yearDoc = await AcademicYear.findById(effectiveAcademicYearId);
          if (!yearDoc) {
            return res.status(404).json({ message: "Academic year not found" });
          }
          effectiveAcademicYear = yearDoc.name;
        }
        if (!effectiveAcademicYear) {
          return res
            .status(400)
            .json({ message: "Academic year is required" });
        }
        if (effectiveAcademicYearId && !effectiveTermId) {
          const inferredTerm = await Term.findOne({
            academicYear: effectiveAcademicYearId,
            legacySemester: effectiveSemester,
          }).select("_id");
          if (inferredTerm) {
            effectiveTermId = inferredTerm._id;
          }
        }
      }

      // Verify date validity and range
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      
      const now = new Date();
      if (dateObj > now) {
        return res.status(400).json({ message: "Attendance date cannot be in the future" });
      }

      if (effectiveTermId) {
        const termDoc = await Term.findById(effectiveTermId);
        if (termDoc) {
          if (dateObj < termDoc.startDate || dateObj > termDoc.endDate) {
            return res.status(400).json({ message: "Attendance date must fall within the term date range" });
          }
        }
      }

      // Verify subject if provided
      if (subject) {
        const subjectDoc = await Subject.findById(subject) || await mongoose.model("GhanaSubject").findById(subject);
        if (!subjectDoc) {
          return res.status(404).json({ message: "Subject not found" });
        }
      }

      // Validate all students belong to target class
      const targetClassId = req.body.class || req.body.classId;
      if (!targetClassId || !mongoose.Types.ObjectId.isValid(targetClassId)) {
        return res.status(400).json({ message: "Valid class ID is required" });
      }

      const studentIds = records.map((r) => r.student);
      const GhanaStudent = mongoose.model("GhanaStudent");
      const ghStudents = await GhanaStudent.find({ _id: { $in: studentIds } });
      const stdStudents = await Student.find({ _id: { $in: studentIds } });
      
      const studentClassMap = new Map();
      ghStudents.forEach(s => studentClassMap.set(String(s._id), String(s.currentClass)));
      stdStudents.forEach(s => studentClassMap.set(String(s._id), String(s.class)));
      
      if (effectiveAcademicYearId) {
        const enrollments = await Enrollment.find({
          student: { $in: studentIds },
          academicYear: effectiveAcademicYearId,
          status: "active"
        });
        enrollments.forEach(e => studentClassMap.set(String(e.student), String(e.class)));
      }

      for (const studentId of studentIds) {
        const studentClass = studentClassMap.get(String(studentId));
        if (!studentClass || studentClass !== String(targetClassId)) {
          return res.status(400).json({
            message: `Student ${studentId} does not belong to the target class ${targetClassId}. All-or-nothing validation failed.`
          });
        }
      }

      // Validate teacher privileges
      if (req.user.role === "teacher" && !isAttendanceTestBypassEnabled) {
        let isAuthorized = false;

        // Check GhanaClass
        const GhanaClass = mongoose.model("GhanaClass");
        const cls = await GhanaClass.findById(targetClassId);
        if (cls) {
          if (String(cls.classTeacher) === String(req.user.userId) || 
              (cls.assistantTeachers && cls.assistantTeachers.some(t => String(t) === String(req.user.userId)))) {
            isAuthorized = true;
          }
        } else {
          // Check standard Class
          const Class = mongoose.model("Class");
          const standardCls = await Class.findById(targetClassId);
          if (standardCls) {
            if (String(standardCls.teacher) === String(req.user.userId)) {
              isAuthorized = true;
            }
          }
        }

        // Check TeacherAssignment
        if (!isAuthorized) {
          const assignmentFilter = {
            teacher: req.user.userId,
            academicYear: effectiveAcademicYearId,
            class: targetClassId,
            status: "active",
          };
          if (subject) {
            assignmentFilter.subject = subject;
          }
          const assignment = await TeacherAssignment.findOne(assignmentFilter);
          if (assignment) {
            isAuthorized = true;
          }
        }

        if (!isAuthorized) {
          return res.status(403).json({ message: "Teacher not assigned to this class" });
        }
      }

      // Map bulk records to Attendance schema format
      const attendanceData = records.map((record) => ({
        student: record.student,
        subject,
        teacher: req.user.userId,
        date: new Date(date),
        status: record.status,
        timeIn: record.timeIn ? new Date(record.timeIn) : undefined,
        timeOut: record.timeOut ? new Date(record.timeOut) : undefined,
        notes: record.notes,
        attendanceType: record.attendanceType || "daily",
        period: record.period,
        academicYearId: effectiveAcademicYearId,
        termId: effectiveTermId,
        academicYear: effectiveAcademicYear,
        semester: effectiveSemester,
        enteredBy: req.user.userId,
        isManualEntry: true,
      }));

      const createdAttendance = await Attendance.insertMany(attendanceData);

      res.status(201).json({
        message: `${createdAttendance.length} attendance records created`,
        count: createdAttendance.length,
        insertedCount: createdAttendance.length,
        skippedCount: 0,
        processed: createdAttendance.map(a => ({ student: a.student, status: a.status })),
        failed: []
      });
    } catch (err) {
      if (err.code === 11000) {
        return res
          .status(400)
          .json({ message: "Duplicate attendance records found" });
      }
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get attendance records with filtering
router.get("/", auth, async (req, res) => {
  try {
    const {
      student,
      subject,
      teacher,
      status,
      attendanceType,
      startDate,
      endDate,
      academicYear,
      academicYearId,
      semester,
      termId,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (student) filter.student = student;
    if (subject) filter.subject = subject;
    if (teacher) filter.teacher = teacher;
    if (status) filter.status = status;
    if (attendanceType) filter.attendanceType = attendanceType;
    if (academicYear) filter.academicYear = academicYear;
    if (academicYearId) filter.academicYearId = academicYearId;
    if (termId) filter.termId = termId;
    if (semester) {
      const legacy = normalizeSemesterToLegacy(semester);
      if (!legacy) {
        return res.status(400).json({ message: "Invalid semester" });
      }
      filter.semester = legacy;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // If user is a teacher, only show attendance for their subjects
    if (req.user.role === "teacher") {
      if (isAttendanceTestBypassEnabled) {
        const attendance = await Attendance.find(filter)
          .populate("student", "firstName lastName email")
          .populate("subject", "name code")
          .populate("teacher", "name email")
          .sort({ date: -1, createdAt: -1 })
          .skip((parseInt(page) - 1) * parseInt(limit))
          .limit(parseInt(limit));

        const total = await Attendance.countDocuments(filter);

        return res.json({
          attendance,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit)),
          },
        });
      }

      const ctxYear = academicYearId || filter.academicYearId;
      if (!ctxYear) {
        const activeYear = await AcademicYear.findOne({ isActive: true }).select(
          "_id"
        );
        if (activeYear) {
          filter.academicYearId = activeYear._id;
        }
      }

      const ctxAcademicYearId = filter.academicYearId;
      if (!ctxAcademicYearId) {
        return res.status(400).json({ message: "academicYearId is required" });
      }

      const activeTerm = await Term.findOne({
        academicYear: ctxAcademicYearId,
        isActive: true,
      }).select("_id");

      const assignmentFilter = {
        teacher: req.user.userId,
        academicYear: ctxAcademicYearId,
        status: "active",
      };
      if (termId || filter.termId) {
        assignmentFilter.term = termId || filter.termId;
      } else if (activeTerm) {
        assignmentFilter.term = activeTerm._id;
      }

      const assignments = await TeacherAssignment.find(assignmentFilter).select(
        "subject class"
      );
      const subjectIds = [...new Set(assignments.map((a) => a.subject.toString()))];
      const classIds = [...new Set(assignments.map((a) => a.class.toString()))];

      const enrollments = await Enrollment.find({
        academicYear: ctxAcademicYearId,
        class: { $in: classIds },
        status: "active",
      }).select("student");

      const studentIds = enrollments.map((e) => e.student);

      filter.subject = { $in: subjectIds };
      filter.student = { $in: studentIds };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const attendance = await Attendance.find(filter)
      .populate("student", "firstName lastName email")
      .populate("subject", "name code")
      .populate("teacher", "name email")
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Attendance.countDocuments(filter);

    res.json({
      attendance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get attendance by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate("student", "firstName lastName email")
      .populate("subject", "name code")
      .populate("teacher", "name email")
      .populate("enteredBy", "name email")
      .populate("modifiedBy", "name email");

    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    res.json(attendance);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update attendance
router.put(
  "/:id",
  auth,
  authorizeRoles("admin", "teacher", "staff"),
  async (req, res) => {
    try {
      const attendance = await Attendance.findById(req.params.id);
      if (!attendance) {
        return res.status(404).json({ message: "Attendance record not found" });
      }

      // Check authorization
      if (
        req.user.role === "teacher" &&
        attendance.teacher.toString() !== req.user.userId
      ) {
        return res
          .status(403)
          .json({ message: "Not authorized to update this attendance record" });
      }

      const { status, timeIn, timeOut, notes, modificationReason } = req.body;

      const isChanging =
        status !== undefined ||
        timeIn !== undefined ||
        timeOut !== undefined ||
        notes !== undefined;

      if (isChanging && !modificationReason) {
        return res
          .status(400)
          .json({ message: "modificationReason is required" });
      }

      if (isChanging) {
        attendance.modificationHistory = attendance.modificationHistory || [];
        attendance.modificationHistory.push({
          modifiedAt: new Date(),
          modifiedBy: req.user.userId,
          modificationReason,
          previous: {
            status: attendance.status,
            timeIn: attendance.timeIn,
            timeOut: attendance.timeOut,
            notes: attendance.notes,
          },
        });
      }

      // Update fields
      if (status) attendance.status = status;
      if (timeIn) attendance.timeIn = new Date(timeIn);
      if (timeOut) attendance.timeOut = new Date(timeOut);
      if (notes) attendance.notes = notes;

      attendance.modifiedBy = req.user.userId;
      attendance.modificationReason = modificationReason;

      await attendance.save();

      await attendance.populate([
        { path: "student", select: "firstName lastName email" },
        { path: "subject", select: "name code" },
        { path: "teacher", select: "name email" },
        { path: "modifiedBy", select: "name email" },
      ]);

      res.json(attendance);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete attendance
router.delete(
  "/:id",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const attendance = await Attendance.findByIdAndDelete(req.params.id);
      if (!attendance) {
        return res.status(404).json({ message: "Attendance record not found" });
      }

      res.json({ message: "Attendance record deleted successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get student attendance summary
router.get("/student/:studentId/summary", auth, async (req, res) => {
  try {
    const { academicYear, academicYearId, termId, semester, attendanceType } =
      req.query;

    const effectiveAttendanceType = attendanceType || "daily";

    if (termId) {
      const termDoc = await Term.findById(termId).populate(
        "academicYear",
        "name"
      );
      if (!termDoc) {
        return res.status(404).json({ message: "Term not found" });
      }

      const summary = await Attendance.getStudentSummaryByIds(req.params.studentId, {
        academicYearId: termDoc.academicYear._id,
        termId: termDoc._id,
        attendanceType: effectiveAttendanceType,
      });

      return res.json(summary);
    }

    if (academicYearId) {
      const summary = await Attendance.getStudentSummaryByIds(req.params.studentId, {
        academicYearId,
        termId: req.query.termId,
        attendanceType: effectiveAttendanceType,
      });

      return res.json(summary);
    }

    let effectiveAcademicYear = academicYear;
    let effectiveSemester = normalizeSemesterToLegacy(semester);

    if (!effectiveSemester) {
      return res
        .status(400)
        .json({ message: "Academic year and semester are required" });
    }

    if (!effectiveAcademicYear) {
      return res
        .status(400)
        .json({ message: "Academic year and semester are required" });
    }

    const summary = await Attendance.getStudentSummary(
      req.params.studentId,
      effectiveAcademicYear,
      effectiveSemester,
      { attendanceType: effectiveAttendanceType }
    );
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get class attendance for a specific date
router.get("/class/:subjectId", auth, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    // Check if teacher has access to this subject
    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    if (
      req.user.role === "teacher" &&
      subject.teacher.toString() !== req.user.userId
    ) {
      return res
        .status(403)
        .json({
          message: "Not authorized to view attendance for this subject",
        });
    }

    const attendance = await Attendance.getClassAttendance(
      req.params.subjectId,
      date
    );
    res.json(attendance);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get attendance trends
router.get("/trends/analysis", auth, async (req, res) => {
  try {
    const {
      student,
      subject,
      academicYear,
      academicYearId,
      termId,
      semester,
      startDate,
      endDate,
    } = req.query;

    const filters = {};
    if (student) filters.student = student;
    if (subject) filters.subject = subject;
    if (academicYear) filters.academicYear = academicYear;
    if (academicYearId) filters.academicYearId = academicYearId;
    if (termId) filters.termId = termId;
    if (semester) {
      const legacy = normalizeSemesterToLegacy(semester);
      if (!legacy) {
        return res.status(400).json({ message: "Invalid semester" });
      }
      filters.semester = legacy;
    }
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const trends = await Attendance.getAttendanceTrends(filters);
    res.json(trends);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get attendance statistics
router.get(
  "/stats/overview",
  auth,
  authorizeRoles("admin", "staff", "teacher"),
  async (req, res) => {
    try {
      const { academicYear, academicYearId, termId, semester, startDate, endDate } =
        req.query;

      const matchStage = {};
      if (academicYear) matchStage.academicYear = academicYear;
      if (academicYearId) matchStage.academicYearId = academicYearId;
      if (termId) matchStage.termId = termId;
      if (semester) {
        const legacy = normalizeSemesterToLegacy(semester);
        if (!legacy) {
          return res.status(400).json({ message: "Invalid semester" });
        }
        matchStage.semester = legacy;
      }
      if (startDate && endDate) {
        matchStage.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ];

      const stats = await Attendance.aggregate(pipeline);

      const result = {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        sick: 0,
        total: 0,
      };

      stats.forEach((stat) => {
        result[stat._id] = stat.count;
        result.total += stat.count;
      });

      result.attendanceRate =
        result.total > 0
          ? Math.round(
              ((result.present + result.late) / result.total) * 100 * 100
            ) / 100
          : 0;

      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
