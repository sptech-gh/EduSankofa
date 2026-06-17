const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass, createMockAcademicYear, createMockTerm } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Stress Testing Edge Cases", () => {
  let adminToken, teacherToken;
  let largeStudentDataset;
  let testAcademicYear, testTerm, testClass;

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
    testAcademicYear = createMockAcademicYear();
    testTerm = createMockTerm();
    testClass = createMockClass();

    // Create large student dataset
    largeStudentDataset = Array.from({ length: 1000 }, (_, i) => 
      createMockStudent({
        email: `student${i}@test.com`,
        firstName: `Student${i}`,
        lastName: `Test${i}`
      })
    );
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

  describe("Large Student Dataset Stress Testing", () => {
    test("should handle large student dataset efficiently", async () => {
      const Student = require("../models/Student");
      Student.find.mockResolvedValue(largeStudentDataset);

      const startTime = Date.now();

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.students).toHaveLength(1000);
      expect(responseTime).toBeLessThan(5000); // Should complete in under 5 seconds

      console.log("✅ Large student dataset handled efficiently");
    });

    test("should handle concurrent large dataset operations", async () => {
      const Student = require("../models/Student");
      Student.find.mockResolvedValue(largeStudentDataset);

      const startTime = Date.now();

      // Create multiple concurrent requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        api("get", "/api/students")
          .set("Authorization", `Bearer ${adminToken}`)
          .query({ page: i, limit: 100 })
      );

      const responses = await Promise.all(promises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.students).toHaveLength(100);
      });

      expect(totalTime).toBeLessThan(10000); // Should complete in under 10 seconds

      console.log("✅ Concurrent large dataset operations handled efficiently");
    });

    test("should maintain performance with large dataset filtering", async () => {
      const Student = require("../models/Student");
      Student.find.mockImplementation((query) => {
        if (query.firstName && query.firstName.$regex) {
          // Simulate regex filtering
          return Promise.resolve(largeStudentDataset.filter(s => 
            s.firstName.toLowerCase().includes(query.firstName.$regex)
          ));
        }
        return Promise.resolve(largeStudentDataset);
      });

      const startTime = Date.now();

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ firstName: "Student1" });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(3000); // Should complete in under 3 seconds

      console.log("✅ Large dataset filtering performance maintained");
    });
  });

  describe("Edge Score Values Testing", () => {
    test("should handle perfect scores (100%)", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: "student1",
          subject: "Mathematics",
          assessment: 100,
          exam: 100,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", "/api/grades/student/student1/subject/Mathematics")
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalScore).toBe(100);
      expect(response.body.grade).toBe("A");

      console.log("✅ Perfect scores handled correctly");
    });

    test("should handle zero scores (0%)", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: "student2",
          subject: "Mathematics",
          assessment: 0,
          exam: 0,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", "/api/grades/student/student2/subject/Mathematics")
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalScore).toBe(0);
      expect(response.body.grade).toBe("F");

      console.log("✅ Zero scores handled correctly");
    });

    test("should handle borderline scores", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: "student3",
          subject: "Mathematics",
          assessment: 49.5,
          exam: 50,
          term: "First Term"
        },
        {
          student: "student4",
          subject: "Mathematics",
          assessment: 50,
          exam: 49.5,
          term: "First Term"
        },
        {
          student: "student5",
          subject: "Mathematics",
          assessment: 59.9,
          exam: 60,
          term: "First Term"
        },
        {
          student: "student6",
          subject: "Mathematics",
          assessment: 60,
          exam: 59.9,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const responses = await Promise.all([
        api("get", "/api/grades/student/student3/subject/Mathematics")
          .set("Authorization", `Bearer ${teacherToken}`),
        api("get", "/api/grades/student/student4/subject/Mathematics")
          .set("Authorization", `Bearer ${teacherToken}`),
        api("get", "/api/grades/student/student5/subject/Mathematics")
          .set("Authorization", `Bearer ${teacherToken}`),
        api("get", "/api/grades/student/student6/subject/Mathematics")
          .set("Authorization", `Bearer ${teacherToken}`)
      ]);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Verify borderline grade mapping
      expect(responses[0].body.grade).toBe("F"); // 49.75
      expect(responses[1].body.grade).toBe("F"); // 49.75
      expect(responses[2].body.grade).toBe("C"); // 59.95
      expect(responses[3].body.grade).toBe("C"); // 59.95

      console.log("✅ Borderline scores handled correctly");
    });

    test("should handle decimal scores", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: "student7",
          subject: "Mathematics",
          assessment: 87.5,
          exam: 92.3,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", "/api/grades/student/student7/subject/Mathematics")
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      
      // Calculate expected total score
      const expectedTotalScore = (87.5 + 92.3) / 2;
      expect(response.body.totalScore).toBeCloseTo(expectedTotalScore, 0.01);

      console.log("✅ Decimal scores handled correctly");
    });

    test("should handle negative scores", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: "student8",
          subject: "Mathematics",
          assessment: -5,
          exam: 25,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("post", "/api/grades")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send(mockGrades[0]);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.assessment).toBeDefined();

      console.log("✅ Negative scores rejected correctly");
    });
  });

  describe("Missing Score Scenarios", () => {
    test("should handle missing assessment scores", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: "student9",
          subject: "Mathematics",
          assessment: null,
          exam: 85,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", "/api/grades/student/student9/subject/Mathematics")
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalScore).toBe(85); // Only exam score
      expect(response.body.missingAssessment).toBe(true);

      console.log("✅ Missing assessment scores handled correctly");
    });

    test("should handle missing exam scores", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: "student10",
          subject: "Mathematics",
          assessment: 85,
          exam: null,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", "/api/grades/student/student10/subject/Mathematics")
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalScore).toBe(85); // Only assessment score
      expect(response.body.missingExam).toBe(true);

      console.log("✅ Missing exam scores handled correctly");
    });

    test("should handle both assessment and exam missing", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: "student11",
          subject: "Mathematics",
          assessment: null,
          exam: null,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", "/api/grades/student/student11/subject/Mathematics")
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalScore).toBe(0);
      expect(response.body.missingAssessment).toBe(true);
      expect(response.body.missingExam).toBe(true);

      console.log("✅ Both assessment and exam missing handled correctly");
    });

    test("should handle invalid score ranges", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: "student12",
          subject: "Mathematics",
          assessment: 150, // Invalid - over 100
          exam: 85,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("post", "/api/grades")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send(mockGrades[0]);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.assessment).toBeDefined();

      console.log("✅ Invalid score ranges rejected correctly");
    });
  });

  describe("Calculation Error Scenarios", () => {
    test("should handle division by zero in calculations", async () => {
      const Grade = require("../models/Grade");
      
      // Mock scenario where weight calculation could cause division by zero
      const mockGrades = [
        {
          student: "student13",
          subject: "Mathematics",
          assessment: 85,
          exam: 90,
          term: "First Term",
          assessmentWeight: 0,
          examWeight: 0 // Both weights are zero
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", "/api/grades/student/student13/subject/Mathematics")
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.error).toBeDefined();
      expect(response.body.error).toContain("division by zero");

      console.log("✅ Division by zero handled correctly");
    });

    test("should handle NaN values in calculations", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: "student14",
          subject: "Mathematics",
          assessment: NaN,
          exam: 90,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("post", "/api/grades")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send(mockGrades[0]);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.assessment).toBeDefined();

      console.log("✅ NaN values handled correctly");
    });

    test("should handle Infinity values in calculations", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: "student15",
          subject: "Mathematics",
          assessment: Infinity,
          exam: 90,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("post", "/api/grades")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send(mockGrades[0]);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.assessment).toBeDefined();

      console.log("✅ Infinity values handled correctly");
    });
  });

  describe("Memory and Performance Under Stress", () => {
    test("should maintain memory usage with large operations", async () => {
      const Student = require("../models/Student");
      Student.find.mockResolvedValue(largeStudentDataset);

      const initialMemory = process.memoryUsage();

      // Perform multiple large operations
      const promises = Array.from({ length: 50 }, (_, i) =>
        api("get", "/api/students")
          .set("Authorization", `Bearer ${adminToken}`)
          .query({ page: i, limit: 20 })
      );

      await Promise.all(promises);

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase significantly
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase

      console.log("✅ Memory usage maintained under stress");
    });

    test("should handle concurrent calculations without errors", async () => {
      const Grade = require("../models/Grade");
      
      // Mock multiple grade calculations
      const mockGrades = Array.from({ length: 100 }, (_, i) => ({
        student: `student${i}`,
        subject: "Mathematics",
        assessment: Math.random() * 100,
        exam: Math.random() * 100,
        term: "First Term"
      }));

      Grade.find.mockResolvedValue(mockGrades);

      const startTime = Date.now();

      // Perform concurrent calculations
      const promises = mockGrades.map(grade =>
        api("get", `/api/grades/student/${grade.student}/subject/Mathematics`)
          .set("Authorization", `Bearer ${teacherToken}`)
      );

      const responses = await Promise.all(promises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.totalScore).toBeDefined();
      });

      expect(totalTime).toBeLessThan(15000); // Should complete in under 15 seconds

      console.log("✅ Concurrent calculations handled without errors");
    });
  });
});
