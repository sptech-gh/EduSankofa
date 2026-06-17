const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Security & Hardening Tests", () => {
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

    // Create mock users for each role
    const adminUser = createMockUser({ role: "admin" });
    const teacherUser = createMockUser({ role: "teacher" });
    const accountantUser = createMockUser({ role: "accounts officer" });
    const parentUser = createMockUser({ role: "parent" });
    const studentUser = createMockUser({ role: "student" });
    
    const User = require("../models/User");
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

  afterAll(async () => {
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => server.close(resolve));
  });

  describe("Input Sanitization", () => {
    test("should sanitize HTML script tags", async () => {
      const maliciousInput = {
        firstName: "<script>alert('xss')</script>",
        lastName: "Test",
        email: "test@example.com"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(maliciousInput);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.sanitizedInput).toBeDefined();
      expect(response.body.sanitizedInput.firstName).not.toContain("<script>");

      console.log("✅ HTML script tags sanitized");
    });

    test("should sanitize SQL injection attempts", async () => {
      const maliciousInput = {
        firstName: "'; DROP TABLE students; --",
        lastName: "Test",
        email: "test@example.com"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(maliciousInput);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.sanitizedInput).toBeDefined();
      expect(response.body.sanitizedInput.firstName).not.toContain("DROP TABLE");

      console.log("✅ SQL injection attempts sanitized");
    });

    test("should sanitize NoSQL injection attempts", async () => {
      const maliciousInput = {
        firstName: { "$ne": null },
        lastName: "Test",
        email: "test@example.com"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(maliciousInput);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.sanitizedInput).toBeDefined();

      console.log("✅ NoSQL injection attempts sanitized");
    });

    test("should sanitize special characters", async () => {
      const maliciousInput = {
        firstName: "!@#$%^&*()_+-=[]{}|;':\",./<>?",
        lastName: "Test",
        email: "test@example.com"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(maliciousInput);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.sanitizedInput).toBeDefined();

      console.log("✅ Special characters sanitized");
    });
  });

  describe("XSS Vulnerabilities", () => {
    test("should prevent XSS in student data", async () => {
      const xssPayload = {
        firstName: "<img src=x onerror=alert('xss')>",
        lastName: "Test",
        email: "test@example.com"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(xssPayload);

      expect(response.status).toBe(400);
      expect(response.body.xssPrevented).toBe(true);
      expect(response.body.sanitizedData).toBeDefined();

      console.log("✅ XSS prevented in student data");
    });

    test("should prevent XSS in search parameters", async () => {
      const xssSearch = "<script>alert('xss')</script>";

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ search: xssSearch });

      expect(response.status).toBe(400);
      expect(response.body.xssPrevented).toBe(true);
      expect(response.body.sanitizedQuery).toBeDefined();

      console.log("✅ XSS prevented in search parameters");
    });

    test("should prevent XSS in file uploads", async () => {
      const xssFile = {
        filename: "<script>alert('xss')</script>.jpg",
        content: "fake-image-content"
      };

      const response = await api("post", "/api/upload")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("file", Buffer.from("fake-content"), xssFile.filename);

      expect(response.status).toBe(400);
      expect(response.body.xssPrevented).toBe(true);
      expect(response.body.sanitizedFilename).toBeDefined();

      console.log("✅ XSS prevented in file uploads");
    });

    test("should prevent XSS in API responses", async () => {
      const Student = require("../models/Student");
      
      // Mock student with XSS in data
      const studentWithXSS = {
        firstName: "<script>alert('xss')</script>",
        lastName: "Test",
        email: "test@example.com"
      };

      Student.find.mockResolvedValue([studentWithXSS]);

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.students[0].firstName).not.toContain("<script>");
      expect(response.body.xssFiltered).toBe(true);

      console.log("✅ XSS prevented in API responses");
    });
  });

  describe("CSRF Protection", () => {
    test("should require CSRF token for state-changing requests", async () => {
      const studentData = {
        firstName: "Test",
        lastName: "Student",
        email: "test@example.com"
      };

      // Request without CSRF token
      const response = await api("post", "/api/students")
        .send(studentData);

      expect(response.status).toBe(403);
      expect(response.body.csrfRequired).toBe(true);
      expect(response.body.message).toContain("CSRF token");

      console.log("✅ CSRF token required for state-changing requests");
    });

    test("should validate CSRF token", async () => {
      const studentData = {
        firstName: "Test",
        lastName: "Student",
        email: "test@example.com"
      };

      // Request with invalid CSRF token
      const response = await api("post", "/api/students")
        .set("X-CSRF-Token", "invalid-token")
        .send(studentData);

      expect(response.status).toBe(403);
      expect(response.body.csrfInvalid).toBe(true);
      expect(response.body.message).toContain("Invalid CSRF token");

      console.log("✅ CSRF token validation working");
    });

    test("should allow requests with valid CSRF token", async () => {
      const studentData = {
        firstName: "Test",
        lastName: "Student",
        email: "test@example.com"
      };

      // Request with valid CSRF token
      const response = await api("post", "/api/students")
        .set("X-CSRF-Token", "valid-csrf-token")
        .send(studentData);

      expect(response.status).toBe(201);
      expect(response.body.csrfValidated).toBe(true);

      console.log("✅ Valid CSRF token requests allowed");
    });

    test("should implement double submit cookie protection", async () => {
      const studentData = {
        firstName: "Test",
        lastName: "Student",
        email: "test@example.com"
      };

      // Request with double submit cookie
      const response = await api("post", "/api/students")
        .set("Cookie", "double-submit-protection=token123")
        .send(studentData);

      expect(response.status).toBe(403);
      expect(response.body.doubleSubmitPrevented).toBe(true);

      console.log("✅ Double submit cookie protection working");
    });
  });

  describe("SQL Injection Risk", () => {
    test("should prevent SQL injection in login", async () => {
      const sqlInjectionPayload = {
        email: "admin' OR '1'='1' --",
        password: "password"
      };

      const response = await api("post", "/api/auth/login")
        .send(sqlInjectionPayload);

      expect(response.status).toBe(400);
      expect(response.body.sqlInjectionPrevented).toBe(true);
      expect(response.body.message).toContain("SQL injection");

      console.log("✅ SQL injection prevented in login");
    });

    test("should prevent SQL injection in search", async () => {
      const sqlInjectionSearch = "admin'; DROP TABLE users; --";

      const response = await api("get", "/api/students")
        .query({ search: sqlInjectionSearch });

      expect(response.status).toBe(400);
      expect(response.body.sqlInjectionPrevented).toBe(true);
      expect(response.body.message).toContain("SQL injection");

      console.log("✅ SQL injection prevented in search");
    });

    test("should prevent SQL injection in parameters", async () => {
      const sqlInjectionParams = {
        id: "1' OR '1'='1",
        orderBy: "id; DROP TABLE students; --"
      };

      const response = await api("get", "/api/students")
        .query(sqlInjectionParams);

      expect(response.status).toBe(400);
      expect(response.body.sqlInjectionPrevented).toBe(true);
      expect(response.body.message).toContain("SQL injection");

      console.log("✅ SQL injection prevented in parameters");
    });

    test("should prevent SQL injection in file operations", async () => {
      const sqlInjectionFile = {
        filename: "1'; DROP TABLE students; --.jpg",
        content: "fake-content"
      };

      const response = await api("post", "/api/upload")
        .attach("file", Buffer.from("fake-content"), sqlInjectionFile.filename);

      expect(response.status).toBe(400);
      expect(response.body.sqlInjectionPrevented).toBe(true);
      expect(response.body.message).toContain("SQL injection");

      console.log("✅ SQL injection prevented in file operations");
    });
  });

  describe("File Upload Validation", () => {
    test("should validate file types", async () => {
      const maliciousFile = {
        filename: "malicious.exe",
        content: Buffer.from("fake-executable-content")
      };

      const response = await api("post", "/api/upload")
        .attach("file", maliciousFile.content, maliciousFile.filename);

      expect(response.status).toBe(400);
      expect(response.body.fileTypeInvalid).toBe(true);
      expect(response.body.allowedTypes).toBeDefined();

      console.log("✅ File types validated");
    });

    test("should validate file sizes", async () => {
      const largeFile = {
        filename: "large-file.jpg",
        content: Buffer.alloc(10 * 1024 * 1024) // 10MB
      };

      const response = await api("post", "/api/upload")
        .attach("file", largeFile.content, largeFile.filename);

      expect(response.status).toBe(400);
      expect(response.body.fileTooLarge).toBe(true);
      expect(response.body.maxFileSize).toBeDefined();

      console.log("✅ File sizes validated");
    });

    test("should validate file content", async () => {
      const maliciousContentFile = {
        filename: "image.jpg",
        content: Buffer.from("<script>alert('xss')</script>")
      };

      const response = await api("post", "/api/upload")
        .attach("file", maliciousContentFile.content, maliciousContentFile.filename);

      expect(response.status).toBe(400);
      expect(response.body.maliciousContentDetected).toBe(true);
      expect(response.body.contentValidation).toBeDefined();

      console.log("✅ File content validated");
    });

    test("should validate file names", async () => {
      const maliciousFilenameFile = {
        filename: "../../../etc/passwd",
        content: Buffer.from("fake-content")
      };

      const response = await api("post", "/api/upload")
        .attach("file", maliciousFilenameFile.content, maliciousFilenameFile.filename);

      expect(response.status).toBe(400);
      expect(response.body.pathTraversalPrevented).toBe(true);
      expect(response.body.sanitizedFilename).toBeDefined();

      console.log("✅ File names validated");
    });
  });

  describe("Audit Trail Accuracy", () => {
    test("should log all user actions", async () => {
      const Student = require("../models/Student");
      
      // Mock audit logging
      const auditLog = {
        userId: "admin123",
        action: "CREATE_STUDENT",
        resource: "students",
        timestamp: new Date(),
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        details: {
          studentId: "student123",
          changes: ["firstName", "lastName", "email"]
        }
      };

      Student.create.mockResolvedValue({
        firstName: "Test",
        lastName: "Student",
        email: "test@example.com"
      });

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          firstName: "Test",
          lastName: "Student",
          email: "test@example.com"
        });

      expect(response.status).toBe(201);
      expect(response.body.auditLogged).toBe(true);

      console.log("✅ User actions logged in audit trail");
    });

    test("should log authentication attempts", async () => {
      const User = require("../models/User");
      
      // Mock authentication logging
      const authLog = {
        email: "admin@test.com",
        action: "LOGIN_ATTEMPT",
        success: true,
        timestamp: new Date(),
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0"
      };

      User.findOne.mockResolvedValue({
        email: "admin@test.com",
        password: "hashedpassword"
      });

      const response = await api("post", "/api/auth/login")
        .send({
          email: "admin@test.com",
          password: "password123"
        });

      expect(response.status).toBe(200);
      expect(response.body.authLogged).toBe(true);

      console.log("✅ Authentication attempts logged");
    });

    test("should log failed authentication attempts", async () => {
      const User = require("../models/User");
      
      // Mock failed authentication logging
      const failedAuthLog = {
        email: "admin@test.com",
        action: "LOGIN_FAILED",
        reason: "invalid_password",
        timestamp: new Date(),
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0"
      };

      User.findOne.mockResolvedValue(null);

      const response = await api("post", "/api/auth/login")
        .send({
          email: "admin@test.com",
          password: "wrongpassword"
        });

      expect(response.status).toBe(401);
      expect(response.body.authFailedLogged).toBe(true);

      console.log("✅ Failed authentication attempts logged");
    });

    test("should log data access patterns", async () => {
      const Student = require("../models/Student");
      
      // Mock data access logging
      const dataAccessLog = {
        userId: "teacher123",
        action: "DATA_ACCESS",
        resource: "students",
        endpoint: "/api/students",
        timestamp: new Date(),
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        queryParams: {
          class: "class1",
          term: "First Term"
        }
      };

      Student.find.mockResolvedValue([
        {
          firstName: "Student1",
          lastName: "Test",
          email: "student1@test.com"
        }
      ]);

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          class: "class1",
          term: "First Term"
        });

      expect(response.status).toBe(200);
      expect(response.body.dataAccessLogged).toBe(true);

      console.log("✅ Data access patterns logged");
    });
  });

  describe("Error Logging", () => {
    test("should log validation errors", async () => {
      const Student = require("../models/Student");
      
      // Mock validation error logging
      const validationErrorLog = {
        errorType: "VALIDATION_ERROR",
        message: "Invalid email format",
        field: "email",
        value: "invalid-email",
        timestamp: new Date(),
        stackTrace: "Error: Invalid email format"
      };

      Student.create.mockRejectedValue(new Error("Validation failed"));

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          firstName: "Test",
          lastName: "Student",
          email: "invalid-email"
        });

      expect(response.status).toBe(400);
      expect(response.body.errorLogged).toBe(true);

      console.log("✅ Validation errors logged");
    });

    test("should log system errors", async () => {
      const Student = require("../models/Student");
      
      // Mock system error logging
      const systemErrorLog = {
        errorType: "SYSTEM_ERROR",
        message: "Database connection failed",
        timestamp: new Date(),
        stackTrace: "Error: ECONNREFUSED",
        severity: "HIGH"
      };

      Student.create.mockRejectedValue(new Error("Database connection failed"));

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          firstName: "Test",
          lastName: "Student",
          email: "test@example.com"
        });

      expect(response.status).toBe(500);
      expect(response.body.systemErrorLogged).toBe(true);

      console.log("✅ System errors logged");
    });

    test("should log security violations", async () => {
      const Student = require("../models/Student");
      
      // Mock security violation logging
      const securityViolationLog = {
        violationType: "UNAUTHORIZED_ACCESS",
        userId: "unknown",
        action: "CREATE_STUDENT",
        resource: "students",
        timestamp: new Date(),
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        details: "Attempted to create student without authentication"
      };

      Student.create.mockRejectedValue(new Error("Unauthorized access"));

      const response = await api("post", "/api/students")
        .send({
          firstName: "Test",
          lastName: "Student",
          email: "test@example.com"
        });

      expect(response.status).toBe(401);
      expect(response.body.securityViolationLogged).toBe(true);

      console.log("✅ Security violations logged");
    });

    test("should provide error tracking", async () => {
      const Student = require("../models/Student");
      
      // Mock error tracking
      const errorTracking = {
        errorId: "ERR-001",
        errorType: "VALIDATION_ERROR",
        count: 3,
        firstOccurrence: new Date(Date.now() - 3600000), // 1 hour ago
        lastOccurrence: new Date(),
        resolved: false,
        resolution: null
      };

      Student.create.mockRejectedValue(new Error("Validation failed"));

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          firstName: "Test",
          lastName: "Student",
          email: "invalid-email"
        });

      expect(response.status).toBe(400);
      expect(response.body.errorTracking).toBeDefined();
      expect(response.body.errorTracking.errorId).toBe("ERR-001");

      console.log("✅ Error tracking provided");
    });
  });

  describe("Malicious Input Attempts", () => {
    test("should prevent buffer overflow attacks", async () => {
      const bufferOverflow = {
        firstName: "A".repeat(10000),
        lastName: "Test",
        email: "test@example.com"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(bufferOverflow);

      expect(response.status).toBe(400);
      expect(response.body.bufferOverflowPrevented).toBe(true);
      expect(response.body.inputSizeExceeded).toBe(true);

      console.log("✅ Buffer overflow attacks prevented");
    });

    test("should prevent command injection", async () => {
      const commandInjection = {
        firstName: "Test; rm -rf /",
        lastName: "Test",
        email: "test@example.com"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(commandInjection);

      expect(response.status).toBe(400);
      expect(response.body.commandInjectionPrevented).toBe(true);
      expect(response.body.maliciousCommandDetected).toBe(true);

      console.log("✅ Command injection prevented");
    });

    test("should prevent LDAP injection", async () => {
      const ldapInjection = {
        email: "admin)(&(objectClass=user)(cn=admin*",
        password: "password"
      };

      const response = await api("post", "/api/auth/login")
        .send(ldapInjection);

      expect(response.status).toBe(400);
      expect(response.body.ldapInjectionPrevented).toBe(true);
      expect(response.body.ldapQueryDetected).toBe(true);

      console.log("✅ LDAP injection prevented");
    });

    test("should prevent XML injection", async () => {
      const xmlInjection = {
        firstName: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><!DOCTYPE root [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]><root>&xxe;</root>",
        lastName: "Test",
        email: "test@example.com"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(xmlInjection);

      expect(response.status).toBe(400);
      expect(response.body.xmlInjectionPrevented).toBe(true);
      expect(response.body.xmlEntityDetected).toBe(true);

      console.log("✅ XML injection prevented");
    });
  });

  describe("Script Injection Attempts", () => {
    test("should prevent JavaScript injection", async () => {
      const jsInjection = {
        firstName: "<script>alert('xss')</script>",
        lastName: "Test",
        email: "test@example.com"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(jsInjection);

      expect(response.status).toBe(400);
      expect(response.body.scriptInjectionPrevented).toBe(true);
      expect(response.body.javascriptDetected).toBe(true);

      console.log("✅ JavaScript injection prevented");
    });

    test("should prevent VBScript injection", async () => {
      const vbsInjection = {
        firstName: "<script language=\"vbscript\">alert('xss')</script>",
        lastName: "Test",
        email: "test@example.com"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(vbsInjection);

      expect(response.status).toBe(400);
      expect(response.body.vbscriptInjectionPrevented).toBe(true);
      expect(response.body.vbscriptDetected).toBe(true);

      console.log("✅ VBScript injection prevented");
    });

    test("should prevent CSS injection", async () => {
      const cssInjection = {
        firstName: "<style>body { background: url('javascript:alert(\"xss\")') }</style>",
        lastName: "Test",
        email: "test@example.com"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(cssInjection);

      expect(response.status).toBe(400);
      expect(response.body.cssInjectionPrevented).toBe(true);
      expect(response.body.cssDetected).toBe(true);

      console.log("✅ CSS injection prevented");
    });

    test("should prevent HTML injection", async () => {
      const htmlInjection = {
        firstName: "<img src=x onerror=alert('xss')>",
        lastName: "Test",
        email: "test@example.com"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(htmlInjection);

      expect(response.status).toBe(400);
      expect(response.body.htmlInjectionPrevented).toBe(true);
      expect(response.body.htmlDetected).toBe(true);

      console.log("✅ HTML injection prevented");
    });
  });

  describe("Route Tampering Attempts", () => {
    test("should prevent HTTP method tampering", async () => {
      const response = await api("patch", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          firstName: "Test",
          lastName: "Student",
          email: "test@example.com"
        });

      expect(response.status).toBe(405);
      expect(response.body.methodNotAllowed).toBe(true);
      expect(response.body.allowedMethods).toBeDefined();

      console.log("✅ HTTP method tampering prevented");
    });

    test("should prevent parameter pollution", async () => {
      const parameterPollution = {
        firstName: "Test",
        lastName: "Student",
        email: "test@example.com",
        "user[admin]": "true",
        "user[role]": "admin"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(parameterPollution);

      expect(response.status).toBe(400);
      expect(response.body.parameterPollutionPrevented).toBe(true);
      expect(response.body.suspiciousParameters).toBeDefined();

      console.log("✅ Parameter pollution prevented");
    });

    test("should prevent header injection", async () => {
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Forwarded-For", "http://malicious-site.com")
        .set("X-Real-IP", "192.168.1.1");

      expect(response.status).toBe(400);
      expect(response.body.headerInjectionPrevented).toBe(true);
      expect(response.body.suspiciousHeaders).toBeDefined();

      console.log("✅ Header injection prevented");
    });

    test("should prevent URL tampering", async () => {
      const response = await api("get", "/api/students/../admin/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.pathTraversalPrevented).toBe(true);
      expect(response.body.suspiciousPath).toBeDefined();

      console.log("✅ URL tampering prevented");
    });
  });
});
