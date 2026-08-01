const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { auth, authorizeRoles } = require("../middleware/auth");
const GhanaStudent = require("../models/GhanaStudent");
const GhanaClass = require("../models/GhanaClass");
const StudentBill = require("../models/StudentBill");
const SchoolProfile = require("../models/SchoolProfile");
const GhanaAttendance = require('../models/GhanaAttendance');
const TeacherAssignment = require('../models/TeacherAssignment');
const Term = require('../models/Term');
const AcademicYear = require('../models/AcademicYear');

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

// Helper to find teacher's current class level
async function getTeacherClass(teacherId) {
  const cls = await GhanaClass.findOne({ classTeacher: teacherId, isActive: true });
  return cls;
}

// @route   GET /api/teacher/class/students
// @desc    List students in the teacher's assigned class
router.get(
  "/class/students",
  [auth, authorizeRoles("teacher", "class teacher")],
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const cls = await getTeacherClass(req.user._id);
      if (!cls) {
        return res.status(403).json({ message: "Access Denied: Teacher is not currently assigned to a class." });
      }

      const students = await GhanaStudent.find({
        schoolId,
        currentClass: cls._id,
        status: "Active",
      }).sort({ lastName: 1, firstName: 1 });

      res.json(students);
    } catch (err) {
      next(err);
    }
  }
);

