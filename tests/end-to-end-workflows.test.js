const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass, createMockAcademicYear } = require("./setup-mock");
const User = require("../models/User");
const Student = require("../models/Student");
const ClassModel = require("../models/Class");
const AcademicYear = require("../models/AcademicYear");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("End-to-End Workflow Tests", () => {
  let adminToken, teacherToken, accountantToken, parentToken;
  let testStudent, testClass, testAcademicYear;

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
  });

  afterAll(async () => {
    const http = require("http");
    if (http.globalAgent && typeof http.globalAgent.destroy === "function") {
      http.globalAgent.destroy();
    }
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create test data
    testAcademicYear = createMockAcademicYear();
    testClass = createMockClass();
    testStudent = createMockStudent();
    
    // Mock database operations
    AcademicYear.findOne.mockResolvedValue(testAcademicYear);
    ClassModel.findOne.mockResolvedValue(testClass);
    Student.findOne.mockResolvedValue(testStudent);
    Student.find.mockResolvedValue([testStudent]);
    
    // Create mock users for each role
    const adminUser = createMockUser({ role: "admin" });
    const teacherUser = createMockUser({ role: "teacher" });
    const accountantUser = createMockUser({ role: "accounts officer" });
    const parentUser = createMockUser({ role: "parent" });
    
    User.findOne.mockImplementation((query) => {
      if (query.email === "admin@test.com") return Promise.resolve(adminUser);
      if (query.email === "teacher@test.com") return Promise.resolve(teacherUser);
      if (query.email === "accountant@test.com") return Promise.resolve(accountantUser);
      if (query.email === "parent@test.com") return Promise.resolve(parentUser);
      return Promise.resolve(null);
    });
  });

  describe("Admin Complete Workflow", () => {
    test("should complete full administrative workflow", async () => {
      // 1. Admin Login
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "admin@test.com",
        password: "password123"
      });
      expect(loginResponse.status).toBe(200);
      adminToken = loginResponse.body.token;

      // 2. Create Student
      const studentResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          firstName: "Test",
          lastName: "Student",
          email: "student@test.com",
          dateOfBirth: "2010-01-01",
          gender: "Male",
          nationality: "Ghanaian",
          birthCertificateNumber: "BC123456",
          nhisNumber: "NHIS789012"
        });
      expect(studentResponse.status).toBe(201);
      const studentId = studentResponse.body._id;

      // 3. Create Fee
      const feeResponse = await api("post", "/api/fees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: studentId,
          feeType: "tuition",
          academicYear: testAcademicYear._id,
          amount: 1500,
          dueDate: "2025-03-15"
        });
      expect(feeResponse.status).toBe(201);
      const feeId = feeResponse.body._id;

      // 4. Process Payment
      const paymentResponse = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: studentId,
          fee: feeId,
          amount: 500,
          paymentMethod: "cash",
          transactionId: "TXN123456"
        });
      expect(paymentResponse.status).toBe(201);

      // 5. Generate Report Card
      const reportCardResponse = await api("post", "/api/report-cards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: studentId,
          academicYearId: testAcademicYear._id,
          termId: "term123",
          subjects: [
            {
              name: "Mathematics",
              classScore: 85,
              examScore: 90,
              totalScore: 87.5
            }
          ],
          attendance: {
            totalDays: 60,
            daysPresent: 55,
            attendancePercentage: 91.67
          }
        });
      expect(reportCardResponse.status).toBe(201);

      // 6. Calculate Promotion
      const promotionResponse = await api("post", "/api/promotion/calculate")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          academicYearId: testAcademicYear._id,
          termId: "term123"
        });
      expect(promotionResponse.status).toBe(200);
      expect(promotionResponse.body.results).toBeDefined();

      console.log("✅ Admin workflow completed successfully");
    });
  });

  describe("Teacher Complete Workflow", () => {
    test("should complete full teacher workflow", async () => {
      // 1. Teacher Login
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "teacher@test.com",
        password: "password123"
      });
      expect(loginResponse.status).toBe(200);
      teacherToken = loginResponse.body.token;

      // 2. View Assigned Students
      const studentsResponse = await api("get", "/api/students")
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(studentsResponse.status).toBe(200);
      expect(Array.isArray(studentsResponse.body)).toBe(true);

      // 3. Mark Attendance
      const attendanceResponse = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "2025-02-14",
          status: "present",
          term: "First Term"
        });
      expect(attendanceResponse.status).toBe(201);

      // 4. Enter Grades
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

      // 5. Generate Report Card (Teacher View)
      const reportCardResponse = await api("get", `/api/report-cards/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(reportCardResponse.status).toBe(200);

      console.log("✅ Teacher workflow completed successfully");
    });
  });

  describe("Accountant Complete Workflow", () => {
    test("should complete full accountant workflow", async () => {
      // 1. Accountant Login
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "accountant@test.com",
        password: "password123"
      });
      expect(loginResponse.status).toBe(200);
      accountantToken = loginResponse.body.token;

      // 2. View Fee Dashboard
      const feesResponse = await api("get", "/api/fees")
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(feesResponse.status).toBe(200);
      expect(Array.isArray(feesResponse.body.fees)).toBe(true);

      // 3. Process Payment
      const paymentResponse = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          amount: 500,
          paymentMethod: "bank_transfer",
          transactionId: "TXN789012"
        });
      expect(paymentResponse.status).toBe(201);

      // 4. View Payment History
      const paymentsResponse = await api("get", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(paymentsResponse.status).toBe(200);
      expect(Array.isArray(paymentsResponse.body.payments)).toBe(true);

      // 5. Generate Financial Report
      const financialReportResponse = await api("get", "/api/fees/summary")
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(financialReportResponse.status).toBe(200);

      console.log("✅ Accountant workflow completed successfully");
    });
  });

  describe("Parent Complete Workflow", () => {
    test("should complete full parent workflow", async () => {
      // 1. Parent Login
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "parent@test.com",
        password: "password123"
      });
      expect(loginResponse.status).toBe(200);
      parentToken = loginResponse.body.token;

      // 2. View Children's Information
      const studentsResponse = await api("get", "/api/students")
        .set("Authorization", `Bearer ${parentToken}`);
      expect(studentsResponse.status).toBe(200);

      // 3. View Children's Report Cards
      const reportCardResponse = await api("get", `/api/report-cards/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${parentToken}`);
      expect(reportCardResponse.status).toBe(200);
      expect(reportCardResponse.body.subjects).toBeDefined();

      // 4. View Fee Status
      const feesResponse = await api("get", `/api/fees/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${parentToken}`);
      expect(feesResponse.status).toBe(200);

      // 5. View Payment History
      const paymentsResponse = await api("get", `/api/payments/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${parentToken}`);
      expect(paymentsResponse.status).toBe(200);

      console.log("✅ Parent workflow completed successfully");
    });
  });

  describe("Cross-Role Data Integrity", () => {
    test("should maintain data integrity across role interactions", async () => {
      // Admin creates data
      const studentResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          firstName: "Integrity",
          lastName: "Test",
          email: "integrity@test.com",
          dateOfBirth: "2010-01-01"
        });
      expect(studentResponse.status).toBe(201);
      const studentId = studentResponse.body._id;

      // Teacher can view but not delete
      const teacherViewResponse = await api("get", `/api/students/${studentId}`)
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(teacherViewResponse.status).toBe(200);

      const teacherDeleteResponse = await api("delete", `/api/students/${studentId}`)
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(teacherDeleteResponse.status).toBe(403); // Forbidden

      // Accountant can view financial data but not academic records
      const accountantFeesResponse = await api("get", `/api/fees/student/${studentId}`)
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(accountantFeesResponse.status).toBe(200);

      const accountantGradesResponse = await api("get", `/api/grades/student/${studentId}`)
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(accountantGradesResponse.status).toBe(403); // Forbidden

      // Parent can only view their children's data
      const parentReportResponse = await api("get", `/api/report-cards/student/${studentId}`)
        .set("Authorization", `Bearer ${parentToken}`);
      expect(parentReportResponse.status).toBe(200);

      console.log("✅ Cross-role data integrity maintained");
    });
  });

  describe("Financial Data Consistency", () => {
    test("should maintain financial data consistency", async () => {
      // Create fee
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

      // Process partial payment
      const payment1Response = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          fee: feeId,
          amount: 500,
          paymentMethod: "cash"
        });
      expect(payment1Response.status).toBe(201);

      // Check balance calculation
      const balanceResponse = await api("get", `/api/fees/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(balanceResponse.status).toBe(200);
      
      const fee = balanceResponse.body.fees.find(f => f._id === feeId);
      expect(fee.balance).toBe(1000); // 1500 - 500
      expect(fee.status).toBe("partial");

      // Process final payment
      const payment2Response = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          fee: feeId,
          amount: 1000,
          paymentMethod: "bank_transfer"
        });
      expect(payment2Response.status).toBe(201);

      // Verify fee is fully paid
      const finalBalanceResponse = await api("get", `/api/fees/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(finalBalanceResponse.status).toBe(200);
      
      const finalFee = finalBalanceResponse.body.fees.find(f => f._id === feeId);
      expect(finalFee.balance).toBe(0);
      expect(finalFee.status).toBe("paid");

      console.log("✅ Financial data consistency maintained");
    });
  });

  describe("Academic Progression Validation", () => {
    test("should validate academic progression logic", async () => {
      // Create report card with good grades
      const reportCardResponse = await api("post", "/api/report-cards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          academicYearId: testAcademicYear._id,
          termId: "term123",
          subjects: [
            { name: "Mathematics", totalScore: 85 },
            { name: "English", totalScore: 78 },
            { name: "Science", totalScore: 82 }
          ],
          attendance: {
            attendancePercentage: 92
          }
        });
      expect(reportCardResponse.status).toBe(201);

      // Calculate promotion
      const promotionResponse = await api("post", "/api/promotion/calculate")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          academicYearId: testAcademicYear._id,
          termId: "term123"
        });
      expect(promotionResponse.status).toBe(200);

      const promotionResults = promotionResponse.body.results;
      const studentPromotion = promotionResults.find(r => r.studentId === testStudent._id);
      
      // Should be recommended for promotion
      expect(studentPromotion.shouldPromote).toBe(true);
      expect(studentPromotion.reason).toContain("Meets promotion criteria");

      console.log("✅ Academic progression logic validated");
    });
  });
});
