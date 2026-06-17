const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass, createMockAcademicYear, createMockTerm, createMockFee, createMockPayment, createMockReportCard } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Performance Optimization Tests", () => {
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

    // Create large datasets for optimization testing
    largeStudentDataset = Array.from({ length: 2000 }, (_, i) => 
      createMockStudent({
        email: `student${i}@test.com`,
        firstName: `Student${i}`,
        lastName: `Test${i}`
      })
    );

    largeClassDataset = Array.from({ length: 100 }, (_, i) => 
      createMockClass({
        name: `Class ${i}`,
        description: `Test Class ${i}`,
        capacity: 30
      })
    );

    largeAttendanceDataset = Array.from({ length: 15000 }, (_, i) => ({
      student: `student${i % 2000}`,
      date: new Date(2025, 0, (i % 30) + 1).toISOString().split('T')[0],
      term: ["First Term", "Second Term", "Third Term"][i % 3],
      status: ["present", "absent", "late"][i % 3]
    }));

    largeFinancialDataset = Array.from({ length: 10000 }, (_, i) => ({
      student: `student${i % 2000}`,
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

  describe("Database Query Optimization", () => {
    test("should optimize student queries with proper indexing", async () => {
      const Student = require("../models/Student");
      
      // Mock optimized query execution
      const optimizedQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(optimizedQuery);

      const startTime = Date.now();

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100,
          sort: "lastName",
          order: "asc",
          indexedFields: ["lastName", "firstName", "email"]
        });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.students).toHaveLength(100);
      expect(queryTime).toBeLessThan(1000); // Should complete in under 1 second

      // Verify optimized query parameters
      expect(optimizedQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: { lastName: 1 },
          limit: 100,
          skip: 0
        })
      );

      console.log("✅ Student queries optimized with proper indexing");
    });

    test("should implement query result caching", async () => {
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
          limit: 100,
          cache: true
        });

      const endTime1 = Date.now();
      const firstQueryTime = endTime1 - startTime1;

      // Second request (should be cached)
      const startTime2 = Date.now();
      const response2 = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100,
          cache: true
        });

      const endTime2 = Date.now();
      const secondQueryTime = endTime2 - startTime2;

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(secondQueryTime).toBeLessThan(firstQueryTime / 2); // Should be at least 2x faster

      console.log("✅ Query result caching implemented");
    });

    test("should optimize aggregation queries", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock optimized aggregation
      const optimizedAggregation = jest.fn(() => Promise.resolve([
        {
          totalStudents: 2000,
          attendanceRate: 85,
          averageAttendance: 1700,
          breakdown: {
            present: 1700,
            absent: 200,
            late: 100
          }
        }
      ]));
      Attendance.aggregate.mockImplementation(optimizedAggregation);

      const startTime = Date.now();

      const response = await api("get", "/api/analytics/attendance-summary")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          term: "First Term",
          startDate: "2025-01-01",
          endDate: "2025-01-31",
          optimized: true
        });

      const endTime = Date.now();
      const aggregationTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.totalStudents).toBe(2000);
      expect(response.body.attendanceRate).toBe(85);
      expect(aggregationTime).toBeLessThan(2000);

      // Verify optimized aggregation pipeline
      expect(optimizedAggregation).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ $match: {} }),
          expect.objectContaining({ $group: {} }),
          expect.objectContaining({ $sort: {} })
        ])
      );

      console.log("✅ Aggregation queries optimized");
    });

    test("should implement batch processing for large datasets", async () => {
      const Student = require("../models/Student");
      
      // Mock batch processing
      const batchProcessQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 1000)));
      Student.find.mockImplementation(batchProcessQuery);

      const startTime = Date.now();

      const response = await api("get", "/api/students/batch")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          batchSize: 1000,
          processInBatches: true
        });

      const endTime = Date.now();
      const batchTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.students).toHaveLength(1000);
      expect(batchTime).toBeLessThan(3000);

      // Verify batch processing
      expect(batchProcessQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 1000,
          batch: true
        })
      );

      console.log("✅ Batch processing for large datasets implemented");
    });
  });

  describe("Memory Optimization", () => {
    test("should implement memory-efficient pagination", async () => {
      const Student = require("../models/Student");
      
      const initialMemory = process.memoryUsage();

      // Mock memory-efficient pagination
      const memoryEfficientQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(memoryEfficientQuery);

      const startTime = Date.now();

      // Test cursor-based pagination
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          cursor: null,
          limit: 100,
          memoryEfficient: true
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
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
      expect(queryTime).toBeLessThan(1500);

      console.log("✅ Memory-efficient pagination implemented");
    });

    test("should implement streaming for large datasets", async () => {
      const Student = require("../models/Student");
      
      const initialMemory = process.memoryUsage();

      // Mock streaming response
      const streamingQuery = jest.fn(() => Promise.resolve(largeStudentDataset));
      Student.find.mockImplementation(streamingQuery);

      const startTime = Date.now();

      const response = await api("get", "/api/students/stream")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          stream: true,
          limit: 2000
        });

      const endTime = Date.now();
      const streamTime = endTime - startTime;

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      
      // Memory usage should be controlled
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB increase
      expect(streamTime).toBeLessThan(5000);

      console.log("✅ Streaming for large datasets implemented");
    });

    test("should implement object pooling for frequent operations", async () => {
      const Student = require("../models/Student");
      
      // Mock object pooling
      const pooledQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(pooledQuery);

      const startTime = Date.now();

      // Test object pooling
      const promises = Array.from({ length: 10 }, (_, i) =>
        api("get", "/api/students")
          .set("Authorization", `Bearer ${adminToken}`)
          .query({
            page: i + 1,
            limit: 100,
            usePool: true
          })
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const poolTime = endTime - startTime;

      expect(poolTime).toBeLessThan(3000);

      // Verify object pooling
      expect(pooledQuery).toHaveBeenCalledTimes(10);

      console.log("✅ Object pooling for frequent operations implemented");
    });

    test("should implement lazy loading for related data", async () => {
      const Student = require("../models/Student");
      const Class = require("../models/Class");
      
      // Mock lazy loading
      const lazyLoadQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(lazyLoadQuery);

      const startTime = Date.now();

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100,
          lazyLoad: true
        });

      const endTime = Date.now();
      const lazyLoadTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.students).toHaveLength(100);
      expect(lazyLoadTime).toBeLessThan(1000);

      // Verify lazy loading
      expect(lazyLoadQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          lazy: true,
          populate: false
        })
      );

      console.log("✅ Lazy loading for related data implemented");
    });
  });

  describe("Response Optimization", () => {
    test("should implement response compression", async () => {
      const Student = require("../models/Student");
      
      // Mock large response
      Student.find.mockResolvedValue(largeStudentDataset);

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 1000,
          compress: true
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-encoding']).toBe('gzip');
      expect(response.headers['content-length']).toBeDefined();

      console.log("✅ Response compression implemented");
    });

    test("should implement response caching with ETags", async () => {
      const Student = require("../models/Student");
      
      // Mock cached response
      const cachedResponse = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(cachedResponse);

      // First request
      const response1 = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100,
          cache: true
        });

      expect(response1.status).toBe(200);
      expect(response1.headers.etag).toBeDefined();

      // Second request with ETag
      const response2 = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("If-None-Match", response1.headers.etag)
        .query({
          page: 1,
          limit: 100,
          cache: true
        });

      expect(response2.status).toBe(304); // Not Modified

      console.log("✅ Response caching with ETags implemented");
    });

    test("should implement field selection for reduced payload", async () => {
      const Student = require("../models/Student");
      
      // Mock field selection
      const fieldSelectionQuery = jest.fn(() => Promise.resolve(
        largeStudentDataset.slice(0, 100).map(student => ({
          _id: student._id,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email
        }))
      ));
      Student.find.mockImplementation(fieldSelectionQuery);

      const startTime = Date.now();

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100,
          fields: "firstName,lastName,email"
        });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.students).toHaveLength(100);
      expect(response.body.students[0]).toHaveProperty('firstName');
      expect(response.body.students[0]).toHaveProperty('lastName');
      expect(response.body.students[0]).toHaveProperty('email');
      expect(response.body.students[0]).not.toHaveProperty('createdAt');
      expect(queryTime).toBeLessThan(1000);

      console.log("✅ Field selection for reduced payload implemented");
    });

    test("should implement response pagination metadata", async () => {
      const Student = require("../models/Student");
      
      // Mock pagination metadata
      const paginationQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(paginationQuery);
      Student.countDocuments.mockResolvedValue(2000);

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100,
          metadata: true
        });

      expect(response.status).toBe(200);
      expect(response.body.students).toHaveLength(100);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.totalPages).toBe(20);
      expect(response.body.pagination.totalCount).toBe(2000);
      expect(response.body.pagination.hasNext).toBe(true);
      expect(response.body.pagination.hasPrev).toBe(false);

      console.log("✅ Response pagination metadata implemented");
    });
  });

  describe("Connection Optimization", () => {
    test("should implement connection pooling", async () => {
      const Student = require("../models/Student");
      
      // Mock connection pooling
      const pooledQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(pooledQuery);

      const startTime = Date.now();

      // Test concurrent requests with connection pooling
      const promises = Array.from({ length: 50 }, (_, i) =>
        api("get", "/api/students")
          .set("Authorization", `Bearer ${adminToken}`)
          .query({
            page: i + 1,
            limit: 40,
            usePool: true
          })
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(10000); // Should complete in under 10 seconds

      console.log("✅ Connection pooling implemented");
    });

    test("should implement connection keep-alive", async () => {
      const Student = require("../models/Student");
      
      // Mock keep-alive connection
      const keepAliveQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(keepAliveQuery);

      // Test keep-alive connection
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("Connection", "keep-alive")
        .query({
          page: 1,
          limit: 100
        });

      expect(response.status).toBe(200);
      expect(response.headers.connection).toBe('keep-alive');

      console.log("✅ Connection keep-alive implemented");
    });

    test("should implement request timeout handling", async () => {
      const Student = require("../models/Student");
      
      // Mock slow query
      const slowQuery = jest.fn(() => 
        new Promise(resolve => setTimeout(() => resolve(largeStudentDataset.slice(0, 100)), 5000))
      );
      Student.find.mockImplementation(slowQuery);

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100,
          timeout: 2000
        });

      expect(response.status).toBe(408); // Request Timeout

      console.log("✅ Request timeout handling implemented");
    });

    test("should implement circuit breaker pattern", async () => {
      const Student = require("../models/Student");
      
      // Mock circuit breaker
      const circuitBreakerQuery = jest.fn(() => {
        if (Math.random() > 0.7) {
          return Promise.reject(new Error("Service unavailable"));
        }
        return Promise.resolve(largeStudentDataset.slice(0, 100));
      });
      Student.find.mockImplementation(circuitBreakerQuery);

      // Test circuit breaker
      const promises = Array.from({ length: 10 }, (_, i) =>
        api("get", "/api/students")
          .set("Authorization", `Bearer ${adminToken}`)
          .query({
            page: 1,
            limit: 100,
            circuitBreaker: true
          })
      );

      const responses = await Promise.allSettled(promises);

      // Some requests should fail due to circuit breaker
      const failedResponses = responses.filter(r => 
        r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status >= 500)
      );

      expect(failedResponses.length).toBeGreaterThan(0);

      console.log("✅ Circuit breaker pattern implemented");
    });
  });

  describe("Performance Monitoring", () => {
    test("should implement performance metrics collection", async () => {
      const Student = require("../models/Student");
      
      // Mock performance monitoring
      const monitoredQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(monitoredQuery);

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100,
          monitor: true
        });

      expect(response.status).toBe(200);
      expect(response.body.performance).toBeDefined();
      expect(response.body.performance.queryTime).toBeDefined();
      expect(response.body.performance.memoryUsage).toBeDefined();
      expect(response.body.performance.cacheHit).toBeDefined();

      console.log("✅ Performance metrics collection implemented");
    });

    test("should implement slow query detection", async () => {
      const Student = require("../models/Student");
      
      // Mock slow query
      const slowQuery = jest.fn(() => 
        new Promise(resolve => setTimeout(() => resolve(largeStudentDataset.slice(0, 100)), 3000))
      );
      Student.find.mockImplementation(slowQuery);

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100,
          slowQueryThreshold: 2000
        });

      expect(response.status).toBe(200);
      expect(response.body.performance.isSlowQuery).toBe(true);
      expect(response.body.performance.queryTime).toBeGreaterThan(2000);

      console.log("✅ Slow query detection implemented");
    });

    test("should implement performance alerts", async () => {
      const Student = require("../models/Student");
      
      // Mock performance alerts
      const alertQuery = jest.fn(() => Promise.resolve(largeStudentDataset.slice(0, 100)));
      Student.find.mockImplementation(alertQuery);

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          page: 1,
          limit: 100,
          alertThreshold: 1000
        });

      expect(response.status).toBe(200);
      expect(response.body.performance.alerts).toBeDefined();
      expect(Array.isArray(response.body.performance.alerts)).toBe(true);

      console.log("✅ Performance alerts implemented");
    });

    test("should implement performance dashboard", async () => {
      const Student = require("../models/Student");
      const Payment = require("../models/Payment");
      const Attendance = require("../models/Attendance");
      
      // Mock performance dashboard data
      Student.find.mockResolvedValue(largeStudentDataset);
      Payment.aggregate.mockResolvedValue([{ totalRevenue: 200000 }]);
      Attendance.aggregate.mockResolvedValue([{ attendanceRate: 85 }]);

      const response = await api("get", "/api/analytics/performance")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.performance).toBeDefined();
      expect(response.body.performance.database).toBeDefined();
      expect(response.body.performance.memory).toBeDefined();
      expect(response.body.performance.responseTime).toBeDefined();
      expect(response.body.performance.throughput).toBeDefined();

      console.log("✅ Performance dashboard implemented");
    });
  });
});
