const mongoose = require("mongoose");

const rolePermissionSchema = new mongoose.Schema(
  {
    // Role definition
    role: {
      type: String,
      required: true,
      enum: [
        "Super Admin",
        "School Admin",
        "Admin",
        "Headmaster",
        "Proprietor",
        "Teacher",
        "Accountant",
        "Accounts Officer",
        "Parent",
        "Student",
        "Staff",
        "Librarian",
        "Counselor",
        "Head Teacher",
        "Deputy Head Teacher",
        "Subject Head",
        "Class Teacher",
        "Administrative Staff",
        "Support Staff",
      ],
    },
    
    // Permission categories
    permissions: {
      // Academic Management
      academic: {
        create: { type: Boolean, default: false },
        read: { type: Boolean, default: false },
        update: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
        manageStudents: { type: Boolean, default: false },
        manageClasses: { type: Boolean, default: false },
        manageSubjects: { type: Boolean, default: false },
        manageGrades: { type: Boolean, default: false },
        manageExams: { type: Boolean, default: false },
        managePromotions: { type: Boolean, default: false },
      },
      
      // Student Management
      student: {
        create: { type: Boolean, default: false },
        read: { type: Boolean, default: false },
        update: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
        viewAll: { type: Boolean, default: false },
        viewOwn: { type: Boolean, default: false },
        manageAdmission: { type: Boolean, default: false },
        manageProfile: { type: Boolean, default: false },
        manageAttendance: { type: Boolean, default: false },
        manageDiscipline: { type: Boolean, default: false },
        manageMedical: { type: Boolean, default: false },
        manageFees: { type: Boolean, default: false },
        bulkImport: { type: Boolean, default: false },
        exportData: { type: Boolean, default: false },
      },
      
      // Attendance Management
      attendance: {
        create: { type: Boolean, default: false },
        read: { type: Boolean, default: false },
        update: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
        markDaily: { type: Boolean, default: false },
        markOwnClass: { type: Boolean, default: false },
        viewAll: { type: Boolean, default: false },
        viewOwnClass: { type: Boolean, default: false },
        override: { type: Boolean, default: false },
        approve: { type: Boolean, default: false },
        generateReports: { type: Boolean, default: false },
        exportReports: { type: Boolean, default: false },
        manageHolidays: { type: Boolean, default: false },
      },
      
      // Announcements Management
      announcements: {
        create: { type: Boolean, default: false },
        read: { type: Boolean, default: false },
        update: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
        publish: { type: Boolean, default: false },
        targetAll: { type: Boolean, default: false },
        targetSpecific: { type: Boolean, default: false },
        manageComments: { type: Boolean, default: false },
        moderate: { type: Boolean, default: false },
        sendNotifications: { type: Boolean, default: false },
        viewAnalytics: { type: Boolean, default: false },
      },
      
      // Financial Management
      financial: {
        create: { type: Boolean, default: false },
        read: { type: Boolean, default: false },
        update: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
        manageFees: { type: Boolean, default: false },
        managePayments: { type: Boolean, default: false },
        manageInvoices: { type: Boolean, default: false },
        manageScholarships: { type: Boolean, default: false },
        generateReports: { type: Boolean, default: false },
        approveTransactions: { type: Boolean, default: false },
        receivePayments: { type: Boolean, default: false },
        generateReceipts: { type: Boolean, default: false },
        viewAssignedReports: { type: Boolean, default: false },
        exportData: { type: Boolean, default: false },
        viewAllFinancial: { type: Boolean, default: false },
        viewOwnClass: { type: Boolean, default: false },
      },
      
      // User Management
      user: {
        create: { type: Boolean, default: false },
        read: { type: Boolean, default: false },
        update: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
        manageRoles: { type: Boolean, default: false },
        managePermissions: { type: Boolean, default: false },
        resetPasswords: { type: Boolean, default: false },
        activateDeactivate: { type: Boolean, default: false },
        viewAll: { type: Boolean, default: false },
        manageSelf: { type: Boolean, default: false },
      },
      
      // System Administration
      system: {
        manageSchool: { type: Boolean, default: false },
        manageSettings: { type: Boolean, default: false },
        manageAcademicYear: { type: Boolean, default: false },
        manageTerms: { type: Boolean, default: false },
        manageGradingSystem: { type: Boolean, default: false },
        manageCurriculum: { type: Boolean, default: false },
        manageHolidays: { type: Boolean, default: false },
        manageBackup: { type: Boolean, default: false },
        viewLogs: { type: Boolean, default: false },
        manageSecurity: { type: Boolean, default: false },
        manageIntegrations: { type: Boolean, default: false },
        manageReports: { type: Boolean, default: false },
        systemMaintenance: { type: Boolean, default: false },
      },
      
      // Reporting and Analytics
      reports: {
        viewAll: { type: Boolean, default: false },
        generateReports: { type: Boolean, default: false },
        exportReports: { type: Boolean, default: false },
        manageTemplates: { type: Boolean, default: false },
        scheduleReports: { type: Boolean, default: false },
        viewAnalytics: { type: Boolean, default: false },
        manageDashboards: { type: Boolean, default: false },
        viewSystemStats: { type: Boolean, default: false },
      },
      
      // Communication
      communication: {
        sendMessages: { type: Boolean, default: false },
        sendEmails: { type: Boolean, default: false },
        sendSMS: { type: Boolean, default: false },
        manageNotifications: { type: Boolean, default: false },
        viewAllMessages: { type: Boolean, default: false },
        manageTemplates: { type: Boolean, default: false },
      },
    },
    
    // Scope limitations
    scope: {
      // Data access scope
      dataAccess: {
        type: String,
        enum: ["All", "Own Class", "Own Subjects", "Own Children", "Self Only"],
        default: "Self Only",
      },
      
      // Geographic scope for multi-campus schools
      campus: {
        type: String,
        enum: ["All", "Main Campus", "Branch Campus 1", "Branch Campus 2"],
        default: "All",
      },
      
      // Academic scope
      academicScope: {
        type: String,
        enum: ["All Years", "Current Year", "Specific Years", "All Terms", "Current Term"],
        default: "Current Year",
      },
    },
    
    // Time-based restrictions
    timeRestrictions: {
      canAccess247: { type: Boolean, default: true },
      accessHours: {
        start: { type: String, default: "00:00" },
        end: { type: String, default: "23:59" },
      },
      accessDays: {
        type: [String],
        enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      },
      holidaysAllowed: { type: Boolean, default: true },
    },
    
    // IP and device restrictions
    restrictions: {
      allowedIPs: [String],
      allowedDevices: [String],
      requireMFA: { type: Boolean, default: false },
      sessionTimeout: { type: Number, default: 30 }, // minutes
      maxConcurrentSessions: { type: Number, default: 3 },
    },
    
    // Metadata
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
rolePermissionSchema.index({ role: 1, isActive: 1 });
rolePermissionSchema.index({ "permissions.academic.create": 1 });
rolePermissionSchema.index({ "permissions.student.create": 1 });
rolePermissionSchema.index({ "permissions.attendance.create": 1 });
rolePermissionSchema.index({ "permissions.announcements.create": 1 });
rolePermissionSchema.index({ "permissions.financial.create": 1 });
rolePermissionSchema.index({ "permissions.user.create": 1 });
rolePermissionSchema.index({ "permissions.system.manageSchool": 1 });

// Static method to get permissions for a role
rolePermissionSchema.statics.getRolePermissions = async function (role) {
  const titleCaseRole = String(role || "")
    .trim()
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const rolePermission = await this.findOne({
    $or: [
      { role: titleCaseRole, isActive: true },
      { role: role, isActive: true }
    ]
  });
  return rolePermission ? rolePermission.permissions : null;
};

// Static method to check if role has permission
rolePermissionSchema.statics.hasPermission = async function (role, category, permission) {
  const rolePermission = await this.getRolePermissions(role);
  if (!rolePermission || !rolePermission[category]) {
    return false;
  }
  
  return rolePermission[category][permission] || false;
};

// Static method to get all active roles
rolePermissionSchema.statics.getActiveRoles = async function () {
  return this.find({ isActive: true }).select("role description").sort({ role: 1 });
};

// Static method to create default role permissions
rolePermissionSchema.statics.createDefaultPermissions = async function () {
  const defaultPermissions = {
    "Super Admin": {
      academic: {
        create: true, read: true, update: true, delete: true,
        manageStudents: true, manageClasses: true, manageSubjects: true,
        manageGrades: true, manageExams: true, managePromotions: true,
        approve: true,
      },
      student: {
        create: true, read: true, update: true, delete: true,
        viewAll: true, manageAdmission: true, manageProfile: true,
        manageAttendance: true, manageDiscipline: true, manageMedical: true,
        manageFees: true, bulkImport: true, exportData: true,
      },
      attendance: {
        create: true, read: true, update: true, delete: true,
        markDaily: true, viewAll: true, override: true, approve: true,
        generateReports: true, exportReports: true, manageHolidays: true,
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
        exportData: true, viewAllFinancial: true,
      },
      user: {
        create: true, read: true, update: true, delete: true,
        manageRoles: true, managePermissions: true, resetPasswords: true,
        activateDeactivate: true, viewAll: true,
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
    },
    "School Admin": {
      academic: {
        create: true, read: true, update: true, delete: true,
        manageStudents: true, manageClasses: true, manageSubjects: true,
        manageGrades: true, manageExams: true, managePromotions: true,
        approve: true,
      },
      student: {
        create: true, read: true, update: true, delete: true,
        viewAll: true, manageAdmission: true, manageProfile: true,
        manageAttendance: true, manageDiscipline: true, manageMedical: true,
        manageFees: true, bulkImport: true, exportData: true,
      },
      attendance: {
        create: true, read: true, update: true, delete: true,
        markDaily: true, viewAll: true, override: true, approve: true,
        generateReports: true, exportReports: true, manageHolidays: true,
      },
      announcements: {
        create: true, read: true, update: true, delete: true,
        publish: true, targetAll: true, targetSpecific: true,
        manageComments: true, moderate: true, sendNotifications: true,
        viewAnalytics: true,
      },
      financial: {
        create: true, read: true, update: true,
        manageFees: true, managePayments: true, manageInvoices: true,
        manageScholarships: true, generateReports: true, approveTransactions: true,
        exportData: true, viewAllFinancial: true,
      },
      user: {
        create: true, read: true, update: true, delete: true,
        activateDeactivate: true, viewAll: true,
      },
      system: {
        manageSchool: true, manageSettings: true, manageAcademicYear: true,
        manageTerms: true, manageGradingSystem: true, manageCurriculum: true,
        manageHolidays: true, manageBackup: true, viewLogs: true,
        manageReports: true,
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
    },
    "Admin": {
      academic: {
        create: true, read: true, update: true, delete: true,
        manageStudents: true, manageClasses: true, manageSubjects: true,
        manageGrades: true, manageExams: true, managePromotions: true,
        approve: true,
      },
      student: {
        create: true, read: true, update: true, delete: true,
        viewAll: true, manageAdmission: true, manageProfile: true,
        manageAttendance: true, manageDiscipline: true, manageMedical: true,
        manageFees: true, bulkImport: true, exportData: true,
      },
      attendance: {
        create: true, read: true, update: true, delete: true,
        markDaily: true, viewAll: true, override: true, approve: true,
        generateReports: true, exportReports: true, manageHolidays: true,
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
        exportData: true, viewAllFinancial: true,
      },
      user: {
        create: true, read: true, update: true, delete: true,
        manageRoles: true, managePermissions: true, resetPasswords: true,
        activateDeactivate: true, viewAll: true,
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
    },
    "Headmaster": {
      academic: {
        create: true, read: true, update: true, delete: true,
        manageStudents: true, manageClasses: true, manageSubjects: true,
        manageGrades: true, manageExams: true, managePromotions: true,
        approve: true,
      },
      student: {
        create: true, read: true, update: true,
        viewAll: true, manageAdmission: true, manageProfile: true,
        manageAttendance: true, manageDiscipline: true, manageMedical: true,
        manageFees: true, exportData: true,
      },
      attendance: {
        create: true, read: true, update: true, delete: true,
        markDaily: true, viewAll: true, override: true, approve: true,
        generateReports: true, exportReports: true, manageHolidays: true,
      },
      announcements: {
        create: true, read: true, update: true, delete: true,
        publish: true, targetAll: true, targetSpecific: true,
        manageComments: true, moderate: true, sendNotifications: true,
        viewAnalytics: true,
      },
      financial: {
        create: true, read: true, update: true,
        manageFees: true, managePayments: true, manageInvoices: true,
        manageScholarships: true, generateReports: true, approveTransactions: true,
        exportData: true, viewAllFinancial: true,
      },
      user: {
        read: true, viewAll: true, resetPasswords: true,
      },
      system: {
        manageSchool: true, manageAcademicYear: true,
        manageTerms: true, manageGradingSystem: true, manageCurriculum: true,
        manageHolidays: true, viewLogs: true, manageReports: true,
      },
      reports: {
        viewAll: true, generateReports: true, exportReports: true,
        viewAnalytics: true, manageDashboards: true, viewSystemStats: true,
      },
      communication: {
        sendMessages: true, sendEmails: true, sendSMS: true,
        manageNotifications: true, viewAllMessages: true,
      },
    },
    "Proprietor": {
      academic: {
        read: true, approve: true,
        manageStudents: true, manageGrades: true, manageExams: true,
        managePromotions: true,
      },
      student: {
        read: true, viewAll: true, manageFees: true, exportData: true,
      },
      attendance: {
        read: true, viewAll: true, override: true, approve: true,
        generateReports: true, exportReports: true,
      },
      announcements: {
        create: true, read: true, update: true, delete: true,
        publish: true, targetAll: true, targetSpecific: true,
        sendNotifications: true, viewAnalytics: true,
      },
      financial: {
        read: true, update: true,
        manageFees: true, managePayments: true, generateReports: true,
        approveTransactions: true, viewAllFinancial: true, exportData: true,
      },
      user: {
        read: true, viewAll: true,
      },
      system: {
        manageSchool: true, viewLogs: true, manageReports: true,
      },
      reports: {
        viewAll: true, generateReports: true, exportReports: true,
        viewAnalytics: true, manageDashboards: true, viewSystemStats: true,
      },
      communication: {
        sendMessages: true, sendEmails: true, sendSMS: true,
        manageNotifications: true, viewAllMessages: true,
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
      announcements: {
        create: true, read: true, update: true, delete: true,
        targetSpecific: true, manageComments: true, sendNotifications: true,
      },
      reports: {
        generateReports: true, exportReports: true, viewAnalytics: true,
      },
      communication: {
        sendMessages: true, sendEmails: true, manageNotifications: true,
      },
    },
    "Accountant": {
      financial: {
        create: true, read: true, update: true,
        manageFees: true, managePayments: true, manageInvoices: true,
        manageScholarships: true, generateReports: true, approveTransactions: true,
        receivePayments: true, generateReceipts: true, viewAssignedReports: true,
        exportData: true,
      },
      student: {
        read: true, viewAll: true, manageFees: true,
      },
      reports: {
        viewAll: true, generateReports: true, exportReports: true,
        viewAnalytics: true,
      },
      announcements: {
        create: true, read: true, update: true, publish: true,
        targetAll: true, targetSpecific: true,
      },
      communication: {
        sendMessages: true, sendEmails: true, sendSMS: true,
        manageNotifications: true, viewAllMessages: true,
      },
    },
    "Accounts Officer": {
      financial: {
        create: true, read: true,
        managePayments: true,
        receivePayments: true,
        generateReceipts: true,
        viewAssignedReports: true,
      },
      student: {
        read: true,
      },
      reports: {
        generateReports: true,
      },
      communication: {
        sendMessages: true,
        manageNotifications: true,
      },
    },
    "Parent": {
      student: {
        read: true, viewOwn: true, manageProfile: true,
      },
      attendance: {
        read: true, viewOwnClass: true,
      },
      announcements: {
        read: true, manageComments: true,
      },
      financial: {
        read: true, viewOwnClass: true,
      },
      communication: {
        sendMessages: true, manageNotifications: true,
      },
    },
    "Student": {
      student: {
        read: true, manageSelf: true,
      },
      attendance: {
        read: true, viewOwn: true,
      },
      announcements: {
        read: true, manageComments: true,
      },
      communication: {
        sendMessages: true, manageNotifications: true,
      },
    },
  };

  const createdPermissions = [];
  for (const [role, permissions] of Object.entries(defaultPermissions)) {
    const rolePermission = new this({
      role,
      permissions,
      scope: {
        dataAccess: role === "Parent" ? "Own Children" : 
                   role === "Teacher" ? "Own Class" : 
                   role === "Student" ? "Self Only" : "All",
      },
      description: `Default permissions for ${role} role`,
      createdBy: new mongoose.Types.ObjectId("000000000000000000000000"), // System user
    });

    try {
      await rolePermission.save();
      createdPermissions.push(role);
    } catch (err) {
      console.error(`Error creating permissions for ${role}:`, err.message);
    }
  }

  return createdPermissions;
};

// Instance method to check specific permission
rolePermissionSchema.methods.can = function (category, permission) {
  return this.permissions[category] && this.permissions[category][permission] === true;
};

// Instance method to get all permissions in a category
rolePermissionSchema.methods.getCategoryPermissions = function (category) {
  return this.permissions[category] || {};
};

// Instance method to update permission
rolePermissionSchema.methods.updatePermission = function (category, permission, value) {
  if (this.permissions[category]) {
    this.permissions[category][permission] = value;
    return this.save();
  }
  throw new Error(`Category ${category} not found`);
};

// Pre-save middleware for validation
rolePermissionSchema.pre("save", function (next) {
  // Validate that at least one permission is set to true
  let hasAnyPermission = false;
  for (const category of Object.values(this.permissions)) {
    for (const permission of Object.values(category)) {
      if (permission === true) {
        hasAnyPermission = true;
        break;
      }
    }
    if (hasAnyPermission) break;
  }

  if (!hasAnyPermission) {
    return next(new Error("At least one permission must be granted"));
  }

  next();
});

module.exports = mongoose.model("RolePermission", rolePermissionSchema);
