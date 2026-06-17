const express = require("express");
const GhanaStudent = require("../models/GhanaStudent");
const GhanaClass = require("../models/GhanaClass");
const GhanaReportCard = require("../models/GhanaReportCard");
const GhanaAttendance = require("../models/GhanaAttendance");
const GhanaAnnouncement = require("../models/GhanaAnnouncement");
const StudentLedger = require("../models/StudentLedger");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const User = require("../models/User");
const { auth, authorizeRoles } = require("../middleware/auth");
const { rbac } = require("../middleware/rbac");

const router = express.Router();

// ============= ADMIN DASHBOARD =============

router.get(
  "/admin",
  auth,
  rbac("system", "viewAll"),
  async (req, res) => {
    try {
      const { academicYearId, termId } = req.query;

      // Get current academic year and term if not provided
      let currentAcademicYear, currentTerm;
      if (academicYearId) {
        currentAcademicYear = await AcademicYear.findById(academicYearId);
      } else {
        currentAcademicYear = await AcademicYear.findOne({ isActive: true });
      }
      
      if (termId) {
        currentTerm = await Term.findById(termId);
      } else if (currentAcademicYear) {
        currentTerm = await Term.findOne({ 
          academicYear: currentAcademicYear._id,
          isActive: true 
        });
      }

      // Get total students
      const totalStudents = await GhanaStudent.countDocuments({ status: "Active" });
      
      // Get students by level
      const studentsByLevel = await GhanaStudent.aggregate([
        { $match: { status: "Active" } },
        {
          $group: {
            _id: "$currentLevel",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Get class statistics
      const classStats = await GhanaClass.aggregate([
        {
          $lookup: {
            from: "ghanastudents",
            localField: "_id",
            foreignField: "currentClass",
            as: "students",
          },
        },
        {
          $project: {
            name: 1,
            level: 1,
            section: 1,
            totalStudents: { $size: "$students" },
            capacity: 1,
            enrollmentRate: {
              $multiply: [
                { $divide: [{ $size: "$students" }, "$capacity"] },
                100,
              ],
            },
          },
        },
        { $sort: { level: 1, name: 1 } },
      ]);

      // Get attendance statistics
      let attendanceStats = { totalDays: 0, presentDays: 0, attendanceRate: 0 };
      if (currentAcademicYear && currentTerm) {
        attendanceStats = await GhanaAttendance.aggregate([
          {
            $match: {
              academicYear: currentAcademicYear._id,
              term: currentTerm._id,
            },
          },
          {
            $group: {
              _id: null,
              totalDays: { $sum: 1 },
              presentDays: {
                $sum: {
                  $cond: [
                    { $in: ["$status", ["Present", "Late"]] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]);
        attendanceStats = attendanceStats[0] || { totalDays: 0, presentDays: 0 };
        attendanceStats.attendanceRate = attendanceStats.totalDays > 0 
          ? Math.round((attendanceStats.presentDays / attendanceStats.totalDays) * 100)
          : 0;
      }

      // Get academic performance summary
      let academicStats = {
        totalReportCards: 0,
        averageScore: 0,
        averageGPA: 0,
        gradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 },
      };

      if (currentAcademicYear && currentTerm) {
        academicStats = await GhanaReportCard.aggregate([
          {
            $match: {
              academicYear: currentAcademicYear._id,
              term: currentTerm._id,
              status: "Published",
            },
          },
          {
            $group: {
              _id: null,
              totalReportCards: { $sum: 1 },
              averageScore: { $avg: "$overallPerformance.averageScore" },
              averageGPA: { $avg: "$overallPerformance.overallGPA" },
            },
          },
        ]);
        
        academicStats = academicStats[0] || academicStats;

        // Get grade distribution
        const gradeDist = await GhanaReportCard.aggregate([
          {
            $match: {
              academicYear: currentAcademicYear._id,
              term: currentTerm._id,
              status: "Published",
            },
          },
          { $unwind: "$subjects" },
          {
            $group: {
              _id: "$subjects.grade",
              count: { $sum: 1 },
            },
          },
        ]);

        gradeDist.forEach(grade => {
          academicStats.gradeDistribution[grade._id] = grade.count;
        });
      }

      // Get financial summary
      let financialStats = {
        totalRevenue: 0,
        totalCollected: 0,
        outstandingBalance: 0,
        collectionRate: 0,
      };

      if (currentAcademicYear && currentTerm) {
        const ledgerStats = await StudentLedger.getPaymentStatistics(
          currentAcademicYear._id,
          currentTerm._id
        );
        financialStats = ledgerStats;
      }

      // Get recent activities
      const recentActivities = await Promise.all([
        // Recent enrollments
        GhanaStudent.find({ status: "Active" })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("firstName lastName studentId createdAt currentLevel"),
        
        // Recent report cards
        GhanaReportCard.find({ status: "Published" })
          .sort({ publishedDate: -1 })
          .limit(5)
          .populate("student", "firstName lastName studentId")
          .select("student overallPerformance.averageScore publishedDate"),
        
        // Recent announcements
        GhanaAnnouncement.find({ status: "Published" })
          .sort({ scheduledDate: -1 })
          .limit(5)
          .populate("author", "firstName lastName")
          .select("title scheduledDate author"),
      ]);

      res.json({
        period: {
          academicYear: currentAcademicYear,
          term: currentTerm,
        },
        overview: {
          totalStudents,
          totalClasses: classStats.length,
          totalTeachers: await User.countDocuments({ role: "teacher", status: "Active" }),
          totalParents: await User.countDocuments({ role: "parent", status: "Active" }),
        },
        students: {
          total: totalStudents,
          byLevel: studentsByLevel,
          enrollmentStatus: {
            active: totalStudents,
            inactive: await GhanaStudent.countDocuments({ status: "Inactive" }),
            graduated: await GhanaStudent.countDocuments({ status: "Graduated" }),
          },
        },
        classes: classStats,
        attendance: attendanceStats,
        academic: academicStats,
        financial: financialStats,
        recentActivities: {
          enrollments: recentActivities[0],
          reportCards: recentActivities[1],
          announcements: recentActivities[2],
        },
        alerts: {
          lowAttendance: attendanceStats.attendanceRate < 80,
          lowCollection: financialStats.collectionRate < 70,
          overdueFees: financialStats.totalBalance > 0,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= TEACHER DASHBOARD =============

router.get(
  "/teacher",
  auth,
  rbac("academic", "read"),
  async (req, res) => {
    try {
      const { academicYearId, termId } = req.query;

      // Get teacher's assigned classes
      const assignedClasses = await GhanaClass.find({
        $or: [
          { classTeacher: req.user._id },
          { subjectTeachers: req.user._id },
        ],
      })
        .populate("students", "firstName lastName studentId")
        .populate("classTeacher", "firstName lastName");

      // Get attendance statistics for assigned classes
      let attendanceStats = {
        totalStudents: 0,
        presentToday: 0,
        absentToday: 0,
        attendanceRate: 0,
      };

      if (assignedClasses.length > 0 && academicYearId && termId) {
        const classIds = assignedClasses.map(c => c._id);
        
        const attendanceData = await GhanaAttendance.aggregate([
          {
            $match: {
              class: { $in: classIds },
              academicYear: new mongoose.Types.ObjectId(academicYearId),
              term: new mongoose.Types.ObjectId(termId),
              date: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                $lt: new Date(new Date().setHours(23, 59, 59, 999)),
              },
            },
          },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]);

        const attendanceMap = {};
        attendanceData.forEach(item => {
          attendanceMap[item._id] = item.count;
        });

        attendanceStats.totalStudents = assignedClasses.reduce(
          (sum, cls) => sum + cls.students.length,
          0
        );
        attendanceStats.presentToday = (attendanceMap["Present"] || 0) + (attendanceMap["Late"] || 0);
        attendanceStats.absentToday = attendanceMap["Absent"] || 0;
        attendanceStats.attendanceRate = attendanceStats.totalStudents > 0
          ? Math.round((attendanceStats.presentToday / attendanceStats.totalStudents) * 100)
          : 0;
      }

      // Get grading progress
      let gradingStats = {
        totalSubjects: 0,
        gradedSubjects: 0,
        pendingGrades: 0,
        averageScore: 0,
      };

      if (academicYearId && termId) {
        const subjects = await GhanaSubject.find({
          academicYear: academicYearId,
          term: termId,
          $or: [
            { teacher: req.user._id },
            { teachers: req.user._id },
          ],
        });

        gradingStats.totalSubjects = subjects.length;

        // Get report cards for teacher's subjects
        const reportCards = await GhanaReportCard.find({
          academicYear: academicYearId,
          term: termId,
          status: "Published",
          "subjects.subjectTeacher": req.user._id,
        });

        gradingStats.gradedSubjects = reportCards.length;
        gradingStats.pendingGrades = gradingStats.totalSubjects - gradingStats.gradedSubjects;

        if (reportCards.length > 0) {
          const totalScore = reportCards.reduce(
            (sum, card) => sum + card.overallPerformance.averageScore,
            0
          );
          gradingStats.averageScore = Math.round(totalScore / reportCards.length);
        }
      }

      // Get class performance summary
      const classPerformance = await Promise.all(
        assignedClasses.map(async (cls) => {
          if (!academicYearId || !termId) return null;

          const classReportCards = await GhanaReportCard.find({
            class: cls._id,
            academicYear: academicYearId,
            term: termId,
            status: "Published",
          });

          if (classReportCards.length === 0) return null;

          const averageScore = classReportCards.reduce(
            (sum, card) => sum + card.overallPerformance.averageScore,
            0
          ) / classReportCards.length;

          return {
            classId: cls._id,
            className: cls.name,
            level: cls.level,
            totalStudents: cls.students.length,
            averageScore: Math.round(averageScore),
            gradeDistribution: {
              A: 0, B: 0, C: 0, D: 0, E: 0, F: 0
            },
          };
        })
      );

      // Get upcoming events/activities
      const upcomingEvents = await GhanaAnnouncement.find({
        targetAudience: { $in: ["Teachers", "All Users"] },
        status: "Published",
        scheduledDate: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
        },
      })
        .sort({ scheduledDate: 1 })
        .limit(5)
        .select("title scheduledDate priority category");

      res.json({
        teacher: {
          name: `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email,
          role: req.user.role,
        },
        assignedClasses: assignedClasses.map(cls => ({
          id: cls._id,
          name: cls.name,
          level: cls.level,
          section: cls.section,
          totalStudents: cls.students.length,
          isClassTeacher: cls.classTeacher?.toString() === req.user._id.toString(),
        })),
        attendance: attendanceStats,
        grading: gradingStats,
        classPerformance: classPerformance.filter(Boolean),
        upcomingEvents,
        alerts: {
          lowAttendance: attendanceStats.attendanceRate < 80,
          pendingGrades: gradingStats.pendingGrades > 0,
          upcomingDeadlines: false, // Would be calculated based on grading deadlines
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= ACCOUNTANT DASHBOARD =============

router.get(
  "/accountant",
  auth,
  rbac("financial", "read"),
  async (req, res) => {
    try {
      const { academicYearId, termId } = req.query;

      // Get current academic period
      let currentAcademicYear, currentTerm;
      if (academicYearId) {
        currentAcademicYear = await AcademicYear.findById(academicYearId);
      } else {
        currentAcademicYear = await AcademicYear.findOne({ isActive: true });
      }
      
      if (termId) {
        currentTerm = await Term.findById(termId);
      } else if (currentAcademicYear) {
        currentTerm = await Term.findOne({ 
          academicYear: currentAcademicYear._id,
          isActive: true 
        });
      }

      // Get financial statistics
      let financialStats = {
        totalRevenue: 0,
        totalCollected: 0,
        outstandingBalance: 0,
        collectionRate: 0,
        totalStudents: 0,
        fullyPaid: 0,
        partiallyPaid: 0,
        overdue: 0,
      };

      if (currentAcademicYear && currentTerm) {
        const stats = await StudentLedger.getPaymentStatistics(
          currentAcademicYear._id,
          currentTerm._id
        );
        financialStats = stats;
      }

      // Get payment trends (last 30 days)
      const paymentTrends = await StudentLedger.aggregate([
        {
          $match: currentAcademicYear && currentTerm ? {
            academicYear: currentAcademicYear._id,
            term: currentTerm._id,
          } : {},
        },
        { $unwind: "$transactions" },
        {
          $match: {
            "transactions.type": "Payment",
            "transactions.transactionDate": {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$transactions.transactionDate",
              },
            },
            totalAmount: { $sum: "$transactions.amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Get payment method breakdown
      const paymentMethods = await StudentLedger.aggregate([
        {
          $match: currentAcademicYear && currentTerm ? {
            academicYear: currentAcademicYear._id,
            term: currentTerm._id,
          } : {},
        },
        { $unwind: "$transactions" },
        {
          $match: {
            "transactions.type": "Payment",
          },
        },
        {
          $group: {
            _id: "$transactions.paymentMethod",
            count: { $sum: 1 },
            totalAmount: { $sum: "$transactions.amount" },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]);

      // Get overdue accounts
      const overdueAccounts = await StudentLedger.getOverdueLedgers(
        currentAcademicYear?._id,
        currentTerm?._id
      );

      // Get class-wise collection status
      const classCollections = await StudentLedger.aggregate([
        {
          $match: currentAcademicYear && currentTerm ? {
            academicYear: currentAcademicYear._id,
            term: currentTerm._id,
          } : {},
        },
        {
          $lookup: {
            from: "ghanastudents",
            localField: "student",
            foreignField: "_id",
            as: "studentInfo",
          },
        },
        { $unwind: "$studentInfo" },
        {
          $lookup: {
            from: "ghanaclasses",
            localField: "studentInfo.currentClass",
            foreignField: "_id",
            as: "classInfo",
          },
        },
        { $unwind: "$classInfo" },
        {
          $group: {
            _id: "$classInfo._id",
            className: { $first: "$classInfo.name" },
            level: { $first: "$classInfo.level" },
            totalStudents: { $sum: 1 },
            totalFees: { $sum: "$totalFees" },
            totalPaid: { $sum: "$totalPaid" },
            balance: { $sum: "$balance" },
          },
        },
        {
          $addFields: {
            collectionRate: {
              $multiply: [
                { $divide: ["$totalPaid", "$totalFees"] },
                100,
              ],
            },
          },
        },
        { $sort: { className: 1 } },
      ]);

      // Get recent transactions
      const recentTransactions = await StudentLedger.aggregate([
        {
          $match: currentAcademicYear && currentTerm ? {
            academicYear: currentAcademicYear._id,
            term: currentTerm._id,
          } : {},
        },
        { $unwind: "$transactions" },
        { $sort: { "transactions.transactionDate": -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "ghanastudents",
            localField: "student",
            foreignField: "_id",
            as: "studentInfo",
          },
        },
        { $unwind: "$studentInfo" },
        {
          $project: {
            receiptNumber: "$transactions.receiptNumber",
            amount: "$transactions.amount",
            paymentMethod: "$transactions.paymentMethod",
            transactionDate: "$transactions.transactionDate",
            studentName: {
              $concat: ["$studentInfo.firstName", " ", "$studentInfo.lastName"],
            },
            studentId: "$studentInfo.studentId",
            status: "$transactions.status",
          },
        },
      ]);

      res.json({
        period: {
          academicYear: currentAcademicYear,
          term: currentTerm,
        },
        overview: financialStats,
        trends: {
          daily: paymentTrends,
          paymentMethods,
        },
        overdue: {
          accounts: overdueAccounts.slice(0, 20),
          totalAmount: overdueAccounts.reduce((sum, account) => sum + account.balance, 0),
          count: overdueAccounts.length,
        },
        classCollections,
        recentTransactions,
        alerts: {
          lowCollectionRate: financialStats.collectionRate < 70,
          highOverdue: overdueAccounts.length > 10,
          paymentDecline: paymentTrends.length > 0 && 
            paymentTrends[paymentTrends.length - 1]?.totalAmount < 
            paymentTrends[Math.max(0, paymentTrends.length - 7)]?.totalAmount,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= PARENT DASHBOARD =============

router.get(
  "/parent",
  auth,
  rbac("student", "viewOwn"),
  async (req, res) => {
    try {
      // Get parent's children
      const children = await GhanaStudent.find({
        "guardians.userId": req.user._id,
        status: "Active",
      })
        .populate("currentClass", "name level section")
        .select("firstName lastName studentId currentLevel currentClass");

      if (children.length === 0) {
        return res.json({
          parent: {
            name: `${req.user.firstName} ${req.user.lastName}`,
            email: req.user.email,
          },
          children: [],
          message: "No active students found for this parent",
        });
      }

      // Get comprehensive data for each child
      const childrenData = await Promise.all(
        children.map(async (child) => {
          // Get current academic year and term
          const currentAcademicYear = await AcademicYear.findOne({ isActive: true });
          const currentTerm = currentAcademicYear 
            ? await Term.findOne({ 
                academicYear: currentAcademicYear._id,
                isActive: true 
              })
            : null;

          // Get attendance data
          let attendanceData = {
            totalDays: 0,
            presentDays: 0,
            attendanceRate: 0,
            attendanceGrade: "Good",
          };

          if (currentAcademicYear && currentTerm) {
            const attendanceStats = await GhanaAttendance.getStudentAttendanceSummary(
              child._id,
              currentAcademicYear._id,
              currentTerm._id
            );

            attendanceData = {
              totalDays: attendanceStats.totalDays,
              presentDays: attendanceStats.presentDays,
              attendanceRate: attendanceStats.attendancePercentage,
              attendanceGrade: attendanceStats.attendanceGrade,
            };
          }

          // Get academic performance
          let academicData = {
            latestReportCard: null,
            overallGPA: 0,
            averageScore: 0,
            classPosition: null,
            subjects: [],
          };

          if (currentAcademicYear && currentTerm) {
            const latestReportCard = await GhanaReportCard.findOne({
              student: child._id,
              academicYear: currentAcademicYear._id,
              term: currentTerm._id,
              status: "Published",
            })
              .populate("subjects.subject", "name code");

            if (latestReportCard) {
              academicData = {
                latestReportCard: {
                  id: latestReportCard._id,
                  termName: latestReportCard.termName,
                  overallGPA: latestReportCard.overallPerformance.overallGPA,
                  averageScore: latestReportCard.overallPerformance.averageScore,
                  classPosition: latestReportCard.overallPerformance.classPosition,
                  teacherRemarks: latestReportCard.classTeacherRemarks,
                },
                subjects: latestReportCard.subjects.map(subject => ({
                  name: subject.subjectName,
                  grade: subject.grade,
                  totalScore: subject.totalScore,
                })),
              };
            }
          }

          // Get financial information
          let financialData = {
            totalFees: 0,
            totalPaid: 0,
            balance: 0,
            paymentStatus: "No fees",
            nextPaymentDue: null,
          };

          if (currentAcademicYear && currentTerm) {
            const ledger = await StudentLedger.findOne({
              student: child._id,
              academicYear: currentAcademicYear._id,
              term: currentTerm._id,
            });

            if (ledger) {
              financialData = {
                totalFees: ledger.totalFees,
                totalPaid: ledger.totalPaid,
                balance: ledger.balance,
                paymentStatus: ledger.status,
                nextPaymentDue: ledger.nextPaymentDue,
              };
            }
          }

          // Get recent announcements
          const announcements = await GhanaAnnouncement.find({
            targetAudience: { $in: ["Parents", "All Users"] },
            status: "Published",
            scheduledDate: { $lte: new Date() },
          })
            .sort({ scheduledDate: -1 })
            .limit(5)
            .select("title content scheduledDate priority");

          return {
            student: {
              id: child._id,
              name: `${child.firstName} ${child.lastName}`,
              studentId: child.studentId,
              currentLevel: child.currentLevel,
              currentClass: child.currentClass,
            },
            attendance: attendanceData,
            academic: academicData,
            financial: financialData,
            announcements,
          };
        })
      );

      res.json({
        parent: {
          name: `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email,
        },
        children: childrenData,
        summary: {
          totalChildren: children.length,
          overallAttendanceRate: childrenData.reduce(
            (sum, child) => sum + child.attendance.attendanceRate,
            0
          ) / children.length,
          childrenWithFees: childrenData.filter(c => c.financial.totalFees > 0).length,
          outstandingBalance: childrenData.reduce(
            (sum, child) => sum + child.financial.balance,
            0
          ),
        },
        alerts: {
          lowAttendance: childrenData.some(c => c.attendance.attendanceRate < 80),
          outstandingFees: childrenData.some(c => c.financial.balance > 0),
          poorPerformance: childrenData.some(c => 
            c.academic.averageScore > 0 && c.academic.averageScore < 50
          ),
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= STUDENT DASHBOARD =============

router.get(
  "/student",
  auth,
  rbac("student", "manageSelf"),
  async (req, res) => {
    try {
      // Get student information
      const student = await GhanaStudent.findById(req.user._id)
        .populate("currentClass", "name level section");

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Get current academic year and term
      const currentAcademicYear = await AcademicYear.findOne({ isActive: true });
      const currentTerm = currentAcademicYear 
        ? await Term.findOne({ 
            academicYear: currentAcademicYear._id,
            isActive: true 
          })
        : null;

      // Get attendance data
      let attendanceData = {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        attendanceRate: 0,
        attendanceGrade: "Good",
        monthlyAttendance: [],
      };

      if (currentAcademicYear && currentTerm) {
        const attendanceStats = await GhanaAttendance.getStudentAttendanceSummary(
          student._id,
          currentAcademicYear._id,
          currentTerm._id
        );

        attendanceData = {
          totalDays: attendanceStats.totalDays,
          presentDays: attendanceStats.presentDays,
          absentDays: attendanceStats.absentDays,
          lateDays: attendanceStats.lateDays,
          attendanceRate: attendanceStats.attendancePercentage,
          attendanceGrade: attendanceStats.attendanceGrade,
        };

        // Get monthly attendance trend
        const monthlyTrend = await GhanaAttendance.getAttendanceTrends({
          student: student._id,
          academicYear: currentAcademicYear._id,
          term: currentTerm._id,
          startDate: new Date(new Date().setMonth(new Date().getMonth() - 3)),
          endDate: new Date(),
        });

        attendanceData.monthlyAttendance = monthlyTrend.map(trend => ({
          month: trend.date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          attendanceRate: trend.attendanceRate,
        }));
      }

      // Get academic performance
      let academicData = {
        latestReportCard: null,
        subjectPerformance: [],
        overallGPA: 0,
        classPosition: null,
        gradeHistory: [],
      };

      if (currentAcademicYear && currentTerm) {
        const latestReportCard = await GhanaReportCard.findOne({
          student: student._id,
          academicYear: currentAcademicYear._id,
          term: currentTerm._id,
          status: "Published",
        })
          .populate("subjects.subject", "name code");

        if (latestReportCard) {
          academicData = {
            latestReportCard: {
              id: latestReportCard._id,
              termName: latestReportCard.termName,
              overallGPA: latestReportCard.overallPerformance.overallGPA,
              averageScore: latestReportCard.overallPerformance.averageScore,
              classPosition: latestReportCard.overallPerformance.classPosition,
              teacherRemarks: latestReportCard.classTeacherRemarks,
              headTeacherRemarks: latestReportCard.headTeacherRemarks,
            },
            subjectPerformance: latestReportCard.subjects.map(subject => ({
              name: subject.subjectName,
              code: subject.subjectCode,
              grade: subject.grade,
              totalScore: subject.totalScore,
              gradePoint: subject.gradePoint,
              position: subject.position,
              remarks: subject.remarks,
            })),
          };
        }

        // Get grade history
        const gradeHistory = await GhanaReportCard.find({
          student: student._id,
          status: "Published",
        })
          .sort({ academicYear: -1, term: 1 })
          .populate("academicYear", "name")
          .populate("term", "name")
          .select("overallPerformance.averageScore overallPerformance.overallGPA academicYear term");

        academicData.gradeHistory = gradeHistory.map(card => ({
          academicYear: card.academicYear.name,
          term: card.term.name,
          averageScore: card.overallPerformance.averageScore,
          overallGPA: card.overallPerformance.overallGPA,
        }));
      }

      // Get announcements for students
      const announcements = await GhanaAnnouncement.find({
        targetAudience: { $in: ["Students", "All Users"] },
        status: "Published",
        scheduledDate: { $lte: new Date() },
      })
        .sort({ scheduledDate: -1, priority: -1 })
        .limit(10)
        .select("title content scheduledDate priority category");

      // Get upcoming events/assignments
      const upcomingEvents = await GhanaAnnouncement.find({
        targetAudience: { $in: ["Students", "All Users"] },
        status: "Published",
        scheduledDate: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Next 14 days
        },
        category: { $in: ["Events", "Examination", "Academic"] },
      })
        .sort({ scheduledDate: 1 })
        .limit(5)
        .select("title scheduledDate category priority");

      res.json({
        student: {
          id: student._id,
          name: `${student.firstName} ${student.lastName}`,
          studentId: student.studentId,
          currentLevel: student.currentLevel,
          currentClass: student.currentClass,
        },
        attendance: attendanceData,
        academic: academicData,
        announcements,
        upcomingEvents,
        alerts: {
          lowAttendance: attendanceData.attendanceRate < 80,
          upcomingExams: upcomingEvents.some(e => e.category === "Examination"),
          missingGrades: academicData.latestReportCard === null,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

module.exports = router;
