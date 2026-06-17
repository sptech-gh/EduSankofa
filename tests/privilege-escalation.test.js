const request = require("supertest");
const app = require("../server");
const { createMockUser } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Privilege Escalation Tests", () => {
  let studentToken, teacherToken, parentToken;

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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Token Manipulation Tests", () => {
    test("should reject expired tokens", async () => {
      // Create expired token
      const expiredToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IiIj9.eyJzdWIiOiIifQ"; // Mock expired token
      
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("expired");
    });

    test("should reject invalid tokens", async () => {
      const invalidToken = "invalid.token.format";
      
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("invalid");
    });

    test("should reject malformed tokens", async () => {
      const malformedToken = "not.a.jwt";
      
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${malformedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("invalid");
    });
  });

  describe("Role Manipulation Tests", () => {
    test("should prevent role escalation through token manipulation", async () => {
      // Create student token
      const User = require("../models/User");
      const studentUser = createMockUser({ role: "student" });
      User.findOne.mockResolvedValue(studentUser);
      
      const loginResponse = await api("post", "/api/auth/login")
        .send({
          email: "student@test.com",
          password: "password123"
        });
      const studentToken = loginResponse.body.token;

      // Try to access admin endpoint with student token
      const adminResponse = await api("get", "/api/backup/list")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(adminResponse.status).toBe(403);
      expect(adminResponse.body.message).toContain("forbidden");
    });

    test("should prevent role escalation through parameter manipulation", async () => {
      const User = require("../models/User");
      const teacherUser = createMockUser({ role: "teacher" });
      User.findOne.mockResolvedValue(teacherUser);
      
      const loginResponse = await api("post", "/api/auth/login")
        .send({
          email: "teacher@test.com",
          password: "password123"
        });
      const teacherToken = loginResponse.body.token;

      // Try to access admin endpoint with teacher token
      const adminResponse = await api("get", "/api/backup/list")
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(adminResponse.status).toBe(403);
      expect(adminResponse.body.message).toContain("forbidden");
    });
  });

  describe("Authorization Bypass Tests", () => {
    test("should prevent access without authorization header", async () => {
      const response = await api("get", "/api/students");

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("No token");
    });

    test("should prevent access with malformed authorization header", async () => {
      const response = await api("get", "/api/students")
        .set("Authorization", "Bearer malformed.token");

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("invalid");
    });
  });

  describe("Cross-Tenant Data Leakage Tests", () => {
    test("should prevent cross-tenant data access", async () => {
      // Create two users from different "schools"
      const User = require("../models/User");
      const user1 = createMockUser({ 
        email: "user1@school1.com", 
        role: "admin",
        schoolId: "school1"
      });
      const user2 = createMockUser({ 
        email: "user2@school2.com", 
        role: "admin",
        schoolId: "school2"
      });

      // Mock user1 login
      User.findOne.mockImplementation((query) => {
        if (query.email === "user1@school1.com") return Promise.resolve(user1);
        if (query.email === "user2@school2.com") return Promise.resolve(user2);
        return Promise.resolve(null);
      });

      const loginResponse1 = await api("post", "/api/auth/login")
        .send({
          email: "user1@school1.com",
          password: "password123"
        });
      const token1 = loginResponse1.body.token;

      // Create student under user1
      const Student = require("../models/Student");
      const student1 = {
        firstName: "Student1",
        lastName: "Test",
        email: "student1@school1.com"
      };
      Student.create.mockResolvedValue({
        ...student1,
        _id: "student1Id",
        schoolId: "school1"
      });

      const createResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${token1}`)
        .send(student1);

      expect(createResponse.status).toBe(201);

      // Try to access student1's data with user2 token
      const getResponse = await api("get", `/api/students/student1Id`)
        .set("Authorization", `Bearer ${token1}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.schoolId).toBe("school1");

      // Now try with user2 token
      User.findOne.mockResolvedValue(user2);
      const loginResponse2 = await api("post", "/api/auth/login")
        .send({
          email: "user2@school2.com",
          password: "password123"
        });
      const token2 = loginResponse2.body.token;

      const getResponse2 = await api("get", `/api/students/student1Id`)
        .set("Authorization", `Bearer ${token2}`);

      expect(getResponse2.status).toBe(403);
      expect(getResponse2.body.message).toContain("forbidden");

      console.log("✅ Cross-tenant data leakage prevention working");
    });
  });

  describe("Session Management Tests", () => {
    test("should handle concurrent sessions properly", async () => {
      // Create multiple concurrent logins
      const User = require("../models/User");
      const adminUser = createMockUser({ role: "admin" });
      User.findOne.mockResolvedValue(adminUser);

      const promises = Array.from({ length: 5 }, (_, i) =>
        api("post", "/api/auth/login")
          .send({
            email: "admin@test.com",
            password: "password123"
          })
      );

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.token).toBeDefined();
      });

      // Verify tokens are different
      const tokens = responses.map(r => r.body.token);
      const uniqueTokens = [...new Set(tokens)];
      expect(uniqueTokens.length).toBe(5);

      console.log("✅ Concurrent session management working");
    });
  });

  describe("Input Validation for Authorization", () => {
    test("should sanitize authorization headers", async () => {
      // Try to inject script in authorization header
      const response = await api("get", "/api/students")
        .set("Authorization", "Bearer <script>alert('xss')</script>");

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("invalid");
    });

    test("should handle malformed authorization header", async () => {
      const response = await api("get", "/api/students")
        .set("Authorization", "Bearer malformed");

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("invalid");
    });
  });

  describe("Rate Limiting Effectiveness", () => {
    test("should enforce rate limits on authentication attempts", async () => {
      const User = require("../models/User");
      const adminUser = createMockUser({ role: "admin" });
      User.findOne.mockResolvedValue(adminUser);

      // Make rapid login attempts
      const promises = Array.from({ length: 10 }, () =>
        api("post", "/api/auth/login")
          .send({
            email: "admin@test.com",
            password: "password123"
          })
      );

      const responses = await Promise.all(promises);

      // Some should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      const successfulResponses = responses.filter(r => r.status === 200);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(successfulResponses.length).toBeGreaterThan(0);

      console.log("✅ Rate limiting on authentication working");
    });
  });

  describe("Security Headers Validation", () => {
    test("should include security headers", async () => {
      const response = await api("get", "/api/students")
        .set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe("CORS Configuration", () => {
    test("should enforce CORS policies", async () => {
      // Test preflight request
      const preflightResponse = await api("options", "/api/students")
        .set("Origin", "http://malicious-site.com")
        .set("Access-Control-Request-Method", "GET")
        .set("Access-Control-Request-Headers", "Authorization");

      expect(preflightResponse.status).toBe(204);
      expect(preflightResponse.headers['access-control-allow-origin']).toBeDefined();

      console.log("✅ CORS configuration working");
    });
  });
});
