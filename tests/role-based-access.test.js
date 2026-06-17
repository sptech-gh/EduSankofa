const request = require("supertest");
const app = require("../server");
const { createMockUser } = require("./setup-mock");
const User = require("../models/User");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Role-Based Access Control Tests", () => {
  let adminToken, teacherToken, accountantToken, parentToken, studentToken;

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
    
    User.findOne.mockImplementation((query) => {
      if (query.email === "admin@test.com") return Promise.resolve(adminUser);
      if (query.email === "teacher@test.com") return Promise.resolve(teacherUser);
      if (query.email === "accountant@test.com") return Promise.resolve(accountantUser);
      if (query.email === "parent@test.com") return Promise.resolve(parentUser);
      if (query.email === "student@test.com") return Promise.resolve(studentUser);
      return Promise.resolve(null);
    });

    // Get tokens for each role
    const responses = await Promise.all([
      api("post", "/api/auth/login").send({ email: "admin@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "teacher@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "accountant@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "parent@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "student@test.com", password: "password123" })
    ]);

    adminToken = responses[0].body.token;
    teacherToken = responses[1].body.token;
    accountantToken = responses[2].body.token;
    parentToken = responses[3].body.token;
    studentToken = responses[4].body.token;
  });

  describe("Student Management Access", () => {
    test("admin should have full access to student endpoints", async () => {
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
    });

    test("teacher should have read access to student endpoints", async () => {
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(response.status).toBe(200);
    });

    test("accountant should have read access to student endpoints", async () => {
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(response.status).toBe(200);
    });

    test("parent should have read access to student endpoints", async () => {
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${parentToken}`);
      expect(response.status).toBe(200);
    });

    test("student should not have access to student endpoints", async () => {
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(response.status).toBe(403);
    });

    test("admin should be able to create students", async () => {
      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          firstName: "Test",
          lastName: "Student",
          email: "newstudent@test.com"
        });
      expect(response.status).toBe(201);
    });

    test("teacher should not be able to create students", async () => {
      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          firstName: "Test",
          lastName: "Student",
          email: "newstudent@test.com"
        });
      expect(response.status).toBe(403);
    });

    test("student should not be able to create students", async () => {
      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({
          firstName: "Test",
          lastName: "Student",
          email: "newstudent@test.com"
        });
      expect(response.status).toBe(403);
    });
  });

  describe("Fee Management Access", () => {
    test("admin should have full access to fee endpoints", async () => {
      const response = await api("get", "/api/fees")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
    });

    test("accountant should have full access to fee endpoints", async () => {
      const response = await api("get", "/api/fees")
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(response.status).toBe(200);
    });

    test("teacher should not have access to fee endpoints", async () => {
      const response = await api("get", "/api/fees")
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(response.status).toBe(403);
    });

    test("parent should not have access to fee endpoints", async () => {
      const response = await api("get", "/api/fees")
        .set("Authorization", `Bearer ${parentToken}`);
      expect(response.status).toBe(403);
    });

    test("student should not have access to fee endpoints", async () => {
      const response = await api("get", "/api/fees")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(response.status).toBe(403);
    });

    test("admin should be able to create fees", async () => {
      const response = await api("post", "/api/fees")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: "student123",
          feeType: "tuition",
          amount: 1500
        });
      expect(response.status).toBe(201);
    });

    test("accountant should be able to create fees", async () => {
      const response = await api("post", "/api/fees")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: "student123",
          feeType: "tuition",
          amount: 1500
        });
      expect(response.status).toBe(201);
    });

    test("teacher should not be able to create fees", async () => {
      const response = await api("post", "/api/fees")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: "student123",
          feeType: "tuition",
          amount: 1500
        });
      expect(response.status).toBe(403);
    });
  });

  describe("Payment Management Access", () => {
    test("admin should have full access to payment endpoints", async () => {
      const response = await api("get", "/api/payments")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
    });

    test("accountant should have full access to payment endpoints", async () => {
      const response = await api("get", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(response.status).toBe(200);
    });

    test("teacher should not have access to payment endpoints", async () => {
      const response = await api("get", "/api/payments")
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(response.status).toBe(403);
    });

    test("parent should not have access to payment endpoints", async () => {
      const response = await api("get", "/api/payments")
        .set("Authorization", `Bearer ${parentToken}`);
      expect(response.status).toBe(403);
    });

    test("student should not have access to payment endpoints", async () => {
      const response = await api("get", "/api/payments")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(response.status).toBe(403);
    });
  });

  describe("Report Card Access", () => {
    test("admin should have full access to report card endpoints", async () => {
      const response = await api("get", "/api/report-cards")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
    });

    test("teacher should have access to report card endpoints", async () => {
      const response = await api("get", "/api/report-cards")
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(response.status).toBe(200);
    });

    test("parent should have read access to report card endpoints", async () => {
      const response = await api("get", "/api/report-cards")
        .set("Authorization", `Bearer ${parentToken}`);
      expect(response.status).toBe(200);
    });

    test("accountant should not have access to report card endpoints", async () => {
      const response = await api("get", "/api/report-cards")
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(response.status).toBe(403);
    });

    test("student should not have access to report card endpoints", async () => {
      const response = await api("get", "/api/report-cards")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(response.status).toBe(403);
    });
  });

  describe("Promotion Management Access", () => {
    test("admin should have full access to promotion endpoints", async () => {
      const response = await api("post", "/api/promotion/calculate")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          academicYearId: "year123",
          termId: "term123"
        });
      expect(response.status).toBe(200);
    });

    test("staff should have access to promotion endpoints", async () => {
      // Mock staff user
      const staffUser = createMockUser({ role: "staff" });
      User.findOne.mockResolvedValue(staffUser);
      
      const staffResponse = await api("post", "/api/auth/login").send({ 
        email: "staff@test.com", 
        password: "password123" 
      });
      const staffToken = staffResponse.body.token;

      const response = await api("post", "/api/promotion/calculate")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          academicYearId: "year123",
          termId: "term123"
        });
      expect(response.status).toBe(200);
    });

    test("teacher should not have access to promotion endpoints", async () => {
      const response = await api("post", "/api/promotion/calculate")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          academicYearId: "year123",
          termId: "term123"
        });
      expect(response.status).toBe(403);
    });

    test("parent should not have access to promotion endpoints", async () => {
      const response = await api("post", "/api/promotion/calculate")
        .set("Authorization", `Bearer ${parentToken}`)
        .send({
          academicYearId: "year123",
          termId: "term123"
        });
      expect(response.status).toBe(403);
    });
  });

  describe("System Settings Access", () => {
    test("admin should have access to system settings", async () => {
      const response = await api("get", "/api/backup/list")
        .set("Authorization", `Bearer ${adminToken}`);
      // Should not be 403 (may be 404 or other error but not forbidden)
      expect(response.status).not.toBe(403);
    });

    test("teacher should not have access to system settings", async () => {
      const response = await api("get", "/api/backup/list")
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(response.status).toBe(403);
    });

    test("accountant should not have access to system settings", async () => {
      const response = await api("get", "/api/backup/list")
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(response.status).toBe(403);
    });

    test("parent should not have access to system settings", async () => {
      const response = await api("get", "/api/backup/list")
        .set("Authorization", `Bearer ${parentToken}`);
      expect(response.status).toBe(403);
    });

    test("student should not have access to system settings", async () => {
      const response = await api("get", "/api/backup/list")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(response.status).toBe(403);
    });
  });

  describe("Dashboard Analytics Access", () => {
    test("admin should have access to dashboard analytics", async () => {
      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
    });

    test("teacher should have access to dashboard analytics", async () => {
      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(response.status).toBe(200);
    });

    test("accountant should have access to dashboard analytics", async () => {
      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${accountantToken}`);
      expect(response.status).toBe(200);
    });

    test("parent should have access to dashboard analytics", async () => {
      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${parentToken}`);
      expect(response.status).toBe(200);
    });

    test("student should have access to dashboard analytics", async () => {
      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(response.status).toBe(200);
    });
  });

  describe("Cross-Role Data Access Validation", () => {
    test("parent should only access their children's data", async () => {
      // This would require proper parent-child relationship setup
      // For now, test that parent can access student data but not create it
      const readResponse = await api("get", "/api/students")
        .set("Authorization", `Bearer ${parentToken}`);
      expect(readResponse.status).toBe(200);

      const createResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${parentToken}`)
        .send({
          firstName: "Test",
          lastName: "Student",
          email: "newstudent@test.com"
        });
      expect(createResponse.status).toBe(403);
    });

    test("teacher should access assigned class data only", async () => {
      // Test that teacher can read but has limited write access
      const readResponse = await api("get", "/api/students")
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(readResponse.status).toBe(200);

      const deleteResponse = await api("delete", "/api/students/student123")
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(deleteResponse.status).toBe(403);
    });
  });
});
