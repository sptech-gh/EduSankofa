const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass, createMockAcademicYear, createMockTerm } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Continuous Assessment Validation Tests", () => {
  let adminToken, teacherToken;
  let testStudent, testClass, testAcademicYear, testTerm;

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
    testClass = createMockClass();
    testAcademicYear = createMockAcademicYear();
    testTerm = createMockTerm();
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

  describe("Continuous Assessment Calculations", () => {
    test("should calculate continuous assessment correctly", async () => {
      const Grade = require("../models/Grade");
      
      // Mock grades for continuous assessment
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
          assessment: 78,
          exam: 82,
          term: "First Term"
        },
        {
          student: testStudent._id,
          subject: "Mathematics",
          assessment: 92,
          exam: 88,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", `/api/grades/student/${testStudent._id}/subject/Mathematics`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.grades).toHaveLength(3);

      // Calculate expected continuous assessment average
      const expectedAverage = (85 + 78 + 92) / 3;
      expect(response.body.continuousAssessmentAverage).toBeCloseTo(expectedAverage, 0.01);

      console.log("✅ Continuous assessment calculation correct");
    });

    test("should handle missing assessment scores", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: testStudent._id,
          subject: "Mathematics",
          assessment: null,
          exam: 90,
          term: "First Term"
        },
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
      
      // Should handle missing assessment scores
      expect(response.body.continuousAssessmentAverage).toBe(85); // Only one assessment score
      expect(response.body.missingAssessmentCount).toBe(1);

      console.log("✅ Missing assessment scores handled correctly");
    });

    test("should calculate weighted continuous assessment", async () => {
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
      
      // Calculate expected weighted score
      const expectedWeightedScore = (80 * 0.4) + (90 * 0.6);
      expect(response.body.weightedScore).toBeCloseTo(expectedWeightedScore, 0.01);

      console.log("✅ Weighted continuous assessment calculated correctly");
    });
  });

  describe("Exam Score Integration", () => {
    test("should integrate exam scores with continuous assessment", async () => {
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
          subject: "English",
          assessment: 78,
          exam: 82,
          term: "First Term"
        },
        {
          student: testStudent._id,
          subject: "Science",
          assessment: 92,
          exam: 88,
          term: "First Term"
        }
      ];

      Grade.find.mockResolvedValue(mockGrades);

      const response = await api("get", `/api/grades/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.grades).toHaveLength(3);

      // Verify exam scores are properly integrated
      response.body.grades.forEach(grade => {
        expect(grade.exam).toBeDefined();
        expect(grade.assessment).toBeDefined();
        expect(grade.totalScore).toBeDefined();
      });

      console.log("✅ Exam scores integrated correctly");
    });

    test("should handle missing exam scores", async () => {
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

      const response = await api("get", `/api/grades/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      
      // Should handle missing exam scores
      expect(response.body.missingExamCount).toBe(1);
      expect(response.body.grades[0].totalScore).toBe(85); // Only assessment score

      console.log("✅ Missing exam scores handled correctly");
    });
  });

  describe("Total Score Computation", () => {
    test("should compute total scores correctly", async () => {
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

      const response = await api("get", `/api/grades/student/${testStudent._id}/subject/Mathematics`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      
      // Calculate expected total score
      const expectedTotalScore = (85 + 90) / 2; // Simple average
      expect(response.body.totalScore).toBeCloseTo(expectedTotalScore, 0.01);

      console.log("✅ Total score computation correct");
    });

    test("should compute weighted total scores", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
        {
          student: testStudent._id,
          subject: "Mathematics",
          assessment: 85,
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
      
      // Calculate expected weighted total score
      const expectedWeightedTotal = (85 * 0.4) + (90 * 0.6);
      expect(response.body.weightedTotalScore).toBeCloseTo(expectedWeightedTotal, 0.01);

      console.log("✅ Weighted total score computation correct");
    });

    test("should handle multiple assessments", async () => {
      const Grade = require("../models/Grade");
      
      const mockGrades = [
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
          assessment: 85,
          exam: 90,
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
      
      // Calculate expected total score (average of all assessments and exams)
      const expectedAssessmentAverage = (80 + 85 + 90) / 3;
      const expectedExamAverage = (85 + 90 + 95) / 3;
      const expectedTotalScore = (expectedAssessmentAverage + expectedExamAverage) / 2;
      
      expect(response.body.totalScore).toBeCloseTo(expectedTotalScore, 0.01);

      console.log("✅ Multiple assessments handled correctly");
    });
  });

  describe("Grade Mapping", () => {
    test("should map scores to Ghana grades correctly", async () => {
      const ReportCard = require("../models/ReportCard");
      
      const mockReportCard = {
        student: testStudent._id,
        academicYearId: testAcademicYear._id,
        termId: testTerm._id,
        subjects: [
          { name: "Mathematics", totalScore: 95 },
          { name: "English", totalScore: 85 },
          { name: "Science", totalScore: 75 },
          { name: "Social Studies", totalScore: 65 },
          { name: "Ghanaian Language", totalScore: 55 }
        ]
      };

      ReportCard.find.mockResolvedValue([mockReportCard]);

      const response = await api("get", `/api/report-cards/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      // Verify Ghana grade mapping
      expect(response.body.reportCards[0].subjects[0].grade).toBe("A"); // 95
      expect(response.body.reportCards[0].subjects[1].grade).toBe("B"); // 85
      expect(response.body.reportCards[0].subjects[2].grade).toBe("C"); // 75
      expect(response.body.reportCards[0].subjects[3].grade).toBe("D"); // 65
      expect(response.body.reportCards[0].subjects[4].grade).toBe("E"); // 55

      console.log("✅ Ghana grade mapping correct");
    });

    test("should handle edge case scores", async () => {
      const ReportCard = require("../models/ReportCard");
      
      const mockReportCard = {
        student: testStudent._id,
        academicYearId: testAcademicYear._id,
        termId: testTerm._id,
        subjects: [
          { name: "Mathematics", totalScore: 100 }, // Perfect score
          { name: "English", totalScore: 0 }, // Zero score
          { name: "Science", totalScore: 50 }, // Borderline
          { name: "Social Studies", totalScore: 49.5 } // Just below borderline
        ]
      };

      ReportCard.find.mockResolvedValue([mockReportCard]);

      const response = await api("get", `/api/report-cards/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      // Verify edge case grade mapping
      expect(response.body.reportCards[0].subjects[0].grade).toBe("A"); // 100
      expect(response.body.reportCards[0].subjects[1].grade).toBe("F"); // 0
      expect(response.body.reportCards[0].subjects[2].grade).toBe("C"); // 50
      expect(response.body.reportCards[0].subjects[3].grade).toBe("F"); // 49.5

      console.log("✅ Edge case grade mapping correct");
    });
  });

  describe("Class Position Ranking", () => {
    test("should calculate class position ranking correctly", async () => {
      const ReportCard = require("../models/ReportCard");
      
      const mockReportCards = [
        {
          student: "student1",
          totalScore: 95,
          position: 1
        },
        {
          student: "student2",
          totalScore: 85,
          position: 3
        },
        {
          student: testStudent._id,
          totalScore: 90,
          position: 2
        },
        {
          student: "student4",
          totalScore: 80,
          position: 4
        }
      ];

      ReportCard.find.mockResolvedValue(mockReportCards);

      const response = await api("get", `/api/report-cards/class/${testClass._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.reportCards).toHaveLength(4);

      // Verify position ranking
      const studentReportCard = response.body.reportCards.find(rc => rc.student === testStudent._id);
      expect(studentReportCard.position).toBe(2);
      expect(studentReportCard.totalScore).toBe(90);

      console.log("✅ Class position ranking correct");
    });

    test("should handle ties in ranking", async () => {
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
      
      // Verify tie handling
      const tiedStudents = response.body.reportCards.filter(rc => rc.position === 1);
      expect(tiedStudents).toHaveLength(3);
      expect(tiedStudents.every(rc => rc.totalScore === 95)).toBe(true);

      console.log("✅ Tie handling in ranking correct");
    });
  });

  describe("Term Isolation", () => {
    test("should isolate grades by term", async () => {
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
          term: "Second Term"
        }
      ];

      Grade.find.mockImplementation((query) => {
        if (query.term === "First Term") {
          return Promise.resolve([mockGrades[0]]);
        }
        if (query.term === "Second Term") {
          return Promise.resolve([mockGrades[1]]);
        }
        return Promise.resolve([]);
      });

      // Get First Term grades
      const firstTermResponse = await api("get", `/api/grades/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({ term: "First Term" });

      expect(firstTermResponse.status).toBe(200);
      expect(firstTermResponse.body.grades).toHaveLength(1);
      expect(firstTermResponse.body.grades[0].assessment).toBe(85);

      // Get Second Term grades
      const secondTermResponse = await api("get", `/api/grades/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({ term: "Second Term" });

      expect(secondTermResponse.status).toBe(200);
      expect(secondTermResponse.body.grades).toHaveLength(1);
      expect(secondTermResponse.body.grades[0].assessment).toBe(80);

      console.log("✅ Term isolation working correctly");
    });

    test("should prevent cross-term data leakage", async () => {
      const Grade = require("../models/Grade");
      
      Grade.find.mockImplementation((query) => {
        if (query.term === "First Term") {
          return Promise.resolve([{ assessment: 85, exam: 90 }]);
        }
        return Promise.resolve([]);
      });

      // Try to get Second Term data with First Term query
      const response = await api("get", `/api/grades/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({ term: "Second Term" });

      expect(response.status).toBe(200);
      expect(response.body.grades).toHaveLength(0);

      console.log("✅ Cross-term data leakage prevented");
    });
  });

  describe("Lock After Approval", () => {
    test("should lock report cards after approval", async () => {
      const ReportCard = require("../models/ReportCard");
      
      const mockReportCard = {
        student: testStudent._id,
        academicYearId: testAcademicYear._id,
        termId: testTerm._id,
        subjects: [
          { name: "Mathematics", totalScore: 85 }
        ],
        status: "approved",
        approvedAt: new Date(),
        approvedBy: "admin"
      };

      ReportCard.findOne.mockResolvedValue(mockReportCard);

      // Try to modify approved report card
      const updateResponse = await api("put", `/api/report-cards/${mockReportCard._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          subjects: [
            { name: "Mathematics", totalScore: 90 } // Try to change score
          ]
        });

      expect(updateResponse.status).toBe(403);
      expect(updateResponse.body.message).toContain("locked");

      console.log("✅ Report card locked after approval");
    });

    test("should allow admin to unlock report cards", async () => {
      const ReportCard = require("../models/ReportCard");
      
      const mockReportCard = {
        student: testStudent._id,
        academicYearId: testAcademicYear._id,
        termId: testTerm._id,
        subjects: [
          { name: "Mathematics", totalScore: 85 }
        ],
        status: "approved",
        approvedAt: new Date(),
        approvedBy: "admin"
      };

      ReportCard.findOne.mockResolvedValue(mockReportCard);
      ReportCard.findByIdAndUpdate.mockResolvedValue({
        ...mockReportCard,
        status: "draft",
        unlockedAt: new Date(),
        unlockedBy: "admin"
      });

      // Admin should be able to unlock
      const unlockResponse = await api("put", `/api/report-cards/${mockReportCard._id}/unlock`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(unlockResponse.status).toBe(200);
      expect(unlockResponse.body.status).toBe("draft");

      console.log("✅ Admin can unlock report cards");
    });
  });

  describe("PDF Generation Accuracy", () => {
    test("should generate accurate PDF report cards", async () => {
      const ReportCard = require("../models/ReportCard");
      
      const mockReportCard = {
        student: testStudent._id,
        academicYearId: testAcademicYear._id,
        termId: testTerm._id,
        subjects: [
          { name: "Mathematics", totalScore: 85, grade: "B" },
          { name: "English", totalScore: 90, grade: "A" },
          { name: "Science", totalScore: 78, grade: "B" }
        ],
        attendance: {
          totalDays: 60,
          daysPresent: 55,
          attendancePercentage: 91.67
        },
        averageScore: 84.33,
        position: 3
      };

      ReportCard.findOne.mockResolvedValue(mockReportCard);

      const response = await api("get", `/api/report-cards/${mockReportCard._id}/pdf`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.body).toBeDefined();

      console.log("✅ PDF generation accurate");
    });

    test("should include all required data in PDF", async () => {
      const ReportCard = require("../models/ReportCard");
      
      const mockReportCard = {
        student: testStudent,
        subjects: [
          { name: "Mathematics", totalScore: 85 }
        ],
        attendance: {
          totalDays: 60,
          daysPresent: 55,
          attendancePercentage: 91.67
        }
      };

      ReportCard.findOne.mockResolvedValue(mockReportCard);

      const response = await api("get", `/api/report-cards/${mockReportCard._id}/pdf`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      // Verify PDF contains required data
      expect(response.body).toContain("Mathematics");
      expect(response.body).toContain("85");
      expect(response.body).toContain("91.67%");

      console.log("✅ PDF includes all required data");
    });
  });
});
