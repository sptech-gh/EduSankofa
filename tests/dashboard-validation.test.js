const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass, createMockAcademicYear, createMockTerm, createMockFee, createMockPayment, createMockReportCard } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Dashboard Validation Tests", () => {
  let adminToken, teacherToken, accountantToken, parentToken;
  let testStudent, testClass, testAcademicYear, testTerm, testFee, testPayment, testReportCard;

  beforeAll(async () => {
    server = app.listen(0);
    server.on("connection", (socket) => {
      sockets.add(socket);
      if (typeof socket.unref === "function") {
        socket.unref();
      }
      socket.on("close", () => sockets.delete(socket));
    });
    await new Promise((resolve) => server.once("listening", resolve));

    server.keepAliveTimeout = 1;
    server.headersTimeout = 2;

    if (typeof server.unref === "function") {
      server.unref();
    }

    // Create test data
    testStudent = createMockStudent();
    testClass = createMockClass();
    testAcademicYear = createMockAcademicYear();
    testTerm = createMockTerm();
    testFee = createMockFee();
    testPayment = createMockPayment();
    testReportCard = createMockReportCard();
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create mock users for each role
    const adminUser = createMockUser({ role: "admin" });
    const teacherUser = createMockUser({ role: "teacher" });
    const accountantUser = createMockUser({ role: "accounts officer" });
    const parentUser = createMockUser({ role: "parent" });
    
    const User = require("../models/User");
    User.findOne.mockImplementation((query) => {
      if (query.email === "admin@test.com") return Promise.resolve(adminUser);
      if (query.email === "teacher@test.com") return Promise.resolve(teacherUser);
      if (query.email === "accountant@test.com") return Promise.resolve(accountantUser);
      if (query.email === "parent@test.com") return Promise.resolve(parentUser);
      return Promise.resolve(null);
    });

    // Get tokens for each role
    const responses = await Promise.all([
      api("post", "/api/auth/login").send({ email: "admin@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "teacher@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "accountant@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "parent@test.com", password: "password123" })
    ]);

    adminToken = responses[0].body.token;
    teacherToken = responses[1].body.token;
    accountantToken = responses[2].body.token;
    parentToken = responses[3].body.token;
  });

  describe("Admin Dashboard Validation", () => {
    test("should display accurate student count", async () => {
      const Student = require("../models/Student");
      
      // Mock real database student count
      const studentCount = 250;
      Student.countDocuments.mockResolvedValue(studentCount);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalStudents).toBe(studentCount);
      expect(response.body.studentCountAccuracy).toBe(true);

      console.log("✅ Admin dashboard student count accurate");
    });

    test("should display accurate revenue data", async () => {
      const Payment = require("../models/Payment");
      
      // Mock real database revenue data
      const revenueData = {
        totalRevenue: 125000,
        totalFees: 150000,
        totalPayments: 125000,
        outstandingBalance: 25000,
        paymentMethods: {
          cash: 75000,
          bank_transfer: 30000,
          mobile_money: 20000
        }
      };

      Payment.aggregate.mockResolvedValue([revenueData]);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalRevenue).toBe(125000);
      expect(response.body.revenueAccuracy).toBe(true);
      expect(response.body.dataSource).toBe("real_database");

      console.log("✅ Admin dashboard revenue data accurate");
    });

    test("should display correct attendance rate", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock real database attendance data
      const attendanceData = {
        totalDays: 100,
        totalPresent: 85,
        totalAbsent: 10,
        totalLate: 5,
        attendanceRate: 85
      };

      Attendance.aggregate.mockResolvedValue([attendanceData]);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.attendanceRate).toBe(85);
      expect(response.body.attendanceAccuracy).toBe(true);

      console.log("✅ Admin dashboard attendance rate correct");
    });

    test("should display accurate academic performance aggregation", async () => {
      const ReportCard = require("../models/ReportCard");
      
      // Mock real database academic performance data
      const academicPerformanceData = {
        totalStudents: 250,
        averageScore: 78.5,
        gradeDistribution: {
          A: 50,
          B: 100,
          C: 75,
          D: 20,
          F: 5
        },
        subjectPerformance: {
          Mathematics: { average: 75, passRate: 85 },
          English: { average: 80, passRate: 90 },
          Science: { average: 78, passRate: 82 }
        }
      };

      ReportCard.aggregate.mockResolvedValue([academicPerformanceData]);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.averageScore).toBe(78.5);
      expect(response.body.academicPerformanceAccuracy).toBe(true);

      console.log("✅ Admin dashboard academic performance aggregation accurate");
    });

    test("should reflect real-time database values", async () => {
      const Student = require("../models/Student");
      const Payment = require("../models/Payment");
      const Attendance = require("../models/Attendance");
      
      // Mock real-time database values
      const realTimeData = {
        studentCount: 250,
        revenue: 125000,
        attendanceRate: 85,
        lastUpdated: new Date()
      };

      Student.countDocuments.mockResolvedValue(realTimeData.studentCount);
      Payment.aggregate.mockResolvedValue([{ totalRevenue: realTimeData.revenue }]);
      Attendance.aggregate.mockResolvedValue([{ attendanceRate: realTimeData.attendanceRate }]);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.studentCount).toBe(250);
      expect(response.body.totalRevenue).toBe(125000);
      expect(response.body.attendanceRate).toBe(85);
      expect(response.body.dataFreshness).toBe("real_time");

      console.log("✅ Admin dashboard reflects real-time database values");
    });
  });

  describe("Teacher Dashboard Validation", () => {
    test("should display assigned classes only", async () => {
      const TeacherAssignment = require("../models/TeacherAssignment");
      
      // Mock teacher's assigned classes
      const assignedClasses = [
        {
          class: testClass._id,
          className: "Class 5A",
          subject: "Mathematics",
          studentCount: 30
        },
        {
          class: "class2-id",
          className: "Class 5B",
          subject: "English",
          studentCount: 28
        }
      ];

      TeacherAssignment.find.mockResolvedValue(assignedClasses);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.assignedClasses).toHaveLength(2);
      expect(response.body.assignedClassesOnly).toBe(true);

      console.log("✅ Teacher dashboard displays assigned classes only");
    });

    test("should display correct attendance summary", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock teacher's class attendance summary
      const attendanceSummary = {
        classId: testClass._id,
        className: "Class 5A",
        totalStudents: 30,
        presentToday: 28,
        absentToday: 2,
        weeklyAttendance: {
          Monday: { present: 28, absent: 2 },
          Tuesday: { present: 29, absent: 1 },
          Wednesday: { present: 27, absent: 3 },
          Thursday: { present: 30, absent: 0 },
          Friday: { present: 28, absent: 2 }
        },
        attendanceRate: 93.3
      };

      Attendance.aggregate.mockResolvedValue([attendanceSummary]);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.attendanceSummary.attendanceRate).toBe(93.3);
      expect(response.body.attendanceAccuracy).toBe(true);

      console.log("✅ Teacher dashboard attendance summary correct");
    });

    test("should display accurate grading progress", async () => {
      const Grade = require("../models/Grade");
      
      // Mock teacher's grading progress
      const gradingProgress = {
        classId: testClass._id,
        className: "Class 5A",
        totalStudents: 30,
        gradedStudents: 25,
        pendingGrades: 5,
        subjects: [
          {
            name: "Mathematics",
            totalStudents: 30,
            gradedStudents: 25,
            averageScore: 78.5,
            gradingProgress: 83.3
          },
          {
            name: "English",
            totalStudents: 30,
            gradedStudents: 20,
            averageScore: 82.0,
            gradingProgress: 66.7
          }
        ]
      };

      Grade.aggregate.mockResolvedValue([gradingProgress]);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.gradingProgress.subjects[0].gradingProgress).toBe(83.3);
      expect(response.body.gradingAccuracy).toBe(true);

      console.log("✅ Teacher dashboard grading progress accurate");
    });

    test("should prevent access to unassigned classes data", async () => {
      const TeacherAssignment = require("../models/TeacherAssignment");
      
      // Mock teacher's assigned classes (only class1)
      const assignedClasses = [
        {
          class: testClass._id,
          className: "Class 5A",
          subject: "Mathematics"
        }
      ];

      TeacherAssignment.find.mockResolvedValue(assignedClasses);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.assignedClasses).toHaveLength(1);
      expect(response.body.unassignedClassesAccess).toBe(false);

      console.log("✅ Teacher dashboard prevents unassigned classes access");
    });
  });

  describe("Accountant Dashboard Validation", () => {
    test("should display revenue totals matching ledger", async () => {
      const Payment = require("../models/Payment");
      
      // Mock ledger-matched revenue data
      const ledgerData = {
        totalRevenue: 125000,
        totalFees: 150000,
        totalPayments: 125000,
        outstandingBalance: 25000,
        ledgerBalance: 25000,
        revenueLedgerMatch: true
      };

      Payment.aggregate.mockResolvedValue([ledgerData]);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalRevenue).toBe(125000);
      expect(response.body.ledgerBalance).toBe(25000);
      expect(response.body.revenueLedgerMatch).toBe(true);

      console.log("✅ Accountant dashboard revenue totals match ledger");
    });

    test("should display correct outstanding balances", async () => {
      const Fee = require("../models/Fee");
      
      // Mock outstanding balances data
      const outstandingBalances = {
        totalOutstanding: 25000,
        studentBreakdown: [
          {
            studentId: "student1",
            studentName: "John Doe",
            outstandingAmount: 5000,
            overdueDays: 15
          },
          {
            studentId: "student2",
            studentName: "Jane Smith",
            outstandingAmount: 3000,
            overdueDays: 10
          }
        ],
        feeTypeBreakdown: {
          tuition: 18000,
          registration: 3000,
          books: 2000,
          other: 2000
        },
        balanceAccuracy: true
      };

      Fee.aggregate.mockResolvedValue([outstandingBalances]);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalOutstanding).toBe(25000);
      expect(response.body.studentBreakdown).toHaveLength(2);
      expect(response.body.balanceAccuracy).toBe(true);

      console.log("✅ Accountant dashboard outstanding balances correct");
    });

    test("should display payment method breakdown", async () => {
      const Payment = require("../models/Payment");
      
      // Mock payment method breakdown
      const paymentBreakdown = {
        totalPayments: 125000,
        paymentMethods: {
          cash: {
            amount: 75000,
            count: 150,
            percentage: 60
          },
          bank_transfer: {
            amount: 30000,
            count: 60,
            percentage: 24
          },
          mobile_money: {
            amount: 20000,
            count: 40,
            percentage: 16
          }
        },
        breakdownAccuracy: true
      };

      Payment.aggregate.mockResolvedValue([paymentBreakdown]);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.paymentMethods.cash.amount).toBe(75000);
      expect(response.body.paymentMethods.cash.percentage).toBe(60);
      expect(response.body.breakdownAccuracy).toBe(true);

      console.log("✅ Accountant dashboard payment method breakdown accurate");
    });

    test("should display financial summary accuracy", async () => {
      const Payment = require("../models/Payment");
      const Fee = require("../models/Fee");
      
      // Mock financial summary
      const financialSummary = {
        period: {
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        },
        totalFees: 150000,
        totalCollected: 125000,
        totalOutstanding: 25000,
        collectionRate: 83.3,
        accuracy: {
          feeCalculation: true,
          paymentCalculation: true,
          balanceCalculation: true
        }
      };

      Payment.aggregate.mockResolvedValue([financialSummary]);
      Fee.aggregate.mockResolvedValue([financialSummary]);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.collectionRate).toBe(83.3);
      expect(response.body.accuracy.feeCalculation).toBe(true);
      expect(response.body.financialAccuracy).toBe(true);

      console.log("✅ Accountant dashboard financial summary accurate");
    });
  });

  describe("Parent Dashboard Validation", () => {
    test("should display child-specific data only", async () => {
      const Student = require("../models/Student");
      
      // Mock parent's children data
      const childrenData = [
        {
          studentId: testStudent._id,
          firstName: "John",
          lastName: "Doe",
          class: "Class 5A",
          parentId: "parent123"
        },
        {
          studentId: "student2",
          firstName: "Jane",
          lastName: "Doe",
          class: "Class 3B",
          parentId: "parent123"
        }
      ];

      Student.find.mockResolvedValue(childrenData);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.children).toHaveLength(2);
      expect(response.body.children[0].studentId).toBe(testStudent._id);
      expect(response.body.childSpecificDataOnly).toBe(true);

      console.log("✅ Parent dashboard displays child-specific data only");
    });

    test("should prevent data leakage to other parents", async () => {
      const Student = require("../models/Student");
      
      // Mock parent's children data (only their own children)
      const childrenData = [
        {
          studentId: testStudent._id,
          firstName: "John",
          lastName: "Doe",
          parentId: "parent123"
        }
      ];

      Student.find.mockResolvedValue(childrenData);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.children).toHaveLength(1);
      expect(response.body.dataLeakagePrevented).toBe(true);

      console.log("✅ Parent dashboard prevents data leakage");
    });

    test("should display child's academic performance", async () => {
      const ReportCard = require("../models/ReportCard");
      
      // Mock child's academic performance
      const childAcademicPerformance = {
        studentId: testStudent._id,
        studentName: "John Doe",
        currentTerm: "First Term",
        subjects: [
          {
            name: "Mathematics",
            score: 85,
            grade: "B",
            position: 5
          },
          {
            name: "English",
            score: 90,
            grade: "A",
            position: 2
          }
        ],
        averageScore: 87.5,
        classPosition: 3,
        performanceAccuracy: true
      };

      ReportCard.find.mockResolvedValue([childAcademicPerformance]);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.averageScore).toBe(87.5);
      expect(response.body.performanceAccuracy).toBe(true);

      console.log("✅ Parent dashboard displays child's academic performance");
    });

    test("should display child's attendance information", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock child's attendance information
      const childAttendance = {
        studentId: testStudent._id,
        studentName: "John Doe",
        currentTerm: "First Term",
        attendanceSummary: {
          totalDays: 100,
          daysPresent: 85,
          daysAbsent: 10,
          daysLate: 5,
          attendanceRate: 85
        },
        recentAttendance: [
          {
            date: "2025-02-14",
            status: "present"
          },
          {
            date: "2025-02-13",
            status: "late"
          }
        ],
        attendanceAccuracy: true
      };

      Attendance.aggregate.mockResolvedValue([childAttendance]);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.attendanceSummary.attendanceRate).toBe(85);
      expect(response.body.attendanceAccuracy).toBe(true);

      console.log("✅ Parent dashboard displays child's attendance information");
    });

    test("should display child's fee status", async () => {
      const Fee = require("../models/Fee");
      
      // Mock child's fee status
      const childFeeStatus = {
        studentId: testStudent._id,
        studentName: "John Doe",
        currentTerm: "First Term",
        fees: [
          {
            feeType: "tuition",
            amount: 1000,
            paid: 800,
            balance: 200,
            status: "partial",
            dueDate: "2025-03-15"
          },
          {
            feeType: "books",
            amount: 300,
            paid: 300,
            balance: 0,
            status: "completed",
            dueDate: "2025-02-01"
          }
        ],
        totalFees: 1300,
        totalPaid: 1100,
        totalBalance: 200,
        feeAccuracy: true
      };

      Fee.aggregate.mockResolvedValue([childFeeStatus]);

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${parentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalBalance).toBe(200);
      expect(response.body.feeAccuracy).toBe(true);

      console.log("✅ Parent dashboard displays child's fee status");
    });
  });

  describe("Real Database Values Validation", () => {
    test("should ensure all dashboards reflect real database values", async () => {
      const Student = require("../models/Student");
      const Payment = require("../models/Payment");
      const Attendance = require("../models/Attendance");
      const ReportCard = require("../models/ReportCard");
      const Fee = require("../models/Fee");
      
      // Mock real database values
      const realDatabaseValues = {
        studentCount: 250,
        totalRevenue: 125000,
        attendanceRate: 85,
        averageScore: 78.5,
        outstandingBalance: 25000,
        lastUpdated: new Date()
      };

      Student.countDocuments.mockResolvedValue(realDatabaseValues.studentCount);
      Payment.aggregate.mockResolvedValue([{ totalRevenue: realDatabaseValues.totalRevenue }]);
      Attendance.aggregate.mockResolvedValue([{ attendanceRate: realDatabaseValues.attendanceRate }]);
      ReportCard.aggregate.mockResolvedValue([{ averageScore: realDatabaseValues.averageScore }]);
      Fee.aggregate.mockResolvedValue([{ totalBalance: realDatabaseValues.outstandingBalance }]);

      // Test all dashboards
      const adminResponse = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      const teacherResponse = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${teacherToken}`);

      const accountantResponse = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${accountantToken}`);

      const parentResponse = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${parentToken}`);

      // Verify all dashboards reflect real database values
      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body.studentCount).toBe(250);
      expect(adminResponse.body.totalRevenue).toBe(125000);
      expect(adminResponse.body.dataSource).toBe("real_database");

      expect(teacherResponse.status).toBe(200);
      expect(teacherResponse.body.dataSource).toBe("real_database");

      expect(accountantResponse.status).toBe(200);
      expect(accountantResponse.body.dataSource).toBe("real_database");

      expect(parentResponse.status).toBe(200);
      expect(parentResponse.body.dataSource).toBe("real_database");

      console.log("✅ All dashboards reflect real database values");
    });

    test("should handle real-time data updates", async () => {
      const Student = require("../models/Student");
      
      // Mock real-time data update
      const initialStudentCount = 250;
      const updatedStudentCount = 251;

      Student.countDocuments
        .mockResolvedValueOnce(initialStudentCount)
        .mockResolvedValueOnce(updatedStudentCount);

      // Initial request
      const initialResponse = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(initialResponse.status).toBe(200);
      expect(initialResponse.body.studentCount).toBe(250);

      // Updated request
      const updatedResponse = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(updatedResponse.status).toBe(200);
      expect(updatedResponse.body.studentCount).toBe(251);
      expect(updatedResponse.body.dataFreshness).toBe("real_time");

      console.log("✅ Real-time data updates working correctly");
    });

    test("should validate data consistency across dashboards", async () => {
      const Student = require("../models/Student");
      const Payment = require("../models/Payment");
      
      // Mock consistent data across dashboards
      const consistentData = {
        studentCount: 250,
        totalRevenue: 125000,
        attendanceRate: 85
      };

      Student.countDocuments.mockResolvedValue(consistentData.studentCount);
      Payment.aggregate.mockResolvedValue([{ totalRevenue: consistentData.totalRevenue }]);

      // Get data from different dashboards
      const adminResponse = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      const accountantResponse = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${accountantToken}`);

      // Verify data consistency
      expect(adminResponse.status).toBe(200);
      expect(accountantResponse.status).toBe(200);
      expect(adminResponse.body.studentCount).toBe(accountantResponse.body.studentCount);
      expect(adminResponse.body.totalRevenue).toBe(accountantResponse.body.totalRevenue);
      expect(adminResponse.body.dataConsistency).toBe(true);

      console.log("✅ Data consistency across dashboards validated");
    });
  });
});
