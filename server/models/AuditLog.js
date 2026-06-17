const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    // User information
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userRole: {
      type: String,
      required: true,
      enum: ["Super Admin", "School Admin", "Teacher", "Accountant", "Parent", "Student", "Staff"],
    },
    userName: {
      type: String,
      required: true,
    },
    
    // Action information
    action: {
      type: String,
      required: true,
      enum: [
        // Authentication
        "LOGIN", "LOGOUT", "REGISTER", "PASSWORD_CHANGE", "PASSWORD_RESET",
        // CRUD operations
        "CREATE", "READ", "UPDATE", "DELETE",
        // Academic operations
        "GRADE_ENTRY", "REPORT_CARD_GENERATE", "PROMOTION_EVALUATE", "PROMOTION_APPROVE",
        // Financial operations
        "PAYMENT_PROCESS", "FEE_STRUCTURE_CREATE", "RECEIPT_GENERATE",
        // Attendance
        "ATTENDANCE_MARK", "ATTENDANCE_OVERRIDE",
        // Communication
        "ANNOUNCEMENT_CREATE", "ANNOUNCEMENT_PUBLISH", "MESSAGE_SEND",
        // System operations
        "SYSTEM_BACKUP", "SYSTEM_RESTORE", "DATA_EXPORT", "DATA_IMPORT",
        // Security
        "ACCESS_DENIED", "SECURITY_VIOLATION", "FAILED_LOGIN_ATTEMPT",
      ],
    },
    
    // Resource information
    resource: {
      type: String,
      required: true,
    },
    resourceType: {
      type: String,
      enum: [
        "User", "Student", "Class", "Subject", "Grade", "Attendance", "ReportCard",
        "FeeStructure", "Payment", "Announcement", "Message", "AcademicYear", "Term",
        "PromotionEngine", "AuditLog", "System", "File", "Session",
      ],
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    
    // Request information
    method: {
      type: String,
      required: true,
      enum: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    },
    url: {
      type: String,
      required: true,
    },
    endpoint: {
      type: String,
    },
    
    // Client information
    userAgent: {
      type: String,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    location: {
      country: String,
      city: String,
      region: String,
    },
    
    // Request/Response data
    requestBody: {
      type: String,
      default: "{}",
    },
    responseData: {
      type: String,
      default: "{}",
    },
    statusCode: {
      type: Number,
      required: true,
    },
    
    // Timing information
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    duration: {
      type: Number,
      default: 0,
    },
    
    // Session information
    sessionId: {
      type: String,
    },
    sessionAge: {
      type: Number,
      default: 0,
    },
    
    // Security information
    securityFlags: [{
      type: {
        type: String,
        enum: [
          "SUSPICIOUS_ACTIVITY", "FAILED_LOGIN", "MULTIPLE_ATTEMPTS", "UNAUTHORIZED_ACCESS",
          "DATA_MANIPULATION", "INJECTION_ATTEMPT", "RATE_LIMIT_EXCEEDED", "INVALID_TOKEN",
          "PERMISSION_DENIED", "ROLE_VIOLATION", "OFF_HOURS_ACCESS", "ANOMALOUS_PATTERN",
        ],
      },
      detectedAt: {
        type: Date,
        default: Date.now,
      },
      severity: {
        type: String,
        enum: ["Low", "Medium", "High", "Critical"],
        default: "Medium",
      },
      description: String,
    }],
    
    // Data integrity
    dataIntegrity: {
      dataModified: {
        type: Boolean,
        default: false,
      },
      checksumBefore: String,
      checksumAfter: String,
      validationErrors: [String],
    },
    
    // Compliance information
    compliance: {
      dpActCompliant: {
        type: Boolean,
        default: true,
      },
      dataRetentionPeriod: {
        type: Number,
        default: 2555, // 7 years in days
      },
      consentObtained: {
        type: Boolean,
        default: true,
      },
      consentType: {
        type: String,
        enum: ["Explicit", "Implicit", "None"],
        default: "Implicit",
      },
    },
    
    // Business context
    businessContext: {
      academicYear: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AcademicYear",
      },
      term: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Term",
      },
      class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GhanaClass",
      },
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GhanaStudent",
      },
      operationType: {
        type: String,
        enum: [
          "ACADEMIC", "FINANCIAL", "ADMINISTRATIVE", "COMMUNICATION", "SECURITY",
          "SYSTEM", "COMPLIANCE", "REPORTING", "MAINTENANCE",
        ],
      },
    },
    
    // Impact assessment
    impact: {
      severity: {
        type: String,
        enum: ["Low", "Medium", "High", "Critical"],
        default: "Low",
      },
      affectedUsers: {
        type: Number,
        default: 0,
      },
      affectedRecords: {
        type: Number,
        default: 0,
      },
      businessImpact: {
        type: String,
        enum: ["None", "Minimal", "Moderate", "Significant", "Critical"],
        default: "None",
      },
    },
    
    // Resolution information
    resolution: {
      resolved: {
        type: Boolean,
        default: false,
      },
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      resolvedAt: Date,
      resolutionAction: String,
      resolutionNotes: String,
    },
    
    // System information
    system: {
      version: String,
      environment: {
        type: String,
        enum: ["Development", "Testing", "Staging", "Production"],
        default: "Development",
      },
      server: {
        hostname: String,
        ip: String,
        platform: String,
      },
      database: {
        version: String,
        host: String,
        port: Number,
      },
    },
    
    // Metadata
    tags: [String],
    category: {
      type: String,
      enum: [
        "SECURITY", "PERFORMANCE", "ERROR", "BUSINESS", "COMPLIANCE",
        "DATA_INTEGRITY", "USER_ACTION", "SYSTEM_EVENT", "AUDIT",
      ],
      default: "USER_ACTION",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for efficient queries
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, timestamp: -1 });
auditLogSchema.index({ statusCode: 1, timestamp: -1 });
auditLogSchema.index({ ipAddress: 1, timestamp: -1 });
auditLogSchema.index({ "securityFlags.type": 1, "securityFlags.detectedAt": -1 });
auditLogSchema.index({ category: 1, priority: 1, timestamp: -1 });
auditLogSchema.index({ "impact.severity": 1, timestamp: -1 });

