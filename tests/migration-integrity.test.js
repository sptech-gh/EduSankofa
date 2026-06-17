const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockAcademicYear, createMockClass } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Migration Integrity Tests", () => {
  let adminToken;
  let testStudent, testAcademicYear, testClass;

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

    // Create admin user and get token
    const adminUser = createMockUser({ role: "admin" });
    const User = require("../models/User");
    User.findOne.mockResolvedValue(adminUser);
    
    const loginResponse = await api("post", "/api/auth/login").send({
      email: "admin@test.com",
      password: "password123"
    });
    adminToken = loginResponse.body.token;

    // Create test data
    testStudent = createMockStudent();
    testAcademicYear = createMockAcademicYear();
    testClass = createMockClass();
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database models
    const Student = require("../models/Student");
    const AcademicYear = require("../models/AcademicYear");
    const ClassModel = require("../models/Class");
    
    Student.findOne.mockResolvedValue(testStudent);
    AcademicYear.findOne.mockResolvedValue(testAcademicYear);
    ClassModel.findOne.mockResolvedValue(testClass);
  });

  describe("Database Schema Validation", () => {
    test("should have proper student schema validation", async () => {
      // Test required fields
      const invalidStudent = {
        lastName: "Test",
        email: "test@test.com"
        // Missing firstName
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidStudent);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.firstName).toBeDefined();

      console.log("✅ Student schema validation working");
    });

    test("should validate email format", async () => {
      const invalidEmailStudent = {
        firstName: "Test",
        lastName: "Student",
        email: "invalid-email-format"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidEmailStudent);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.email).toBeDefined();

      console.log("✅ Email format validation working");
    });

    test("should validate date formats", async () => {
      const invalidDateStudent = {
        firstName: "Test",
        lastName: "Student",
        email: "test@test.com",
        dateOfBirth: "invalid-date"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidDateStudent);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.dateOfBirth).toBeDefined();

      console.log("✅ Date format validation working");
    });
  });

  describe("Index Validation", () => {
    test("should enforce unique constraints", async () => {
      const Student = require("../models/Student");
      
      // Create first student
      Student.create.mockResolvedValue(testStudent);
      const createResponse1 = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testStudent);

      expect(createResponse1.status).toBe(201);

      // Try to create student with same email
      const duplicateStudent = {
        ...testStudent,
        email: testStudent.email
      };
      Student.findOne.mockResolvedValue(testStudent);

      const createResponse2 = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(duplicateStudent);

      expect(createResponse2.status).toBe(400);
      expect(createResponse2.body.errors).toBeDefined();
      expect(createResponse2.body.errors.email).toBeDefined();

      console.log("✅ Unique constraint enforcement working");
    });

    test("should enforce studentId uniqueness", async () => {
      const Student = require("../models/Student");
      
      // Create student with admission number
      const studentWithAdmissionNumber = {
        ...testStudent,
        admissionNumber: "ADM001"
      };
      Student.create.mockResolvedValue(studentWithAdmissionNumber);

      const createResponse1 = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(studentWithAdmissionNumber);

      expect(createResponse1.status).toBe(201);

      // Try to create student with same admission number
      const duplicateStudent = {
        ...testStudent,
        admissionNumber: "ADM001"
      };
      Student.findOne.mockResolvedValue(studentWithAdmissionNumber);

      const createResponse2 = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(duplicateStudent);

      expect(createResponse2.status).toBe(400);
      expect(createResponse2.body.errors).toBeDefined();
      expect(createResponse2.body.errors.admissionNumber).toBeDefined();

      console.log("✅ StudentId uniqueness enforcement working");
    });
  });

  describe("Foreign Key Integrity", () => {
    test("should prevent orphaned enrollment records", async () => {
      const Enrollment = require("../models/Enrollment");
      
      // Create enrollment without student
      const orphanedEnrollment = {
        academicYear: testAcademicYear._id,
        class: testClass._id,
        status: "active"
      };
      Enrollment.findOne.mockResolvedValue(null);

      const response = await api("post", "/api/enrollments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(orphanedEnrollment);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();

      console.log("✅ Orphaned enrollment prevention working");
    });

    test("should prevent invalid academic year references", async () => {
      const Enrollment = require("../models/Enrollment");
      const AcademicYear = require("../models/AcademicYear");
      
      // Create enrollment with non-existent academic year
      const invalidEnrollment = {
        student: testStudent._id,
        academicYear: "nonexistentYear",
        class: testClass._id,
        status: "active"
      };
      AcademicYear.findOne.mockResolvedValue(null);

      const response = await api("post", "/api/enrollments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidEnrollment);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();

      console.log("✅ Invalid academic year reference prevention working");
    });
  });

  describe("Data Type Validation", () => {
    test("should validate enum values", async () => {
      // Test invalid gender
      const invalidGenderStudent = {
        firstName: "Test",
        lastName: "Student",
        email: "test@test.com",
        gender: "invalid-gender"
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidGenderStudent);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.gender).toBeDefined();

      console.log("✅ Enum validation working");
    });

    test("should validate numeric ranges", async () => {
      // Test invalid phone number
      const invalidPhoneStudent = {
        firstName: "Test",
        lastName: "Student",
        email: "test@test.com",
        phone: "123" // Too short
      };

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidPhoneStudent);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();

      console.log("✅ Numeric range validation working");
    });
  });

  describe("Default Value Validation", () => {
    test("should apply default values correctly", async () => {
      const Student = require("../models/Student");
      
      // Create student without status (should default to "active")
      const studentWithoutStatus = {
        firstName: "Test",
        lastName: "Student",
        email: "test@test.com"
      };
      Student.create.mockResolvedValue({
        ...studentWithoutStatus,
        status: "active"
      });

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(studentWithoutStatus);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("active");

      console.log("✅ Default value application working");
    });
  });

  describe("Timestamp Validation", () => {
    test("should automatically set timestamps", async () => {
      const Student = require("../models/Student");
      const mockDate = new Date();
      
      const studentData = {
        firstName: "Test",
        lastName: "Student",
        email: "test@test.com"
      };
      
      // Mock the save method to verify timestamps
      const mockSave = jest.fn().mockImplementation(function() {
        this.createdAt = mockDate;
        this.updatedAt = mockDate;
        return Promise.resolve(this);
      });
      
      Student.prototype.save = mockSave;
      Student.create.mockResolvedValue({
        ...studentData,
        createdAt: mockDate,
        updatedAt: mockDate
      });

      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(studentData);

      expect(response.status).toBe(201);
      expect(mockSave).toHaveBeenCalled();

      console.log("✅ Timestamp validation working");
    });
  });

  describe("Migration State Validation", () => {
    test("should handle database connection state", async () => {
      // Mock successful database connection
      const response = await api("get", "/api/health")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("connected");

      console.log("✅ Database connection state validation working");
    });

    test("should handle database migration state", async () => {
      // This would test if migrations are properly applied
      // For now, we verify the database schema is consistent
      const Student = require("../models/Student");
      
      // Verify schema has required fields
      const studentSchema = Student.schema;
      expect(studentSchema.paths.firstName.isRequired).toBe(true);
      expect(studentSchema.paths.email.isRequired).toBe(true);
      expect(studentSchema.paths.lastName.isRequired).toBe(true);

      // Verify indexes are defined
      expect(Array.isArray(studentSchema.indexes)).toBe(true);
      expect(studentSchema.indexes.length).toBeGreaterThan(0);

      console.log("✅ Migration state validation working");
    });
  });
});
