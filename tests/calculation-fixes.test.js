const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass, createMockAcademicYear, createMockTerm } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Calculation Fixes Tests", () => {
  let adminToken, teacherToken;
  let testStudent, testAcademicYear, testTerm, testClass;

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
    testAcademicYear = createMockAcademicYear();
    testTerm = createMockTerm();
    testClass = createMockClass();
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create mock users
    const adminUser = createMockUser({ role: "admin" });
    const teacherUser = createMockUser({ role: "teacher" });
    
    const User = require("../models/User");
    User.findOne.mockImplementation((query) => {
      if (query.email === "admin@test.com") return Promise.resolve(adminUser);
      if (query.email === "teacher@test.com") return Promise.resolve(teacherUser);
      return Promise.resolve(null);
    });

    // Get tokens
    const responses = await Promise.all([
      api("post", "/api/auth/login").send({ email: "admin@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "teacher@test.com", password: "password123" })
    ]);

    adminToken = responses[0].body.token;
    teacherToken = responses[1].body.token;
  });

  describe("Fixed Continuous Assessment Calculations", () => {
    test("should correctly calculate weighted continuous assessment", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: testStudent._id,
          subject: "Mathematics",
          assessment: 80,
          exam: 90,
          term: "First Term",
          assessmentWeight: 0.4,
          examWeight: 0.6
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", `/api/grades/student/${testStudent._id}/subject/Mathematics`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      
      // Fixed calculation: (80 * 0.4) + (90 * 0.6) = 86
      expect(response.body.weightedScore).toBe(86);

      console.log("✅ Fixed weighted continuous assessment calculation");
    });

    test("should handle missing assessment with proper fallback", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: testStudent._id,
          subject: "Mathematics",
          assessment: null,
          exam: 85,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", `/api/grades/student/${testStudent._id}/subject/Mathematics`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      
      // Fixed: Use exam score when assessment is missing
      expect(response.body.totalScore).toBe(85);
      expect(response.body.missingAssessment).toBe(true);

      console.log("✅ Fixed missing assessment fallback");
    });

    test("should handle missing exam with proper fallback", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: testStudent._id,
          subject: "Mathematics",
          assessment: 85,
          exam: null,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", `/api/grades/student/${testStudent._id}/subject/Mathematics`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      
      // Fixed: Use assessment score when exam is missing
      expect(response.body.totalScore).toBe(85);
      expect(response.body.missingExam).toBe(true);

      console.log("✅ Fixed missing exam fallback");
    });
  });

  describe("Fixed Total Score Computation", () => {
    test("should handle multiple assessments correctly", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: testStudent._id,
          subject: "Mathematics",
          assessment: 85,
          exam: 90,
          term: "First Term"
        },
        {
          student: testStudent._id,
          subject: "Mathematics",
          assessment: 80,
          exam: 85,
          term: "First Term"
        },
        {
          student: testStudent._id,
          subject: "Mathematics",
          assessment: 90,
          exam: 95,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", `/api/grades/student/${testStudent._id}/subject/Mathematics`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      
      // Fixed: Calculate average of all assessments and exams separately
      const expectedAssessmentAverage = (85 + 80 + 90) / 3;
      const expectedExamAverage = (90 + 85 + 95) / 3;
      const expectedTotalScore = (expectedAssessmentAverage + expectedExamAverage) / 2;
      
      expect(response.body.totalScore).toBeCloseTo(expectedTotalScore, 0.01);

      console.log("✅ Fixed multiple assessments calculation");
    });

    test("should handle decimal precision correctly", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: testStudent._id,
          subject: "Mathematics",
          assessment: 87.5,
          exam: 92.3,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", `/api/grades/student/${testStudent._id}/subject/Mathematics`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      
      // Fixed: Handle decimal precision properly
      const expectedTotalScore = (87.5 + 92.3) / 2;
      expect(response.body.totalScore).toBeCloseTo(expectedTotalScore, 0.01);

      console.log("✅ Fixed decimal precision handling");
    });
  });

  describe("Fixed Grade Mapping", () => {
    test("should map borderline scores correctly", async () => {
      const ReportCard = require("../models/ReportCard");
      
      const mockReportCard = {
        student: testStudent._id,
        academicYearId: testAcademicYear._id,
        termId: testTerm._id,
        subjects: [
          { name: "Mathematics", totalScore: 49.5 },
          { name: "English", totalScore: 49.6 },
          { name: "Science", totalScore: 59.5 },
          { name: "Social Studies", totalScore: 59.4 }
        ]
      };

      ReportCard.find.mockResolvedValue([mockReportCard]);

      const response = await api("get", `/api/report-cards/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      // Fixed: Handle borderline scores correctly
      expect(response.body.reportCards[0].subjects[0].grade).toBe("F"); // 49.5
      expect(response.body.reportCards[0].subjects[1].grade).toBe("F"); // 49.6
      expect(response.body.reportCards[0].subjects[2].grade).toBe("C"); // 59.5
      expect(response.body.reportCards[0].subjects[3].grade).toBe("F"); // 59.4

      console.log("✅ Fixed borderline grade mapping");
    });

    test("should handle perfect and zero scores", async () => {
      const ReportCard = require("../models/ReportCard");
      
      const mockReportCard = {
        student: testStudent._id,
        academicYearId: testAcademicYear._id,
        termId: testTerm._id,
        subjects: [
          { name: "Mathematics", totalScore: 100 },
          { name: "English", totalScore: 0 },
          { name: "Science", totalScore: 50 }
        ]
      };

      ReportCard.find.mockResolvedValue([mockReportCard]);

      const response = await api("get", `/api/report-cards/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      // Fixed: Perfect and zero scores
      expect(response.body.reportCards[0].subjects[0].grade).toBe("A"); // 100
      expect(response.body.reportCards[0].subjects[1].grade).toBe("F"); // 0
      expect(response.body.reportCards[0].subjects[2].grade).toBe("C"); // 50

      console.log("✅ Fixed perfect and zero score mapping");
    });
  });

  describe("Fixed Class Position Ranking", () => {
    test("should handle ties correctly", async () => {
      const ReportCard = require("../models/ReportCard");
      
      const mockReportCards = [
        {
          student: "student1",
          totalScore: 95,
          position: 1
        },
        {
          student: "student2",
          totalScore: 95,
          position: 1
        },
        {
          student: testStudent._id,
          totalScore: 95,
          position: 1
        },
        {
          student: "student4",
          totalScore: 90,
          position: 4
        }
      ];

      ReportCard.find.mockResolvedValue(mockReportCards);

      const response = await api("get", `/api/report-cards/class/${testClass._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      // Fixed: Proper tie handling
      const tiedStudents = response.body.reportCards.filter(rc => rc.position === 1);
      expect(tiedStudents).toHaveLength(3);
      expect(tiedStudents.every(rc => rc.totalScore === 95)).toBe(true);

      console.log("✅ Fixed tie handling in ranking");
    });

    test("should calculate position ranking with gaps", async () => {
      const ReportCard = require("../models/ReportCard");
      
      const mockReportCards = [
        { student: "student1", totalScore: 95, position: 1 },
        { student: "student2", totalScore: 85, position: 3 },
        { student: testStudent._id, totalScore: 90, position: 2 },
        { student: "student4", totalScore: 80, position: 4 },
        { student: "student5", totalScore: 75, position: 5 }
      ];

      ReportCard.find.mockResolvedValue(mockReportCards);

      const response = await api("get", `/api/report-cards/class/${testClass._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      // Fixed: Calculate positions with gaps
      const studentReportCard = response.body.reportCards.find(rc => rc.student === testStudent._id);
      expect(studentReportCard.position).toBe(2);
      expect(studentReportCard.totalScore).toBe(90);

      console.log("✅ Fixed position ranking with gaps");
    });
  });

  describe("Error Handling in Calculations", () => {
    test("should handle invalid input gracefully", async () => {
      const Grade = require("../models/Grade");
      
      const invalidGrade = {
        student: testStudent._id,
        subject: "Mathematics",
        assessment: "invalid",
        exam: 85,
        term: "First Term"
      };

      Grade.create.mockRejectedValue(new Error("Invalid input"));

      const response = await api("post", "/api/grades")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send(invalidGrade);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();

      console.log("✅ Invalid input handled gracefully");
    });

    test("should handle calculation overflow", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: testStudent._id,
          subject: "Mathematics",
          assessment: Number.MAX_VALUE,
          exam: 90,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", `/api/grades/student/${testStudent._id}/subject/Mathematics`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain("overflow");

      console.log("✅ Calculation overflow handled gracefully");
    });

    test("should handle database errors in calculations", async () => {
      const Grade = require("../models/Grade");
      
      Grade.find.mockRejectedValue(new Error("Database connection lost"));

      const response = await api("get", `/api/grades/student/${testStudent._id}/subject/Mathematics`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(500);
      expect(response.body.message).toBeDefined();

      console.log("✅ Database errors in calculations handled gracefully");
    });
  });

  describe("Performance Optimizations", () => {
    test("should cache calculation results", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: testStudent._id,
          subject: "Mathematics",
          assessment: 85,
          exam: 90,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      // First request
      const startTime = Date.now();
      const response1 = await api("get", `/api/grades/student/${testStudent._id}/subject/Mathematics`)
        .set("Authorization", `Bearer ${teacherToken}`);

      const firstRequestTime = Date.now() - startTime;

      // Second request (should be cached)
      const response2 = await api("get", `/api/grades/student/${testStudent._id}/subject/Mathematics`)
        .set("Authorization", `Bearer ${teacherToken}`);

      const secondRequestTime = Date.now() - startTime;

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body).toEqual(response2.body);
      expect(secondRequestTime).toBeLessThan(firstRequestTime);

      console.log("✅ Calculation results cached properly");
    });

    test("should batch process calculations efficiently", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = Array.from({ length: 100 }, (_, i) => ({
        student: `student${i}`,
        subject: "Mathematics",
        assessment: Math.random() * 100,
        exam: Math.random() * 100,
        term: "First Term"
      }));

      Grade.find.mockResolvedValue(mockGrades);

      const startTime = Date.now();

      // Batch calculation request
      const response = await api("post", "/api/grades/batch-calculate")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          students: mockGrades.map(g => g.student),
          subject: "Mathematics",
          term: "First Term"
        });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(100);
      expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds

      console.log("✅ Batch calculations processed efficiently");
    });
  });
});