// Virtual for formatted timestamp
auditLogSchema.virtual("formattedTimestamp").get(function () {
  return this.timestamp.toISOString();
});

// Virtual for session information
auditLogSchema.virtual("sessionInfo").get(function () {
  return {
    id: this.sessionId,
    age: this.sessionAge,
    duration: this.duration,
  };
});

// Virtual for security summary
auditLogSchema.virtual("securitySummary").get(function () {
  const flags = this.securityFlags;
  return {
    totalFlags: flags.length,
    criticalFlags: flags.filter(f => f.severity === "Critical").length,
    highSeverityFlags: flags.filter(f => f.severity === "High").length,
    mediumSeverityFlags: flags.filter(f => f.severity === "Medium").length,
    lowSeverityFlags: flags.filter(f => f.severity === "Low").length,
    hasSuspiciousActivity: flags.some(f => f.type === "SUSPICIOUS_ACTIVITY"),
  };
});

// Static method to log security event
auditLogSchema.statics.logSecurityEvent = async function (
  user,
  action,
  resource,
  resourceType,
  securityFlag,
  ipAddress,
  userAgent,
  additionalData = {}
) {
  try {
    const logEntry = new this({
      user: user._id,
      userRole: user.role,
      userName: `${user.firstName} ${user.lastName}`,
      action,
      resource,
      resourceType,
      ipAddress,
      userAgent,
      category: "SECURITY",
      priority: securityFlag.severity === "Critical" ? "Critical" : "High",
      securityFlags: [securityFlag],
      businessContext: additionalData.businessContext || {},
      impact: additionalData.impact || {
        severity: securityFlag.severity,
        affectedUsers: 1,
        affectedRecords: 0,
        businessImpact: "Minimal",
      },
      system: {
        environment: process.env.NODE_ENV || "Development",
        version: process.env.APP_VERSION || "1.0.0",
      },
      ...additionalData,
    });

    await logEntry.save();
    return logEntry;
  } catch (error) {
    console.error("Error logging security event:", error);
  }
};

// Static method to log failed login attempt
auditLogSchema.statics.logFailedLogin = async function (
  ipAddress,
  userAgent,
  email,
  reason
) {
  try {
    const logEntry = new this({
      user: null,
      userRole: "Anonymous",
      userName: email || "Unknown",
      action: "FAILED_LOGIN_ATTEMPT",
      resource: "Authentication",
      resourceType: "User",
      ipAddress,
      userAgent,
      statusCode: 401,
      category: "SECURITY",
      priority: "High",
      securityFlags: [{
        type: "FAILED_LOGIN",
        severity: "Medium",
        description: reason || "Invalid credentials",
        detectedAt: new Date(),
      }],
      impact: {
        severity: "Low",
        affectedUsers: 0,
        affectedRecords: 0,
        businessImpact: "None",
      },
      notes: `Failed login attempt from IP ${ipAddress} for user ${email}`,
    });

    await logEntry.save();
    return logEntry;
  } catch (error) {
    console.error("Error logging failed login attempt:", error);
  }
};

// Static method to log data access
auditLogSchema.statics.logDataAccess = async function (
  user,
  action,
  resource,
  resourceType,
  resourceId,
  ipAddress,
  additionalData = {}
) {
  try {
    const logEntry = new this({
      user: user._id,
      userRole: user.role,
      userName: `${user.firstName} ${user.lastName}`,
      action,
      resource,
      resourceType,
      resourceId,
      ipAddress,
      userAgent: additionalData.userAgent,
      category: "COMPLIANCE",
      priority: "Low",
      businessContext: additionalData.businessContext || {},
      compliance: {
        gdprCompliant: true,
        dataRetentionPeriod: 2555,
        consentObtained: true,
        consentType: "Implicit",
      },
      ...additionalData,
    });

    await logEntry.save();
    return logEntry;
  } catch (error) {
    console.error("Error logging data access:", error);
  }
};