// @route   GET /api/teacher/class/billing-summary
// @desc    Get aggregate billing stats for class (filter: academicYear, term)
router.get(
  "/class/billing-summary",
  [auth, authorizeRoles("teacher", "class teacher")],
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const cls = await getTeacherClass(req.user._id);
      if (!cls) {
        return res.status(403).json({ message: "Access Denied: Teacher is not currently assigned to a class." });
      }

      const { academicYear, term } = req.query;
      if (!academicYear || !term) {
        return res.status(400).json({ message: "academicYear and term query parameters are required" });
      }

      const termNumber = parseInt(term, 10);

      // Find all students in class
      const students = await GhanaStudent.find({
        currentClass: cls._id,
        status: "Active",
      });

      const studentIds = students.map((s) => s._id);

      // Fetch bills
      const bills = await StudentBill.find({
        schoolId,
        studentId: { $in: studentIds },
        academicYear,
        term: termNumber,
      });

      let totalBilled = 0;
      let totalPaid = 0;
      let totalOutstanding = 0;

      const studentStats = students.map((student) => {
        const bill = bills.find((b) => b.studentId.toString() === student._id.toString());
        const billed = bill ? bill.totalFinalPesewas : 0;
        const paid = bill ? bill.totalPaidPesewas : 0;
        const outstanding = bill ? bill.outstandingPesewas : 0;

        totalBilled += billed;
        totalPaid += paid;
        totalOutstanding += outstanding;

        return {
          studentId: student._id,
          fullName: `${student.firstName} ${student.lastName}`,
          billStatus: bill ? bill.status : "NO_BILL",
          totalBilledPesewas: billed,
          totalPaidPesewas: paid,
          outstandingPesewas: outstanding,
        };
      });

      res.json({
        classCode: cls.level,
        academicYear,
        term: termNumber,
        totalStudents: students.length,
        totalBilledPesewas: totalBilled,
        totalPaidPesewas: totalPaid,
        totalOutstandingPesewas: totalOutstanding,
        students: studentStats,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── DASHBOARD ──────────────────────────────────────────────────────────
// @route   GET /api/teacher/dashboard
// @desc    Teacher dashboard stats: class info, today's attendance, pending scores
router.get(
  '/dashboard',
  [auth, authorizeRoles('teacher', 'class teacher')],
  async (req, res, next) => {
    try {
      const schoolId = await getSchoolId();
      const cls = await getTeacherClass(req.user._id);
      if (!cls) {
        return res.json({
          myClass: null,
          attendanceToday: { isMarked: false, markedCount: 0 },
          scoresPending: 0,
          reportCardStatus: 'NO_CLASS',
        });
      }

      const students = await GhanaStudent.find({ currentClass: cls._id, status: 'Active' });
      const studentIds = students.map(s => s._id);

      // Today's attendance
      const today = new Date();
      const startOfDay = new Date(today); startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(today); endOfDay.setHours(23,59,59,999);
      const todayAttendance = await GhanaAttendance.find({
        class: cls._id,
        date: { $gte: startOfDay, $lte: endOfDay },
      });
      const isMarked = todayAttendance.length > 0;
      const markedCount = todayAttendance.filter(a => a.status === 'Present').length;

      res.json({
        myClass: { level: cls.level, name: cls.name, studentCount: students.length },
        attendanceToday: { isMarked, markedCount, total: students.length },
        scoresPending: 0, // placeholder — score model integration TBD
        reportCardStatus: 'IN_PROGRESS',
      });
    } catch (err) { next(err); }
  }
);

// ── ATTENDANCE ─────────────────────────────────────────────────────────
// @route   GET /api/teacher/attendance?date=YYYY-MM-DD
// @desc    Get attendance records for teacher's class on a given date
router.get(
  '/attendance',
  [auth, authorizeRoles('teacher', 'class teacher')],
  async (req, res, next) => {
    try {
      const cls = await getTeacherClass(req.user._id);
      if (!cls) return res.status(403).json({ message: 'No class assigned' });

      const date = req.query.date ? new Date(req.query.date) : new Date();
      const startOfDay = new Date(date); startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(date); endOfDay.setHours(23,59,59,999);

      const students = await GhanaStudent.find({ currentClass: cls._id, status: 'Active' }).sort({ lastName:1, firstName:1 });
      const records = await GhanaAttendance.find({
        class: cls._id,
        date: { $gte: startOfDay, $lte: endOfDay },
      });

      const studentList = students.map(s => {
        const rec = records.find(r => r.student.toString() === s._id.toString());
        return {
          studentId: s._id,
          firstName: s.firstName,
          lastName: s.lastName,
          studentCode: s.studentId,
          status: rec ? rec.status : null,
          attendanceId: rec ? rec._id : null,
        };
      });

      res.json({
        date: date.toISOString().split('T')[0],
        classLevel: cls.level,
        isMarked: records.length > 0,
        students: studentList,
      });
    } catch (err) { next(err); }
  }
);

// @route   POST /api/teacher/attendance
// @desc    Save (upsert) daily attendance for teacher's class
router.post(
  '/attendance',
  [auth, authorizeRoles('teacher', 'class teacher')],
  async (req, res, next) => {
    const session = await mongoose.startSession();
    try {
      const cls = await getTeacherClass(req.user._id);
      if (!cls) return res.status(403).json({ message: 'No class assigned' });

      const { date, records } = req.body;
      if (!date || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ message: 'date and records array are required' });
      }

      const attendanceDate = new Date(date);
      attendanceDate.setHours(0,0,0,0);
      const timeIn = new Date(attendanceDate);
      timeIn.setHours(8, 0, 0, 0); // Default school start time

      // Get active term and academic year
      const activeTerm = await Term.findOne({ isActive: true }).sort({ createdAt: -1 });
      const activeYear = await AcademicYear.findOne({ isActive: true }).sort({ createdAt: -1 });

      if (!activeTerm || !activeYear) {
        return res.status(400).json({ message: 'No active term or academic year found' });
      }

      await session.withTransaction(async () => {
        const ops = records.map(r => ({
          updateOne: {
            filter: {
              student: r.studentId,
              class: cls._id,
              date: attendanceDate,
              attendanceType: 'Daily',
              period: 'Full Day',
            },
            update: {
              $set: {
                student: r.studentId,
                class: cls._id,
                teacher: req.user._id,
                date: attendanceDate,
                timeIn,
                status: r.status,
                attendanceType: 'Daily',
                period: 'Full Day',
                academicYear: activeYear._id,
                term: activeTerm._id,
                enteredBy: req.user._id,
              },
            },
            upsert: true,
          },
        }));
        await GhanaAttendance.bulkWrite(ops, { session });
      });

      res.json({ message: 'Attendance saved successfully', date, count: records.length });
    } catch (err) { next(err); }
    finally { await session.endSession(); }
  }
);

// ── SCORE ENTRY ────────────────────────────────────────────────────────
// Helper: determine curriculum mode from class level
function getCurriculumMode(level) {
  const jhsLevels = ['JHS 1', 'JHS 2', 'JHS 3', 'SHS 1', 'SHS 2', 'SHS 3'];
  return jhsLevels.includes(level) ? 'JHS' : 'SBC';
}

// @route   GET /api/teacher/scores
// @desc    Get students + current term scores for teacher's class
router.get(
  '/scores',
  [auth, authorizeRoles('teacher', 'class teacher')],
  async (req, res, next) => {
    try {
      const cls = await getTeacherClass(req.user._id);
      if (!cls) return res.status(403).json({ message: 'No class assigned' });

      const students = await GhanaStudent.find({ currentClass: cls._id, status: 'Active' }).sort({ lastName:1, firstName:1 });

      const GhanaSubject = require('../models/GhanaSubject');
      const subjects = await GhanaSubject.find({ class: cls._id, isActive: true }).sort({ name: 1 });

      res.json({
        classLevel: cls.level,
        curriculumMode: getCurriculumMode(cls.level),
        students: students.map(s => ({ _id: s._id, firstName: s.firstName, lastName: s.lastName, studentId: s.studentId })),
        subjects: subjects.map(s => ({ _id: s._id, name: s.name, code: s.code })),
      });
    } catch (err) { next(err); }
  }
);

// @route   POST /api/teacher/scores/submit
// @desc    Submit scores for students in teacher's class
router.post(
  '/scores/submit',
  [auth, authorizeRoles('teacher', 'class teacher')],
  async (req, res, next) => {
    try {
      const cls = await getTeacherClass(req.user._id);
      if (!cls) return res.status(403).json({ message: 'No class assigned' });

      const { scores, curriculumMode } = req.body;
      if (!Array.isArray(scores) || scores.length === 0) {
        return res.status(400).json({ message: 'scores array is required' });
      }

      // Validate scores per mode
      const validModes = ['SBC', 'JHS'];
      if (!validModes.includes(curriculumMode)) {
        return res.status(400).json({ message: 'curriculumMode must be SBC or JHS' });
      }
      const sbcValues = ['EXCEEDS_EXPECTATIONS','MEETS_EXPECTATIONS','APPROACHING_EXPECTATIONS','BELOW_EXPECTATIONS'];

      for (const entry of scores) {
        if (curriculumMode === 'SBC') {
          if (!sbcValues.includes(entry.value)) {
            return res.status(400).json({ message: `Invalid SBC value: ${entry.value}` });
          }
        } else {
          const cw = parseInt(entry.courseworkScore, 10);
          const exam = parseInt(entry.examScore, 10);
          if (isNaN(cw) || cw < 0 || cw > 30) return res.status(400).json({ message: 'courseworkScore must be 0-30' });
          if (isNaN(exam) || exam < 0 || exam > 70) return res.status(400).json({ message: 'examScore must be 0-70' });
        }
      }

      // TODO: persist to GhanaReportCard or ScoreSubmission model when available
      res.json({ message: 'Scores submitted successfully', count: scores.length, curriculumMode });
    } catch (err) { next(err); }
  }
);

// ── REMARKS ────────────────────────────────────────────────────────────
// @route   GET /api/teacher/remarks
// @desc    Get students needing class teacher remarks
router.get(
  '/remarks',
  [auth, authorizeRoles('teacher', 'class teacher')],
  async (req, res, next) => {
    try {
      const cls = await getTeacherClass(req.user._id);
      if (!cls) return res.status(403).json({ message: 'No class assigned' });

      const students = await GhanaStudent.find({ currentClass: cls._id, status: 'Active' }).sort({ lastName:1, firstName:1 });
      res.json(students.map(s => ({
        studentId: s._id,
        firstName: s.firstName,
        lastName: s.lastName,
        studentCode: s.studentId,
        remark: s.classTeacherRemark || '',
        status: s.reportCardStatus || 'PENDING',
      })));
    } catch (err) { next(err); }
  }
);

// @route   PATCH /api/teacher/remarks/:studentId
// @desc    Save class teacher remarks for a student
router.patch(
  '/remarks/:studentId',
  [auth, authorizeRoles('teacher', 'class teacher')],
  async (req, res, next) => {
    try {
      const cls = await getTeacherClass(req.user._id);
      if (!cls) return res.status(403).json({ message: 'No class assigned' });

      const { remark } = req.body;
      if (!remark || typeof remark !== 'string') return res.status(400).json({ message: 'remark is required' });
      if (remark.length > 300) return res.status(400).json({ message: 'remark must be 300 characters or fewer' });

      // Verify student belongs to this teacher's class
      const student = await GhanaStudent.findOne({ _id: req.params.studentId, currentClass: cls._id });
      if (!student) return res.status(404).json({ message: 'Student not found in your class' });

      student.classTeacherRemark = remark.trim();
      await student.save();

      res.json({ message: 'Remark saved', studentId: student._id });
    } catch (err) { next(err); }
  }
);

module.exports = router;
