const request = require("supertest");
const app = require("../server");
const { createMockUser, createMockAcademicYear, createMockTerm } = require("./setup-mock");

let server;
const sockets = new Set();

const api = (method, path) =>
  request(server)[method](path).set("Connection", "close");

describe("Term Isolation Tests", () => {
  let adminToken;
  let testAcademicYear, testTerm1, testTerm2, testTerm3;

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

    // Create test data
    testAcademicYear = createMockAcademicYear();
    testTerm1 = createMockTerm({ name: "First Term", order: 1 });
    testTerm2 = createMockTerm({ name: "Second Term", order: 2 });
    testTerm3 = createMockTerm({ name: "Third Term", order: 3 });
  });

  afterAll(async () => {
    for (const socket of sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database models
    const AcademicYear = require("../models/AcademicYear");
    const Term = require("../models/Term");
    
    AcademicYear.findOne.mockResolvedValue(testAcademicYear);
    Term.findOne.mockImplementation((query) => {
      if (query._id === testTerm1._id) return Promise.resolve(testTerm1);
      if (query._id === testTerm2._id) return Promise.resolve(testTerm2);
      if (query._id === testTerm3._id) return Promise.resolve(testTerm3);
      return Promise.resolve(null);
    });
  });

  describe("First Term Isolation", () => {
    test("should isolate First Term data properly", async () => {
      // Create data specific to First Term
      const Student = require("../models/Student");
      const firstTermStudent = {
        firstName: "FirstTerm",
        lastName: "Student",
        email: "firstterm@test.com",
        term: "First Term"
      };
      Student.find.mockResolvedValue([firstTermStudent]);

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ term: "First Term", academicYear: testAcademicYear._id });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].term).toBe("First Term");

      // Verify no data leakage to other terms
      const secondTermResponse = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ term: "Second Term", academicYear: testAcademicYear._id });

      expect(secondTermResponse.status).toBe(200);
      expect(secondTermResponse.body).toHaveLength(0);

      console.log("✅ First Term isolation working correctly");
    });
  });

  describe("Second Term Isolation", () => {
    test("should isolate Second Term data properly", async () => {
      // Create data specific to Second Term
      const Student = require("../models/Student");
      const secondTermStudent = {
        firstName: "SecondTerm",
        lastName: "Student",
        email: "secondterm@test.com",
        term: "Second Term"
      };
      Student.find.mockResolvedValue([secondTermStudent]);

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ term: "Second Term", academicYear: testAcademicYear._id });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].term).toBe("Second Term");

      // Verify no data leakage to other terms
      const firstTermResponse = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ term: "First Term", academicYear: testAcademicYear._id });

      expect(firstTermResponse.status).toBe(200);
      expect(firstTermResponse.body).toHaveLength(0);

      console.log("✅ Second Term isolation working correctly");
    });
  });

  describe("Third Term Isolation", () => {
    test("should isolate Third Term data properly", async () => {
      // Create data specific to Third Term
      const Student = require("../models/Student");
      const thirdTermStudent = {
        firstName: "ThirdTerm",
        lastName: "Student",
        email: "thirdterm@test.com",
        term: "Third Term"
      };
      Student.find.mockResolvedValue([thirdTermStudent]);

      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ term: "Third Term", academicYear: testAcademicYear._id });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].term).toBe("Third Term");

      // Verify no data leakage to other terms
      const firstTermResponse = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ term: "First Term", academicYear: testAcademicYear._id });

      expect(firstTermResponse.status).toBe(200);
      expect(firstTermResponse.body).toHaveLength(0);

      console.log("✅ Third Term isolation working correctly");
    });
  });

  describe("Cross-Academic Year Isolation", () => {
    test("should isolate data between academic years", async () => {
      // Create student for 2024-2025
      const Student = require("../models/Student");
      const student2024 = {
        firstName: "Student2024",
        lastName: "Test",
        email: "student2024@test.com",
        academicYear: "2024-2025"
      };
      Student.find.mockImplementation((query) => {
        if (query.academicYear === "2024-2025") {
          return Promise.resolve([student2024]);
        }
        return Promise.resolve([]);
      });

      const response2024 = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ academicYear: "2024-2025" });

      expect(response2024.status).toBe(200);
      expect(response2024.body).toHaveLength(1);
      expect(response2024.body[0].academicYear).toBe("2024-2025");

      // Verify no data leakage to 2025-2026
      const response2025 = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ academicYear: "2025-2026" });

      expect(response2025.status).toBe(200);
      expect(response2025.body).toHaveLength(0);

      console.log("✅ Cross-academic year isolation working correctly");
    });
  });

  describe("Term Access Control", () => {
    test("should prevent access to inactive terms", async () => {
      // Create inactive term
      const Term = require("../models/Term");
      const inactiveTerm = {
        ...testTerm1,
        isActive: false
      };
      Term.findOne.mockImplementation((query) => {
        if (query._id === testTerm1._id) {
          return Promise.resolve(inactiveTerm);
        }
        return Promise.resolve(null);
      });

      // Try to access data for inactive term
      const response = await api("get", "/api/students")
        .set("Authorization", `Bearer ${adminToken}`)
        .query({ term: "First Term", academicYear: testAcademicYear._id });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("inactive");

      console.log("✅ Inactive term access control working");
    });
  });

  describe("Term Data Integrity", () => {
    test("should maintain term order consistency", async () => {
      // Try to create term with duplicate order
      const Term = require("../models/Term");
      const duplicateOrderTerm = {
        ...testTerm2,
        order: 1 // Duplicate - First Term already has order 1
      };
      Term.findOne.mockImplementation((query) => {
        if (query.academicYear === testAcademicYear._id && query.order === 1) {
          return Promise.resolve(testTerm1);
        }
        return Promise.resolve(null);
      });

      const createResponse = await api("post", "/api/terms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(duplicateOrderTerm);

      expect(createResponse.status).toBe(400);
      expect(createResponse.body.errors).toBeDefined();

      console.log("✅ Term order consistency maintained");
    });

    test("should prevent duplicate term names within academic year", async () => {
      // Try to create duplicate term
      const Term = require("../models/Term");
      Term.findOne.mockImplementation((query) => {
        if (query.academicYear === testAcademicYear._id && query.name === "First Term") {
          return Promise.resolve(testTerm1);
        }
        return Promise.resolve(null);
      });

      const duplicateTerm = {
        ...testTerm1,
        _id: "differentId"
      };

      const createResponse = await api("post", "/api/terms")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(duplicateTerm);

      expect(createResponse.status).toBe(400);
      expect(createResponse.body.errors).toBeDefined();

      console.log("✅ Duplicate term prevention working");
    });
  });

  describe("Concurrent Term Operations", () => {
    test("should handle concurrent term operations safely", async () => {
      // Create multiple terms concurrently
      const Term = require("../models/Term");
      Term.find.mockResolvedValue([testTerm1, testTerm2, testTerm3]);
      Term.create.mockResolvedValue(testTerm1);

      const promises = [
        api("get", "/api/terms")
          .set("Authorization", `Bearer ${adminToken}`)
          .query({ academicYear: testAcademicYear._id }),
        api("post", "/api/terms")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            academicYear: testAcademicYear._id,
            name: "New Term",
            order: 4
          })
      ];

      const responses = await Promise.all(promises);

      expect(responses[0].status).toBe(200);
      expect(responses[0].body).toHaveLength(3);
      expect(responses[1].status).toBe(201);

      console.log("✅ Concurrent term operations handled safely");
    });
  });
});
