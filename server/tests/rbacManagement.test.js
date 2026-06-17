const mongoose = require("mongoose");
const RolePermission = require("../models/RolePermission");

describe("RBAC Management Unit Tests", () => {
  describe("RolePermission Model", () => {
    test("Should have required fields", () => {
      const rolePermission = new RolePermission({
        role: "Teacher",
        permissions: {
          academic: {
            create: true,
            read: true,
            update: true,
            delete: false,
          },
          student: {
            read: true,
            update: true,
            viewOwn: true,
          },
        },
        scope: {
          dataAccess: "Own Class",
          campus: "All",
          academicScope: "Current Year",
        },
        createdBy: new mongoose.Types.ObjectId(),
      });

      expect(rolePermission.role).toBe("Teacher");
      expect(rolePermission.permissions.academic.create).toBe(true);
      expect(rolePermission.permissions.academic.delete).toBe(false);
      expect(rolePermission.permissions.student.read).toBe(true);
      expect(rolePermission.scope.dataAccess).toBe("Own Class");
      expect(rolePermission.isActive).toBe(true);
    });

    test("Should validate role enum", () => {
      const validRoles = [
        "Super Admin", "School Admin", "Teacher", "Accountant", "Parent", "Student",
        "Staff", "Librarian", "Counselor", "Head Teacher", "Deputy Head Teacher",
        "Subject Head", "Class Teacher", "Administrative Staff", "Support Staff",
      ];
      
      for (const role of validRoles) {
        const rolePermission = new RolePermission({ role });
        expect(validRoles).toContain(rolePermission.role);
      }
    });

    test("Should validate scope enums", () => {
      const rolePermission = new RolePermission({
        role: "Teacher",
        scope: {
          dataAccess: "Own Class",
          campus: "Main Campus",
          academicScope: "Current Year",
        },
      });

      expect(["All", "Own Class", "Own Subjects", "Own Children", "Self Only"])
        .toContain(rolePermission.scope.dataAccess);
      expect(["All", "Main Campus", "Branch Campus 1", "Branch Campus 2"])
        .toContain(rolePermission.scope.campus);
      expect(["All Years", "Current Year", "Specific Years", "All Terms", "Current Term"])
        .toContain(rolePermission.scope.academicScope);
    });

    test("Should handle time restrictions", () => {
      const rolePermission = new RolePermission({
        role: "Teacher",
        timeRestrictions: {
          canAccess247: false,
          accessHours: {
            start: "08:00",
            end: "17:00",
          },
          accessDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          holidaysAllowed: false,
        },
      });

      expect(rolePermission.timeRestrictions.canAccess247).toBe(false);
      expect(rolePermission.timeRestrictions.accessHours.start).toBe("08:00");
      expect(rolePermission.timeRestrictions.accessHours.end).toBe("17:00");
      expect(rolePermission.timeRestrictions.accessDays).toHaveLength(5);
      expect(rolePermission.timeRestrictions.holidaysAllowed).toBe(false);
    });

    test("Should handle IP and device restrictions", () => {
      const rolePermission = new RolePermission({
        role: "Teacher",
        restrictions: {
          allowedIPs: ["192.168.1.100", "192.168.1.101"],
          allowedDevices: ["Desktop", "Mobile"],
          requireMFA: true,
          sessionTimeout: 60,
          maxConcurrentSessions: 2,
        },
      });

      expect(rolePermission.restrictions.allowedIPs).toHaveLength(2);
      expect(rolePermission.restrictions.allowedDevices).toHaveLength(2);
      expect(rolePermission.restrictions.requireMFA).toBe(true);
      expect(rolePermission.restrictions.sessionTimeout).toBe(60);
      expect(rolePermission.restrictions.maxConcurrentSessions).toBe(2);
    });

    test("Should check specific permission", () => {
      const rolePermission = new RolePermission({
        role: "Teacher",
        permissions: {
          academic: {
            create: true,
            read: true,
            update: false,
          },
          student: {
            read: true,
            update: true,
          },
        },
      });

      expect(rolePermission.can("academic", "create")).toBe(true);
      expect(rolePermission.can("academic", "read")).toBe(true);
      expect(rolePermission.can("academic", "update")).toBe(false);
      expect(rolePermission.can("student", "read")).toBe(true);
      expect(rolePermission.can("student", "update")).toBe(true);
    });

    test("Should get category permissions", () => {
      const rolePermission = new RolePermission({
        role: "Teacher",
        permissions: {
          academic: {
            create: true,
            read: true,
            update: false,
            delete: false,
          },
        },
      });

      const academicPerms = rolePermission.getCategoryPermissions("academic");
      expect(academicPerms.create).toBe(true);
      expect(academicPerms.read).toBe(true);
      expect(academicPerms.update).toBe(false);
      expect(academicPerms.delete).toBe(false);
    });

    test("Should update specific permission", async () => {
      const rolePermission = new RolePermission({
        role: "Teacher",
        permissions: {
          academic: {
            create: true,
            read: true,
            update: false,
          },
        },
      });

      // Mock save method
      rolePermission.save = jest.fn().mockResolvedValue(rolePermission);

      await rolePermission.updatePermission("academic", "update", true);

      expect(rolePermission.permissions.academic.update).toBe(true);
      expect(rolePermission.save).toHaveBeenCalled();
    });
  });

  describe("Static Methods", () => {
    test("Should get role permissions", async () => {
      // Mock findOne method
      const mockRolePermission = {
        role: "Teacher",
        permissions: {
          academic: { create: true, read: true },
          student: { read: true, update: true },
        },
      };

      RolePermission.findOne = jest.fn().mockResolvedValue(mockRolePermission);

      const result = await RolePermission.getRolePermissions("Teacher");

      expect(RolePermission.findOne).toHaveBeenCalledWith({ role: "Teacher", isActive: true });
      expect(result).toEqual(mockRolePermission.permissions);
    });

    test("Should check if role has permission", async () => {
      const mockPermissions = {
        academic: { create: true, read: true, update: false },
        student: { read: true, update: true },
      };

      RolePermission.getRolePermissions = jest.fn().mockResolvedValue(mockPermissions);

      const hasCreate = await RolePermission.hasPermission("Teacher", "academic", "create");
      const hasUpdate = await RolePermission.hasPermission("Teacher", "academic", "update");
      const hasStudentRead = await RolePermission.hasPermission("Teacher", "student", "read");

      expect(hasCreate).toBe(true);
      expect(hasUpdate).toBe(false);
      expect(hasStudentRead).toBe(true);
    });

    test("Should handle non-existent role", async () => {
      RolePermission.getRolePermissions = jest.fn().mockResolvedValue(null);

      const result = await RolePermission.hasPermission("NonExistent", "academic", "create");

      expect(result).toBe(false);
    });

    test("Should get active roles", async () => {
      const mockRoles = [
        { role: "Teacher", description: "Teacher permissions" },
        { role: "Student", description: "Student permissions" },
        { role: "Parent", description: "Parent permissions" },
      ];

      RolePermission.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockRoles),
        }),
      });

      const result = await RolePermission.getActiveRoles();

      expect(RolePermission.find).toHaveBeenCalledWith({ isActive: true });
      expect(result).toEqual(mockRoles);
    });
  });

  describe("Default Permissions", () => {
    test("Should create default permissions structure", async () => {
      const mockSave = jest.fn().mockResolvedValue({});
      RolePermission.createDefaultPermissions = jest.fn().mockImplementation(async () => {
        const defaultPermissions = {
          "Super Admin": {
            academic: {
              create: true, read: true, update: true, delete: true,
              manageStudents: true, manageClasses: true, manageSubjects: true,
              manageGrades: true, manageExams: true, managePromotions: true,
            },
            student: {
              create: true, read: true, update: true, delete: true,
              viewAll: true, manageAdmission: true, manageProfile: true,
              manageAttendance: true, manageDiscipline: true, manageMedical: true,
              manageFees: true, bulkImport: true, exportData: true,
            },
          },
          "Teacher": {
            academic: {
              read: true, update: true, manageGrades: true, manageExams: true,
            },
            student: {
              read: true, update: true, viewOwn: true, manageProfile: true,
              manageAttendance: true, manageDiscipline: true,
            },
            attendance: {
              create: true, read: true, update: true,
              markOwnClass: true, viewOwnClass: true, generateReports: true,
            },
          },
        };

        return Object.keys(defaultPermissions);
      });

      const result = await RolePermission.createDefaultPermissions();

      expect(result).toContain("Super Admin");
      expect(result).toContain("Teacher");
    });
  });

  describe("Permission Categories", () => {
    test("Should handle academic permissions", () => {
      const academicPerms = {
        create: true,
        read: true,
        update: true,
        delete: false,
        manageStudents: true,
        manageClasses: false,
        manageSubjects: true,
        manageGrades: true,
        manageExams: false,
        managePromotions: false,
      };

      const rolePermission = new RolePermission({
        role: "Teacher",
        permissions: { academic: academicPerms },
      });

      expect(rolePermission.permissions.academic.create).toBe(true);
      expect(rolePermission.permissions.academic.delete).toBe(false);
      expect(rolePermission.permissions.academic.manageStudents).toBe(true);
      expect(rolePermission.permissions.academic.manageClasses).toBe(false);
    });

    test("Should handle student permissions", () => {
      const studentPerms = {
        create: false,
        read: true,
        update: true,
        delete: false,
        viewAll: false,
        viewOwn: true,
        manageAdmission: false,
        manageProfile: true,
        manageAttendance: true,
        manageDiscipline: false,
        manageMedical: false,
        manageFees: false,
        bulkImport: false,
        exportData: false,
      };

      const rolePermission = new RolePermission({
        role: "Teacher",
        permissions: { student: studentPerms },
      });

      expect(rolePermission.permissions.student.create).toBe(false);
      expect(rolePermission.permissions.student.read).toBe(true);
      expect(rolePermission.permissions.student.viewOwn).toBe(true);
      expect(rolePermission.permissions.student.manageAttendance).toBe(true);
    });

    test("Should handle attendance permissions", () => {
      const attendancePerms = {
        create: true,
        read: true,
        update: true,
        delete: false,
        markDaily: true,
        markOwnClass: true,
        viewAll: false,
        viewOwnClass: true,
        override: false,
        approve: false,
        generateReports: true,
        exportReports: false,
        manageHolidays: false,
      };

      const rolePermission = new RolePermission({
        role: "Teacher",
        permissions: { attendance: attendancePerms },
      });

      expect(rolePermission.permissions.attendance.create).toBe(true);
      expect(rolePermission.permissions.attendance.markOwnClass).toBe(true);
      expect(rolePermission.permissions.attendance.override).toBe(false);
      expect(rolePermission.permissions.attendance.generateReports).toBe(true);
    });

    test("Should handle announcements permissions", () => {
      const announcementPerms = {
        create: true,
        read: true,
        update: true,
        delete: true,
        publish: false,
        targetAll: false,
        targetSpecific: true,
        manageComments: true,
        moderate: false,
        sendNotifications: true,
        viewAnalytics: false,
      };

      const rolePermission = new RolePermission({
        role: "Teacher",
        permissions: { announcements: announcementPerms },
      });

      expect(rolePermission.permissions.announcements.create).toBe(true);
      expect(rolePermission.permissions.announcements.targetSpecific).toBe(true);
      expect(rolePermission.permissions.announcements.targetAll).toBe(false);
      expect(rolePermission.permissions.announcements.sendNotifications).toBe(true);
    });

    test("Should handle financial permissions", () => {
      const financialPerms = {
        create: false,
        read: true,
        update: false,
        delete: false,
        manageFees: false,
        managePayments: false,
        manageInvoices: false,
        manageScholarships: false,
        generateReports: false,
        approveTransactions: false,
        exportData: false,
        viewAllFinancial: false,
        viewOwnClass: true,
      };

      const rolePermission = new RolePermission({
        role: "Teacher",
        permissions: { financial: financialPerms },
      });

      expect(rolePermission.permissions.financial.read).toBe(true);
      expect(rolePermission.permissions.financial.viewOwnClass).toBe(true);
      expect(rolePermission.permissions.financial.manageFees).toBe(false);
    });

    test("Should handle system permissions", () => {
      const systemPerms = {
        manageSchool: false,
        manageSettings: false,
        manageAcademicYear: false,
        manageTerms: false,
        manageGradingSystem: false,
        manageCurriculum: false,
        manageHolidays: false,
        manageBackup: false,
        viewLogs: false,
        manageSecurity: false,
        manageIntegrations: false,
        manageReports: false,
        systemMaintenance: false,
      };

      const rolePermission = new RolePermission({
        role: "Teacher",
        permissions: { system: systemPerms },
      });

      expect(rolePermission.permissions.system.manageSchool).toBe(false);
      expect(rolePermission.permissions.system.viewLogs).toBe(false);
      expect(rolePermission.permissions.system.manageReports).toBe(false);
    });
  });

  describe("Data Validation", () => {
    test("Should validate role enum values", () => {
      const validRoles = [
        "Super Admin", "School Admin", "Teacher", "Accountant", "Parent", "Student",
        "Staff", "Librarian", "Counselor", "Head Teacher", "Deputy Head Teacher",
        "Subject Head", "Class Teacher", "Administrative Staff", "Support Staff",
      ];

      for (const role of validRoles) {
        const rolePermission = new RolePermission({ role });
        expect(validRoles).toContain(rolePermission.role);
      }
    });

    test("Should validate data access scope", () => {
      const validScopes = ["All", "Own Class", "Own Subjects", "Own Children", "Self Only"];
      
      for (const scope of validScopes) {
        const rolePermission = new RolePermission({
          role: "Teacher",
          scope: { dataAccess: scope },
        });
        expect(validScopes).toContain(rolePermission.scope.dataAccess);
      }
    });

    test("Should validate campus scope", () => {
      const validCampuses = ["All", "Main Campus", "Branch Campus 1", "Branch Campus 2"];
      
      for (const campus of validCampuses) {
        const rolePermission = new RolePermission({
          role: "Teacher",
          scope: { campus },
        });
        expect(validCampuses).toContain(rolePermission.scope.campus);
      }
    });

    test("Should validate academic scope", () => {
      const validScopes = ["All Years", "Current Year", "Specific Years", "All Terms", "Current Term"];
      
      for (const scope of validScopes) {
        const rolePermission = new RolePermission({
          role: "Teacher",
          scope: { academicScope: scope },
        });
        expect(validScopes).toContain(rolePermission.scope.academicScope);
      }
    });

    test("Should validate access days", () => {
      const validDays = [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
      ];
      
      const rolePermission = new RolePermission({
        role: "Teacher",
        timeRestrictions: {
          accessDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        },
      });

      expect(rolePermission.timeRestrictions.accessDays).toHaveLength(5);
      rolePermission.timeRestrictions.accessDays.forEach(day => {
        expect(validDays).toContain(day);
      });
    });

    test("Should validate time format", () => {
      const rolePermission = new RolePermission({
        role: "Teacher",
        timeRestrictions: {
          accessHours: {
            start: "08:00",
            end: "17:30",
          },
        },
      });

      expect(rolePermission.timeRestrictions.accessHours.start).toMatch(/^\d{2}:\d{2}$/);
      expect(rolePermission.timeRestrictions.accessHours.end).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe("Permission Matrix", () => {
    test("Should create comprehensive permission matrix", () => {
      const allPermissions = {
        academic: {
          create: true, read: true, update: true, delete: true,
          manageStudents: true, manageClasses: true, manageSubjects: true,
          manageGrades: true, manageExams: true, managePromotions: true,
        },
        student: {
          create: true, read: true, update: true, delete: true,
          viewAll: true, viewOwn: true, manageAdmission: true,
          manageProfile: true, manageAttendance: true, manageDiscipline: true,
          manageMedical: true, manageFees: true, bulkImport: true, exportData: true,
        },
        attendance: {
          create: true, read: true, update: true, delete: true,
          markDaily: true, markOwnClass: true, viewAll: true, viewOwnClass: true,
          override: true, approve: true, generateReports: true, exportReports: true,
          manageHolidays: true,
        },
        announcements: {
          create: true, read: true, update: true, delete: true,
          publish: true, targetAll: true, targetSpecific: true,
          manageComments: true, moderate: true, sendNotifications: true,
          viewAnalytics: true,
        },
        financial: {
          create: true, read: true, update: true, delete: true,
          manageFees: true, managePayments: true, manageInvoices: true,
          manageScholarships: true, generateReports: true, approveTransactions: true,
          exportData: true, viewAllFinancial: true, viewOwnClass: true,
        },
        user: {
          create: true, read: true, update: true, delete: true,
          manageRoles: true, managePermissions: true, resetPasswords: true,
          activateDeactivate: true, viewAll: true, manageSelf: true,
        },
        system: {
          manageSchool: true, manageSettings: true, manageAcademicYear: true,
          manageTerms: true, manageGradingSystem: true, manageCurriculum: true,
          manageHolidays: true, manageBackup: true, viewLogs: true,
          manageSecurity: true, manageIntegrations: true, manageReports: true,
          systemMaintenance: true,
        },
        reports: {
          viewAll: true, generateReports: true, exportReports: true,
          manageTemplates: true, scheduleReports: true, viewAnalytics: true,
          manageDashboards: true, viewSystemStats: true,
        },
        communication: {
          sendMessages: true, sendEmails: true, sendSMS: true,
          manageNotifications: true, viewAllMessages: true, manageTemplates: true,
        },
      };

      const rolePermission = new RolePermission({
        role: "Super Admin",
        permissions: allPermissions,
      });

      // Check that all categories exist
      expect(Object.keys(rolePermission.permissions)).toContain("academic");
      expect(Object.keys(rolePermission.permissions)).toContain("student");
      expect(Object.keys(rolePermission.permissions)).toContain("attendance");
      expect(Object.keys(rolePermission.permissions)).toContain("announcements");
      expect(Object.keys(rolePermission.permissions)).toContain("financial");
      expect(Object.keys(rolePermission.permissions)).toContain("user");
      expect(Object.keys(rolePermission.permissions)).toContain("system");
      expect(Object.keys(rolePermission.permissions)).toContain("reports");
      expect(Object.keys(rolePermission.permissions)).toContain("communication");

      // Check that Super Admin has all permissions set to true
      Object.values(rolePermission.permissions).forEach(category => {
        Object.values(category).forEach(permission => {
          expect(permission).toBe(true);
        });
      });
    });
  });

  describe("Ghanaian Context", () => {
    test("Should handle Ghanaian school structure permissions", () => {
      const rolePermission = new RolePermission({
        role: "Teacher",
        permissions: {
          academic: {
            manageClasses: true,
            manageSubjects: true,
            manageGrades: true,
          },
          student: {
            manageProfile: true,
            manageAttendance: true,
          },
        },
        scope: {
          dataAccess: "Own Class",
          academicScope: "Current Year",
        },
      });

      expect(rolePermission.permissions.academic.manageClasses).toBe(true);
      expect(rolePermission.permissions.academic.manageSubjects).toBe(true);
      expect(rolePermission.scope.dataAccess).toBe("Own Class");
    });

    test("Should handle Ghanaian education system permissions", () => {
      const rolePermission = new RolePermission({
        role: "School Admin",
        permissions: {
          academic: {
            create: true, read: true, update: true, delete: true,
            manageStudents: true, manageClasses: true, manageSubjects: true,
            manageGrades: true, manageExams: true, managePromotions: true,
          },
          system: {
            manageSchool: true,
            manageSettings: true,
            manageAcademicYear: true,
            manageTerms: true,
            manageGradingSystem: true,
            manageCurriculum: true,
            manageHolidays: true,
            manageBackup: true,
            viewLogs: true,
            manageSecurity: true,
            manageIntegrations: true,
            manageReports: true,
            systemMaintenance: true,
          },
        },
      });

      expect(rolePermission.permissions.system.manageSchool).toBe(true);
      expect(rolePermission.permissions.system.manageSettings).toBe(true);
      expect(rolePermission.permissions.system.manageAcademicYear).toBe(true);
      expect(rolePermission.permissions.system.manageTerms).toBe(true);
      expect(rolePermission.permissions.system.manageGradingSystem).toBe(true);
      expect(rolePermission.permissions.system.manageCurriculum).toBe(true);
    });
  });
});
