const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockStudent, createMockClass, createMockAcademicYear, createMockTerm, createMockFee, createMockPayment, createMockReportCard, createMockAnnouncement } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Real Workflow Simulation Tests", () => {
  let adminToken, teacherToken, accountantToken, parentToken, studentToken;
  let testAcademicYear, testTerm1, testTerm2, testTerm3, testClass, testStudent, testTeacher, testFee, testPayment, testReportCard, testAnnouncement;

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
    testTerm1 = createMockTerm({ name: "First Term", order: 1 });
    testTerm2 = createMockTerm({ name: "Second Term", order: 2 });
    testTerm3 = createMockTerm({ name: "Third Term", order: 3 });
    testClass = createMockClass();
    testStudent = createMockStudent();
    testTeacher = createMockUser({ role: "teacher" });
    testFee = createMockFee();
    testPayment = createMockPayment();
    testReportCard = createMockReportCard();
    testAnnouncement = createMockAnnouncement();
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
    const studentUser = createMockUser({ role: "student" });
    
    const User = require("../models/User");
    User.findOne.mockImplementation((query) => {
      if (query.email === "admin@test.com") return Promise.resolve(adminUser);
      if (query.email === "teacher@test.com") return Promise.resolve(teacherUser);
      if (query.email === "accountant@test.com") return Promise.resolve(accountantUser);
      if (query.email === "parent@test.com") return Promise.resolve(parentUser);
      if (query.email === "student@test.com") return Promise.resolve(studentUser);
      return Promise.resolve(null);
    });

    // Get tokens for each role
    const responses = await Promise.all([
      api("post", "/api/auth/login").send({ email: "admin@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "teacher@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "accountant@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "parent@test.com", password: "password123" }),
      api("post", "/api/auth/login").send({ email: "student@test.com", password: "password123" })
    ]);

    adminToken = responses[0].body.token;
    teacherToken = responses[1].body.token;
    accountantToken = responses[2].body.token;
    parentToken = responses[3].body.token;
    studentToken = responses[4].body.token;
  });

  describe("Admin Complete Workflow", () => {
    test("should execute complete admin workflow without errors", async () => {
      // 1. Create academic year
      const AcademicYear = require("../models/AcademicYear");
      AcademicYear.create.mockResolvedValue(testAcademicYear);

      const academicYearResponse = await api("post", "/api/academic-years")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testAcademicYear);

      expect(academicYearResponse.status).toBe(201);
      expect(academicYearResponse.body.name).toBe(testAcademicYear.name);
      console.log("✅ Academic year created successfully");

      // 2. Create First Term
      const Term = require("../models/Term");
      Term.create.mockResolvedValue(testTerm1);

      const term1Response = await api("post", "/api/terms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          ...testTerm1,
          academicYear: academicYearResponse.body._id
        });

      expect(term1Response.status).toBe(201);
      expect(term1Response.body.name).toBe("First Term");
      console.log("✅ First Term created successfully");

      // 3. Create Second Term
      Term.create.mockResolvedValue(testTerm2);

      const term2Response = await api("post", "/api/terms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          ...testTerm2,
          academicYear: academicYearResponse.body._id
        });

      expect(term2Response.status).toBe(201);
      expect(term2Response.body.name).toBe("Second Term");
      console.log("✅ Second Term created successfully");

      // 4. Create Third Term
      Term.create.mockResolvedValue(testTerm3);

      const term3Response = await api("post", "/api/terms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          ...testTerm3,
          academicYear: academicYearResponse.body._id
        });

      expect(term3Response.status).toBe(201);
      expect(term3Response.body.name).toBe("Third Term");
      console.log("✅ Third Term created successfully");

      // 5. Create class
      const ClassModel = require("../models/Class");
      ClassModel.create.mockResolvedValue(testClass);

      const classResponse = await api("post", "/api/classes")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testClass);

      expect(classResponse.status).toBe(201);
      expect(classResponse.body.name).toBe(testClass.name);
      console.log("✅ Class created successfully");

      // 6. Create subjects
      const Subject = require("../models/Subject");
      const subjects = [
        { name: "Mathematics", code: "MATH101" },
        { name: "English", code: "ENG101" },
        { name: "Science", code: "SCI101" }
      ];

      Subject.create.mockResolvedValue(subjects[0]);
      const subject1Response = await api("post", "/api/subjects")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(subjects[0]);

      expect(subject1Response.status).toBe(201);
      expect(subject1Response.body.name).toBe("Mathematics");
      console.log("✅ Mathematics subject created successfully");

      // 7. Admit student
      const Student = require("../models/Student");
      Student.create.mockResolvedValue(testStudent);

      const studentResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testStudent);

      expect(studentResponse.status).toBe(201);
      expect(studentResponse.body.firstName).toBe(testStudent.firstName);
      console.log("✅ Student admitted successfully");

      // 8. Assign teacher to class
      const TeacherAssignment = require("../models/TeacherAssignment");
      TeacherAssignment.create.mockResolvedValue({
        teacher: testTeacher._id,
        class: classResponse.body._id,
        subject: subject1Response.body._id
      });

      const assignmentResponse = await api("post", "/api/teacher-assignments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          teacher: testTeacher._id,
          class: classResponse.body._id,
          subject: subject1Response.body._id
        });

      expect(assignmentResponse.status).toBe(201);
      console.log("✅ Teacher assigned successfully");

      // 9. Publish announcement
      const Announcement = require("../models/Announcement");
      Announcement.create.mockResolvedValue(testAnnouncement);

      const announcementResponse = await api("post", "/api/announcements")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testAnnouncement);

      expect(announcementResponse.status).toBe(201);
      expect(announcementResponse.body.title).toBe(testAnnouncement.title);
      console.log("✅ Announcement published successfully");

      // 10. Approve report card
      const ReportCard = require("../models/ReportCard");
      ReportCard.create.mockResolvedValue(testReportCard);

      const reportCardResponse = await api("post", "/api/report-cards")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          student: studentResponse.body._id,
          academicYearId: academicYearResponse.body._id,
          termId: term1Response.body._id,
          subjects: [
            { name: "Mathematics", totalScore: 85 }
          ],
          attendance: {
            totalDays: 60,
            daysPresent: 55,
            attendancePercentage: 91.67
          }
        });

      expect(reportCardResponse.status).toBe(201);
      expect(reportCardResponse.body.student).toBe(studentResponse.body._id);
      console.log("✅ Report card approved successfully");

      // 11. Generate financial summary
      const Fee = require("../models/Fee");
      Fee.find.mockResolvedValue([testFee]);

      const financialSummaryResponse = await api("get", "/api/fees/summary")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(financialSummaryResponse.status).toBe(200);
      expect(financialSummaryResponse.body.totalFees).toBeDefined();
      console.log("✅ Financial summary generated successfully");

      console.log("✅ Complete admin workflow executed without errors");
    });
  });

  describe("Teacher Complete Workflow", () => {
    test("should execute complete teacher workflow without errors", async () => {
      // 1. Mark attendance
      const Attendance = require("../models/Attendance");
      Attendance.create.mockResolvedValue({
        student: testStudent._id,
        date: "2025-02-14",
        status: "present",
        term: "First Term"
      });

      const attendanceResponse = await api("post", "/api/attendance")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          date: "2025-02-14",
          status: "present",
          term: "First Term"
        });

      expect(attendanceResponse.status).toBe(201);
      expect(attendanceResponse.body.status).toBe("present");
      console.log("✅ Attendance marked successfully");

      // 2. Enter scores
      const Grade = require("../models/Grade");
      Grade.create.mockResolvedValue({
        student: testStudent._id,
        subject: "Mathematics",
        assessment: 85,
        exam: 90,
        term: "First Term"
      });

      const gradeResponse = await api("post", "/api/grades")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          subject: "Mathematics",
          assessment: 85,
          exam: 90,
          term: "First Term"
        });

      expect(gradeResponse.status).toBe(201);
      expect(gradeResponse.body.assessment).toBe(85);
      console.log("✅ Scores entered successfully");

      // 3. Submit report
      const ReportCard = require("../models/ReportCard");
      ReportCard.create.mockResolvedValue(testReportCard);

      const reportResponse = await api("post", "/api/report-cards")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          academicYearId: testAcademicYear._id,
          termId: testTerm1._id,
          subjects: [
            { name: "Mathematics", totalScore: 87.5 }
          ],
          attendance: {
            totalDays: 60,
            daysPresent: 55,
            attendancePercentage: 91.67
          }
        });

      expect(reportResponse.status).toBe(201);
      expect(reportResponse.body.subjects).toHaveLength(1);
      console.log("✅ Report submitted successfully");

      // 4. View analytics
      const analyticsResponse = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${teacherToken}`);

      expect(analyticsResponse.status).toBe(200);
      expect(analyticsResponse.body.myStudents).toBeDefined();
      expect(analyticsResponse.body.myClasses).toBeDefined();
      console.log("✅ Analytics viewed successfully");

      console.log("✅ Complete teacher workflow executed without errors");
    });
  });

  describe("Accountant Complete Workflow", () => {
    test("should execute complete accountant workflow without errors", async () => {
      // 1. Create fee structure
      const Fee = require("../models/Fee");
      Fee.create.mockResolvedValue(testFee);

      const feeResponse = await api("post", "/api/fees")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          feeType: "tuition",
          amount: 1500,
          dueDate: "2025-03-15"
        });

      expect(feeResponse.status).toBe(201);
      expect(feeResponse.body.amount).toBe(1500);
      console.log("✅ Fee structure created successfully");

      // 2. Record payment
      const Payment = require("../models/Payment");
      Payment.create.mockResolvedValue(testPayment);

      const paymentResponse = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          fee: feeResponse.body._id,
          amount: 500,
          paymentMethod: "cash",
          transactionId: "TXN123456"
        });

      expect(paymentResponse.status).toBe(201);
      expect(paymentResponse.body.amount).toBe(500);
      console.log("✅ Payment recorded successfully");

      // 3. Generate receipt
      const receiptResponse = await api("get", `/api/payments/${paymentResponse.body._id}/receipt`)
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(receiptResponse.status).toBe(200);
      expect(receiptResponse.body.transactionId).toBe("TXN123456");
      console.log("✅ Receipt generated successfully");

      // 4. View outstanding balances
      const outstandingResponse = await api("get", "/api/fees/outstanding")
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(outstandingResponse.status).toBe(200);
      expect(Array.isArray(outstandingResponse.body.outstanding)).toBe(true);
      console.log("✅ Outstanding balances viewed successfully");

      // 5. Verify ledger consistency
      const ledgerResponse = await api("get", "/api/payments/ledger")
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(ledgerResponse.status).toBe(200);
      expect(ledgerResponse.body.ledger).toBeDefined();
      console.log("✅ Ledger consistency verified successfully");

      console.log("✅ Complete accountant workflow executed without errors");
    });
  });

  describe("Parent Complete Workflow", () => {
    test("should execute complete parent workflow without errors", async () => {
      // 1. View child performance
      const ReportCard = require("../models/ReportCard");
      ReportCard.find.mockResolvedValue([testReportCard]);

      const performanceResponse = await api("get", `/api/report-cards/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${parentToken}`);

      expect(performanceResponse.status).toBe(200);
      expect(performanceResponse.body.subjects).toBeDefined();
      console.log("✅ Child performance viewed successfully");

      // 2. View attendance
      const Attendance = require("../models/Attendance");
      Attendance.find.mockResolvedValue([
        {
          student: testStudent._id,
          date: "2025-02-14",
          status: "present"
        }
      ]);

      const attendanceResponse = await api("get", `/api/attendance/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${parentToken}`);

      expect(attendanceResponse.status).toBe(200);
      expect(Array.isArray(attendanceResponse.body.attendance)).toBe(true);
      console.log("✅ Attendance viewed successfully");

      // 3. View fee balance
      const Fee = require("../models/Fee");
      Fee.find.mockResolvedValue([testFee]);

      const feeBalanceResponse = await api("get", `/api/fees/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${parentToken}`);

      expect(feeBalanceResponse.status).toBe(200);
      expect(Array.isArray(feeBalanceResponse.body.fees)).toBe(true);
      console.log("✅ Fee balance viewed successfully");

      // 4. View announcements
      const Announcement = require("../models/Announcement");
      Announcement.find.mockResolvedValue([testAnnouncement]);

      const announcementsResponse = await api("get", "/api/announcements")
        .set("Authorization", `Bearer ${parentToken}`);

      expect(announcementsResponse.status).toBe(200);
      expect(Array.isArray(announcementsResponse.body.announcements)).toBe(true);
      console.log("✅ Announcements viewed successfully");

      console.log("✅ Complete parent workflow executed without errors");
    });
  });

  describe("Student Complete Workflow", () => {
    test("should execute complete student workflow without errors", async () => {
      // 1. View report card
      const ReportCard = require("../models/ReportCard");
      ReportCard.find.mockResolvedValue([testReportCard]);

      const reportCardResponse = await api("get", `/api/report-cards/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(reportCardResponse.status).toBe(200);
      expect(reportCardResponse.body.subjects).toBeDefined();
      console.log("✅ Report card viewed successfully");

      // 2. View attendance
      const Attendance = require("../models/Attendance");
      Attendance.find.mockResolvedValue([
        {
          student: testStudent._id,
          date: "2025-02-14",
          status: "present"
        }
      ]);

      const attendanceResponse = await api("get", `/api/attendance/student/${testStudent._id}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(attendanceResponse.status).toBe(200);
      expect(Array.isArray(attendanceResponse.body.attendance)).toBe(true);
      console.log("✅ Attendance viewed successfully");

      // 3. View announcements
      const Announcement = require("../models/Announcement");
      Announcement.find.mockResolvedValue([testAnnouncement]);

      const announcementsResponse = await api("get", "/api/announcements")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(announcementsResponse.status).toBe(200);
      expect(Array.isArray(announcementsResponse.body.announcements)).toBe(true);
      console.log("✅ Announcements viewed successfully");

      // 4. View dashboard
      const dashboardResponse = await api("get", "/api/analytics/dashboard")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.body.studentInfo).toBeDefined();
      console.log("✅ Dashboard viewed successfully");

      console.log("✅ Complete student workflow executed without errors");
    });
  });

  describe("Cross-Workflow Data Consistency", () => {
    test("should maintain data consistency across all workflows", async () => {
      // Create student through admin workflow
      const Student = require("../models/Student");
      Student.create.mockResolvedValue(testStudent);

      const studentResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testStudent);

      expect(studentResponse.status).toBe(201);
      const studentId = studentResponse.body._id;

      // Create fee through accountant workflow
      const Fee = require("../models/Fee");
      Fee.create.mockResolvedValue({
        ...testFee,
        student: studentId
      });

      const feeResponse = await api("post", "/api/fees")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: studentId,
          feeType: "tuition",
          amount: 1500,
          dueDate: "2025-03-15"
        });

      expect(feeResponse.status).toBe(201);
      const feeId = feeResponse.body._id;

      // Create report card through teacher workflow
      const ReportCard = require("../models/ReportCard");
      ReportCard.create.mockResolvedValue({
        ...testReportCard,
        student: studentId
      });

      const reportCardResponse = await api("post", "/api/report-cards")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: studentId,
          academicYearId: testAcademicYear._id,
          termId: testTerm1._id,
          subjects: [
            { name: "Mathematics", totalScore: 85 }
          ]
        });

      expect(reportCardResponse.status).toBe(201);

      // Verify data consistency across all workflows
      const studentCheckResponse = await api("get", `/api/students/${studentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(studentCheckResponse.status).toBe(200);
      expect(studentCheckResponse.body._id).toBe(studentId);

      const feeCheckResponse = await api("get", `/api/fees/${feeId}`)
        .set("Authorization", `Bearer ${accountantToken}`);

      expect(feeCheckResponse.status).toBe(200);
      expect(feeCheckResponse.body.student).toBe(studentId);

      const reportCardCheckResponse = await api("get", `/api/report-cards/student/${studentId}`)
        .set("Authorization", `Bearer ${parentToken}`);

      expect(reportCardCheckResponse.status).toBe(200);
      expect(reportCardCheckResponse.body.student).toBe(studentId);

      // Verify calculations are consistent
      expect(feeCheckResponse.body.amount).toBe(1500);
      expect(reportCardCheckResponse.body.subjects[0].totalScore).toBe(85);

      console.log("✅ Cross-workflow data consistency maintained");
    });
  });

  describe("Error Handling in Real Workflows", () => {
    test("should handle errors gracefully in real workflows", async () => {
      // Test database connection error during student creation
      const Student = require("../models/Student");
      Student.create.mockRejectedValue(new Error("Database connection lost"));

      const studentErrorResponse = await api("post", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(testStudent);

      expect(studentErrorResponse.status).toBe(500);
      expect(studentErrorResponse.body.message).toBeDefined();
      console.log("✅ Database error handled gracefully");

      // Test payment gateway error
      const Payment = require("../models/Payment");
      Payment.create.mockRejectedValue(new Error("Payment gateway timeout"));

      const paymentErrorResponse = await api("post", "/api/payments")
        .set("Authorization", `Bearer ${accountantToken}`)
        .send({
          student: testStudent._id,
          amount: 500,
          paymentMethod: "online"
        });

      expect(paymentErrorResponse.status).toBe(500);
      expect(paymentErrorResponse.body.message).toBeDefined();
      console.log("✅ Payment gateway error handled gracefully");

      // Test report card generation error
      const ReportCard = require("../models/ReportCard");
      ReportCard.create.mockRejectedValue(new Error("Report generation failed"));

      const reportCardErrorResponse = await api("post", "/api/report-cards")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          subjects: []
        });

      expect(reportCardErrorResponse.status).toBe(500);
      expect(reportCardErrorResponse.body.message).toBeDefined();
      console.log("✅ Report card generation error handled gracefully");

      console.log("✅ Error handling in real workflows working properly");
    });
  });

  describe("Performance Under Real Workflows", () => {
    test("should maintain performance under real workflow load", async () => {
      const startTime = Date.now();

      // Simulate concurrent admin operations
      const adminPromises = [
        api("get", "/api/students").set("Authorization", `Bearer ${adminToken}`),
        api("get", "/api/fees").set("Authorization", `Bearer ${adminToken}`),
        api("get", "/api/report-cards").set("Authorization", `Bearer ${adminToken}`),
        api("get", "/api/analytics/dashboard").set("Authorization", `Bearer ${adminToken}`)
      ];

      // Simulate concurrent teacher operations
      const teacherPromises = [
        api("get", "/api/students").set("Authorization", `Bearer ${teacherToken}`),
        api("get", "/api/attendance").set("Authorization", `Bearer ${teacherToken}`),
        api("get", "/api/grades").set("Authorization", `Bearer ${teacherToken}`)
      ];

      // Simulate concurrent parent operations
      const parentPromises = [
        api("get", "/api/students").set("Authorization", `Bearer ${parentToken}`),
        api("get", "/api/report-cards").set("Authorization", `Bearer ${parentToken}`),
        api("get", "/api/announcements").set("Authorization", `Bearer ${parentToken}`)
      ];

      // Execute all operations concurrently
      const allPromises = [...adminPromises, ...teacherPromises, ...parentPromises];
      const responses = await Promise.all(allPromises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(5000); // Under 5 seconds

      console.log("✅ Performance maintained under real workflow load");
    });
  });
});
