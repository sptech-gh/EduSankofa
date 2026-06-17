const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass, createMockAcademicYear, createMockTerm, createMockFee, createMockPayment, createMockReportCard } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("End-to-End System Validation", () => {
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

  describe("Complete Academic Workflow", () => {
    test("should handle complete student lifecycle", async () => {
      // 1. Create academic year
      const AcademicYear = require("../models/AcademicYear");
      AcademicYear.create.mockResolvedValue(testAcademicYear);

      const academicYearResponse = await api("post", "/api/academic-years")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testAcademicYear);
      expect(academicYearResponse.status).toBe(201);

      // 2. Create term
      const Term = require("../models/Term");
      Term.create.mockResolvedValue(testTerm);

      const termResponse = await api("post", "/api/terms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          ...testTerm,
          academicYear: academicYearResponse.body._id
        });
      expect(termResponse.status).toBe(201);

      // 3. Create class
      const ClassModel = require("../models/Class");
      ClassModel.create.mockResolvedValue(testClass);

      const classResponse = await api("post", "/api/classes")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testClass);
      expect(classResponse.status).toBe(201);

      // 4. Create student
      const Student = require("../models/Student");
      Student.create.mockResolvedValue(testStudent);

      const studentResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testStudent);
      expect(studentResponse.status).toBe(201);

      // 5. Enroll student
      const Enrollment = require("../models/Enrollment");
      Enrollment.create.mockResolvedValue({
        student: studentResponse.body._id,
        academicYear: academicYearResponse.body._id,
        class: classResponse.body._id,
        status: "active"
      });

      const enrollmentResponse = await api("post", "/api/enrollments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: studentResponse.body._id,
          academicYear: academicYearResponse.body._id,
          class: classResponse.body._id
        });
      expect(enrollmentResponse.status).toBe(201);

      console.log("✅ Complete student lifecycle working");
    });

    test("should handle complete academic assessment workflow", async () => {
      // 1. Mark attendance
      const Attendance = require("../models/Attendance");
      Attendance.create.mockResolvedValue({
        student: testStudent._id,
        date: "2025-02-14",
        status: "present",
        term: "First Term"
      });

      const attendanceResponse = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "2025-02-14",
          status: "present",
          term: "First Term"
        });
      expect(attendanceResponse.status).toBe(201);

      // 2. Enter grades
      const Grade = require("../models/Grade");
      Grade.create.mockResolvedValue({
        student: testStudent._id,
        subject: "Mathematics",
        assessment: 85,
        exam: 90,
        term: "First Term"
      });

      const gradeResponse = await api("post", "/api/grades")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          subject: "Mathematics",
          assessment: 85,
          exam: 90,
          term: "First Term"
        });
      expect(gradeResponse.status).toBe(201);

      // 3. Generate report card
      const ReportCard = require("../models/ReportCard");
      ReportCard.create.mockResolvedValue(testReportCard);

      const reportCardResponse = await api("post", "/api/report-cards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          academicYearId: testAcademicYear._id,
          termId: testTerm._id,
          subjects: [
            { name: "Mathematics", totalScore: 87.5 }
          ],
          attendance: {
            totalDays: 60,
            daysPresent: 55,
            attendancePercentage: 91.67
          }
        });
      expect(reportCardResponse.status).toBe(201);

      console.log("✅ Complete academic assessment workflow working");
    });
  });

  describe("Complete Financial Workflow", () => {
    test("should handle complete fee and payment lifecycle", async () => {
      // 1. Create fee
      const Fee = require("../models/Fee");
      Fee.create.mockResolvedValue(testFee);

      const feeResponse = await api("post", "/api/fees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          feeType: "tuition",
          amount: 1500,
          dueDate: "2025-03-15"
        });
      expect(feeResponse.status).toBe(201);
      const feeId = feeResponse.body._id;

      // 2. Process payment
      const Payment = require("../models/Payment");
      Payment.create.mockResolvedValue(testPayment);

      const paymentResponse = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          fee: feeId,
          amount: 500,
          paymentMethod: "cash",
          transactionId: "TXN123456"
        });
      expect(paymentResponse.status).toBe(201);

      // 3. Generate receipt
      const receiptResponse = await api("get", `/api/payments/${paymentResponse.body._id}/receipt`)
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(receiptResponse.status).toBe(200);

      // 4. Check fee status
      const feeStatusResponse = await api("get", `/api/fees/${feeId}`)
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(feeStatusResponse.status).toBe(200);
      expect(feeStatusResponse.body.balance).toBe(1000);
      expect(feeStatusResponse.body.status).toBe("partial");

      console.log("✅ Complete fee and payment lifecycle working");
    });

    test("should handle financial reporting workflow", async () => {
      // 1. Get fee summary
      const feeSummaryResponse = await api("get", "/api/fees/summary")
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(feeSummaryResponse.status).toBe(200);
      expect(feeSummaryResponse.body.totalFees).toBeDefined();
      expect(feeSummaryResponse.body.totalPaid).toBeDefined();

      // 2. Get payment summary
      const paymentSummaryResponse = await api("get", "/api/payments/summary")
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(paymentSummaryResponse.status).toBe(200);
      expect(paymentSummaryResponse.body.totalPayments).toBeDefined();
      expect(paymentSummaryResponse.body.paymentMethods).toBeDefined();

      // 3. Get outstanding fees
      const outstandingResponse = await api("get", "/api/fees/outstanding")
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(outstandingResponse.status).toBe(200);
      expect(Array.isArray(outstandingResponse.body.outstanding)).toBe(true);

      console.log("✅ Financial reporting workflow working");
    });
  });

  describe("Complete Promotion Workflow", () => {
    test("should handle complete promotion lifecycle", async () => {
      // 1. Calculate promotion recommendations
      const promotionResponse = await api("post", "/api/promotion/calculate")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          academicYearId: testAcademicYear._id,
          termId: testTerm._id
        });
      expect(promotionResponse.status).toBe(200);
      expect(Array.isArray(promotionResponse.body.results)).toBe(true);

      // 2. Execute promotion
      const executeResponse = await api("post", "/api/promotion/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          academicYearId: testAcademicYear._id,
          termId: testTerm._id,
          promotions: promotionResponse.body.results
        });
      expect(executeResponse.status).toBe(200);
      expect(executeResponse.body.executed).toBe(true);

      // 3. Get promotion history
      const historyResponse = await api("get", "/api/promotion/history")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(historyResponse.status).toBe(200);
      expect(Array.isArray(historyResponse.body.history)).toBe(true);

      console.log("✅ Complete promotion lifecycle working");
    });
  });

  describe("Complete System Administration Workflow", () => {
    test("should handle complete system management workflow", async () => {
      // 1. Create backup
      const backupResponse = await api("post", "/api/backup/create")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          includeDatabase: true,
          includeFiles: true
        });
      expect(backupResponse.status).toBe(200);
      expect(backupResponse.body.backupId).toBeDefined();

      // 2. List backups
      const listResponse = await api("get", "/api/backup/list")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(listResponse.status).toBe(200);
      expect(Array.isArray(listResponse.body.backups)).toBe(true);

      // 3. Get audit logs
      const auditResponse = await api("get", "/api/audit/logs")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(auditResponse.status).toBe(200);
      expect(Array.isArray(auditResponse.body.logs)).toBe(true);

      // 4. Get system settings
      const settingsResponse = await api("get", "/api/settings")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(settingsResponse.status).toBe(200);
      expect(settingsResponse.body.settings).toBeDefined();

      console.log("✅ Complete system management workflow working");
    });
  });

  describe("Complete Parent Portal Workflow", () => {
    test("should handle complete parent portal workflow", async () => {
      // 1. View children's information
      const childrenResponse = await api("get", "/api/students")
        .set("Authorization", `Bearer ${parentToken}`);
      expect(childrenResponse.status).toBe(200);
      expect(Array.isArray(childrenResponse.body)).toBe(true);

      // 2. View children's report cards
      const reportCardResponse = await api("get", `/api/report-cards/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${parentToken}`);
      expect(reportCardResponse.status).toBe(200);
      expect(reportCardResponse.body.subjects).toBeDefined();

      // 3. View fee status
      const feeStatusResponse = await api("get", `/api/fees/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${parentToken}`);
      expect(feeStatusResponse.status).toBe(200);
      expect(Array.isArray(feeStatusResponse.body.fees)).toBe(true);

      // 4. View payment history
      const paymentHistoryResponse = await api("get", `/api/payments/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${parentToken}`);
      expect(paymentHistoryResponse.status).toBe(200);
      expect(Array.isArray(paymentHistoryResponse.body.payments)).toBe(true);

      console.log("✅ Complete parent portal workflow working");
    });
  });

  describe("Complete Dashboard Analytics Workflow", () => {
    test("should handle complete dashboard analytics workflow", async () => {
      // 1. Admin dashboard
      const adminDashboardResponse = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(adminDashboardResponse.status).toBe(200);
      expect(adminDashboardResponse.body.totalStudents).toBeDefined();
      expect(adminDashboardResponse.body.totalFees).toBeDefined();
      expect(adminDashboardResponse.body.totalPayments).toBeDefined();

      // 2. Teacher dashboard
      const teacherDashboardResponse = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(teacherDashboardResponse.status).toBe(200);
      expect(teacherDashboardResponse.body.myStudents).toBeDefined();
      expect(teacherDashboardResponse.body.myClasses).toBeDefined();

      // 3. Accountant dashboard
      const accountantDashboardResponse = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(accountantDashboardResponse.status).toBe(200);
      expect(accountantDashboardResponse.body.financialSummary).toBeDefined();
      expect(accountantDashboardResponse.body.paymentStats).toBeDefined();

      // 4. Parent dashboard
      const parentDashboardResponse = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${parentToken}`);
      expect(parentDashboardResponse.status).toBe(200);
      expect(parentDashboardResponse.body.childrenInfo).toBeDefined();
      expect(parentDashboardResponse.body.feeStatus).toBeDefined();

      console.log("✅ Complete dashboard analytics workflow working");
    });
  });

  describe("System Integration Validation", () => {
    test("should maintain data consistency across all modules", async () => {
      // Create student
      const Student = require("../models/Student");
      Student.create.mockResolvedValue(testStudent);

      const studentResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testStudent);
      expect(studentResponse.status).toBe(201);
      const studentId = studentResponse.body._id;

      // Create fee for student
      const Fee = require("../models/Fee");
      Fee.create.mockResolvedValue({
        ...testFee,
        student: studentId
      });

      const feeResponse = await api("post", "/api/fees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: studentId,
          feeType: "tuition",
          amount: 1500,
          dueDate: "2025-03-15"
        });
      expect(feeResponse.status).toBe(201);
      const feeId = feeResponse.body._id;

      // Process payment for fee
      const Payment = require("../models/Payment");
      Payment.create.mockResolvedValue({
        ...testPayment,
        student: studentId,
        fee: feeId
      });

      const paymentResponse = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: studentId,
          fee: feeId,
          amount: 500,
          paymentMethod: "cash",
          transactionId: "TXN123456"
        });
      expect(paymentResponse.status).toBe(201);

      // Create report card for student
      const ReportCard = require("../models/ReportCard");
      ReportCard.create.mockResolvedValue({
        ...testReportCard,
        student: studentId
      });

      const reportCardResponse = await api("post", "/api/report-cards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: studentId,
          academicYearId: testAcademicYear._id,
          termId: testTerm._id,
          subjects: [
            { name: "Mathematics", totalScore: 87.5 }
          ]
        });
      expect(reportCardResponse.status).toBe(201);

      // Verify all data is consistent
      const studentCheckResponse = await api("get", `/api/students/${studentId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(studentCheckResponse.status).toBe(200);
      expect(studentCheckResponse.body._id).toBe(studentId);

      const feeCheckResponse = await api("get", `/api/fees/${feeId}`)
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(feeCheckResponse.status).toBe(200);
      expect(feeCheckResponse.body.student).toBe(studentId);

      const paymentCheckResponse = await api("get", `/api/payments/${paymentResponse.body._id}`)
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(paymentCheckResponse.status).toBe(200);
      expect(paymentCheckResponse.body.student).toBe(studentId);

      const reportCardCheckResponse = await api("get", `/api/report-cards/student/${studentId}`)
        .set("Authorization", `Bearer ${parentToken}`);
      expect(reportCardCheckResponse.status).toBe(200);
      expect(reportCardCheckResponse.body.student).toBe(studentId);

      console.log("✅ System integration data consistency maintained");
    });
  });

  describe("Error Handling and Recovery", () => {
    test("should handle errors gracefully across all modules", async () => {
      // Test error handling in student creation
      const Student = require("../models/Student");
      Student.create.mockRejectedValue(new Error("Database connection lost"));

      const studentErrorResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testStudent);
      expect(studentErrorResponse.status).toBe(500);
      expect(studentErrorResponse.body.message).toBeDefined();

      // Test error handling in payment processing
      const Payment = require("../models/Payment");
      Payment.create.mockRejectedValue(new Error("Payment gateway error"));

      const paymentErrorResponse = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          amount: 500,
          paymentMethod: "cash"
        });
      expect(paymentErrorResponse.status).toBe(500);
      expect(paymentErrorResponse.body.message).toBeDefined();

      // Test error handling in report card generation
      const ReportCard = require("../models/ReportCard");
      ReportCard.create.mockRejectedValue(new Error("Report generation failed"));

      const reportCardErrorResponse = await api("post", "/api/report-cards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          academicYearId: testAcademicYear._id,
          termId: testTerm._id
        });
      expect(reportCardErrorResponse.status).toBe(500);
      expect(reportCardErrorResponse.body.message).toBeDefined();

      console.log("✅ Error handling and recovery working properly");
    });
  });

  describe("Performance Under Load", () => {
    test("should handle concurrent operations across all modules", async () => {
      // Create multiple concurrent requests
      const promises = [];

      // Concurrent student creation
      for (let i = 0; i < 5; i++) {
        const Student = require("../models/Student");
        Student.create.mockResolvedValue({
          ...testStudent,
          email: `student${i}@test.com`
        });
        
        promises.push(api("post", "/api/students")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            ...testStudent,
            email: `student${i}@test.com`
          }));
      }

      // Concurrent fee creation
      for (let i = 0; i < 5; i++) {
        const Fee = require("../models/Fee");
        Fee.create.mockResolvedValue({
          ...testFee,
          student: `student${i}`
        });
        
        promises.push(api("post", "/api/fees")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            student: `student${i}`,
            feeType: "tuition",
            amount: 1500
          }));
      }

      // Concurrent payment processing
      for (let i = 0; i < 5; i++) {
        const Payment = require("../models/Payment");
        Payment.create.mockResolvedValue({
          ...testPayment,
          student: `student${i}`
        });
        
        promises.push(api("post", "/api/payments")
          .set("Authorization", `Bearer ${accountantToken}`)
          .send({
            student: `student${i}`,
            amount: 500,
            paymentMethod: "cash"
          }));
      }

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect([200, 201]).toContain(response.status);
      });

      console.log("✅ Concurrent operations handled successfully");
    });
  });
});
