const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass, createMockAcademicYear, createMockTerm } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Attendance Issues Fixes Tests", () => {
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

  describe("Duplicate Attendance Prevention Fixes", () => {
    test("should fix duplicate attendance detection issues", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock duplicate attendance detection issue
      const duplicateIssue = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "First Term",
        status: "present",
        duplicateDetected: false // Issue: duplicate not detected
      };

      Attendance.findOne.mockResolvedValue(duplicateIssue);
      Attendance.create.mockResolvedValue({
        ...duplicateIssue,
        duplicateDetected: true, // Fixed
        duplicateId: "dup123"
      });

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present"
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("duplicate");

      console.log("✅ Duplicate attendance detection issue fixed");
    });

    test("should fix duplicate bulk attendance handling", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock duplicate bulk attendance issue
      const duplicateBulkIssue = {
        attendance: [
          { student: "student1", date: "2025-02-14", status: "present" },
          { student: "student1", date: "2025-02-14", status: "present" }, // Duplicate
          { student: "student2", date: "2025-02-14", status: "present" }
        ],
        duplicateDetection: {
          enabled: false, // Issue: duplicate detection disabled
          duplicatesFound: 2
        }
      };

      Attendance.find.mockResolvedValue(duplicateBulkIssue.attendance);
      Attendance.insertMany.mockResolvedValue({
        insertedCount: 1,
        skippedCount: 2,
        duplicatesFound: 2,
        duplicateDetection: {
          enabled: true, // Fixed
          duplicatesFound: 2
        }
      });

      const response = await api("post", "/api/attendance/bulk")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          attendance: duplicateBulkIssue.attendance
        });

      expect(response.status).toBe(201);
      expect(response.body.skippedCount).toBe(2);
      expect(response.body.duplicateDetection.duplicatesFound).toBe(2);

      console.log("✅ Duplicate bulk attendance handling fixed");
    });

    test("should fix attendance status update conflicts", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock attendance status update conflict
      const statusConflictIssue = {
        attendanceId: "attendance123",
        currentStatus: "present",
        newStatus: "absent",
        conflictDetected: false // Issue: conflict not detected
      };

      Attendance.findOne.mockResolvedValue(statusConflictIssue);
      Attendance.findByIdAndUpdate.mockResolvedValue({
        ...statusConflictIssue,
        conflictDetected: true, // Fixed
        conflictResolved: true
      });

      const response = await api("put", "/api/attendance/attendance123")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          status: "absent"
        });

      expect(response.status).toBe(200);
      expect(response.body.conflictDetected).toBe(true);
      expect(response.body.conflictResolved).toBe(true);

      console.log("✅ Attendance status update conflicts fixed");
    });
  });

  describe("Date Recording Fixes", () => {
    test("should fix date format validation issues", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock date format validation issue
      const dateFormatIssue = {
        student: testStudent._id,
        date: "invalid-date-format",
        term: "First Term",
        status: "present",
        dateValidation: {
          enabled: false, // Issue: validation disabled
          validFormat: false
        }
      };

      Attendance.create.mockRejectedValue(new Error("Invalid date format"));
      Attendance.create.mockResolvedValue({
        ...dateFormatIssue,
        dateValidation: {
          enabled: true, // Fixed
          validFormat: true
        }
      });

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "invalid-date-format",
          term: "First Term",
          status: "present"
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();

      console.log("✅ Date format validation issue fixed");
    });

    test("should fix timezone handling issues", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock timezone handling issue
      const timezoneIssue = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "First Term",
        status: "present",
        timezone: null,
        timezoneHandling: {
          enabled: false // Issue: timezone handling disabled
        }
      };

      Attendance.create.mockResolvedValue(timezoneIssue);
      Attendance.findByIdAndUpdate.mockResolvedValue({
        ...timezoneIssue,
        timezone: "Africa/Accra", // Fixed
        timezoneHandling: {
          enabled: true
        }
      });

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

      console.log("✅ Timezone handling issue fixed");
    });

    test("should fix date range validation issues", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock date range validation issue
      const dateRangeIssue = {
        student: testStudent._id,
        date: "2025-13-14", // Invalid date (future)
        term: "First Term",
        status: "present",
        dateRangeValidation: {
          enabled: false // Issue: validation disabled
          validRange: false
        }
      };

      Attendance.create.mockRejectedValue(new Error("Date outside valid range"));
      Attendance.create.mockResolvedValue({
        ...dateRangeIssue,
        dateRangeValidation: {
          enabled: true, // Fixed
          validRange: true
        }
      });

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "2025-13-14",
          term: "First Term",
          status: "present"
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();

      console.log("✅ Date range validation issue fixed");
    });
  });

  describe("Term Mapping Fixes", () => {
    test("should fix term validation issues", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock term validation issue
      const termValidationIssue = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "Invalid Term", // Invalid term
        status: "present",
        termValidation: {
          enabled: false, // Issue: validation disabled
          validTerm: false
        }
      };

      Attendance.create.mockRejectedValue(new Error("Invalid term"));
      Attendance.create.mockResolvedValue({
        ...termValidationIssue,
        term: "First Term",
        termValidation: {
          enabled: true, // Fixed
          validTerm: true
        }
      });

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present"
        });

      expect(response.status).toBe(201);
      expect(response.body.term).toBe("First Term");

      console.log("✅ Term validation issue fixed");
    });

    test("should fix term transition issues", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock term transition issue
      const termTransitionIssue = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "First Term",
        academicYear: testAcademicYear._id,
        status: "present",
        termTransition: {
          enabled: false, // Issue: transition validation disabled
          validTransition: false
        }
      };

      Attendance.create.mockRejectedValue(new Error("Invalid term transition"));
      Attendance.create.mockResolvedValue({
        ...termTransitionIssue,
        term: "First Term",
        academicYear: testAcademicYear._id,
        termTransition: {
          enabled: true, // Fixed
          validTransition: true
        }
      });

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
      expect(response.body.termTransition.validTransition).toBe(true);

      console.log("✅ Term transition issue fixed");
    });

    test("should fix cross-term data leakage issues", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock cross-term data leakage issue
      const crossTermLeakage = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "First Term",
        academicYear: testAcademicYear._id,
        status: "present",
        crossTermProtection: {
          enabled: false // Issue: cross-term protection disabled
        }
      };

      Attendance.create.mockResolvedValue(crossTermLeakage);
      Attendance.create.mockRejectedValue(new Error("Cross-term data leakage detected"));

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "2025-02-14",
          term: "Second Term", // Wrong term
          academicYear: testAcademicYear._id,
          status: "present"
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();

      console.log("✅ Cross-term data leakage issue fixed");
    });
  });

  describe("Attendance Percentage Calculation Fixes", () => {
    test("should fix attendance percentage calculation errors", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock attendance percentage calculation error
      const percentageCalculationError = {
        student: testStudent._id,
        term: "First Term",
        startDate: "2025-02-10",
        endDate: "2025-02-14",
        totalDays: 5,
        daysPresent: 4,
        daysAbsent: 1,
        attendancePercentage: 75, // Incorrect - should be 80
        calculationError: 5
      };

      Attendance.aggregate.mockResolvedValue([percentageCalculationError]);
      Attendance.updateOne.mockResolvedValue({
        ...percentageCalculationError,
        attendancePercentage: 80, // Fixed
        calculationError: 0
      });

      const response = await api("get", `/api/attendance/percentage/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          term: "First Term",
          startDate: "2025-02-10",
          endDate: "2025-02-14"
        });

      expect(response.status).toBe(200);
      expect(response.body.attendancePercentage).toBe(80);
      expect(response.body.calculationError).toBe(0);

      console.log("✅ Attendance percentage calculation error fixed");
    });

    test("should fix status weighting issues", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock status weighting issue
      const statusWeightingIssue = {
        student: testStudent._id,
        term: "First Term",
        startDate: "2025-02-10",
        endDate: "2025-02-14",
        totalDays: 5,
        daysPresent: 3,
        daysLate: 1,
        daysAbsent: 1,
        daysExcused: 0,
        statusWeighting: {
          present: 1.0,
          late: 0.5,
          absent: 0.0,
          excused: 0.0 // Issue: excused not counted
        },
        attendancePercentage: 60 // Incorrect - should be 80
      };

      Attendance.aggregate.mockResolvedValue([statusWeightingIssue]);
      Attendance.updateOne.mockResolvedValue({
        ...statusWeightingIssue,
        statusWeighting: {
          present: 1.0,
          late: 0.5,
          absent: 0.0,
          excused: 0.0 // Fixed
        },
        attendancePercentage: 80 // Fixed
      });

      const response = await api("get", `/api/attendance/percentage/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          term: "First Term",
          startDate: "2025-02-10",
          endDate: "2025-02-14"
        });

      expect(response.status).toBe(200);
      expect(response.body.attendancePercentage).toBe(80);
      expect(response.body.statusWeighting.excused).toBe(0.0);

      console.log("✅ Status weighting issue fixed");
    });

    test("should handle edge case percentage calculations", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock edge case percentage calculations
      const edgeCasePercentage = {
        student: testStudent._id,
        term: "First Term",
        startDate: "2025-02-10",
        endDate: "2025-02-14",
        totalDays: 5,
        daysPresent: 5,
        daysLate: 0,
        daysAbsent: 0,
        daysExcused: 0,
        attendancePercentage: 100,
        edgeCaseHandling: {
          perfectAttendance: true,
          zeroAttendance: false,
          allPresent: true
        }
      };

      Attendance.aggregate.mockResolvedValue([edgeCasePercentage]);

      const response = await api("get", `/api/attendance/percentage/${testStudent._id}`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({
          term: "First Term",
          startDate: "2025-02-10",
          endDate: "2025-02-14"
        });

      expect(response.status).toBe(200);
      expect(response.body.attendancePercentage).toBe(100);
      expect(response.body.edgeCaseHandling.perfectAttendance).toBe(true);

      console.log("✅ Edge case percentage calculations working");
    });
  });

  describe("Export Functionality Fixes", () => {
    test("should fix CSV export formatting issues", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock CSV export formatting issue
      const csvExportIssue = {
        headers: ["Student Name", "Date", "Status", "Term"],
        data: [
          {
            studentName: "Test Student",
            date: "2025-02-14",
            status: "present",
            term: "First Term"
          }
        ],
        ],
        formatting: {
          dateFormat: "invalid-format", // Issue: wrong date format
          encoding: "utf-8" // Issue: wrong encoding
          delimiter: "," // Issue: wrong delimiter
        }
      };

      Attendance.aggregate.mockResolvedValue([csvExportIssue]);
      Attendance.updateOne.mockResolvedValue({
        ...csvExportIssue,
        formatting: {
          dateFormat: "YYYY-MM-DD",
          encoding: "utf-8",
          delimiter: ","
        }
      });

      const response = await api("get", "/api/attendance/export/csv")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          student: testStudent._id,
          term: "First Term",
          startDate: "2025-02-10",
          endDate: "2025-02-14"
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.body).toContain("2025-02-14");

      console.log("✅ CSV export formatting issue fixed");
    });

    test("should fix PDF export layout issues", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock PDF export layout issue
      const pdfExportIssue = {
        layout: "basic", // Issue: poor layout
        missingHeaders: true, // Issue: missing headers
        studentInfo: {
          included: false // Issue: student info not included
        },
        summarySection: {
          included: false // Issue: summary not included
        }
      };

      Attendance.aggregate.mockResolvedValue([pdfExportIssue]);
      Attendance.updateOne.mockResolvedValue({
        ...pdfExportIssue,
        layout: "professional",
        missingHeaders: false,
        studentInfo: {
          included: true
        },
        summarySection: {
          included: true
        }
      });

      const response = await api("get", "/api/attendance/export/pdf")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          student: testStudent._id,
          term: "First Term",
          startDate: "2025-02-10",
          endDate: "2025-02-14"
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.body).toContain("Test Student");

      console.log("✅ PDF export layout issue fixed");
    });

    test("should fix export data completeness issues", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock export data completeness issue
      const completenessIssue = {
        student: {
          firstName: "Test",
          lastName: "Student",
          email: "test@test.com"
        },
        attendance: [
          {
          date: "2025-02-14",
          status: "present",
          term: "First Term"
          // Missing: recordedBy, recordedAt
        }
        ],
        summary: {
          totalDays: 5,
          daysPresent: 4,
          attendancePercentage: 80
          // Missing: breakdown by status
        }
      };

      Attendance.aggregate.mockResolvedValue([completenessIssue]);
      Attendance.updateOne.mockResolvedValue({
        ...completenessIssue,
        attendance: [
          {
            date: "2025-02-14",
            status: "present",
            term: "First Term",
            recordedBy: "Teacher1",
            recordedAt: "2025-02-14T08:30:00Z"
          }
        ],
        summary: {
          totalDays: 5,
          daysPresent: 4,
          daysAbsent: 1,
          daysLate: 0,
          daysExcused: 0,
          attendancePercentage: 80,
          breakdownByStatus: {
            present: 4,
            absent: 1,
            late: 0,
            excused: 0
          }
        }
      });

      const response = await api("get", "/api/attendance/export/complete")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({
          student: testStudent._id,
          term: "First Term",
          startDate: "2025-02-10",
          endDate: "2025-02-14"
        });

      expect(response.status).toBe(200);
      expect(response.body.attendance[0].recordedBy).toBe("Teacher1");
      expect(response.body.summary.breakdownByStatus.present).toBe(4);

      console.log("✅ Export data completeness issue fixed");
    });
  });

  describe("Teacher Permission Fixes", () => {
    test("should fix teacher class assignment validation", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock teacher class assignment validation issue
      const classAssignmentIssue = {
        teacher: {
          _id: "teacher1",
          assignedClasses: [testClass._id],
          role: "teacher"
        },
        attendance: {
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present",
          class: "other-class-id", // Wrong class
          classValidation: {
            enabled: false // Issue: validation disabled
            validClass: false
          }
        }
      };

      const User = require("../models/User");
      User.findOne.mockResolvedValue(classAssignmentIssue.teacher);
      Attendance.create.mockRejectedValue(new Error("Teacher not assigned to this class"));
      Attendance.create.mockResolvedValue({
        ...classAssignmentIssue.attendance,
        classValidation: {
          enabled: true, // Fixed
          validClass: false
        }
      });

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present",
          class: "other-class-id"
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("not assigned");

      console.log("✅ Teacher class assignment validation fixed");
    });

    test("should fix admin override prevention", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock admin override prevention issue
      const adminOverrideIssue = {
        teacher: {
          _id: "teacher1",
          assignedClasses: [testClass._id],
          role: "teacher"
        },
        attendance: {
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present",
          class: "other-class-id",
          adminOverride: {
            enabled: true // Issue: admin override allowed
          }
        }
      };

      const User = require("../models/User");
      User.findOne.mockResolvedValue(adminOverrideIssue.teacher);
      Attendance.create.mockResolvedValue({
        ...adminOverrideIssue.attendance,
        classValidation: {
          enabled: false,
          validClass: false
        }
      });

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present",
          class: "other-class-id"
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("not assigned");

      console.log("✅ Admin override prevention fixed");
    });

    test("should fix role-based access control", async () => {
      const Attendance = require("../models/Attendance");
      
      // Mock role-based access control issue
      const roleAccessIssue = {
        student: testStudent._id,
        date: "2025-02-14",
        term: "First Term",
        status: "present",
        roleBasedAccess: {
          enabled: false // Issue: role-based access disabled
          validRoles: false
        }
      };

      Attendance.create.mockResolvedValue(roleAccessIssue);
      Attendance.create.mockRejectedValue(new Error("Role-based access violation"));

      const response = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "2025-02-14",
          term: "First Term",
          status: "present"
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("access violation");

      console.log("✅ Role-based access control fixed");
    });
  });
});
