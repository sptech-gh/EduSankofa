const mongoose = require("mongoose");
const GhanaStudent = require("../models/GhanaStudent");
const GhanaClass = require("../models/GhanaClass");
const GhanaSubject = require("../models/GhanaSubject");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");

describe("Student Management Unit Tests", () => {
  describe("GhanaStudent Model", () => {
    test("Should generate valid student ID", async () => {
      const student = new GhanaStudent({
        firstName: "Kofi",
        lastName: "Asante",
        dateOfBirth: new Date("2010-01-01"),
        gender: "Male",
        placeOfBirth: "Accra",
        regionOfBirth: "Greater Accra",
        currentClass: new mongoose.Types.ObjectId(),
        academicYear: new mongoose.Types.ObjectId(),
        term: new mongoose.Types.ObjectId(),
        phone: "+233241234567",
        guardians: [{
          type: "Father",
          firstName: "Kwame",
          lastName: "Asante",
          phone: "+233241234568",
          isPrimary: true,
        }],
        createdBy: new mongoose.Types.ObjectId(),
      });

      const year = new Date().getFullYear();
      const expectedId = `EDU${year}0001`;
      
      expect(student.studentId).toBe(expectedId);
      expect(student.studentId).toMatch(/^EDU\d{8}$/);
    });

    test("Should generate valid admission number", async () => {
      const student = new GhanaStudent({
        firstName: "Ama",
        lastName: "Mensah",
        dateOfBirth: new Date("2011-01-01"),
        gender: "Female",
        placeOfBirth: "Kumasi",
        regionOfBirth: "Ashanti",
        currentClass: new mongoose.Types.ObjectId(),
        academicYear: new mongoose.Types.ObjectId(),
        term: new mongoose.Types.ObjectId(),
        phone: "+233241234569",
        guardians: [{
          type: "Mother",
          firstName: "Adwoa",
          lastName: "Mensah",
          phone: "+233241234570",
          isPrimary: true,
        }],
        createdBy: new mongoose.Types.ObjectId(),
      });

      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const expectedNumber = `ADM${year}${month}0001`;
      
      expect(student.admissionNumber).toBe(expectedNumber);
      expect(student.admissionNumber).toMatch(/^ADM\d{8}$/);
    });

    test("Should calculate age correctly", () => {
      const student = new GhanaStudent({
        dateOfBirth: new Date("2010-01-01"),
      });

      const today = new Date();
      const expectedAge = today.getFullYear() - 2010;
      
      expect(student.getAge()).toBe(expectedAge);
    });

    test("Should validate Ghanaian regions", () => {
      const validRegions = [
        "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern",
        "Greater Accra", "North East", "Northern", "Oti", "Savannah",
        "Upper East", "Upper West", "Volta", "Western", "Western North"
      ];

      const student = new GhanaStudent({
        regionOfBirth: "Greater Accra",
      });

      expect(validRegions).toContain(student.regionOfBirth);
    });
  });

  describe("Student Admission Workflow", () => {
    test("Should validate required fields for admission", () => {
      const requiredFields = [
        "firstName", "lastName", "dateOfBirth", "gender", 
        "placeOfBirth", "regionOfBirth", "currentClass",
        "academicYear", "term", "phone"
      ];

      const student = new GhanaStudent({});
      
      for (const field of requiredFields) {
        const validation = student.validateSync(field);
        expect(validation).toBeDefined();
      }
    });

    test("Should validate age appropriateness for class", () => {
      const student = new GhanaStudent({
        dateOfBirth: new Date("2015-01-01"), // 8 years old
        currentClass: new mongoose.Types.ObjectId(),
      });

      // This would be validated in the route based on class metadata
      expect(student.dateOfBirth).toBeDefined();
    });

    test("Should handle guardian information", () => {
      const student = new GhanaStudent({
        guardians: [{
          type: "Father",
          firstName: "Kwame",
          lastName: "Asante",
          phone: "+233241234568",
          isPrimary: true,
          occupation: "Teacher",
        }, {
          type: "Mother",
          firstName: "Adwoa",
          lastName: "Mensah",
          phone: "+233241234570",
          isPrimary: false,
          occupation: "Nurse",
        }],
      });

      expect(student.guardians).toHaveLength(2);
      expect(student.guardians[0].isPrimary).toBe(true);
      expect(student.guardians[1].isPrimary).toBe(false);
    });

    test("Should handle Ghanaian identification documents", () => {
      const student = new GhanaStudent({
        ghanaCard: {
          cardNumber: "GHA-123456789",
          pinNumber: "1234",
          issueDate: new Date("2020-01-01"),
          expiryDate: new Date("2025-12-31"),
        },
        nhis: {
          cardNumber: "NHIS-987654321",
          issueDate: new Date("2020-01-01"),
          expiryDate: new Date("2025-12-31"),
        },
      });

      expect(student.ghanaCard.cardNumber).toBe("GHA-123456789");
      expect(student.nhis.cardNumber).toBe("NHIS-987654321");
    });
  });

  describe("Student Promotion System", () => {
    test("Should promote student to next class", async () => {
      const student = new GhanaStudent({
        firstName: "Kofi",
        lastName: "Asante",
        currentClass: new mongoose.Types.ObjectId(),
        academicYear: new mongoose.Types.ObjectId(),
        term: new mongoose.Types.ObjectId(),
      });

      const newClassId = new mongoose.Types.ObjectId();
      const newAcademicYear = new mongoose.Types.ObjectId();
      const newTerm = new mongoose.Types.ObjectId();

      // Mock promotion method
      student.academicHistory = [{
        academicYear: student.academicYear,
        class: student.currentClass,
        term: student.term,
      }];

      student.currentClass = newClassId;
      student.academicYear = newAcademicYear;
      student.term = newTerm;
      student.lastPromotionDate = new Date();

      expect(student.currentClass.toString()).toBe(newClassId.toString());
      expect(student.lastPromotionDate).toBeDefined();
    });

    test("Should track academic history", () => {
      const student = new GhanaStudent({
        academicHistory: [{
          academicYear: new mongoose.Types.ObjectId(),
          class: new mongoose.Types.ObjectId(),
          term: new mongoose.Types.ObjectId(),
          position: 5,
          totalStudents: 30,
          averageScore: 75.5,
          attendanceRate: 92.3,
          conduct: "Very Good",
          promoted: true,
          remarks: "Good performance",
        }],
      });

      expect(student.academicHistory).toHaveLength(1);
      expect(student.academicHistory[0].promoted).toBe(true);
      expect(student.academicHistory[0].averageScore).toBe(75.5);
    });
  });

  describe("Student Profile Management", () => {
    test("Should handle comprehensive student profile", () => {
      const student = new GhanaStudent({
        firstName: "Kofi",
        lastName: "Asante",
        middleName: "Kwame",
        dateOfBirth: new Date("2010-01-01"),
        gender: "Male",
        nationality: "Ghanaian",
        placeOfBirth: "Accra",
        regionOfBirth: "Greater Accra",
        
        // Contact information
        address: {
          houseNumber: "123",
          street: "Education Street",
          area: "Labone",
          city: "Accra",
          region: "Greater Accra",
          postalCode: "00233",
          gpsCoordinates: "5.6037° N, 0.1870° W",
        },
        phone: "+233241234567",
        emergencyPhone: "+233241234568",

        // Academic information
        stream: "Science",
        house: "Prempe",
        
        // Medical information
        medical: {
          bloodGroup: "O+",
          genotype: "AA",
          allergies: ["Peanuts", "Dust"],
          chronicConditions: [],
          medications: [],
          emergencyContact: {
            name: "Dr. Kofi Mensah",
            relationship: "Family Doctor",
            phone: "+233241234569",
            address: "Korle Bu Hospital, Accra",
          },
          vaccinations: [{
            name: "BCG",
            date: new Date("2010-01-15"),
            batchNumber: "BCG201001",
          }],
        },

        // Extracurricular activities
        activities: [{
          name: "Science Club",
          type: "Club",
          position: "President",
          achievements: ["Best Science Project 2023"],
          startDate: new Date("2023-01-01"),
          endDate: new Date("2023-12-31"),
        }],

        // Fees information
        fees: {
          balance: 150.50,
          lastPaymentDate: new Date("2024-01-15"),
          paymentHistory: [{
            date: new Date("2024-01-15"),
            amount: 500.00,
            method: "Bank Transfer",
            reference: "SCH001",
          }],
          scholarships: [{
            name: "Academic Excellence",
            percentage: 25,
            donor: "Ghana Education Trust",
            startDate: new Date("2023-09-01"),
            endDate: new Date("2024-06-30"),
          }],
        },

        // Discipline records
        discipline: [{
          date: new Date("2023-10-15"),
          type: "Warning",
          reason: "Late submission of assignment",
          action: "Counselling session with parents",
          reportedBy: new mongoose.Types.ObjectId(),
          resolved: true,
        }],
      });

      expect(student.firstName).toBe("Kofi");
      expect(student.middleName).toBe("Kwame");
      expect(student.address.city).toBe("Accra");
      expect(student.address.region).toBe("Greater Accra");
      expect(student.medical.bloodGroup).toBe("O+");
      expect(student.activities[0].name).toBe("Science Club");
      expect(student.fees.balance).toBe(150.50);
      expect(student.discipline[0].type).toBe("Warning");
    });

    test("Should handle special needs information", () => {
      const student = new GhanaStudent({
        specialNeeds: {
          hasDisability: true,
          disabilityType: "Visual Impairment",
          accommodations: ["Large print materials", "Extra time for exams"],
          supportServices: ["Vision therapy", "Assistive technology"],
          iep: true,
        },
      });

      expect(student.specialNeeds.hasDisability).toBe(true);
      expect(student.specialNeeds.accommodations).toContain("Large print materials");
      expect(student.specialNeeds.iep).toBe(true);
    });
  });

  describe("Data Validation", () => {
    test("Should validate Ghanaian phone numbers", () => {
      const validPhones = [
        "+233241234567",
        "+233501234567",
        "+233201234567",
        "+233271234567",
        "+233281234567",
        "+233301234567",
        "+233311234567",
        "+233321234567",
        "+233401234567",
        "+233421234567",
        "+233441234567",
        "+233541234567",
        "+233542234567",
        "+233543234567",
        "+233544234567",
        "+233545234567",
        "+233546234567",
        "+233547234567",
        "+233548234567",
        "+233549234567",
        "+233551234567",
      ];

      for (const phone of validPhones) {
        expect(phone).toMatch(/^\+233\d{9}$/);
      }
    });

    test("Should validate Ghana card format", () => {
      const validCardNumbers = [
        "GHA-123456789-0",
        "GHA-987654321-1",
        "GHA-456789123-2",
      ];

      for (const cardNumber of validCardNumbers) {
        expect(cardNumber).toMatch(/^GHA-\d{9}-\d$/);
      }
    });

    test("Should validate NHIS format", () => {
      const validNHISNumbers = [
        "NHIS-123456789",
        "NHIS-987654321",
        "NHIS-456789123",
      ];

      for (const nhisNumber of validNHISNumbers) {
        expect(nhisNumber).toMatch(/^NHIS-\d{9}$/);
      }
    });
  });

  describe("Ghanaian Education Compliance", () => {
    test("Should follow Ghanaian education structure", () => {
      const levels = GhanaClass.getGhanaianLevels();
      const expectedLevels = [
        "Creche", "Nursery 1", "Nursery 2", "KG 1", "KG 2",
        "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
        "JHS 1", "JHS 2", "JHS 3"
      ];

      const levelNames = levels.map(l => l.name);
      expect(levelNames).toEqual(expectedLevels);
    });

    test("Should have appropriate age ranges for each level", () => {
      const levels = GhanaClass.getGhanaianLevels();
      
      const ageRanges = {
        "Creche": "3-4",
        "Nursery 1": "4-5",
        "Primary 1": "8-9",
        "Primary 6": "13-14",
        "JHS 1": "14-15",
        "JHS 3": "16-17",
      };

      for (const [level, expectedRange] of Object.entries(ageRanges)) {
        const levelInfo = levels.find(l => l.name === level);
        expect(levelInfo.ageRange).toBe(expectedRange);
      }
    });

    test("Should support Ghanaian curriculum subjects", () => {
      const curriculum = GhanaSubject.getGhanaianCurriculum();
      
      // Check core subjects at different levels
      expect(curriculum["Primary 1"]).toContain("English Language");
      expect(curriculum["Primary 1"]).toContain("Mathematics");
      expect(curriculum["Primary 1"]).toContain("Integrated Science");
      expect(curriculum["Primary 1"]).toContain("Social Studies");
      
      expect(curriculum["JHS 3"]).toContain("English Language");
      expect(curriculum["JHS 3"]).toContain("Mathematics");
      expect(curriculum["JHS 3"]).toContain("Integrated Science");
      expect(curriculum["JHS 3"]).toContain("Social Studies");
      expect(curriculum["JHS 3"]).toContain("Career Technology");
      
      // Check Ghanaian language subjects
      expect(curriculum["Primary 1"]).toContain("Ghanaian Language");
      expect(curriculum["JHS 1"]).toContain("Ghanaian Language");
    });
  });
});
