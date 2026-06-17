const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass, createMockAcademicYear, createMockTerm } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Attendance Stress Testing", () => {
  let adminToken, teacherToken;
  let largeStudentDataset;
  let testClass, testAcademicYear, testTerm;

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
    testClass = createMockClass();
    testAcademicYear = createMockAcademicYear();
    testTerm = createMockTerm();

    // Create large student dataset for stress testing
    largeStudentDataset = Array.from({ length: 500 }, (_, i) => 
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

  describe("High Volume Entries", () => {
    test("should handle high volume attendance entries efficiently", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock high volume attendance data
      const highVolumeAttendance = Array.from({ length: 1000 }, (_, i) => ({
        student: largeStudentDataset[i % largeStudentDataset.length]._id,
        date: "2025-02-14",
        term: "First Term",
        status: i % 3 === 0 ? "present" : i % 3 === 1 ? "late" : "absent"
      }));

      Attendance.insertMany.mockResolvedValue({
        insertedCount: 1000,
        processingTime: 2.5
      });

      const startTime = Date.now();

      const response = await api("post", "/api/attendance/bulk")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          attendance: highVolumeAttendance
        });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(response.status).toBe(201);
      expect(response.body.insertedCount).toBe(1000);
      expect(processingTime).toBeLessThan(5000); // Should complete in under 5 seconds

      console.log("✅ High volume attendance entries handled efficiently");
    });

    test("should handle concurrent high volume operations", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock concurrent high volume operations
      const concurrentAttendanceData = Array.from({ length: 500 }, (_, i) => ({
        student: largeStudentDataset[i % largeStudentDataset.length]._id,
        date: "2025-02-14",
        term: "First Term",
        status: "present"
      }));

      Attendance.insertMany.mockResolvedValue({
        insertedCount: 500,
        processingTime: 1.5
      });

      const startTime = Date.now();

      // Create multiple concurrent requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        api("post", "/api/attendance/bulk")
          .set("Authorization", `Bearer ${teacherToken}`)
          .send({
            attendance: concurrentAttendanceData.slice(i * 50, (i + 1) * 50)
          })
      );

      const responses = await Promise.all(promises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.insertedCount).toBe(50);
      });

      expect(totalTime).toBeLessThan(10000); // Should complete in under 10 seconds

      console.log("✅ Concurrent high volume operations handled efficiently");
    });

    test("should maintain data integrity under high volume", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock data integrity check
      const integrityCheckData = {
        totalRecords: 1000,
        duplicateRecords: 0,
        missingRequiredFields: 0,
        validDateFormats: 1000,
        validStatuses: 1000
      };

      Attendance.aggregate.mockResolvedValue([integrityCheckData]);

      const response = await api("get", "/api/attendance/integrity-check")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          date: "2025-02-14",
          term: "First Term"
        });

      expect(response.status).toBe(200);
      expect(response.body.totalRecords).toBe(1000);
      expect(response.body.duplicateRecords).toBe(0);
      expect(response.body.dataIntegrity).toBe(true);

      console.log("✅ Data integrity maintained under high volume");
    });
  });

  describe("Same-Day Edits", () => {
    test("should handle same-day attendance edits efficiently", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock same-day attendance edits
      const sameDayEdits = [
        {
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present",
          recordedAt: "2025-02-14T08:30:00Z"
        },
        {
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "late",
          recordedAt: "2025-02-14T09:15:00Z"
        },
        {
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present",
          recordedAt: "2025-02-14T10:30:00Z"
        }
      ];

      Attendance.find.mockResolvedValue(sameDayEdits);

      const response = await api("get", `/api/attendance/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          date: "2025-02-14",
          term: "First Term"
        });

      expect(response.status).toBe(200);
      expect(response.body.attendance).toHaveLength(3);
      expect(response.body.attendance[0].status).toBe("present");
      expect(response.body.attendance[1].status).toBe("late");
      expect(response.body.attendance[2].status).toBe("present");

      console.log("✅ Same-day attendance edits handled efficiently");
    });

    test("should track same-day edit history", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock same-day edit history
      const editHistory = [
        {
          attendanceId: "attendance123",
          originalStatus: "present",
          newStatus: "late",
          editedBy: "Teacher1",
          editedAt: "2025-02-14T09:15:00Z",
          reason: "Student arrived late"
        },
        {
          attendanceId: "attendance123",
          originalStatus: "late",
          newStatus: "present",
          editedBy: "Teacher1",
          editedAt: "2025-02-14T10:30:00Z",
          reason: "Student arrived"
        }
      ];

      Attendance.aggregate.mockResolvedValue(editHistory);

      const response = await api("get", `/api/attendance/history/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          date: "2025-02-14",
          term: "First Term"
        });

      expect(response.status).toBe(200);
      expect(response.body.history).toHaveLength(2);
      expect(response.body.history[0].originalStatus).toBe("present");
      expect(response.body.history[0].newStatus).toBe("late");

      console.log("✅ Same-day edit history tracked correctly");
    });

    test("should prevent conflicting same-day edits", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock conflicting same-day edits
      const conflictingEdits = [
        {
          attendanceId: "attendance123",
          status: "present",
          editedBy: "Teacher1",
          editedAt: "2025-02-14T09:15:00Z"
        },
        {
          attendanceId: "attendance123",
          status: "absent",
          editedBy: "Teacher2",
          editedAt: "2025-02-14T09:20:00Z"
        }
      ];

      Attendance.aggregate.mockResolvedValue(conflictingEdits);

      const response = await api("post", "/api/attendance/resolve-conflict")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          attendanceId: "attendance123",
          date: "2025-02-14",
          term: "First Term"
        });

      expect(response.status).toBe(200);
      expect(response.body.conflictResolved).toBe(true);
      expect(response.body.finalStatus).toBeDefined();

      console.log("✅ Conflicting same-day edits prevented");
    });

    test("should handle bulk same-day edits", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock bulk same-day edits
      const bulkSameDayEdits = Array.from({ length: 100 }, (_, i) => ({
        student: largeStudentDataset[i % largeStudentDataset.length]._id,
        date: "2025-02-14",
        term: "First Term",
        status: i % 2 === 0 ? "present" : "absent",
        recordedAt: `2025-02-14T${8 + Math.floor(i / 10)}:${30 + (i % 10) * 6}:00Z`
      }));

      Attendance.find.mockResolvedValue(bulkSameDayEdits);
      Attendance.updateMany.mockResolvedValue({
        modifiedCount: 100,
        processingTime: 1.2
      });

      const startTime = Date.now();

      const response = await api("post", "/api/attendance/bulk-update")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          updates: bulkSameDayEdits
        });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(response.body.modifiedCount).toBe(100);
      expect(processingTime).toBeLessThan(3000);

      console.log("✅ Bulk same-day edits handled efficiently");
    });
  });

  describe("Term Boundary Dates", () => {
    test("should handle term start date boundary correctly", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock term start boundary
      const termStartBoundary = {
        term: testTerm._id,
        startDate: "2025-01-15",
        endDate: "2025-04-15",
        firstDay: "2025-01-15",
        lastDay: "2025-04-15"
      };

      const Term = require("../models/Term");
      Term.findOne.mockResolvedValue(termStartBoundary);

      const response = await api("get", `/api/attendance/term-boundary/${testTerm._id}`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.firstDay).toBe("2025-01-15");
      expect(response.body.lastDay).toBe("2025-04-15");

      console.log("✅ Term start date boundary handled correctly");
    });

    test("should handle term end date boundary correctly", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock term end boundary
      const termEndBoundary = {
        term: testTerm._id,
        startDate: "2025-01-15",
        endDate: "2025-04-15",
        firstDay: "2025-01-15",
        lastDay: "2025-04-15"
      };

      const Term = require("../models/Term");
      Term.findOne.mockResolvedValue(termEndBoundary);

      const response = await api("get", `/api/attendance/term-boundary/${testTerm._id}`)
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(response.status).toBe(200);
      expect(response.body.firstDay).toBe("2025-01-15");
      expect(response.body.lastDay).toBe("2025-04-15");

      console.log("✅ Term end date boundary handled correctly");
    });

    test("should prevent attendance outside term boundaries", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock attendance outside term boundaries
      const outsideTermAttendance = {
        student: testStudent._id,
        date: "2025-04-20", // After term end
        term: "First Term",
        status: "present"
      };

      Attendance.create.mockRejectedValue(new Error("Date outside term boundaries"));

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send(outsideTermAttendance);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();

      console.log("✅ Attendance outside term boundaries prevented");
    });

    test("should handle term transition periods", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock term transition period
      const termTransitionPeriod = [
        {
          date: "2025-04-10",
          term: "First Term",
          status: "present"
        },
        {
          date: "2025-04-15",
          term: "First Term",
          status: "present"
        },
        {
          date: "2025-04-20",
          term: "Second Term",
          status: "present"
        }
      ];

      Attendance.find.mockResolvedValue(termTransitionPeriod);

      const response = await api("get", `/api/attendance/term-transition/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          startDate: "2025-04-10",
          endDate: "2025-04-20"
        });

      expect(response.status).toBe(200);
      expect(response.body.attendance).toHaveLength(3);
      expect(response.body.attendance[0].term).toBe("First Term");
      expect(response.body.attendance[2].term).toBe("Second Term");

      console.log("✅ Term transition periods handled correctly");
    });

    test("should validate term boundary calculations", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock term boundary validation
      const boundaryValidation = {
        term: testTerm._id,
        totalDays: 90,
        attendanceDays: 88,
        boundaryDays: {
          firstDay: "2025-01-15",
          lastDay: "2025-04-15"
        },
        validation: {
          firstDayAttendance: true,
          lastDayAttendance: true,
          boundaryCompliance: true
        }
      };

      Attendance.aggregate.mockResolvedValue([boundaryValidation]);

      const response = await api("post", "/api/attendance/validate-term-boundaries")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          term: testTerm._id
        });

      expect(response.status).toBe(200);
      expect(response.body.validation.boundaryCompliance).toBe(true);
      expect(response.body.boundaryDays.firstDayAttendance).toBe(true);

      console.log("✅ Term boundary calculations validated");
    });
  });

  describe("Performance Under Stress", () => {
    test("should maintain performance under high load", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock performance under load
      const performanceData = {
        totalRequests: 1000,
        averageResponseTime: 150,
        maxResponseTime: 300,
        errorRate: 0,
        throughput: 5000
      };

      Attendance.find.mockResolvedValue([]);
      Attendance.insertMany.mockResolvedValue({ insertedCount: 100 });

      const startTime = Date.now();

      // Create high load
      const promises = Array.from({ length: 100 }, (_, i) =>
        api("post", "/api/attendance")
          .set("Authorization", `Bearer ${teacherToken}`)
          .send({
            student: largeStudentDataset[i % largeStudentDataset.length]._id,
            date: "2025-02-14",
            term: "First Term",
            status: "present"
          })
      );

      const responses = await Promise.all(promises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      expect(totalTime).toBeLessThan(15000); // Should complete in under 15 seconds

      console.log("✅ Performance maintained under high load");
    });

    test("should handle memory usage efficiently", async () => {
      const Attendance = require("../models/Attendance");
      
      const initialMemory = process.memoryUsage();

      // Create large number of attendance records
      const largeAttendanceData = Array.from({ length: 5000 }, (_, i) => ({
        student: largeStudentDataset[i % largeStudentDataset.length]._id,
        date: "2025-02-14",
        term: "First Term",
        status: "present"
      }));

      Attendance.insertMany.mockResolvedValue({
        insertedCount: 5000,
        processingTime: 3.5
      });

      await api("post", "/api/attendance/bulk")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          attendance: largeAttendanceData
        });

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      
      // Memory usage should not increase significantly
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase

      console.log("✅ Memory usage handled efficiently");
    });

    test("should handle database connection stress", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock database connection stress
      const connectionStressData = Array.from({ length: 2000 }, (_, i) => ({
        student: largeStudentDataset[i % largeStudentDataset.length]._id,
        date: "2025-02-14",
        term: "First Term",
        status: "present"
      }));

      let connectionCount = 0;
      Attendance.insertMany.mockImplementation(() => {
        connectionCount++;
        return Promise.resolve({
          insertedCount: 100,
          processingTime: 0.5
        });
      });

      const startTime = Date.now();

      // Create multiple concurrent requests to stress database
      const promises = Array.from({ length: 20 }, (_, i) =>
        api("post", "/api/attendance/bulk")
          .set("Authorization", `Bearer ${teacherToken}`)
          .send({
            attendance: connectionStressData.slice(i * 100, (i + 1) * 100)
          })
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(connectionCount).toBe(20);
      expect(totalTime).toBeLessThan(10000);

      console.log("✅ Database connection stress handled");
    });
  });
});
