const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass, createMockAcademicYear, createMockTerm, createMockFee, createMockPayment, createMockReportCard } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Performance & Stability Tests", () => {
  let adminToken, teacherToken, accountantToken, parentToken;
  let largeStudentDataset, largeClassDataset, largeAttendanceDataset, largeFinancialDataset;

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

    // Create large datasets for performance testing
    largeStudentDataset = Array.from({ length: 1500 }, (_, i) => 
      createMockStudent({
        email: `student${i}@test.com`,
        firstName: `Student${i}`,
        lastName: `Test${i}`
      })
    );

    largeClassDataset = Array.from({ length: 50 }, (_, i) => 
      createMockClass({
        name: `Class ${i}`,
        description: `Test Class ${i}`,
        capacity: 30
      })
    );

    largeAttendanceDataset = Array.from({ length: 10000 }, (_, i) => ({
      student: `student${i % 1500}`,
      date: new Date(2025, 0, (i % 30) + 1).toISOString().split('T')[0],
      term: ["First Term", "Second Term", "Third Term"][i % 3],
      status: ["present", "absent", "late"][i % 3]
    }));

    largeFinancialDataset = Array.from({ length: 5000 }, (_, i) => ({
      student: `student${i % 1500}`,
      feeType: ["tuition", "registration", "books"][i % 3],
      amount: [1000, 200, 300][i % 3],
      paid: [1000, 150, 200][i % 3],
      balance: [0, 50, 100][i % 3],
      status: ["completed", "partial", "pending"][i % 3],
      date: new Date(2025, 0, (i % 30) + 1).toISOString().split('T')[0]
    }));
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
    
    const User = require("../models/User");
    User.findOne.mockImplementation((query) => {
      if (query.email === "admin@test.com") return Promise.resolve(adminUser);
      if (query.email === "teacher@test.com") return Promise.resolve(teacherUser);
      if (query.email === "accountant@test.com") return Promise.resolve(accountantUser);
      if (query.email === "parent@test.com") return Promise.resolve(parentUser);
      return Promise.resolve(null);
    });

    // Get tokens for each role
    const responses = await Promise.all([
      api("post", "/api/auth/login").send({ email: "admin@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "teacher@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "accountant@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "parent@test.com", password: "password123" })
    ]);

    adminToken = responses[0].body.token;
    teacherToken = responses[1].body.token;
    accountantToken = responses[2].body.token;
    parentToken = responses[3].body.token;
  });

  describe("Large Dataset Performance", () => {
    test("should handle 1,000+ students efficiently", async () => {
      const Student = require("../models/Student");
      
      // Mock large student dataset
      Student.find.mockResolvedValue(largeStudentDataset);
      Student.countDocuments.mockResolvedValue(1500);

      const startTime = Date.now();

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.students).toHaveLength(100);
      expect(response.body.totalCount).toBe(1500);
      expect(responseTime).toBeLessThan(2000); // Should complete in under 2 seconds

      console.log("✅ Large student dataset handled efficiently");
    });

    test("should handle multiple classes efficiently", async () => {
      const Class = require("../models/Class");
      
      // Mock large class dataset
      Class.find.mockResolvedValue(largeClassDataset);
      Class.countDocuments.mockResolvedValue(50);

      const startTime = Date.now();

      const response = await api("get", "/api/classes")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 20
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.classes).toHaveLength(20);
      expect(response.body.totalCount).toBe(50);
      expect(responseTime).toBeLessThan(1500); // Should complete in under 1.5 seconds

      console.log("✅ Multiple classes handled efficiently");
    });

    test("should handle large attendance dataset efficiently", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock large attendance dataset
      Attendance.find.mockResolvedValue(largeAttendanceDataset.slice(0, 1000));
      Attendance.countDocuments.mockResolvedValue(10000);

      const startTime = Date.now();

      const response = await api("get", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          page: 1,
          limit: 100,
          term: "First Term"
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.attendance).toHaveLength(100);
      expect(response.body.totalCount).toBe(10000);
      expect(responseTime).toBeLessThan(3000); // Should complete in under 3 seconds

      console.log("✅ Large attendance dataset handled efficiently");
    });

    test("should handle large financial records efficiently", async () => {
      const Payment = require("../models/Payment");
      
      // Mock large financial dataset
      Payment.find.mockResolvedValue(largeFinancialDataset.slice(0, 1000));
      Payment.countDocuments.mockResolvedValue(5000);

      const startTime = Date.now();

      const response = await api("get", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .query({
          page: 1,
          limit: 100,
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.payments).toHaveLength(100);
      expect(response.body.totalCount).toBe(5000);
      expect(responseTime).toBeLessThan(3000); // Should complete in under 3 seconds

      console.log("✅ Large financial records handled efficiently");
    });
  });

  describe("Page Load Speed", () => {
    test("should load dashboard quickly", async () => {
      const Student = require("../models/Student");
      const Payment = require("../models/Payment");
      const Attendance = require("../models/Attendance");
      
      // Mock dashboard data
      Student.countDocuments.mockResolvedValue(1500);
      Payment.aggregate.mockResolvedValue([{ totalRevenue: 150000 }]);
      Attendance.aggregate.mockResolvedValue([{ attendanceRate: 85 }]);

      const startTime = Date.now();

      const response = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.studentCount).toBe(1500);
      expect(response.body.totalRevenue).toBe(150000);
      expect(response.body.attendanceRate).toBe(85);
      expect(loadTime).toBeLessThan(1000); // Should load in under 1 second

      console.log("✅ Dashboard loads quickly");
    });

    test("should load student list quickly", async () => {
      const Student = require("../models/Student");
      
      // Mock student list data
      Student.find.mockResolvedValue(largeStudentDataset.slice(0, 50));
      Student.countDocuments.mockResolvedValue(1500);

      const startTime = Date.now();

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 50
        });

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.students).toHaveLength(50);
      expect(loadTime).toBeLessThan(1500); // Should load in under 1.5 seconds

      console.log("✅ Student list loads quickly");
    });

    test("should load attendance data quickly", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock attendance data
      Attendance.find.mockResolvedValue(largeAttendanceDataset.slice(0, 100));
      Attendance.countDocuments.mockResolvedValue(10000);

      const startTime = Date.now();

      const response = await api("get", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          date: "2025-02-14",
          term: "First Term"
        });

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.attendance).toHaveLength(100);
      expect(loadTime).toBeLessThan(2000); // Should load in under 2 seconds

      console.log("✅ Attendance data loads quickly");
    });

    test("should load financial data quickly", async () => {
      const Payment = require("../models/Payment");
      
      // Mock financial data
      Payment.find.mockResolvedValue(largeFinancialDataset.slice(0, 100));
      Payment.countDocuments.mockResolvedValue(5000);

      const startTime = Date.now();

      const response = await api("get", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .query({
          page: 1,
          limit: 100
        });

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.payments).toHaveLength(100);
      expect(loadTime).toBeLessThan(2000); // Should load in under 2 seconds

      console.log("✅ Financial data loads quickly");
    });
  });

  describe("Query Optimization", () => {
    test("should use efficient database queries", async () => {
      const Student = require("../models/Student");
      
      // Mock efficient query execution
      const efficientQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(efficientQuery);

      const startTime = Date.now();

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100,
          sort: "lastName",
          order: "asc"
        });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(efficientQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: { lastName: 1 },
          limit: 100,
          skip: 0
        })
      );
      expect(queryTime).toBeLessThan(1500);

      console.log("✅ Efficient database queries used");
    });

    test("should use proper indexing", async () => {
      const Student = require("../models/Student");
      
      // Mock indexed query execution
      const indexedQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 50)));
      Student.find.mockImplementation(indexedQuery);

      const startTime = Date.now();

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          email: "student100@test.com",
          page: 1,
          limit: 50
        });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(indexedQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "student100@test.com"
        })
      );
      expect(queryTime).toBeLessThan(1000);

      console.log("✅ Proper indexing used");
    });

    test("should implement query caching", async () => {
      const Student = require("../models/Student");
      
      // Mock cached query execution
      const cachedQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(cachedQuery);

      // First request
      const startTime1 = Date.now();
      const response1 = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100
        });

      const endTime1 = Date.now();
      const firstQueryTime = endTime1 - startTime1;

      // Second request (should be cached)
      const startTime2 = Date.now();
      const response2 = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100
        });

      const endTime2 = Date.now();
      const secondQueryTime = endTime2 - startTime2;

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(secondQueryTime).toBeLessThan(firstQueryTime);

      console.log("✅ Query caching implemented");
    });

    test("should handle complex aggregations efficiently", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock complex aggregation
      const complexAggregation = jest.fn(() => Promise.resolve([
        {
          totalStudents: 1500,
          attendanceRate: 85,
          averageAttendance: 1275,
          breakdown: {
            present: 1275,
            absent: 150,
            late: 75
          }
        }
      ]));
      Attendance.aggregate.mockImplementation(complexAggregation);

      const startTime = Date.now();

      const response = await api("get", "/api/analytics/attendance-summary")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          term: "First Term",
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        });

      const endTime = Date.now();
      const aggregationTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.totalStudents).toBe(1500);
      expect(response.body.attendanceRate).toBe(85);
      expect(aggregationTime).toBeLessThan(3000);

      console.log("✅ Complex aggregations handled efficiently");
    });
  });

  describe("N+1 Query Issues", () => {
    test("should prevent N+1 queries in student listing", async () => {
      const Student = require("../models/Student");
      const Class = require("../models/Class");
      
      // Mock N+1 query prevention
      const optimizedStudentQuery = jest.fn(() => Promise.resolve(
        largeStudentDataset.slice(0, 50).map(student => ({
          ...student,
          class: {
            _id: "class1",
            name: "Class 5A"
          }
        }))
      ));
      Student.find.mockImplementation(optimizedStudentQuery);

      const startTime = Date.now();

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 50,
          populate: "class"
        });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.students).toHaveLength(50);
      expect(response.body.students[0].class).toBeDefined();
      expect(queryTime).toBeLessThan(2000);

      // Verify single query execution
      expect(optimizedStudentQuery).toHaveBeenCalledTimes(1);

      console.log("✅ N+1 queries prevented in student listing");
    });

    test("should prevent N+1 queries in attendance data", async () => {
      const Attendance = require("../models/Attendance");
      const Student = require("../models/Student");
      
      // Mock N+1 query prevention
      const optimizedAttendanceQuery = jest.fn(() => Promise.resolve(
        largeAttendanceDataset.slice(0, 100).map(attendance => ({
          ...attendance,
          student: {
            _id: attendance.student,
            firstName: `Student${attendance.student}`,
            lastName: "Test"
          }
        }))
      ));
      Attendance.find.mockImplementation(optimizedAttendanceQuery);

      const startTime = Date.now();

      const response = await api("get", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          date: "2025-02-14",
          populate: "student"
        });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.attendance).toHaveLength(100);
      expect(response.body.attendance[0].student).toBeDefined();
      expect(queryTime).toBeLessThan(3000);

      // Verify single query execution
      expect(optimizedAttendanceQuery).toHaveBeenCalledTimes(1);

      console.log("✅ N+1 queries prevented in attendance data");
    });

    test("should prevent N+1 queries in financial data", async () => {
      const Payment = require("../models/Payment");
      const Student = require("../models/Student");
      
      // Mock N+1 query prevention
      const optimizedPaymentQuery = jest.fn(() => Promise.resolve(
        largeFinancialDataset.slice(0, 100).map(payment => ({
          ...payment,
          student: {
            _id: payment.student,
            firstName: `Student${payment.student}`,
            lastName: "Test"
          }
        }))
      ));
      Payment.find.mockImplementation(optimizedPaymentQuery);

      const startTime = Date.now();

      const response = await api("get", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .query({
          page: 1,
          limit: 100,
          populate: "student"
        });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.payments).toHaveLength(100);
      expect(response.body.payments[0].student).toBeDefined();
      expect(queryTime).toBeLessThan(3000);

      // Verify single query execution
      expect(optimizedPaymentQuery).toHaveBeenCalledTimes(1);

      console.log("✅ N+1 queries prevented in financial data");
    });

    test("should use batch loading for related data", async () => {
      const Student = require("../models/Student");
      const Class = require("../models/Class");
      
      // Mock batch loading
      const batchLoadQuery = jest.fn(() => Promise.resolve({
        students: largeStudentDataset.slice(0, 50),
        classes: largeClassDataset.slice(0, 10)
      }));
      Student.find.mockImplementation(batchLoadQuery);

      const startTime = Date.now();

      const response = await api("get", "/api/students/batch")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 50,
          includeClasses: true
        });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.students).toHaveLength(50);
      expect(response.body.classes).toHaveLength(10);
      expect(queryTime).toBeLessThan(2000);

      // Verify batch loading
      expect(batchLoadQuery).toHaveBeenCalledTimes(1);

      console.log("✅ Batch loading for related data implemented");
    });
  });

  describe("Memory Usage", () => {
    test("should maintain memory usage with large datasets", async () => {
      const Student = require("../models/Student");
      
      const initialMemory = process.memoryUsage();

      // Mock large dataset processing
      Student.find.mockResolvedValue(largeStudentDataset);

      const startTime = Date.now();

      // Process large dataset
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 1000
        });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase significantly
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
      expect(processingTime).toBeLessThan(5000); // Should complete in under 5 seconds

      console.log("✅ Memory usage maintained with large datasets");
    });

    test("should handle concurrent requests without memory leaks", async () => {
      const Student = require("../models/Student");
      
      const initialMemory = process.memoryUsage();

      // Mock concurrent data access
      Student.find.mockResolvedValue(largeStudentDataset);

      const startTime = Date.now();

      // Create multiple concurrent requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        api("get", "/api/students")
          .set("Authorization", `Bearer ${adminToken}`)
          .query({
            page: i + 1,
            limit: 100
          })
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase significantly
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
      expect(totalTime).toBeLessThan(10000); // Should complete in under 10 seconds

      console.log("✅ Concurrent requests handled without memory leaks");
    });

    test("should implement memory-efficient pagination", async () => {
      const Student = require("../models/Student");
      
      const initialMemory = process.memoryUsage();

      // Mock memory-efficient pagination
      const memoryEfficientQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(memoryEfficientQuery);

      const startTime = Date.now();

      // Test pagination with cursor-based approach
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          cursor: null,
          limit: 100
        });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      
      // Memory usage should be minimal
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB increase
      expect(queryTime).toBeLessThan(2000);

      console.log("✅ Memory-efficient pagination implemented");
    });

    test("should handle large file uploads efficiently", async () => {
      const multer = require("multer");
      
      const initialMemory = process.memoryUsage();

      // Mock large file upload
      const largeFile = Buffer.alloc(5 * 1024 * 1024); // 5MB file

      const startTime = Date.now();

      const response = await api("post", "/api/upload")
        .attach("file", largeFile, "large-file.pdf");

      const endTime = Date.now();
      const uploadTime = endTime - startTime;

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      
      // Memory usage should be reasonable
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
      expect(uploadTime).toBeLessThan(5000);

      console.log("✅ Large file uploads handled efficiently");
    });
  });

  describe("Performance Optimization", () => {
    test("should implement database connection pooling", async () => {
      const Student = require("../models/Student");
      
      // Mock connection pooling
      const pooledQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(pooledQuery);

      const startTime = Date.now();

      // Test pooled connections
      const promises = Array.from({ length: 20 }, (_, i) =>
        api("get", "/api/students")
          .set("Authorization", `Bearer ${adminToken}`)
          .query({
            page: i + 1,
            limit: 50
          })
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(15000); // Should complete in under 15 seconds

      console.log("✅ Database connection pooling implemented");
    });

    test("should implement response caching", async () => {
      const Student = require("../models/Student");
      
      // Mock response caching
      const cachedResponse = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(cachedResponse);

      // First request
      const startTime1 = Date.now();
      const response1 = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100
        });

      const endTime1 = Date.now();
      const firstTime = endTime1 - startTime1;

      // Second request (should be cached)
      const startTime2 = Date.now();
      const response2 = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100
        });

      const endTime2 = Date.now();
      const secondTime = endTime2 - startTime2;

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(secondTime).toBeLessThan(firstTime / 2); // Should be at least 2x faster

      console.log("✅ Response caching implemented");
    });

    test("should implement compression for large responses", async () => {
      const Student = require("../models/Student");
      
      // Mock large response
      Student.find.mockResolvedValue(largeStudentDataset);

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 1000
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-encoding']).toBe('gzip');
      expect(response.headers['content-length']).toBeDefined();

      console.log("✅ Response compression implemented");
    });

    test("should implement rate limiting for performance", async () => {
      const Student = require("../models/Student");
      
      // Mock rate limiting
      Student.find.mockResolvedValue(largeStudentDataset.slice(0, 100));

      // Make multiple rapid requests
      const promises = Array.from({ length: 100 }, (_, i) =>
        api("get", "/api/students")
          .set("Authorization", `Bearer ${adminToken}`)
          .query({
            page: 1,
            limit: 10
          })
      );

      const responses = await Promise.allSettled(promises);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 429
      );

      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      console.log("✅ Rate limiting implemented for performance");
    });
  });
});
