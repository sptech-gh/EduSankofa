const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Performance & Load Tests", () => {
  let adminToken;
  let testStudents = [];

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

    // Create test students for load testing
    for (let i = 0; i < 10; i++) {
      testStudents.push(createMockStudent({
        email: `student${i}@test.com`,
        firstName: `Student${i}`,
        lastName: `Test${i}`
      }));
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
    
    // Mock admin user
    const adminUser = createMockUser({ role: "admin" });
    const User = require("../models/User");
    User.findOne.mockResolvedValue(adminUser);
  });

  describe("API Response Time Tests", () => {
    test("should handle single student creation quickly", async () => {
      const startTime = Date.now();
      
      const response = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testStudents[0]);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(201);
      expect(responseTime).toBeLessThan(500); // Should respond in under 500ms
    });

    test("should handle batch student creation efficiently", async () => {
      const startTime = Date.now();
      
      // Create 5 students concurrently
      const promises = testStudents.slice(0, 5).map(student =>
        api("post", "/api/students")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(student)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Total time should be reasonable for 5 concurrent operations
      expect(totalTime).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    test("should handle large data retrieval efficiently", async () => {
      // Mock large student list
      const Student = require("../models/Student");
      const largeStudentList = Array.from({ length: 100 }, (_, i) => 
        createMockStudent({
          email: `large${i}@test.com`,
          firstName: `Large${i}`,
          lastName: `Test${i}`
        })
      );
      Student.find.mockResolvedValue(largeStudentList);

      const startTime = Date.now();
      
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond in under 1 second
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(100);
    });
  });

  describe("Concurrent Request Handling", () => {
    test("should handle multiple concurrent requests", async () => {
      const concurrentRequests = 20;
      const startTime = Date.now();

      // Create 20 concurrent requests
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        api("get", "/api/students")
          .set("Authorization", `Bearer ${adminToken}`)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(3000); // Should complete in under 3 seconds
    });

    test("should maintain data consistency under load", async () => {
      // Create a student first
      const createResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testStudents[0]);
      expect(createResponse.status).toBe(201);
      const studentId = createResponse.body._id;

      // Make 10 concurrent requests to the same student
      const promises = Array.from({ length: 10 }, () =>
        api("get", `/api/students/${studentId}`)
          .set("Authorization", `Bearer ${adminToken}`)
      );

      const responses = await Promise.all(promises);

      // All should return the same data
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body._id).toBe(studentId);
        expect(response.body.email).toBe(testStudents[0].email);
      });
    });
  });

  describe("Memory Usage Tests", () => {
    test("should not leak memory during repeated operations", async () => {
      const initialMemory = process.memoryUsage();

      // Perform multiple operations
      for (let i = 0; i < 50; i++) {
        await api("get", "/api/students")
          .set("Authorization", `Bearer ${adminToken}`);
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase significantly
      const heapUsedIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(heapUsedIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });
  });

  describe("Database Connection Tests", () => {
    test("should handle database connection stress", async () => {
      // This test simulates multiple database operations
      const Student = require("../models/Student");
      
      // Mock database operations
      Student.find.mockResolvedValue(testStudents);
      Student.findOne.mockResolvedValue(testStudents[0]);
      Student.create.mockResolvedValue(testStudents[0]);

      const startTime = Date.now();

      // Perform multiple database operations
      const operations = Array.from({ length: 20 }, (_, i) =>
        api("post", "/api/students")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            ...testStudents[i % testStudents.length],
            email: `stress${i}@test.com`
          })
      );

      const responses = await Promise.all(operations);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(5000); // Under 5 seconds for 20 operations
    });
  });

  describe("Rate Limiting Tests", () => {
    test("should enforce rate limits under stress", async () => {
      const startTime = Date.now();
      
      // Make rapid requests to trigger rate limiting
      const promises = Array.from({ length: 150 }, (_, i) =>
        api("post", "/api/auth/login")
          .send({
            email: "admin@test.com",
            password: "password123"
          })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Should handle rate limiting gracefully
      const successResponses = responses.filter(r => r.status === 200);
      expect(successResponses.length).toBeGreaterThan(0);

      // Should complete quickly due to rate limiting
      expect(totalTime).toBeLessThan(10000); // Under 10 seconds
    });
  });

  describe("Error Handling Under Load", () => {
    test("should handle errors gracefully under stress", async () => {
      // Mock database errors
      const Student = require("../models/Student");
      Student.create.mockRejectedValue(new Error("Database connection lost"));

      const startTime = Date.now();

      // Make multiple requests that will fail
      const promises = Array.from({ length: 10 }, (_, i) =>
        api("post", "/api/students")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            ...testStudents[i % testStudents.length],
            email: `error${i}@test.com`
          })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should fail gracefully
      responses.forEach(response => {
        expect([500, 503]).toContain(response.status);
      });

      // Should fail quickly
      expect(totalTime).toBeLessThan(2000); // Under 2 seconds
    });
  });

  describe("Resource Usage Tests", () => {
    test("should handle large file uploads efficiently", async () => {
      // Mock large file upload
      const largeData = "x".repeat(1024 * 1024); // 1MB of data
      
      const startTime = Date.now();

      const response = await api("post", "/api/upload")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("file", Buffer.from(largeData), "large-file.txt");

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should handle large files or return appropriate error
      expect([200, 413, 415]).toContain(response.status);
      expect(responseTime).toBeLessThan(10000); // Under 10 seconds
    });

    test("should handle complex queries efficiently", async () => {
      const Student = require("../models/Student");
      
      // Mock complex query response
      const complexData = Array.from({ length: 1000 }, (_, i) => 
        createMockStudent({
          email: `complex${i}@test.com`,
          firstName: `Complex${i}`,
          lastName: `Test${i}`,
          // Add many fields to simulate complexity
          additionalField1: `data${i}`,
          additionalField2: `more${i}`,
          additionalField3: `complex${i}`
        })
      );
      Student.find.mockResolvedValue(complexData);

      const startTime = Date.now();

      const response = await api("get", "/api/students?complex=true&detailed=true&large=true")
        .set("Authorization", `Bearer ${adminToken}`);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000); // Under 2 seconds even for complex queries
    });
  });

  describe("System Stability Tests", () => {
    test("should maintain stability under sustained load", async () => {
      const iterations = 5;
      const requestsPerIteration = 20;
      
      for (let iteration = 0; iteration < iterations; iteration++) {
        const startTime = Date.now();
        
        // Make multiple requests
        const promises = Array.from({ length: requestsPerIteration }, (_, i) =>
          api("get", "/api/students")
            .set("Authorization", `Bearer ${adminToken}`)
        );

        const responses = await Promise.all(promises);
        const endTime = Date.now();
        const iterationTime = endTime - startTime;

        // All should succeed
        responses.forEach(response => {
          expect(response.status).toBe(200);
        });

        // Each iteration should complete in reasonable time
        expect(iterationTime).toBeLessThan(3000);

        // Small delay between iterations to simulate real usage
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // System should remain stable throughout
      console.log("✅ System stability test completed successfully");
    });
  });
});
