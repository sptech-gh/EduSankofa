const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const SchoolConfig = require("../models/SchoolConfig");
const GradingSystem = require("../models/GradingSystem");
const GhanaClass = require("../models/GhanaClass");
const GhanaSubject = require("../models/GhanaSubject");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const User = require("../models/User");

describe("School Setup Module", () => {
  let adminToken;
  let academicYear;
  let term;

  beforeEach(async () => {
    // Clean up before each test
    await SchoolConfig.deleteMany({});
    await GradingSystem.deleteMany({});
    await GhanaClass.deleteMany({});
    await GhanaSubject.deleteMany({});
    await AcademicYear.deleteMany({});
    await Term.deleteMany({});
    await User.deleteMany({});

    // Create admin user
    const admin = new User({
      firstName: "Admin",
      lastName: "User",
      email: "admin@test.com",
      password: "password123",
      role: "admin",
    });
    await admin.save();

    // Login to get token
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin@test.com",
        password: "password123",
      });

    adminToken = loginResponse.body.token;

    // Create academic year and term
    academicYear = new AcademicYear({
      name: "2025/2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-07-31"),
      isActive: true,
    });
    await academicYear.save();

    term = new Term({
      academicYear: academicYear._id,
      name: "First Term",
      order: 1,
      legacySemester: "Fall",
      isActive: true,
    });
    await term.save();
  });

  describe("School Configuration", () => {
    test("POST /api/school-setup/config - should create school configuration", async () => {
      const schoolConfig = {
        schoolName: "EduSankofa Basic School",
        schoolCode: "EDU001",
        address: {
          street: "123 Education Street",
          city: "Accra",
          region: "Greater Accra",
          country: "Ghana",
          postalCode: "00233",
        },
        contact: {
          phone: "+233241234567",
          email: "info@edusankofa.edu.gh",
          website: "www.edusankofa.edu.gh",
        },
        establishment: new Date("2010-01-15"),
        schoolType: "Private",
        educationLevel: "Basic (Creche-JHS)",
      };

      const response = await request(app)
        .post("/api/school-setup/config")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(schoolConfig)
        .expect(201);

      expect(response.body.schoolName).toBe(schoolConfig.schoolName);
      expect(response.body.schoolCode).toBe(schoolConfig.schoolCode);
      expect(response.body.address.city).toBe(schoolConfig.address.city);
      expect(response.body.contact.email).toBe(schoolConfig.contact.email);
    });

    test("GET /api/school-setup/config - should get school configuration", async () => {
      // First create a config
      const config = new SchoolConfig({
        schoolName: "Test School",
        schoolCode: "TEST001",
        address: { city: "Accra", region: "Greater Accra" },
        contact: { phone: "+233241234567", email: "test@test.com" },
        establishment: new Date("2010-01-15"),
        schoolType: "Private",
      });
      await config.save();

      const response = await request(app)
        .get("/api/school-setup/config")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.schoolName).toBe("Test School");
      expect(response.body.schoolCode).toBe("TEST001");
    });

    test("POST /api/school-setup/config - should validate required fields", async () => {
      const response = await request(app)
        .post("/api/school-setup/config")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some(e => e.msg === "School name is required")).toBe(true);
    });
  });

  describe("Grading System", () => {
    test("POST /api/school-setup/grading-systems/ghanaian - should create Ghanaian grading system", async () => {
      const response = await request(app)
        .post("/api/school-setup/grading-systems/ghanaian")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(201);

      expect(response.body.systemType).toBe("Ghana Basic");
      expect(response.body.gradeBands).toHaveLength(9);
      expect(response.body.gradeBands[0].grade).toBe("A");
      expect(response.body.gradeBands[0].scoreRange.min).toBe(80);
      expect(response.body.gradeBands[0].scoreRange.max).toBe(100);
      expect(response.body.assessmentWeights.classAssessment).toBe(30);
      expect(response.body.assessmentWeights.exams).toBe(40);
    });

    test("GET /api/school-setup/grading-systems - should get all grading systems", async () => {
      // Create a grading system first
      await request(app)
        .post("/api/school-setup/grading-systems/ghanaian")
        .set("Authorization", `Bearer ${adminToken}`);

      const response = await request(app)
        .get("/api/school-setup/grading-systems")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test("POST /api/school-setup/grading-systems/ghanaian - should prevent duplicate creation", async () => {
      // Create first system
      await request(app)
        .post("/api/school-setup/grading-systems/ghanaian")
        .set("Authorization", `Bearer ${adminToken}`);

      // Try to create second system
      const response = await request(app)
        .post("/api/school-setup/grading-systems/ghanaian")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.message).toBe("Ghanaian grading system already exists");
    });
  });

  describe("Class Structure", () => {
    test("GET /api/school-setup/class-levels - should get Ghanaian class levels", async () => {
      const response = await request(app)
        .get("/api/school-setup/class-levels")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(14); // Creche to JHS 3
      expect(response.body[0].name).toBe("Creche");
      expect(response.body[0].ageRange).toBe("3-4");
      expect(response.body[13].name).toBe("JHS 3");
      expect(response.body[13].ageRange).toBe("16-17");
    });

    test("POST /api/school-setup/classes/create-all - should create all classes", async () => {
      const response = await request(app)
        .post("/api/school-setup/classes/create-all")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          academicYear: academicYear._id,
          term: term._id,
          sections: ["A", "B"],
          capacity: 30,
        })
        .expect(201);

      expect(response.body.length).toBe(28); // 14 levels × 2 sections
      expect(response.body[0].level).toBe("Creche");
      expect(response.body[0].section).toBe("A");
      expect(response.body[0].capacity).toBe(30);
    });

    test("POST /api/school-setup/classes - should create single class", async () => {
      const classData = {
        name: "Primary 1 A",
        level: "Primary 1",
        section: "A",
        academicYear: academicYear._id,
        term: term._id,
        capacity: 25,
      };

      const response = await request(app)
        .post("/api/school-setup/classes")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(classData)
        .expect(201);

      expect(response.body.name).toBe(classData.name);
      expect(response.body.level).toBe(classData.level);
      expect(response.body.section).toBe(classData.section);
      expect(response.body.capacity).toBe(classData.capacity);
    });

    test("GET /api/school-setup/classes - should get classes with filters", async () => {
      // Create some classes first
      await request(app)
        .post("/api/school-setup/classes/create-all")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          academicYear: academicYear._id,
          term: term._id,
          sections: ["A"],
        });

      const response = await request(app)
        .get("/api/school-setup/classes")
        .query({ academicYear: academicYear._id, level: "Primary 1" })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every(cls => cls.level === "Primary 1")).toBe(true);
    });

    test("POST /api/school-setup/classes - should validate class data", async () => {
      const response = await request(app)
        .post("/api/school-setup/classes")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Invalid Class",
          level: "Invalid Level",
          section: "Z", // Invalid section
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe("Subject Management", () => {
    test("GET /api/school-setup/subjects/curriculum - should get Ghanaian curriculum", async () => {
      const response = await request(app)
        .get("/api/school-setup/subjects/curriculum")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body["Creche"]).toBeDefined();
      expect(response.body["JHS 3"]).toBeDefined();
      expect(Array.isArray(response.body["Primary 1"])).toBe(true);
      expect(response.body["Primary 1"]).toContain("English Language");
      expect(response.body["Primary 1"]).toContain("Mathematics");
    });

    test("POST /api/school-setup/subjects/create-all - should create subjects for all levels", async () => {
      const response = await request(app)
        .post("/api/school-setup/subjects/create-all")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          academicYear: academicYear._id,
          term: term._id,
        })
        .expect(201);

      expect(response.body.subjects.length).toBeGreaterThan(0);
      expect(response.body.message).toBe("Subjects created successfully");
    });

    test("GET /api/school-setup/subjects - should get subjects with filters", async () => {
      // Create subjects first
      await request(app)
        .post("/api/school-setup/subjects/create-all")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          academicYear: academicYear._id,
          term: term._id,
        });

      const response = await request(app)
        .get("/api/school-setup/subjects")
        .query({ academicYear: academicYear._id, category: "Core" })
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0].category).toBe("Core");
      }
    });
  });

  describe("Role-Based Access Control", () => {
    let teacherToken;

    beforeEach(async () => {
      // Create teacher user
      const teacher = new User({
        firstName: "Teacher",
        lastName: "User",
        email: "teacher@test.com",
        password: "password123",
        role: "teacher",
      });
      await teacher.save();

      // Login to get token
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: "teacher@test.com",
          password: "password123",
        });

      teacherToken = loginResponse.body.token;
    });

    test("Teacher should not access school configuration", async () => {
      await request(app)
        .post("/api/school-setup/config")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          schoolName: "Test School",
          schoolCode: "TEST001",
        })
        .expect(403);
    });

    test("Teacher should not create grading systems", async () => {
      await request(app)
        .post("/api/school-setup/grading-systems/ghanaian")
        .set("Authorization", `Bearer ${teacherToken}`)
        .expect(403);
    });

    test("Teacher should not create classes", async () => {
      await request(app)
        .post("/api/school-setup/classes")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({
          name: "Test Class",
          level: "Primary 1",
          section: "A",
        })
        .expect(403);
    });

    test("Teacher can view class levels and curriculum", async () => {
      await request(app)
        .get("/api/school-setup/class-levels")
        .set("Authorization", `Bearer ${teacherToken}`)
        .expect(200);

      await request(app)
        .get("/api/school-setup/subjects/curriculum")
        .set("Authorization", `Bearer ${teacherToken}`)
        .expect(200);
    });
  });

  describe("Data Validation", () => {
    test("Should validate academic year format", async () => {
      const response = await request(app)
        .post("/api/academic-years")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "2025-2026", // Wrong format
        })
        .expect(400);

      expect(response.body.errors.some(e => e.msg.includes("YYYY/YYYY"))).toBe(true);
    });

    test("Should validate email format in school config", async () => {
      const response = await request(app)
        .post("/api/school-setup/config")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          schoolName: "Test School",
          schoolCode: "TEST001",
          address: { city: "Accra", region: "Greater Accra" },
          contact: { phone: "+233241234567", email: "invalid-email" },
          establishment: new Date("2010-01-15"),
          schoolType: "Private",
        })
        .expect(400);

      expect(response.body.errors.some(e => e.msg.includes("Valid email"))).toBe(true);
    });

    test("Should validate class capacity limits", async () => {
      const response = await request(app)
        .post("/api/school-setup/classes")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Class",
          level: "Primary 1",
          section: "A",
          academicYear: academicYear._id,
          term: term._id,
          capacity: 100, // Over maximum
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });
});
