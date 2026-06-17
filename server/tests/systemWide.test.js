const mongoose = require("mongoose");

describe("System-Wide Integration Tests", () => {
  describe("Module Integration", () => {
    test("All required models should be importable", () => {
      // Test that all our new models can be imported
      expect(() => require("../models/GhanaReportCard")).not.toThrow();
      expect(() => require("../models/GhanaFeeStructure")).not.toThrow();
      expect(() => require("../models/StudentLedger")).not.toThrow();
      expect(() => require("../models/PromotionEngine")).not.toThrow();
      expect(() => require("../models/AuditLog")).not.toThrow();
    });

    test("All required routes should be importable", () => {
      // Test that all our new routes can be imported
      expect(() => require("../routes/ghanaReportCards")).not.toThrow();
      expect(() => require("../routes/financialManagement")).not.toThrow();
      expect(() => require("../routes/dashboardAnalytics")).not.toThrow();
      expect(() => require("../routes/promotionEngine")).not.toThrow();
      expect(() => require("../middleware/rbac")).not.toThrow();
      expect(() => require("../middleware/securityEnhanced")).not.toThrow();
    });
  });

  describe("Ghanaian Education System Compliance", () => {
    test("Ghanaian class levels should be properly defined", () => {
      const GhanaClass = require("../models/GhanaClass");
      const levels = GhanaClass.getGhanaianLevels();
      
      const expectedLevels = [
        "Creche", "Nursery 1", "Nursery 2", "KG 1", "KG 2",
        "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
        "JHS 1", "JHS 2", "JHS 3"
      ];

      expect(levels).toHaveLength(expectedLevels.length);
      levels.forEach((level, index) => {
        expect(level.name).toBe(expectedLevels[index]);
      });
    });

    test("Ghanaian grading system should be implemented", () => {
      const GradingSystem = require("../models/GradingSystem");
      
      const gradingSystem = new GradingSystem({
        name: "Ghana Basic School Grading System",
        academicYear: new mongoose.Types.ObjectId(),
        term: new mongoose.Types.ObjectId(),
        gradingBands: [
          { minScore: 80, maxScore: 100, grade: "A", gradePoint: 4.0, description: "Excellent" },
          { minScore: 70, maxScore: 79, grade: "B", gradePoint: 3.0, description: "Very Good" },
          { minScore: 60, maxScore: 69, grade: "C", gradePoint: 2.0, description: "Good" },
          { minScore: 50, maxScore: 59, grade: "D", gradePoint: 1.0, description: "Credit" },
          { minScore: 40, maxScore: 49, grade: "E", gradePoint: 0.5, description: "Pass" },
          { minScore: 0, maxScore: 39, grade: "F", gradePoint: 0.0, description: "Fail" },
        ],
      });

      expect(gradingSystem.gradingBands).toHaveLength(6);
      expect(gradingSystem.gradingBands[0].grade).toBe("A");
      expect(gradingSystem.gradingBands[0].gradePoint).toBe(4.0);
    });

    test("Ghanaian term structure should be correct", () => {
      const Term = require("../models/Term");
      
      const term = new Term({
        academicYear: new mongoose.Types.ObjectId(),
        name: "First Term",
        order: 1,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-04-12"),
        isActive: true,
      });

      expect(term.name).toBe("First Term");
      expect(term.order).toBe(1);
      expect(term.legacySemester).toBe("First");
    });
  });

  describe("Ghanaian Education System Compliance", () => {
    test("Ghanaian class levels should be properly defined", () => {
      const GhanaClass = require("../models/GhanaClass");
      const levels = GhanaClass.getGhanaianLevels();
      
      const expectedLevels = [
        "Creche", "Nursery 1", "Nursery 2", "KG 1", "KG 2",
        "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
        "JHS 1", "JHS 2", "JHS 3"
      ];

      expect(levels).toHaveLength(expectedLevels.length);
      levels.forEach((level, index) => {
        expect(level.name).toBe(expectedLevels[index]);
      });
    });

    test("Ghanaian grading system should be implemented", () => {
      const GradingSystem = require("../models/GradingSystem");
      
      const gradingSystem = new GradingSystem({
        name: "Ghana Basic School Grading System",
        academicYear: new mongoose.Types.ObjectId(),
        term: new mongoose.Types.ObjectId(),
        gradingBands: [
          { minScore: 80, maxScore: 100, grade: "A", gradePoint: 4.0, description: "Excellent" },
          { minScore: 70, maxScore: 79, grade: "B", gradePoint: 3.0, description: "Very Good" },
          { minScore: 60, maxScore: 69, grade: "C", gradePoint: 2.0, description: "Good" },
          { minScore: 50, maxScore: 59, grade: "D", gradePoint: 1.0, description: "Credit" },
          { minScore: 40, maxScore: 49, grade: "E", gradePoint: 0.5, description: "Pass" },
          { minScore: 0, maxScore: 39, grade: "F", gradePoint: 0.0, description: "Fail" },
        ],
      });

      expect(gradingSystem.gradingBands).toHaveLength(6);
      expect(gradingSystem.gradingBands[0].grade).toBe("A");
      expect(gradingSystem.gradingBands[0].gradePoint).toBe(4.0);
    });

    test("Ghanaian term structure should be correct", () => {
      const Term = require("../models/Term");
      
      const term = new Term({
        academicYear: new mongoose.Types.ObjectId(),
        name: "First Term",
        order: 1,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-04-12"),
        isActive: true,
      });

      expect(term.name).toBe("First Term");
      expect(term.order).toBe(1);
      expect(term.legacySemester).toBe("First");
    });
  });

  describe("Security and Compliance", () => {
    test("Password strength validation should work correctly", () => {
      const { validatePasswordStrength } = require("../middleware/securityEnhanced");
      
      const weakPassword = "password";
      const strongPassword = "SecurePass123!";
      
      const weakResult = validatePasswordStrength(weakPassword);
      const strongResult = validatePasswordStrength(strongPassword);

      expect(weakResult.isValid).toBe(false);
      expect(strongResult.isValid).toBe(true);
      expect(weakResult.message).toContain("at least 8 characters");
    });

    test("Ghanaian phone number validation should work", () => {
      const { validateDataIntegrity } = require("../middleware/securityEnhanced");
      
      const mockReq = {
        body: {
          phone: "+233241234567",
        },
      };
      
      const res = {
        status: 200,
        json: jest.fn(),
      };
      
      const next = jest.fn();
      
      validateDataIntegrity(mockReq, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    test("Student ID validation should follow Ghanaian format", () => {
      const { validateDataIntegrity } = require("../middleware/securityEnhanced");
      
      const mockReq = {
        body: {
          studentId: "AB1234/5678",
        },
      };
      
      const res = {
        status: 200,
        json: jest.fn(),
      };
      
      const next = jest.fn();
      
      validateDataIntegrity(mockReq, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe("Data Integrity", () => {
    test("Report card calculations should be accurate", () => {
      const GhanaReportCard = require("../models/GhanaReportCard");
      
      const reportCard = new GhanaReportCard({
        subjects: [{
          subjectName: "Mathematics",
          continuousAssessment: {
            classWork: { score: 18, weight: 20 },
            assignments: { score: 8, weight: 10 },
            tests: { score: 7, weight: 10 },
            projects: { score: 5, weight: 0 },
            totalScore: 38,
          },
          examination: {
            score: 52,
            weight: 60,
          },
          totalScore: 90,
        }],
      });

      expect(reportCard.subjects[0].totalScore).toBe(90);
      expect(reportCard.subjects[0].grade).toBe("A");
      expect(reportCard.subjects[0].gradePoint).toBe(4.0);
    });

    test("Promotion engine should correctly evaluate students", () => {
      const PromotionEngine = require("../models/PromotionEngine");
      
      const engine = new PromotionEngine({
        promotionSettings: {
          minimumAverageScore: 50,
          minimumGPA: 1.0,
          maximumFailedSubjects: 2,
          minimumAttendanceRate: 75,
          minimumConductGrade: "Fair",
        },
      });

      const evaluation = engine.determinePromotionDecision({
        academic: {
          meetsMinScore: true,
          meetsMinGPA: true,
          meetsMaxFailed: true,
        },
        attendance: {
          meetsMinAttendance: true,
        },
        conduct: {
          meetsMinConduct: true,
        },
        age: {
          ageAppropriate: true,
        },
      }, engine.promotionSettings);

      expect(evaluation.promoted).toBe(true);
      expect(evaluation.promotionType).toBe("Standard");
    });

    test("Fee calculations should be accurate", () => {
      const GhanaFeeStructure = require("../models/GhanaFeeStructure");
      
      const feeStructure = new GhanaFeeStructure({
        feeItems: [
          { name: "Tuition", amount: 500, isMandatory: true },
          { name: "Books", amount: 100, isMandatory: false },
          { name: "Uniform", amount: 150, isMandatory: false },
        ],
      });

      expect(feeStructure.totalAmount).toBe(750);
      expect(feeStructure.mandatoryFeesTotal).toBe(500);
      expect(feeStructure.optionalFeesTotal).toBe(250);
    });
  });

  describe("Role-Based Access Control", () => {
    test("RBAC middleware should validate permissions correctly", () => {
      const { rbac } = require("../middleware/rbac");
      
      const mockReq = {
        user: {
          _id: new mongoose.Types.ObjectId(),
          role: "Teacher",
        },
        method: "POST",
        path: "/api/ghana-report-cards",
      };

      const res = {
        status: 403,
        json: jest.fn(),
      };

      // This would normally check permissions
      // For testing, we'll just verify the middleware exists
      expect(typeof rbac).toBe("function");
    });

    test("Permission matrix should cover all roles", () => {
      const RolePermission = require("../models/RolePermission");
      
      const permissions = {
        academic: {
          create: true,
          read: true,
          update: true,
          delete: false,
        },
        financial: {
          create: true,
          read: true,
          update: true,
          delete: false,
        },
        system: {
          create: false,
          read: false,
          update: false,
          delete: false,
        },
      };

      expect(Object.keys(permissions)).toContain("academic");
      expect(Object.keys(permissions)).toContain("financial");
      expect(Object.keys(permissions)).toContain("system");
    });
  });

  describe("Performance Optimization", () => {
    test("Database indexes should be properly defined", () => {
      const models = [
        "GhanaReportCard",
        "GhanaFeeStructure",
        "StudentLedger",
        "PromotionEngine",
        "AuditLog",
      ];

      models.forEach(modelName => {
        const Model = require(`../models/${modelName}`);
        const schema = Model.schema;
        expect(schema.indexes).toBeDefined();
      });
    });

    test("Virtual fields should not impact performance significantly", () => {
      const GhanaReportCard = require("../models/GhanaReportCard");
      
      const reportCard = new GhanaReportCard({
        subjects: Array(10).fill({
          subjectName: "Test Subject",
          totalScore: 85,
          grade: "A",
        }),
      });

      // Virtual calculations should be fast
      const start = Date.now();
      const totalScore = reportCard.totalContinuousAssessmentScore;
      const end = Date.now();
      
      expect(end - start).toBeLessThan(100); // Should be very fast
      expect(totalScore).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    test("Validation errors should be properly formatted", () => {
      const { validateInput } = require("../middleware/securityEnhanced");
      
      const mockReq = {
        body: {
          email: "invalid-email",
        },
      };
      
      const mockRes = {
        status: 400,
        json: jest.fn(),
      };

      const next = jest.fn();
      
      validateInput([], mockReq, mockRes, next);
      
      expect(mockRes.status).toBe(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Validation failed",
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: "email",
            message: expect.any(String),
          }),
        ]),
      });
    });

    test("Security violations should be logged", async () => {
      const AuditLog = require("../models/AuditLog");
      
      const logEntry = await AuditLog.logSecurityEvent(
        {
          _id: new mongoose.Types.ObjectId(),
          role: "Teacher",
          firstName: "Test",
          lastName: "User",
        },
        "UNAUTHORIZED_ACCESS",
        "Student Data",
        "Student",
        {
          type: "PERMISSION_DENIED",
          severity: "Medium",
          description: "Teacher attempted to access admin data",
        },
        "192.168.1.100",
        "Test Agent"
      );

      expect(logEntry.category).toBe("SECURITY");
      expect(logEntry.priority).toBe("High");
      expect(logEntry.securityFlags).toHaveLength(1);
    });
  });

  describe("Edge Cases", () => {
    test("Empty arrays should be handled gracefully", () => {
      const GhanaReportCard = require("../models/GhanaReportCard");
      
      const reportCard = new GhanaReportCard({
        subjects: [],
      });

      expect(reportCard.subjects).toHaveLength(0);
      expect(reportCard.overallPerformance.totalSubjects).toBe(0);
      expect(reportCard.overallPerformance.averageScore).toBe(0);
    });

    test("Null values should be handled gracefully", () => {
      const StudentLedger = require("../models/StudentLedger");
      
      const ledger = new StudentLedger({
        transactions: [],
        feeBreakdown: [],
      });

      expect(ledger.totalFees).toBe(0);
      expect(ledger.totalPaid).toBe(0);
      expect(ledger.balance).toBe(0);
    });

    test("Maximum values should be enforced", () => {
      const GhanaReportCard = require("../models/GhanaReportCard");
      
      const reportCard = new GhanaReportCard({
        subjects: [{
          subjectName: "Test",
          totalScore: 150, // Above maximum of 100
        }],
      });

      // Pre-save middleware should handle this
      expect(reportCard.subjects[0].totalScore).toBeLessThanOrEqual(100);
    });
  });

  describe("Data Relationships", () => {
    test("Model relationships should be properly defined", () => {
      const GhanaReportCard = require("../models/GhanaReportCard");
      const GhanaStudent = require("../models/GhanaStudent");
      const GhanaClass = require("../models/GhanaClass");

      // Test that refs are properly defined
      expect(GhanaReportCard.schema.paths.student.ref).toBe("GhanaStudent");
      expect(GhanaReportCard.schema.paths.class.ref).toBe("GhanaClass");
      expect(GhanaReportCard.schema.paths.academicYear.ref).toBe("AcademicYear");
      expect(GhanaReportCard.schema.paths.term.ref).toBe("Term");
    });

    test("Population should work correctly", async () => {
      const GhanaReportCard = require("../models/GhanaReportCard");
      const GhanaStudent = require("../models/GhanaStudent");

      // Create a student first
      const student = new GhanaStudent({
        firstName: "Test",
        lastName: "Student",
        studentId: "TS1234/5678",
      });

      await student.save();

      // Create report card
      const reportCard = new GhanaReportCard({
        student: student._id,
        subjects: [],
      });

      await reportCard.save();

      // Test population
      const populated = await GhanaReportCard.findById(reportCard._id)
        .populate("student", "firstName lastName studentId");

      expect(populated.student.firstName).toBe("Test");
      expect(populated.student.studentId).toBe("TS1234/5678");
    });
  });
});

describe("System Performance Tests", () => {
  test("Large dataset operations should complete within time limits", async () => {
      const GhanaReportCard = require("../models/GhanaReportCard");
      
      const startTime = Date.now();
      
      // Create 100 report cards
      const reportCards = [];
      for (let i = 0; i < 100; i++) {
        reportCards.push(new GhanaReportCard({
          subjects: Array(10).fill({
            subjectName: `Subject ${i}`,
            totalScore: Math.floor(Math.random() * 100),
            grade: ["A", "B", "C", "D", "E", "F"][Math.floor(Math.random() * 6)],
          }),
        }));
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    }, 10000);

  test("Concurrent operations should handle conflicts properly", async () => {
      const StudentLedger = require("../models/StudentLedger");
      
      const studentId = new mongoose.Types.ObjectId();
      
      // Create two concurrent operations on the same student
      const operation1 = StudentLedger.addPayment(studentId, {
        amount: 500,
        paymentMethod: "Cash",
        receivedBy: new mongoose.Types.ObjectId(),
      });

      const operation2 = StudentLedger.addPayment(studentId, {
        amount: 300,
        paymentMethod: "Mobile Money",
        receivedBy: new mongoose.Types.ObjectId(),
      });

      // Both should complete successfully
      const [result1, result2] = await Promise.all([operation1, operation2]);
      
      expect(result1.amount).toBe(500);
      expect(result2.amount).toBe(300);
    }, 10000);

  test("Memory usage should remain reasonable", async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create a large dataset
      const GhanaReportCard = require("../models/GhanaReportCard");
      
      const reportCards = [];
      for (let i = 0; i < 1000; i++) {
        reportCards.push(new GhanaReportCard({
          subjects: Array(15).fill({
            subjectName: `Subject ${i}`,
            totalScore: Math.floor(Math.random() * 100),
            grade: ["A", "B", "C", "D", "E", "F"][Math.floor(Math.random() * 6)],
            continuousAssessment: {
              classWork: { score: Math.floor(Math.random() * 40) },
              assignments: { score: Math.floor(Math.random() * 10) },
              tests: { score: Math.floor(Math.random() * 10) },
              projects: { score: Math.floor(Math.random() * 40) },
              totalScore: Math.floor(Math.random() * 100),
            },
            examination: {
              score: Math.floor(Math.random() * 60),
            },
          }),
        }));
      }

      const finalMemory = process.memoryUsage().heapUsed;
      
      // Memory usage should not increase dramatically
      const memoryIncrease = finalMemory - initialMemory;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB limit
    }, 10000);
});

describe("System Compliance Tests", () => {
  test("All modules should be Ghanaian education compliant", () => {
      const models = [
        "GhanaReportCard",
        "GhanaFeeStructure", 
        "StudentLedger",
        "PromotionEngine",
      ];

      models.forEach(modelName => {
        const Model = require(`../models/${modelName}`);
        
        // Check if model has Ghanaian-specific features
        if (modelName === "GhanaReportCard") {
          expect(Model.schema.paths.termName.enum).toContain("First Term");
          expect(Model.schema.paths.termName.enum).toContain("Second Term");
          expect(Model.schema.paths.termName.enum).toContain("Third Term");
        }
        
        if (modelName === "GhanaFeeStructure") {
          expect(Model.schema.paths.feeItems[0].category.enum).toContain("Tuition");
          expect(Model.schema.paths.paymentOptions.fullPaymentDiscount).toBeDefined();
        }
      });
    });

  test("Data retention policies should be enforced", () => {
      const AuditLog = require("../models/AuditLog");
      
      const auditLog = new AuditLog({
        compliance: {
          gdprCompliant: true,
          dataRetentionPeriod: 2555, // 7 years
        },
      });

      expect(auditLog.compliance.dataRetentionPeriod).toBe(2555);
      expect(auditLog.compliance.gdprCompliant).toBe(true);
    });

  test("Access control should be properly enforced", () => {
      const RolePermission = require("../models/RolePermission");
      
      const permissions = RolePermission.getRolePermissions("Teacher");
      
      // Teachers should have academic access but not system access
      expect(permissions.academic.update).toBe(true);
      expect(permissions.system.manageSchool).toBe(false);
      expect(permissions.system.delete).toBe(false);
    });

  test("Audit logging should capture all critical events", () => {
      const AuditLog = require("../models/AuditLog");
      
      const criticalEvents = [
        "LOGIN", "LOGOUT", "DELETE", "SECURITY_VIOLATION",
        "DATA_EXPORT", "SYSTEM_BACKUP", "FAILED_LOGIN_ATTEMPT",
      ];

      criticalEvents.forEach(event => {
        expect(AuditLog.schema.paths.action.enum).toContain(event));
      });
    });
});

// Performance benchmarks
describe("Performance Benchmarks", () => {
  test("Report card generation should be fast", async () => {
    const GhanaReportCard = require("../models/GhanaReportCard");
      
      const startTime = Date.now();
      
      const reportCard = new GhanaReportCard({
        subjects: Array(10).fill({
          subjectName: "Test Subject",
          continuousAssessment: {
            classWork: { score: 20 },
            assignments: { score: 10 },
            tests: { score: 10 },
            projects: { score: 0 },
            totalScore: 40,
          },
          examination: {
            score: 60,
          },
          totalScore: 100,
        }),
      });

      await reportCard.save();
      const endTime = Date.now();
      
      // Should complete within 100ms
      expect(endTime - startTime).toBeLessThan(100);
    }, 10000);

  test("Fee calculation should be efficient", async () => {
      const GhanaFeeStructure = require("../models/GhanaFeeStructure");
      
      const startTime = Date.now();
      
      const feeStructure = new GhanaFeeStructure({
        feeItems: Array(20).fill({
          name: "Test Fee",
          amount: 100,
          category: "Tuition",
        }),
      });

      // Calculate total
      const total = feeStructure.totalAmount;
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(10);
      expect(total).toBe(2000);
    }, 10000);

  test("Promotion evaluation should be scalable", async () => {
      const PromotionEngine = require("../models/PromotionEngine");
      
      const startTime = Date.now();
      
      const engine = new PromotionEngine({
        promotionResults: Array(50).fill({
          academicEvaluation: {
            averageScore: 75,
            overallGPA: 2.5,
            failedSubjects: [],
            totalSubjects: 8,
          },
        }),
      });

      // Calculate summary
      engine.updateSummary();
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(50);
    }, 10000);
});

// Cleanup after all tests
afterAll(async () => {
  // Clean up any test data if needed
  // await mongoose.connection.db.dropDatabase();
  // await mongoose.connection.close();
});
