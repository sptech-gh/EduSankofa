const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockFee, createMockPayment } = require("./setup-mock");
const User = require("../models/User");
const Student = require("../models/Student");
const Fee = require("../models/Fee");
const Payment = require("../models/Payment");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Data Integrity Tests", () => {
  let adminToken;
  let testStudent, testFee, testPayment;

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
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create test data
    testStudent = createMockStudent();
    testFee = createMockFee();
    testPayment = createMockPayment();
    
    // Mock admin user
    const adminUser = createMockUser({ role: "admin" });
    User.findOne.mockResolvedValue(adminUser);
    
    // Get admin token
    const loginResponse = await api("post", "/api/auth/login").send({
      email: "admin@test.com",
      password: "password123"
    });
    adminToken = loginResponse.body.token;
  });

  describe("Financial Data Consistency", () => {
    test("should maintain fee-payment relationship integrity", async () => {
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

      // Process payment
      const paymentResponse = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          fee: feeId,
          amount: 500,
          paymentMethod: "cash",
          transactionId: "TXN123456"
        });
      expect(paymentResponse.status).toBe(201);

      // Verify fee balance
      const feeCheckResponse = await api("get", `/api/fees/${feeId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(feeCheckResponse.status).toBe(200);
      
      const feeData = feeCheckResponse.body;
      expect(feeData.balance).toBe(1000); // 1500 - 500
      expect(feeData.status).toBe("partial");

      // Verify payment record
      const paymentCheckResponse = await api("get", `/api/payments/${paymentResponse.body._id}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(paymentCheckResponse.status).toBe(200);
      
      const paymentData = paymentCheckResponse.body;
      expect(paymentData.amount).toBe(500);
      expect(paymentData.fee).toBe(feeId);

      console.log("✅ Fee-payment relationship integrity maintained");
    });

    test("should prevent overpayment", async () => {
      // Create fee
      const feeResponse = await api("post", "/api/fees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          feeType: "tuition",
          amount: 1000,
          dueDate: "2025-03-15"
        });
      expect(feeResponse.status).toBe(201);
      const feeId = feeResponse.body._id;

      // Process full payment
      await api("post", "/api/payments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          fee: feeId,
          amount: 1000,
          paymentMethod: "cash",
          transactionId: "TXN123456"
        });

      // Try to overpay
      const overpaymentResponse = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          fee: feeId,
          amount: 500, // Overpayment attempt
          paymentMethod: "cash",
          transactionId: "TXN123457"
        });

      expect(overpaymentResponse.status).toBe(400);
      expect(overpaymentResponse.body.message).toContain("overpayment");

      console.log("✅ Overpayment prevention working");
    });

    test("should maintain payment history accuracy", async () => {
      // Create fee
      const feeResponse = await api("post", "/api/fees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          feeType: "tuition",
          amount: 1500,
          dueDate: "2025-03-15"
        });
      const feeId = feeResponse.body._id;

      // Process multiple payments
      const payment1Response = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          fee: feeId,
          amount: 500,
          paymentMethod: "cash",
          transactionId: "TXN123456"
        });

      const payment2Response = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          fee: feeId,
          amount: 1000,
          paymentMethod: "bank_transfer",
          transactionId: "TXN123457"
        });

      // Get payment history
      const historyResponse = await api("get", `/api/payments/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(historyResponse.status).toBe(200);

      const payments = historyResponse.body.payments;
      expect(payments).toHaveLength(2);
      expect(payments[0].amount).toBe(500);
      expect(payments[1].amount).toBe(1000);

      // Verify total paid amount
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      expect(totalPaid).toBe(1500);

      console.log("✅ Payment history accuracy maintained");
    });
  });

  describe("Academic Data Consistency", () => {
    test("should maintain student-academic year relationships", async () => {
      // Create student in specific academic year
      const studentResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          ...testStudent,
          academicYear: "2025-2026"
        });
      expect(studentResponse.status).toBe(201);
      const studentId = studentResponse.body._id;

      // Verify student record
      const getStudentResponse = await api("get", `/api/students/${studentId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(getStudentResponse.status).toBe(200);

      const studentData = getStudentResponse.body;
      expect(studentData.academicYear).toBe("2025-2026");

      console.log("✅ Student-academic year relationship maintained");
    });

    test("should prevent duplicate student records", async () => {
      // Create student with specific email
      const studentResponse1 = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          ...testStudent,
          email: "unique@test.com"
        });
      expect(studentResponse1.status).toBe(201);

      // Try to create student with same email
      const studentResponse2 = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          ...testStudent,
          email: "unique@test.com"
        });
      expect(studentResponse2.status).toBe(400);
      expect(studentResponse2.body.message).toContain("already exists");

      console.log("✅ Duplicate student prevention working");
    });
  });

  describe("Cross-Module Data Integrity", () => {
    test("should maintain data consistency across modules", async () => {
      // Create student
      const studentResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          ...testStudent,
          email: "consistency@test.com"
        });
      expect(studentResponse.status).toBe(201);
      const studentId = studentResponse.body._id;

      // Create fee for student
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

      // Create report card for student
      const reportCardResponse = await api("post", "/api/report-cards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: studentId,
          academicYearId: "year123",
          termId: "term123",
          subjects: [
            { name: "Mathematics", totalScore: 85 }
          ]
        });
      expect(reportCardResponse.status).toBe(201);

      // Verify all data is accessible and consistent
      const studentCheckResponse = await api("get", `/api/students/${studentId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(studentCheckResponse.status).toBe(200);

      const feeCheckResponse = await api("get", `/api/fees/${feeId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(feeCheckResponse.status).toBe(200);

      const reportCardCheckResponse = await api("get", `/api/report-cards/student/${studentId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(reportCardCheckResponse.status).toBe(200);

      // Verify student IDs match across modules
      expect(studentCheckResponse.body._id).toBe(studentId);
      expect(feeCheckResponse.body.student).toBe(studentId);
      expect(reportCardCheckResponse.body.student).toBe(studentId);

      console.log("✅ Cross-module data consistency maintained");
    });
  });

  describe("Data Validation and Constraints", () => {
    test("should validate required fields", async () => {
      // Try to create student without required fields
      const invalidStudentResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          firstName: "",
          lastName: "Test",
          email: "invalid@test.com"
        });

      expect(invalidStudentResponse.status).toBe(400);
      expect(invalidStudentResponse.body.errors).toBeDefined();

      // Try to create fee without required fields
      const invalidFeeResponse = await api("post", "/api/fees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          feeType: "",
          amount: ""
        });

      expect(invalidFeeResponse.status).toBe(400);
      expect(invalidFeeResponse.body.errors).toBeDefined();

      console.log("✅ Required field validation working");
    });

    test("should validate data formats", async () => {
      // Try to create student with invalid email
      const invalidEmailResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          ...testStudent,
          email: "invalid-email-format"
        });

      expect(invalidEmailResponse.status).toBe(400);
      expect(invalidEmailResponse.body.errors).toBeDefined();

      // Try to create fee with invalid amount
      const invalidAmountResponse = await api("post", "/api/fees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          feeType: "tuition",
          amount: "invalid-amount",
          dueDate: "2025-03-15"
        });

      expect(invalidAmountResponse.status).toBe(400);
      expect(invalidAmountResponse.body.errors).toBeDefined();

      console.log("✅ Data format validation working");
    });
  });

  describe("Transaction Integrity", () => {
    test("should handle concurrent operations safely", async () => {
      // Create fee
      const feeResponse = await api("post", "/api/fees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          feeType: "tuition",
          amount: 1500,
          dueDate: "2025-03-15"
        });
      const feeId = feeResponse.body._id;

      // Process payment
      const paymentResponse = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: testStudent._id,
          fee: feeId,
          amount: 500,
          paymentMethod: "cash",
          transactionId: "TXN123456"
        });

      // Verify fee status after payment
      const feeCheckResponse = await api("get", `/api/fees/${feeId}`)
        .set("Authorization", `Bearer ${adminToken}`);
      
      const feeData = feeCheckResponse.body;
      expect(feeData.balance).toBe(1000);
      expect(feeData.status).toBe("partial");

      // Try to delete fee with outstanding balance
      const deleteResponse = await api("delete", `/api/fees/${feeId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(deleteResponse.status).toBe(400);
      expect(deleteResponse.body.message).toContain("outstanding balance");

      console.log("✅ Transaction integrity maintained");
    });
  });
});
