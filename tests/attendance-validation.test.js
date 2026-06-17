const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass, createMockAcademicYear, createMockTerm } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Attendance Validation Tests", () => {
  let adminToken, teacherToken, parentToken;
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
    
    // Create mock users for each role
    const adminUser = createMockUser({ role: "admin" });
    const teacherUser = createMockUser({ role: "teacher" });
    const parentUser = createMockUser({ role: "parent" });
    
    const User = require("../models/User");
    User.findOne.mockImplementation((query) => {
      if (query.email === "admin@test.com") return Promise.resolve(adminUser);
      if (query.email === "teacher@test.com") return Promise.resolve(teacherUser);
      if (query.email === "parent@test.com") return Promise.resolve(parentUser);
      return Promise.resolve(null);
    });

    // Get tokens for each role
    const responses = await Promise.all([
      api("post", "/api/auth/login").send({ email: "admin@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "teacher@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "parent@test.com", password: "password123" })
    ]);

    adminToken = responses[0].body.token;
    teacherToken = responses[1].body.token;
    parentToken = responses[2].body.token;
  });

  describe("No Duplicate Attendance", () => {
    test("should prevent duplicate attendance entries", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock existing attendance record
      const existingAttendance = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "First Term",
        status: "present"
      };

      Attendance.findOne.mockResolvedValue(existingAttendance);

      // Try to create duplicate attendance
      const duplicateResponse = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present"
        });

      expect(duplicateResponse.status).toBe(400);
      expect(duplicateResponse.body.message).toContain("already recorded");

      console.log("✅ Duplicate attendance prevention working");
    });

    test("should allow attendance status updates", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock existing attendance record
      const existingAttendance = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "First Term",
        status: "present"
      };

      Attendance.findOne.mockResolvedValue(existingAttendance);
      Attendance.findByIdAndUpdate.mockResolvedValue({
        ...existingAttendance,
        status: "late",
        updatedAt: new Date()
      });

      // Update attendance status
      const updateResponse = await api("put", `/api/attendance/${existingAttendance._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          status: "late"
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.status).toBe("late");

      console.log("✅ Attendance status updates working");
    });

    test("should handle bulk attendance without duplicates", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock bulk attendance with some existing records
      const existingAttendance = [
        {
          student: "student1",
          date: "2025-02-14",
          term: "First Term",
          status: "present"
        }
      ];

      Attendance.find.mockResolvedValue(existingAttendance);
      Attendance.insertMany.mockResolvedValue({
        insertedCount: 2,
        skippedCount: 1,
        duplicates: 1
      });

      // Bulk attendance
      const bulkResponse = await api("post", "/api/attendance/bulk")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          attendance: [
            {
              student: "student1",
              date: "2025-02-14",
              term: "First Term",
              status: "present"
            },
            {
              student: "student2",
              date: "2025-02-14",
              term: "First Term",
              status: "present"
            },
            {
              student: "student3",
              date: "2025-02-14",
              term: "First Term",
              status: "present"
            }
          ]
        });

      expect(bulkResponse.status).toBe(201);
      expect(bulkResponse.body.insertedCount).toBe(2);
      expect(bulkResponse.body.skippedCount).toBe(1);

      console.log("✅ Bulk attendance without duplicates working");
    });
  });

  describe("Correct Date Recording", () => {
    test("should record attendance dates correctly", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock attendance with correct date
      const attendanceWithCorrectDate = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "First Term",
        status: "present",
        recordedAt: new Date("2025-02-14T08:30:00Z")
      };

      Attendance.create.mockResolvedValue(attendanceWithCorrectDate);

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present"
        });

      expect(response.status).toBe(201);
      expect(response.body.date).toBe("2025-02-14");

      console.log("✅ Attendance date recording correct");
    });

    test("should handle different date formats", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock attendance with different date formats
      const attendanceWithDateFormats = [
        {
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present"
        },
        {
          student: testStudent._id,
          date: "2025-02-14T08:30:00Z",
          term: "First Term",
          status: "present"
        },
        {
          student: testStudent._id,
          date: new Date("2025-02-14"),
          term: "First Term",
          status: "present"
        }
      ];

      Attendance.create.mockResolvedValue(attendanceWithDateFormats[0]);

      const responses = await Promise.all([
        api("post", "/api/attendance")
          .set("Authorization", `Bearer ${teacherToken}`)
          .send({
            student: testStudent._id,
            date: "2025-02-14",
            term: "First Term",
            status: "present"
          }),
        api("post", "/api/attendance")
          .set("Authorization", `Bearer ${teacherToken}`)
          .send({
            student: testStudent._id,
            date: "2025-02-14T08:30:00Z",
            term: "First Term",
            status: "present"
          }),
        api("post", "/api/attendance")
          .set("Authorization", `Bearer ${teacherToken}`)
          .send({
            student: testStudent._id,
            date: new Date("2025-02-14"),
            term: "First Term",
            status: "present"
          })
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      console.log("✅ Different date formats handled correctly");
    });

    test("should validate date ranges", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock invalid date
      const invalidDateAttendance = {
        student: testStudent._id,
        date: "invalid-date",
        term: "First Term",
        status: "present"
      };

      Attendance.create.mockRejectedValue(new Error("Invalid date format"));

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send(invalidDateAttendance);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();

      console.log("✅ Date range validation working");
    });

    test("should handle timezone correctly", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock timezone handling
      const timezoneAttendance = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "First Term",
        status: "present",
        timezone: "Africa/Accra"
      };

      Attendance.create.mockResolvedValue(timezoneAttendance);

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present",
          timezone: "Africa/Accra"
        });

      expect(response.status).toBe(201);
      expect(response.body.timezone).toBe("Africa/Accra");

      console.log("✅ Timezone handling working");
    });
  });

  describe("Correct Term Mapping", () => {
    test("should map attendance to correct term", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock attendance with term mapping
      const attendanceWithTerm = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "First Term",
        academicYear: testAcademicYear._id,
        status: "present"
      };

      Attendance.create.mockResolvedValue(attendanceWithTerm);

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          academicYear: testAcademicYear._id,
          status: "present"
        });

      expect(response.status).toBe(201);
      expect(response.body.term).toBe("First Term");
      expect(response.body.academicYear).toBe(testAcademicYear._id);

      console.log("✅ Attendance term mapping correct");
    });

    test("should prevent cross-term attendance recording", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock cross-term attempt
      const crossTermAttendance = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "Second Term", // Wrong term
        academicYear: testAcademicYear._id,
        status: "present"
      };

      Attendance.create.mockRejectedValue(new Error("Invalid term for date range"));

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send(crossTermAttendance);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();

      console.log("✅ Cross-term attendance prevention working");
    });

    test("should handle term transitions correctly", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock term transition
      const termTransitionAttendance = [
        {
          student: testStudent._id,
          date: "2025-01-31",
          term: "First Term",
          status: "present"
        },
        {
          student: testStudent._id,
          date: "2025-02-01",
          term: "Second Term",
          status: "present"
        }
      ];

      Attendance.find.mockResolvedValue(termTransitionAttendance);

      const response = await api("get", `/api/attendance/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          startDate: "2025-01-01",
          endDate: "2025-02-28"
        });

      expect(response.status).toBe(200);
      expect(response.body.attendance).toHaveLength(2);
      expect(response.body.attendance[0].term).toBe("First Term");
      expect(response.body.attendance[1].term).toBe("Second Term");

      console.log("✅ Term transitions handled correctly");
    });
  });

  describe("Accurate Attendance Percentage", () => {
    test("should calculate attendance percentage correctly", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock attendance data for percentage calculation
      const attendanceData = [
        {
          student: testStudent._id,
          date: "2025-02-10",
          term: "First Term",
          status: "present"
        },
        {
          student: testStudent._id,
          date: "2025-02-11",
          term: "First Term",
          status: "present"
        },
        {
          student: testStudent._id,
          date: "2025-02-12",
          term: "First Term",
          status: "absent"
        },
        {
          student: testStudent._id,
          date: "2025-02-13",
          term: "First Term",
          status: "present"
        },
        {
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present"
        }
      ];

      Attendance.find.mockResolvedValue(attendanceData);

      const response = await api("get", `/api/attendance/percentage/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          term: "First Term",
          startDate: "2025-02-10",
          endDate: "2025-02-14"
        });

      expect(response.status).toBe(200);
      expect(response.body.totalDays).toBe(5);
      expect(response.body.daysPresent).toBe(4);
      expect(response.body.attendancePercentage).toBe(80);

      console.log("✅ Attendance percentage calculation correct");
    });

    test("should handle different attendance statuses in percentage", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock attendance with different statuses
      const attendanceWithStatuses = [
        {
          student: testStudent._id,
          date: "2025-02-10",
          term: "First Term",
          status: "present"
        },
        {
          student: testStudent._id,
          date: "2025-02-11",
          term: "First Term",
          status: "late"
        },
        {
          student: testStudent._id,
          date: "2025-02-12",
          term: "First Term",
          status: "absent"
        },
        {
          student: testStudent._id,
          date: "2025-02-13",
          term: "First Term",
          status: "excused"
        },
        {
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present"
        }
      ];

      Attendance.find.mockResolvedValue(attendanceWithStatuses);

      const response = await api("get", `/api/attendance/percentage/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          term: "First Term",
          startDate: "2025-02-10",
          endDate: "2025-02-14"
        });

      expect(response.status).toBe(200);
      expect(response.body.totalDays).toBe(5);
      expect(response.body.daysPresent).toBe(2);
      expect(response.body.daysLate).toBe(1);
      expect(response.body.daysAbsent).toBe(1);
      expect(response.body.daysExcused).toBe(1);
      expect(response.body.attendancePercentage).toBe(40); // Only present days count

      console.log("✅ Different attendance statuses in percentage working");
    });

    test("should handle class-wide attendance percentage", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock class-wide attendance
      const classAttendance = [
        {
          student: "student1",
          date: "2025-02-14",
          term: "First Term",
          status: "present"
        },
        {
          student: "student2",
          date: "2025-02-14",
          term: "First Term",
          status: "present"
        },
        {
          student: "student3",
          date: "2025-02-14",
          term: "First Term",
          status: "absent"
        }
      ];

      Attendance.find.mockResolvedValue(classAttendance);

      const response = await api("get", `/api/attendance/percentage/class/${testClass._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          date: "2025-02-14",
          term: "First Term"
        });

      expect(response.status).toBe(200);
      expect(response.body.totalStudents).toBe(3);
      expect(response.body.totalPresent).toBe(2);
      expect(response.body.classAttendancePercentage).toBe(66.67);

      console.log("✅ Class-wide attendance percentage working");
    });

    test("should handle term-wide attendance percentage", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock term-wide attendance
      const termAttendance = [
        {
          student: "student1",
          date: "2025-02-14",
          term: "First Term",
          status: "present"
        },
        {
          student: "student2",
          date: "2025-02-14",
          term: "First Term",
          status: "present"
        },
        {
          student: "student3",
          date: "2025-02-14",
          term: "First Term",
          status: "present"
        }
      ];

      Attendance.find.mockResolvedValue(termAttendance);

      const response = await api("get", `/api/attendance/percentage/term/${testTerm._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          date: "2025-02-14"
        });

      expect(response.status).toBe(200);
      expect(response.body.totalStudents).toBe(3);
      expect(response.body.totalPresent).toBe(3);
      expect(response.body.termAttendancePercentage).toBe(100);

      console.log("✅ Term-wide attendance percentage working");
    });
  });

  describe("Export Works (PDF/CSV)", () => {
    test("should export attendance to CSV correctly", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock attendance data for CSV export
      const attendanceForCSV = [
        {
          student: testStudent,
          date: "2025-02-14",
          term: "First Term",
          status: "present",
          recordedAt: "2025-02-14T08:30:00Z",
          recordedBy: "Teacher1"
        }
      ];

      Attendance.find.mockResolvedValue(attendanceForCSV);

      const response = await api("get", "/api/attendance/export/csv")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          student: testStudent._id,
          term: "First Term",
          startDate: "2025-02-01",
          endDate: "2025-02-28"
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.body).toBeDefined();

      console.log("✅ CSV export working");
    });

    test("should export attendance to PDF correctly", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock attendance data for PDF export
      const attendanceForPDF = [
        {
          student: testStudent,
          date: "2025-02-14",
          term: "First Term",
          status: "present",
          recordedAt: "2025-02-14T08:30:00Z",
          recordedBy: "Teacher1"
        }
      ];

      Attendance.find.mockResolvedValue(attendanceForPDF);

      const response = await api("get", "/api/attendance/export/pdf")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          student: testStudent._id,
          term: "First Term",
          startDate: "2025-02-01",
          endDate: "2025-02-28"
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.body).toBeDefined();

      console.log("✅ PDF export working");
    });

    test("should include all required data in exports", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock complete attendance data
      const completeAttendanceData = {
        student: {
          firstName: "Test",
          lastName: "Student",
          email: "test@test.com"
        },
        attendance: [
          {
            date: "2025-02-14",
            term: "First Term",
            status: "present",
            recordedAt: "2025-02-14T08:30:00Z",
            recordedBy: "Teacher1"
          }
        ],
        summary: {
          totalDays: 20,
          daysPresent: 18,
          attendancePercentage: 90
        }
      };

      Attendance.aggregate.mockResolvedValue([completeAttendanceData]);

      const response = await api("get", "/api/attendance/export/complete")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          student: testStudent._id,
          term: "First Term",
          startDate: "2025-02-01",
          endDate: "2025-02-28"
        });

      expect(response.status).toBe(200);
      expect(response.body.student.firstName).toBe("Test");
      expect(response.body.attendance).toHaveLength(1);
      expect(response.body.summary.attendancePercentage).toBe(90);

      console.log("✅ All required data included in exports");
    });
  });

  describe("Teacher Cannot Mark Other Classes", () => {
    test("should prevent teachers from marking other classes", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock teacher with specific class assignment
      const teacherWithClass = {
        _id: "teacher1",
        assignedClasses: [testClass._id],
        role: "teacher"
      };

      const User = require("../models/User");
      User.findOne.mockResolvedValue(teacherWithClass);

      // Mock attendance for different class
      const attendanceForOtherClass = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "First Term",
        status: "present",
        class: "other-class-id" // Different class
      };

      Attendance.create.mockRejectedValue(new Error("Teacher not assigned to this class"));

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send(attendanceForOtherClass);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("not assigned");

      console.log("✅ Teacher cannot mark other classes working");
    });

    test("should allow teachers to mark their assigned classes", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock teacher with specific class assignment
      const teacherWithClass = {
        _id: "teacher1",
        assignedClasses: [testClass._id],
        role: "teacher"
      };

      const User = require("../models/User");
      User.findOne.mockResolvedValue(teacherWithClass);

      // Mock attendance for assigned class
      const attendanceForAssignedClass = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "First Term",
        status: "present",
        class: testClass._id // Assigned class
      };

      Attendance.create.mockResolvedValue(attendanceForAssignedClass);

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send(attendanceForAssignedClass);

      expect(response.status).toBe(201);
      expect(response.body.class).toBe(testClass._id);

      console.log("✅ Teacher can mark assigned classes working");
    });

    test("should handle multiple class assignments", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock teacher with multiple class assignments
      const teacherWithMultipleClasses = {
        _id: "teacher1",
        assignedClasses: [testClass._id, "class2-id", "class3-id"],
        role: "teacher"
      };

      const User = require("../models/User");
      User.findOne.mockResolvedValue(teacherWithMultipleClasses);

      // Mock attendance for assigned classes
      const attendanceForMultipleClasses = [
        {
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present",
          class: testClass._id // Assigned class
        },
        {
          student: "student2",
          date: "2025-02-14",
          term: "First Term",
          status: "present",
          class: "class2-id" // Assigned class
        }
      ];

      Attendance.create.mockResolvedValue(attendanceForMultipleClasses[0]);

      const responses = await Promise.all([
        api("post", "/api/attendance")
          .set("Authorization", `Bearer ${teacherToken}`)
          .send(attendanceForMultipleClasses[0]),
        api("post", "/api/attendance")
          .set("Authorization", `Bearer ${teacherToken}`)
          .send(attendanceForMultipleClasses[1])
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      console.log("✅ Multiple class assignments working");
    });

    test("should prevent admin override for teacher permissions", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock admin override attempt
      const adminOverrideAttendance = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "First Term",
        status: "present",
        class: "other-class-id"
      };

      Attendance.create.mockRejectedValue(new Error("Teacher not assigned to this class"));

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send(adminOverrideAttendance);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("not assigned");

      console.log("✅ Admin override prevention working");
    });
  });
});
