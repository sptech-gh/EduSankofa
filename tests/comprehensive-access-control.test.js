const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass, createMockFee, createMockPayment, createMockReportCard } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Comprehensive Access Control Tests", () => {
  let adminToken, teacherToken, accountantToken, parentToken, studentToken;
  let testStudent, testClass, testFee, testPayment, testReportCard;

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
    
    // Create mock users for each role
    const adminUser = createMockUser({ role: "admin" });
    const teacherUser = createMockUser({ role: "teacher" });
    const accountantUser = createMockUser({ role: "accounts officer" });
    const parentUser = createMockUser({ role: "parent" });
    const studentUser = createMockUser({ role: "student" });
    
    // Create test data
    testStudent = createMockStudent();
    testClass = createMockClass();
    testFee = createMockFee();
    testPayment = createMockPayment();
    testReportCard = createMockReportCard();
    
    const User = require("../models/User");
    User.findOne.mockImplementation((query) => {
      if (query.email === "admin@test.com") return Promise.resolve(adminUser);
      if (query.email === "teacher@test.com") return Promise.resolve(teacherUser);
      if (query.email === "accountant@test.com") return Promise.resolve(accountantUser);
      if (query.email === "parent@test.com") return Promise.resolve(parentUser);
      if (query.email === "student@test.com") return Promise.resolve(studentUser);
      return Promise.resolve(null);
    });
  });

  describe("Admin Role Access Control", () => {
    test("should allow full access to all modules", async () => {
      const User = require("../models/User");
      User.findOne.mockResolvedValue(adminUser);
      
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "admin@test.com",
        password: "password123"
      });
      adminToken = loginResponse.body.token;

      // Test access to all major modules
      const endpoints = [
        { path: "/api/students", method: "GET" },
        { path: "/api/fees", method: "GET" },
        { path: "/api/payments", method: "GET" },
        { path: "/api/report-cards", method: "GET" },
        { path: "/api/promotion/calculate", method: "POST" },
        { path: "/api/backup/list", method: "GET" },
        { path: "/api/analytics/dashboard", method: "GET" },
        { path: "/api/academic-years", method: "GET" },
        { path: "/api/terms", method: "GET" },
        { path: "/api/classes", method: "GET" },
        { path: "/api/subjects", method: "GET" },
        { path: "/api/users", method: "GET" },
      ];

      for (const endpoint of endpoints) {
        const response = await api(endpoint.method, endpoint.path)
          .set("Authorization", `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
      }

      console.log("✅ Admin has full access to all modules");
    });

    test("should allow CRUD operations on all modules", async () => {
      const User = require("../models/User");
      User.findOne.mockResolvedValue(adminUser);
      
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "admin@test.com",
        password: "password123"
      });
      adminToken = loginResponse.body.token;

      // Test CRUD operations
      const createResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testStudent);
      expect(createResponse.status).toBe(201);

      const updateResponse = await api("put", `/api/students/${testStudent._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ firstName: "Updated" });
      expect(updateResponse.status).toBe(200);

      const deleteResponse = await api("delete", `/api/students/${testStudent._id}`)
        .set("Authorization", `Bearer ${adminToken}`);
        expect(deleteResponse.status).toBe(200);

      console.log("✅ Admin can perform CRUD operations");
    });
  });

  describe("Teacher Role Access Control", () => {
    test("should allow access to teacher-specific modules", async () => {
      const User = require("../models/User");
      User.findOne.mockResolvedValue(teacherUser);
      
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "teacher@test.com",
        password: "password123"
      });
      teacherToken = loginResponse.body.token;

      // Test access to allowed modules
      const allowedEndpoints = [
        { path: "/api/students", method: "GET" },
        { path: "/api/attendance", method: "GET" },
        { path: "/api/grades", method: "GET" },
        { path: "/api/report-cards", method: "GET" },
        { path: "/api/classes", method: "GET" },
        path: "/api/subjects", method: "GET" },
      ];

      for (const endpoint of allowedEndpoints) {
        const response = await api(endpoint.method, endpoint.path)
          .set("Authorization", `Bearer ${teacherToken}`);

        expect(response.status).toBe(200);
      }

      console.log("✅ Teacher has access to teacher-specific modules");
    });

    test("should deny access to admin-only modules", async () => {
      const User = require("../models/User");
      User.findOne.mockResolvedValue(teacherUser);
      
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "teacher@test.com",
        password: "password123"
      });
      teacherToken = loginResponse.body.token;

      // Test access to restricted modules
      const restrictedEndpoints = [
        { path: "/api/backup/list", method: "GET" },
        { path: "/api/users", method: "GET" },
        { path: "/api/promotion/calculate", method: "POST" },
        { path: "/api/fees", method: "POST" },
        { path: "/api/payments", method: "POST" },
      ];

      for (const endpoint of restrictedEndpoints) {
        const response = await api(endpoint.method, endpoint.path)
          .set("Authorization", `Bearer ${teacherToken}`);

        expect([403, 401]).toContain(response.status);
      }

      console.log("✅ Teacher denied access to admin-only modules");
    });
  });

  describe("Accountant Role Access Control", () => {
    test("should allow access to finance-specific modules", async () => {
      const User = require("../models/User");
      User.findOne.mockResolvedValue(accountantUser);
      
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "accountant@test.com",
        password: "password123"
      });
      accountantToken = loginResponse.body.token;

      // Test access to allowed modules
      const allowedEndpoints = [
        { path: "/api/students", method: "GET" },
        { path: "/api/fees", method: "GET" },
        { path: "/api/payments", method: "GET" },
        path: "/api/payments", method: "POST" },
        { path: "/api/invoices", method: "GET" },
        { path: "/api/fees/summary", method: "GET" },
      ];

      for (const endpoint of allowedEndpoints) {
        const response = await api(endpoint.method, endpoint.path)
          .set("Authorization", `Bearer ${accountantToken}`);

        expect(response.status).toBe(200);
      }

      console.log("✅ Accountant has access to finance-specific modules");
    });

    test("should deny access to non-finance modules", async () => {
      const User = require("../models/User");
      User.findOne.mockResolvedValue(accountantUser);
      
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "accountant@test.com",
        password: "password123"
      });
      accountantToken = loginResponse.body.token;

      // Test access to restricted modules
      const restrictedEndpoints = [
        { path: "/api/backup/list", method: "GET" },
        { path: "/api/users", method: "GET" },
        { path: "/api/promotion/calculate", method: "POST" },
        { path: "/api/academic-years", method: "GET" },
        { path: "/api/terms", method: "GET" },
        { path: "/api/classes", method: "GET" },
        { path: "/api/subjects", method: "GET" },
        { path: "/api/grades", method: "GET" },
        { path: "/api/report-cards", method: "POST" },
      ];

      for (const endpoint of restrictedEndpoints) {
        const response = await api(endpoint.method, endpoint.path)
          .set("Authorization", `Bearer ${accountantToken}`);

        expect([403, 401]).toContain(response.status);
      }

      console.log("✅ Accountant denied access to non-finance modules");
    });
  });

  describe("Parent Role Access Control", () => {
    test("should allow access to parent-specific modules", async () => {
      const User = require("../models/User");
      User.findOne.mockResolvedValue(parentUser);
      
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "parent@test.com",
        password: "password123"
      });
      parentToken = loginResponse.body.token;

      // Test access to allowed modules
      const allowedEndpoints = [
        { path: "/api/students", method: "GET" },
        { path: "/api/report-cards/student/123", method: "GET" },
        { path: "/api/fees/student/123", method: "GET" },
        { path: "/api/payments/student/123", method: "GET" },
        { path: "/api/dashboard-analytics", method: "GET" },
      ];

      for (const endpoint of allowedEndpoints) {
        const response = await api(endpoint.method, endpoint.path)
          .set("Authorization", `Bearer ${parentToken}`);

        expect(response.status).toBe(200);
      }

      console.log("✅ Parent has access to parent-specific modules");
    });

    test("should deny access to non-parent modules", async () => {
      const User = require("../models/User");
      User.findOne.mockResolvedValue(parentUser);
      
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "parent@test.com",
        password: "password123"
      });
      parentToken = loginResponse.body.token;

      // Test access to restricted modules
      const restrictedEndpoints = [
        { path: "/api/students", method: "POST" },
        { path: "/api/fees", method: "POST" },
        { path: "/api/payments", method: "POST" },
        { path: "/api/classes", method: "GET" },
        { path: "/api/subjects", method: "GET" },
        { path: "/api/grades", method: "GET" },
        { path: "/api/attendance", method: "POST" },
        { path: "/api/backup/list", method: "GET" },
        { path: "/api/users", method: "GET" },
        { path: "/api/promotion/calculate", method: "POST" },
      ];

      for (const endpoint of restrictedEndpoints) {
        const response = await api(endpoint.method, endpoint.path)
          .set("Authorization", `Bearer ${parentToken}`);

        expect([403, 401]).toContain(response.status);
      }

      console.log("✅ Parent denied access to non-parent modules");
    });
  });

  describe("Student Role Access Control", () => {
    test("should allow limited access to student-specific modules", async () => {
      const User = require("../models/User");
      User.findOne.mockResolvedValue(studentUser);
      
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "student@test.com",
        password: "password123"
      });
      studentToken = loginResponse.body.token;

      // Test access to allowed modules
      const allowedEndpoints = [
        { path: "/api/dashboard-analytics", method: "GET" },
        { path: "/api/report-cards/student/123", method: "GET" },
        { path: "/api/fees/student/123", method: "GET" },
        { path: "/api/payments/student/123", method: "GET" },
      ];

      for (const endpoint of allowedEndpoints) {
        const response = await api(endpoint.method, endpoint.path)
          .set("Authorization", `Bearer ${studentToken}`);

        expect(response.status).toBe(200);
      }

      console.log("✅ Student has limited access to student-specific modules");
    });

    test("should deny access to non-student modules", async () => {
      const User = require("../models/User");
      User.findOne.mockResolvedValue(studentUser);
      
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "student@test.com",
        password: "password123"
      });
      studentToken = loginResponse.body.token;

      // Test access to restricted modules
      const restrictedEndpoints = [
        { path: "/api/students", method: "POST" },
        { path: "/api/fees", method: "POST" },
        { path: "/api/payments", method: "POST" },
        { path: "/api/classes", method: "GET" },
        { path: "/api/subjects", method: "GET" },
        { path: "/api/grades", method: "GET" },
        { path: "/api/attendance", method: "POST" },
        { path: "/api/backup/list", method: "GET" },
        { path: "/api/users", method: "GET" },
        { path: "/api/promotion/calculate", method: "POST" },
      ];

      for (const endpoint of restrictedEndpoints) {
        const response = await api(endpoint.method, endpoint.path)
          .set("Authorization", `Bearer ${studentToken}`);

        expect([403, 401]).toContain(response.status);
      }

      console.log("✅ Student denied access to non-student modules");
    });
  });

  describe("Cross-Role Data Access Validation", () => {
    test("should enforce data isolation between roles", async () => {
      const User = require("../models/User");
      
      // Create student with admin
      const adminStudent = createMockStudent({
        firstName: "AdminStudent",
        email: "adminstudent@test.com"
      });
      User.findOne.mockResolvedValue(createMockUser({ role: "admin" }));
      
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "admin@test.com",
        password: "password123"
      });
      const adminToken = loginResponse.body.token;

      const createResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(adminStudent);
      expect(createResponse.status).toBe(201);

      // Teacher should not be able to access admin's student
      const User.findOne.mockResolvedValue(createMockUser({ role: "teacher" }));
      const teacherLoginResponse = await api("post", "/api/auth/login").send({
        email: "teacher@test.com",
        password: "password123"
      });
      const teacherToken = teacherLoginResponse.body.token;

      const getResponse = await api("get", `/api/students/${createResponse.body._id}`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(getResponse.status).toBe(403);
      expect(getResponse.body.message).toContain("forbidden");

      console.log("✅ Cross-role data isolation working");
    });

    test("should prevent unauthorized data modification", async () => {
      const User = require("../models/User");
      const teacherUser = createMockUser({ role: "teacher" });
      User.findOne.mockResolvedValue(teacherUser);
      
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "teacher@test.com",
        password: "password123"
      });
      const teacherToken = loginResponse.body.token;

      // Try to modify student data as teacher
      const Student = require("../models/Student");
      const studentData = {
        firstName: "Modified",
        lastName: "Student",
        email: "student@test.com"
      };
      Student.findOne.mockResolvedValue(studentData);

      const updateResponse = await api("put", `/api/students/${studentData._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          firstName: "Modified"
        });

      expect(updateResponse.status).toBe(403);
      expect(updateResponse.body.message).toContain("forbidden");

      console.log("✅ Unauthorized data modification prevented");
    });
  });

  describe("Resource Access Control", () => {
    test("should enforce resource-based access control", async () => {
      // Test access to specific student data
      const User = require("../models/User");
      const parentUser = createMockUser({ role: "parent" });
      User.findOne.mockResolvedValue(parentUser);
      
      const loginResponse = await api("post", "/api/auth/login").send({
        email: "parent@test.com",
        password: "password123"
      });
      parentToken = loginResponse.body.token;

      // Create student for parent
      const Student = require("../models/Student");
      const parentStudent = createMockStudent({
        firstName: "ParentStudent",
        email: "parentstudent@test.com",
        parentId: parentUser._id
      });
      Student.create.mockResolvedValue(parentStudent);

      const createResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${parentToken}`)
        .send(parentStudent);
      expect(createResponse.status).toBe(201);

      // Teacher should not be able to access parent's student
      const User.findOne.mockResolvedValue(createMockUser({ role: "teacher" }));
      const teacherLoginResponse = await api("post", "/api/auth/login").send({
        email: "teacher@test.com",
        password: "password123"
      });
      const teacherToken = teacherLoginResponse.body.token;

      const getResponse = await api("get", `/api/students/${createResponse.body._id}`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(getResponse.status).toBe(403);
      expect(getResponse.body.message).toContain("forbidden");

      console.log("✅ Resource-based access control working");
    });
  });

  describe("Time-Based Access Control", () => {
    test("should handle session timeout properly", async () => {
      // Create token with short expiration
      const User = require("../models/User");
      const adminUser = createMockUser({ role: "admin" });
      User.findOne.mockResolvedValue(adminUser);
      
      // Mock token that expires immediately
      const shortLivedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IiIj9.eyJzdWIiOiIifQ"; // Mock expired token
      
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${shortLivedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("expired");

      console.log("✅ Session timeout handling working");
    });
  });
  });
});
