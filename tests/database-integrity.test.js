const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockAcademicYear, createMockClass, createMockTerm } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Database Integrity Tests", () => {
  let adminToken;
  let testStudent, testAcademicYear, testClass, testTerm;

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
    testTerm = createMockTerm();
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
    const Term = require("../models/Term");
    const Enrollment = require("../models/Enrollment");
    
    Student.findOne.mockResolvedValue(testStudent);
    Student.find.mockResolvedValue([testStudent]);
    AcademicYear.findOne.mockResolvedValue(testAcademicYear);
    ClassModel.findOne.mockResolvedValue(testClass);
    Term.findOne.mockResolvedValue(testTerm);
    Enrollment.findOne.mockResolvedValue({
      student: testStudent,
      academicYear: testAcademicYear,
      class: testClass,
      status: "active"
    });
  });

  describe("Student ↔ Parent Relationship", () => {
    test("should maintain student-parent relationship integrity", async () => {
      // Create student with parent reference
      const Student = require("../models/Student");
      const studentWithParent = {
        ...testStudent,
        parentId: "parent123"
      };
      Student.create.mockResolvedValue(studentWithParent);

      const createResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(studentWithParent);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.parentId).toBe("parent123");

      // Verify parent reference is maintained
      const getResponse = await api("get", `/api/students/${createResponse.body._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.parentId).toBe("parent123");

      console.log("✅ Student-Parent relationship integrity maintained");
    });

    test("should prevent orphaned student records", async () => {
      // Mock parent deletion
      const User = require("../models/User");
      User.findByIdAndDelete.mockResolvedValue(null);

      // Try to create student with non-existent parent
      const Student = require("../models/Student");
      const studentWithOrphanedParent = {
        ...testStudent,
        parentId: "nonexistentparent"
      };
      Student.findOne.mockImplementation((query) => {
        if (query._id === "nonexistentparent") {
          return Promise.resolve(null);
        }
        return Promise.resolve(testStudent);
      });

      const createResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(studentWithOrphanedParent);

      expect(createResponse.status).toBe(400);
      expect(createResponse.body.errors).toBeDefined();

      console.log("✅ Orphaned student record prevention working");
    });
  });

  describe("Student ↔ Class Relationship", () => {
    test("should maintain student-class enrollment relationship", async () => {
      // Create enrollment
      const Enrollment = require("../models/Enrollment");
      const enrollment = {
        student: testStudent._id,
        academicYear: testAcademicYear._id,
        class: testClass._id,
        status: "active"
      };
      Enrollment.create.mockResolvedValue(enrollment);

      const createResponse = await api("post", "/api/enrollments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(enrollment);

      expect(createResponse.status).toBe(201);

      // Verify enrollment relationship
      const getResponse = await api("get", `/api/enrollments/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body[0].class).toBe(testClass._id);

      console.log("✅ Student-Class enrollment relationship maintained");
    });

    test("should prevent duplicate enrollments", async () => {
      const Enrollment = require("../models/Enrollment");
      Enrollment.findOne.mockResolvedValue({
        student: testStudent._id,
        academicYear: testAcademicYear._id,
        class: testClass._id,
        status: "active"
      });

      const enrollment = {
        student: testStudent._id,
        academicYear: testAcademicYear._id,
        class: testClass._id,
        status: "active"
      };

      const createResponse = await api("post", "/api/enrollments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(enrollment);

      expect(createResponse.status).toBe(400);
      expect(createResponse.body.message).toContain("already enrolled");

      console.log("✅ Duplicate enrollment prevention working");
    });
  });

  describe("Class ↔ Subject Relationship", () => {
    test("should maintain class-subject assignment relationship", async () => {
      // Create class with subjects
      const ClassModel = require("../models/Class");
      const classWithSubjects = {
        ...testClass,
        subjects: ["Mathematics", "English", "Science"]
      };
      ClassModel.create.mockResolvedValue(classWithSubjects);

      const createResponse = await api("post", "/api/classes")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(classWithSubjects);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.subjects).toHaveLength(3);

      console.log("✅ Class-Subject relationship maintained");
    });
  });

  describe("Academic Year ↔ Term Structure", () => {
    test("should maintain academic year-term structure", async () => {
      // Create term for academic year
      const Term = require("../models/Term");
      const termForYear = {
        ...testTerm,
        academicYear: testAcademicYear._id,
        name: "First Term",
        order: 1
      };
      Term.create.mockResolvedValue(termForYear);

      const createResponse = await api("post", "/api/terms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(termForYear);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.academicYear).toBe(testAcademicYear._id);

      console.log("✅ Academic Year-Term structure maintained");
    });

    test("should enforce term order consistency", async () => {
      const Term = require("../models/Term");
      Term.findOne.mockImplementation((query) => {
        if (query.academicYear === testAcademicYear._id) {
          return Promise.resolve(testTerm);
        }
        return Promise.resolve(null);
      });

      // Try to create term with invalid order
      const invalidTerm = {
        ...testTerm,
        academicYear: testAcademicYear._id,
        name: "Second Term",
        order: 1 // Invalid - First Term already exists with order 1
      };

      const createResponse = await api("post", "/api/terms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidTerm);

      expect(createResponse.status).toBe(400);
      expect(createResponse.body.errors).toBeDefined();

      console.log("✅ Term order consistency enforced");
    });
  });

  describe("Archived Terms Protection", () => {
    test("should prevent modification of archived terms", async () => {
      const Term = require("../models/Term");
      const archivedTerm = {
        ...testTerm,
        academicYear: testAcademicYear._id,
        name: "Archived Term",
        order: 1,
        isActive: false
      };
      Term.create.mockResolvedValue(archivedTerm);

      // Try to modify archived term
      const updateResponse = await api("put", `/api/terms/${archivedTerm._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Modified Archived Term"
        });

      expect(updateResponse.status).toBe(403);
      expect(updateResponse.body.message).toContain("archived");

      console.log("✅ Archived terms protection working");
    });

    test("should prevent deletion of archived terms", async () => {
      const Term = require("../models/Term");
      const archivedTerm = {
        ...testTerm,
        academicYear: testAcademicYear._id,
        name: "Archived Term",
        order: 1,
        isActive: false
      };
      Term.create.mockResolvedValue(archivedTerm);

      const deleteResponse = await api("delete", `/api/terms/${archivedTerm._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(deleteResponse.status).toBe(403);
      expect(deleteResponse.body.message).toContain("archived");

      console.log("✅ Archived terms deletion protection working");
    });
  });

  describe("Promotion Logic Data Integrity", () => {
    test("should not corrupt past data during promotion", async () => {
      // Create student with existing data
      const Student = require("../models/Student");
      const existingStudent = {
        ...testStudent,
        _id: "existingStudent123",
        academicHistory: [
          {
            year: "2023-2024",
            grade: "Class 1",
            status: "completed"
          }
        ]
      };
      Student.findOne.mockResolvedValue(existingStudent);

      // Mock promotion calculation
      const ReportCard = require("../models/ReportCard");
      ReportCard.find.mockResolvedValue([{
        student: existingStudent._id,
        averageScore: 85,
        subjects: [
          { name: "Mathematics", totalScore: 90 },
          { name: "English", totalScore: 80 }
        ],
        attendance: {
          attendancePercentage: 92
        }
      }]);

      const promotionResponse = await api("post", "/api/promotion/calculate")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          academicYearId: testAcademicYear._id,
          termId: testTerm._id
        });

      expect(promotionResponse.status).toBe(200);

      // Verify original academic history is preserved
      const getStudentResponse = await api("get", `/api/students/${existingStudent._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(getStudentResponse.status).toBe(200);
      expect(getStudentResponse.body.academicHistory).toEqual(existingStudent.academicHistory);

      console.log("✅ Promotion logic does not corrupt past data");
    });
  });

  describe("Foreign Key Constraints", () => {
    test("should enforce foreign key constraints", async () => {
      // Test enrollment with non-existent student
      const Enrollment = require("../models/Enrollment");
      Enrollment.findOne.mockResolvedValue(null);

      const enrollment = {
        student: "nonexistentstudent123",
        academicYear: testAcademicYear._id,
        class: testClass._id,
        status: "active"
      };

      const createResponse = await api("post", "/api/enrollments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(enrollment);

      expect(createResponse.status).toBe(400);
      expect(createResponse.body.errors).toBeDefined();

      console.log("✅ Foreign key constraints enforced");
    });

    test("should handle cascading deletes properly", async () => {
      // Mock student deletion with cascading enrollment deletion
      const Student = require("../models/Student");
      const Enrollment = require("../models/Enrollment");
      
      Student.findByIdAndDelete.mockResolvedValue(testStudent);
      Enrollment.deleteMany.mockResolvedValue({ deletedCount: 2 });

      const deleteResponse = await api("delete", `/api/students/${testStudent._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(deleteResponse.status).toBe(200);
      expect(Enrollment.deleteMany).toHaveBeenCalledWith({
        student: testStudent._id
      });

      console.log("✅ Cascading deletes working properly");
    });
  });

  describe("Data Consistency Across Modules", () => {
    test("should maintain consistency between student and enrollment data", async () => {
      const Student = require("../models/Student");
      const Enrollment = require("../models/Enrollment");
      
      const studentData = {
        ...testStudent,
        currentGrade: "Class 2"
      };
      Student.findOne.mockResolvedValue(studentData);

      const enrollmentData = {
        student: testStudent._id,
        academicYear: testAcademicYear._id,
        class: testClass._id,
        status: "active"
      };
      Enrollment.findOne.mockResolvedValue(enrollmentData);

      // Get student data
      const studentResponse = await api("get", `/api/students/${testStudent._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(studentResponse.status).toBe(200);
      expect(studentResponse.body.currentGrade).toBe("Class 2");

      // Get enrollment data
      const enrollmentResponse = await api("get", `/api/enrollments/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(enrollmentResponse.status).toBe(200);
      expect(enrollmentResponse.body.student).toBe(testStudent._id);

      console.log("✅ Data consistency across modules maintained");
    });
  });
});