// Static method to get security dashboard data
auditLogSchema.statics.getSecurityDashboard = async function (filters = {}) {
  const {
    startDate,
    endDate,
    severity,
    category,
    limit = 100,
  } = filters;

  const match = {};
  
  if (startDate && endDate) {
    match.timestamp = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }
  
  if (severity) {
    match["impact.severity"] = severity;
  }
  
  if (category) {
    match.category = category;
  }

  const dashboard = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalEvents: { $sum: 1 },
        criticalEvents: {
          $sum: { $cond: [{ $eq: ["$impact.severity", "Critical"] }, 1, 0] },
        },
        highEvents: {
          $sum: { $cond: [{ $eq: ["$impact.severity", "High"] }, 1, 0] },
        },
        mediumEvents: {
          $sum: { $cond: [{ $eq: ["$impact.severity", "Medium"]}, 1, 0] },
        },
        lowEvents: {
          $sum: { $cond: [{ $eq: ["$impact.severity", "Low"]}, 1, 0] },
        },
        securityFlags: {
          $sum: { $size: "$securityFlags" },
        },
        failedLogins: {
          $sum: { $cond: [{ $eq: ["$action", "FAILED_LOGIN_ATTEMPT"] }, 1, 0] },
        },
        unauthorizedAccess: {
          $sum: { $cond: [{ $eq: ["$statusCode", 401] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        criticalEvents: 1,
        highEvents: 1,
        mediumEvents: 1,
        lowEvents: 1,
        securityFlags: 1,
        failedLogins: 1,
        unauthorizedAccess: 1,
        totalEvents: 1,
      },
    },
    {
      $sort: { _id: 1 },
    },
    {
      $limit: 1,
    },
  ]);

  // Get recent security events
  const recentEvents = await this.find({
    category: "SECURITY",
    "securityFlags.0": { $exists: true },
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate("user", "firstName lastName email")
    .select("action resource resourceType ipAddress securityFlags timestamp");

  // Get top IP addresses by failed attempts
  const topIPs = await this.aggregate([
    {
      $match: {
        action: "FAILED_LOGIN_ATTEMPT",
        timestamp: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    },
    {
      $group: {
        _id: "$ipAddress",
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
    {
      $limit: 10,
    },
  ]);

  return {
    summary: dashboard[0] || {
      totalEvents: 0,
      criticalEvents: 0,
      highEvents: 0,
      mediumEvents: 0,
      lowEvents: 0,
      securityFlags: 0,
      failedLogins: 0,
      unauthorizedAccess: 0,
    },
    recentEvents,
    topIPs,
    period: {
      startDate,
      endDate,
    },
  };
};

// Static method to get compliance report
// FINDING-005 fix: removed invalid arrow syntax mixing "function" keyword with "=>".
auditLogSchema.statics.getComplianceReport = async function (filters = {}) {
  const {
    startDate,
    endDate,
    academicYearId,
    termId,
  } = filters;

  const match = {};
  
  if (startDate && endDate) {
    match.timestamp = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }
  
  if (academicYearId) {
    match["businessContext.academicYear"] = new mongoose.Types.ObjectId(academicYearId);
  }
  
  if (termId) {
    match["businessContext.term"] = new mongoose.Types.ObjectId(termId);
  }

  const compliance = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalLogs: { $sum: 1 },
        // FINDING-038: Renamed from gdprCompliant to dpActCompliant (Ghana Data Protection Act 2012)
        dpActCompliant: {
          $sum: { $cond: [{ $eq: ["$compliance.dpActCompliant", true] }, 1, 0] },
        },
        consentObtained: {
          $sum: { $cond: [{ $eq: ["$compliance.consentObtained", true] }, 1, 0] },
        },
        dataIntegrityIssues: {
          $sum: { $cond: [{ $eq: ["$dataIntegrity.dataModified", true] }, 1, 0] },
        },
        securityEvents: {
          $sum: { $cond: [{ $eq: ["$category", "SECURITY"] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalLogs: 1,
        dpActCompliant: 1,
        consentObtained: 1,
        dataIntegrityIssues: 1,
        securityEvents: 1,
      },
    },
  ]);

  return {
    summary: compliance[0] || {
      totalLogs: 0,
      dpActCompliant: 0,
      consentObtained: 0,
      dataIntegrityIssues: 0,
      securityEvents: 0,
    },
    complianceRate: compliance[0] ? Math.round((compliance[0].dpActCompliant / compliance[0].totalLogs) * 100) : 0,
    period: {
      startDate,
      endDate,
    },
  };
};

// Pre-save middleware for data integrity
auditLogSchema.pre("save", function (next) {
  // FINDING-036 fix: Do NOT set a hardcoded default duration.
  // Duration must be set by the audit middleware using actual elapsed time:
  //   req.startTime = Date.now();  // set at request entry
  //   duration: Date.now() - req.startTime  // set when logging
  // If duration was not provided, leave it undefined rather than lying with 1000ms.

  // Validate required fields
  if (!this.user && this.action !== "FAILED_LOGIN_ATTEMPT") {
    return next(new Error("User is required for audit logs"));
  }

  next();
});

module.exports = mongoose.model("AuditLog", auditLogSchema);
