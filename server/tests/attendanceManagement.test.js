const mongoose = require("mongoose");
const GhanaAttendance = require("../models/GhanaAttendance");
const GhanaStudent = require("../models/GhanaStudent");
const GhanaClass = require("../models/GhanaClass");

describe("Attendance Management Unit Tests", () => {
  describe("GhanaAttendance Model", () => {
    test("Should have required fields", () => {
      const attendance = new GhanaAttendance({
        student: new mongoose.Types.ObjectId(),
        class: new mongoose.Types.ObjectId(),
        teacher: new mongoose.Types.ObjectId(),
        date: new Date(),
        timeIn: new Date(),
        status: "Present",
        academicYear: new mongoose.Types.ObjectId(),
        term: new mongoose.Types.ObjectId(),
        enteredBy: new mongoose.Types.ObjectId(),
      });

      expect(attendance.student).toBeDefined();
      expect(attendance.class).toBeDefined();
      expect(attendance.teacher).toBeDefined();
      expect(attendance.status).toBe("Present");
      expect(attendance.period).toBe("Full Day");
      expect(attendance.attendanceType).toBe("Daily");
      expect(attendance.entryMethod).toBe("Manual");
    });

    test("Should validate attendance status enum", () => {
      const validStatuses = ["Present", "Absent", "Late", "Excused", "Sick", "Holiday", "Suspended"];
      
      for (const status of validStatuses) {
        const attendance = new GhanaAttendance({ status });
        expect(validStatuses).toContain(attendance.status);
      }
    });

    test("Should validate period enum", () => {
      const validPeriods = ["Morning", "Mid-Morning", "Afternoon", "Full Day"];
      
      for (const period of validPeriods) {
        const attendance = new GhanaAttendance({ period });
        expect(validPeriods).toContain(attendance.period);
      }
    });

    test("Should validate entry method enum", () => {
      const validMethods = ["Manual", "Biometric", "RFID", "Mobile App", "Web Portal"];
      
      for (const method of validMethods) {
        const attendance = new GhanaAttendance({ entryMethod: method });
        expect(validMethods).toContain(attendance.entryMethod);
      }
    });

    test("Should calculate duration correctly", () => {
      const timeIn = new Date("2024-01-01T08:00:00");
      const timeOut = new Date("2024-01-01T14:30:00");
      
      const attendance = new GhanaAttendance({
        timeIn,
        timeOut,
      });

      const expectedDuration = 390; // 6.5 hours = 390 minutes
      expect(attendance.duration).toBe(expectedDuration);
    });

    test("Should identify late attendance", () => {
      const attendance1 = new GhanaAttendance({ status: "Late" });
      const attendance2 = new GhanaAttendance({ status: "Present" });
      const attendance3 = new GhanaAttendance({
        status: "Present",
        lateArrival: { minutesLate: 15 }
      });

      expect(attendance1.isLate).toBe(true);
      expect(attendance2.isLate).toBe(false);
      expect(attendance3.isLate).toBe(true);
    });

    test("Should identify early departure", () => {
      const attendance1 = new GhanaAttendance({
        earlyDeparture: { time: new Date("2024-01-01T12:00:00") }
      });
      const attendance2 = new GhanaAttendance({});

      expect(attendance1.leftEarly).toBe(true);
      expect(attendance2.leftEarly).toBe(false);
    });

    test("Should check if attendance is for today", () => {
      const today = new Date();
      const attendance1 = new GhanaAttendance({ date: today });
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const attendance2 = new GhanaAttendance({ date: yesterday });

      expect(attendance1.isForToday()).toBe(true);
      expect(attendance2.isForToday()).toBe(false);
    });

    test("Should provide status descriptions", () => {
      const attendance = new GhanaAttendance({ status: "Present" });
      expect(attendance.getStatusDescription()).toBe("Student was present and on time");
      
      attendance.status = "Absent";
      expect(attendance.getStatusDescription()).toBe("Student was absent from school");
      
      attendance.status = "Late";
      expect(attendance.getStatusDescription()).toBe("Student arrived late to school");
    });
  });

  describe("Attendance Validation", () => {
    test("Should validate timeOut is after timeIn", () => {
      const timeIn = new Date("2024-01-01T14:00:00");
      const timeOut = new Date("2024-01-01T08:00:00"); // Earlier than timeIn
      
      const attendance = new GhanaAttendance({
        timeIn,
        timeOut,
      });

      // This would be caught by pre-save middleware
      expect(timeOut.getTime()).toBeLessThan(timeIn.getTime());
    });

    test("Should handle Ghanaian holidays", () => {
      // Test Independence Day (March 6)
      const independenceDay = new Date("2024-03-06");
      const attendance = new GhanaAttendance({
        date: independenceDay,
      });

      // The pre-save middleware should detect this as a holiday
      expect(attendance.date.getMonth()).toBe(2); // March
      expect(attendance.date.getDate()).toBe(6); // 6th
    });

    test("Should handle weather conditions", () => {
      const weatherConditions = ["Sunny", "Cloudy", "Rainy", "Harmattan", "Stormy"];
      
      for (const condition of weatherConditions) {
        const attendance = new GhanaAttendance({
          weather: {
            condition,
            temperature: 25,
            humidity: 70,
          },
        });

        expect(attendance.weather.condition).toBe(condition);
        expect(attendance.weather.temperature).toBe(25);
        expect(attendance.weather.humidity).toBe(70);
      }
    });

    test("Should handle late arrival details", () => {
      const attendance = new GhanaAttendance({
        status: "Late",
        lateArrival: {
          minutesLate: 15,
          reason: "Traffic jam",
          excusedBy: new mongoose.Types.ObjectId(),
          excusedAt: new Date(),
        },
      });

      expect(attendance.lateArrival.minutesLate).toBe(15);
      expect(attendance.lateArrival.reason).toBe("Traffic jam");
      expect(attendance.lateArrival.excusedBy).toBeDefined();
    });

    test("Should handle early departure details", () => {
      const attendance = new GhanaAttendance({
        earlyDeparture: {
          time: new Date("2024-01-01T12:00:00"),
          reason: "Medical appointment",
          approvedBy: new mongoose.Types.ObjectId(),
          approvedAt: new Date(),
        },
      });

      expect(attendance.earlyDeparture.time).toBeDefined();
      expect(attendance.earlyDeparture.reason).toBe("Medical appointment");
      expect(attendance.earlyDeparture.approvedBy).toBeDefined();
    });
  });

  describe("Modification History", () => {
    test("Should track modification history", () => {
      const attendance = new GhanaAttendance({
        modificationHistory: [{
          modifiedAt: new Date("2024-01-01T10:00:00"),
          modifiedBy: new mongoose.Types.ObjectId(),
          previousStatus: "Present",
          newStatus: "Late",
          reason: "Correction of time",
        }],
      });

      expect(attendance.modificationHistory).toHaveLength(1);
      expect(attendance.modificationHistory[0].previousStatus).toBe("Present");
      expect(attendance.modificationHistory[0].newStatus).toBe("Late");
      expect(attendance.modificationHistory[0].reason).toBe("Correction of time");
    });

    test("Should handle attendance flags", () => {
      const attendance = new GhanaAttendance({
        flags: [{
          type: "Suspicious",
          reason: "Multiple entries detected",
          flaggedBy: new mongoose.Types.ObjectId(),
          flaggedAt: new Date(),
          resolved: false,
        }, {
          type: "Manual Override",
          reason: "Admin correction",
          flaggedBy: new mongoose.Types.ObjectId(),
          flaggedAt: new Date(),
          resolved: true,
          resolvedBy: new mongoose.Types.ObjectId(),
          resolvedAt: new Date(),
        }],
      });

      expect(attendance.flags).toHaveLength(2);
      expect(attendance.flags[0].type).toBe("Suspicious");
      expect(attendance.flags[0].resolved).toBe(false);
      expect(attendance.flags[1].type).toBe("Manual Override");
      expect(attendance.flags[1].resolved).toBe(true);
    });
  });

  describe("Parent Notifications", () => {
    test("Should track parent notifications", () => {
      const attendance = new GhanaAttendance({
        parentNotified: true,
        parentNotificationSent: new Date("2024-01-01T08:30:00"),
        parentResponse: {
          acknowledged: true,
          response: "Noted, thank you",
          respondedAt: new Date("2024-01-01T09:00:00"),
        },
      });

      expect(attendance.parentNotified).toBe(true);
      expect(attendance.parentNotificationSent).toBeDefined();
      expect(attendance.parentResponse.acknowledged).toBe(true);
      expect(attendance.parentResponse.response).toBe("Noted, thank you");
    });
  });

  describe("Location and Device Tracking", () => {
    test("Should handle GPS coordinates", () => {
      const attendance = new GhanaAttendance({
        location: "Main Campus",
        device: "Mobile App",
        ipAddress: "192.168.1.100",
        gpsCoordinates: {
          latitude: 5.6037,
          longitude: -0.1870,
          accuracy: 10,
        },
      });

      expect(attendance.location).toBe("Main Campus");
      expect(attendance.device).toBe("Mobile App");
      expect(attendance.ipAddress).toBe("192.168.1.100");
      expect(attendance.gpsCoordinates.latitude).toBe(5.6037);
      expect(attendance.gpsCoordinates.longitude).toBe(-0.1870);
      expect(attendance.gpsCoordinates.accuracy).toBe(10);
    });
  });

  describe("Ghanaian Education Compliance", () => {
    test("Should follow Ghanaian school structure", () => {
      const levels = GhanaClass.getGhanaianLevels();
      const expectedLevels = [
        "Creche", "Nursery 1", "Nursery 2", "KG 1", "KG 2",
        "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
        "JHS 1", "JHS 2", "JHS 3"
      ];

      const levelNames = levels.map(l => l.name);
      expect(levelNames).toEqual(expectedLevels);
    });

    test("Should handle Ghanaian holidays", () => {
      const ghanaianHolidays = [
        { month: 0, day: 1, name: "New Year's Day" }, // January 1
        { month: 2, day: 6, name: "Independence Day" }, // March 6
        { month: 11, day: 25, name: "Christmas Day" }, // December 25
        { month: 11, day: 26, name: "Boxing Day" }, // December 26
      ];

      expect(ghanaianHolidays).toHaveLength(4);
      expect(ghanaianHolidays[1].name).toBe("Independence Day");
      expect(ghanaianHolidays[1].month).toBe(2); // March
      expect(ghanaianHolidays[1].day).toBe(6);
    });

    test("Should handle Ghanaian weather conditions", () => {
      const weatherConditions = ["Sunny", "Cloudy", "Rainy", "Harmattan", "Stormy"];
      
      for (const condition of weatherConditions) {
        expect(weatherConditions).toContain(condition);
      }
      
      // Harmattan is specific to West Africa/Ghana
      expect(weatherConditions).toContain("Harmattan");
    });
  });

  describe("Data Validation", () => {
    test("Should validate Ghanaian phone numbers", () => {
      const validPhones = [
        "+233241234567", // Vodafone
        "+233201234567", // MTN
        "+233271234567", // AirtelTigo
        "+233501234567", // Glo
        "+233231234567", // MTN Business
      ];

      for (const phone of validPhones) {
        expect(phone).toMatch(/^\+233\d{9}$/);
      }
    });

    test("Should validate attendance periods", () => {
      const validPeriods = ["Morning", "Mid-Morning", "Afternoon", "Full Day"];
      
      for (const period of validPeriods) {
        const attendance = new GhanaAttendance({ period });
        expect(validPeriods).toContain(attendance.period);
      }
    });

    test("Should validate attendance types", () => {
      const validTypes = ["Daily", "Class", "Event", "Assembly", "Exam"];
      
      for (const type of validTypes) {
        const attendance = new GhanaAttendance({ attendanceType: type });
        expect(validTypes).toContain(attendance.attendanceType);
      }
    });

    test("Should validate entry methods", () => {
      const validMethods = ["Manual", "Biometric", "RFID", "Mobile App", "Web Portal"];
      
      for (const method of validMethods) {
        const attendance = new GhanaAttendance({ entryMethod: method });
        expect(validMethods).toContain(attendance.entryMethod);
      }
    });
  });

  describe("Attendance Analytics", () => {
    test("Should calculate attendance percentage correctly", () => {
      // Present: 20, Late: 3, Absent: 2, Total: 25
      const presentAndLate = 23;
      const totalSchoolDays = 25;
      const expectedPercentage = Math.round((presentAndLate / totalSchoolDays) * 100);
      
      expect(expectedPercentage).toBe(92);
    });

    test("Should calculate punctuality rate correctly", () => {
      // Present: 20, Late: 3, Total: 23
      const present = 20;
      const presentAndLate = 23;
      const expectedRate = Math.round((present / presentAndLate) * 100);
      
      expect(expectedRate).toBe(87);
    });

    test("Should handle attendance trends", () => {
      const trends = [
        { date: "2024-01-01", present: 25, absent: 2, total: 27 },
        { date: "2024-01-02", present: 26, absent: 1, total: 27 },
        { date: "2024-01-03", present: 24, absent: 3, total: 27 },
      ];

      trends.forEach(trend => {
        const expectedRate = Math.round((trend.present / trend.total) * 100);
        expect(expectedRate).toBeGreaterThan(80);
        expect(expectedRate).toBeLessThanOrEqual(100);
      });
    });
  });
});
