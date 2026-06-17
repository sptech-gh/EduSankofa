const mongoose = require("mongoose");

const ghanaAttendanceSchema = new mongoose.Schema(
  {
    // Core attendance data
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GhanaStudent",
      required: true,
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GhanaClass",
      required: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GhanaSubject",
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    // Date and time information
    date: {
      type: Date,
      required: true,
    },
    timeIn: {
      type: Date,
      required: true,
    },
    timeOut: {
      type: Date,
    },
    
    // Attendance status
    status: {
      type: String,
      required: true,
      enum: ["Present", "Absent", "Late", "Excused", "Sick", "Holiday", "Suspended"],
    },
    
    // Ghanaian school periods
    period: {
      type: String,
      enum: ["Morning", "Mid-Morning", "Afternoon", "Full Day"],
      default: "Full Day",
    },
    
    // Academic context
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
    },
    term: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Term",
      required: true,
    },
    
    // Attendance details
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    
    // Attendance type
    attendanceType: {
      type: String,
      enum: ["Daily", "Class", "Event", "Assembly", "Exam"],
      default: "Daily",
    },
    
    // Entry tracking
    entryMethod: {
      type: String,
      enum: ["Manual", "Biometric", "RFID", "Mobile App", "Web Portal"],
      default: "Manual",
    },
    
    // Late arrival details
    lateArrival: {
      minutesLate: Number,
      reason: String,
      excusedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      excusedAt: Date,
    },
    
    // Early departure details
    earlyDeparture: {
      time: Date,
      reason: String,
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      approvedAt: Date,
    },
    
    // Permission and authorization
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    // Modification tracking
    modificationHistory: [{
      modifiedAt: {
        type: Date,
        default: Date.now,
      },
      modifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      previousStatus: String,
      newStatus: String,
      reason: String,
    }],
    
    // Location and device tracking
    location: {
      type: String,
      trim: true,
    },
    device: {
      type: String,
      trim: true,
    },
    ipAddress: String,
    gpsCoordinates: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
    },
    
    // Ghanaian specific fields
    isGhanaHoliday: {
      type: Boolean,
      default: false,
    },
    holidayName: {
      type: String,
      trim: true,
    },
    
    // Weather conditions (relevant for Ghana)
    weather: {
      condition: {
        type: String,
        enum: ["Sunny", "Cloudy", "Rainy", "Harmattan", "Stormy"],
      },
      temperature: Number,
      humidity: Number,
    },
    
    // Verification
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    verifiedAt: Date,
    
    // Parent notifications
    parentNotified: {
      type: Boolean,
      default: false,
    },
    parentNotificationSent: Date,
    parentResponse: {
      acknowledged: Boolean,
      response: String,
      respondedAt: Date,
    },
    
    // Attendance flags
    flags: [{
      type: {
        type: String,
        enum: ["Suspicious", "Duplicate", "Manual Override", "Late Entry", "Early Exit"],
      },
      reason: String,
      flaggedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      flaggedAt: {
        type: Date,
        default: Date.now,
      },
      resolved: {
        type: Boolean,
        default: false,
      },
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      resolvedAt: Date,
    }],
    
    // Metadata
    metadata: {
      source: String,
      version: String,
      batchId: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
ghanaAttendanceSchema.index({ student: 1, date: 1 });
ghanaAttendanceSchema.index({ class: 1, date: 1 });
ghanaAttendanceSchema.index({ teacher: 1, date: 1 });
ghanaAttendanceSchema.index({ academicYear: 1, term: 1, date: 1 });
ghanaAttendanceSchema.index({ status: 1, date: 1 });
ghanaAttendanceSchema.index({ attendanceType: 1, date: 1 });

// Unique index to prevent duplicate daily attendance
ghanaAttendanceSchema.index(
  { student: 1, date: 1, attendanceType: 1, period: 1 },
  {
    unique: true,
    partialFilterExpression: { 
      attendanceType: { $in: ["Daily", "Full Day"] },
      period: "Full Day"
    },
  }
);

// Virtual for calculating duration
ghanaAttendanceSchema.virtual("duration").get(function () {
  if (this.timeIn && this.timeOut) {
    return Math.round((this.timeOut - this.timeIn) / (1000 * 60)); // Duration in minutes
  }
  return null;
});

// Virtual for checking if student is late
ghanaAttendanceSchema.virtual("isLate").get(function () {
  if (this.status === "Late" || this.lateArrival?.minutesLate > 0) {
    return true;
  }
  return false;
});

// Virtual for checking if student left early
ghanaAttendanceSchema.virtual("leftEarly").get(function () {
  return this.earlyDeparture?.time ? true : false;
});

// Method to check if attendance is for today
ghanaAttendanceSchema.methods.isForToday = function () {
  const today = new Date();
  const attendanceDate = new Date(this.date);
  return attendanceDate.toDateString() === today.toDateString();
};

// Method to get attendance status with Ghanaian context
ghanaAttendanceSchema.methods.getStatusDescription = function () {
  const descriptions = {
    "Present": "Student was present and on time",
    "Absent": "Student was absent from school",
    "Late": "Student arrived late to school",
    "Excused": "Student was absent with valid excuse",
    "Sick": "Student was sick and absent",
    "Holiday": "School was closed for holiday",
    "Suspended": "Student was suspended from school",
  };
  
  return descriptions[this.status] || "Unknown status";
};

// Method to add modification history
ghanaAttendanceSchema.methods.addModification = function (modifiedBy, previousStatus, newStatus, reason) {
  this.modificationHistory.push({
    modifiedBy,
    previousStatus,
    newStatus,
    reason,
  });
  this.modifiedBy = modifiedBy;
  return this.save();
};

// Method to flag attendance
ghanaAttendanceSchema.methods.addFlag = function (type, reason, flaggedBy) {
  this.flags.push({
    type,
    reason,
    flaggedBy,
  });
  return this.save();
};

// Method to resolve flag
ghanaAttendanceSchema.methods.resolveFlag = function (flagIndex, resolvedBy) {
  if (this.flags[flagIndex]) {
    this.flags[flagIndex].resolved = true;
    this.flags[flagIndex].resolvedBy = resolvedBy;
    this.flags[flagIndex].resolvedAt = new Date();
    return this.save();
  }
  throw new Error("Flag not found");
};

// Static method to get daily attendance for a class
ghanaAttendanceSchema.statics.getDailyClassAttendance = async function (classId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    class: classId,
    date: { $gte: startOfDay, $lte: endOfDay },
    attendanceType: "Daily",
  })
    .populate("student", "firstName lastName studentId")
    .populate("teacher", "firstName lastName")
    .sort({ "student.lastName": 1, "student.firstName": 1 });
};

// Static method to get attendance summary for a student
ghanaAttendanceSchema.statics.getStudentAttendanceSummary = async function (
  studentId,
  academicYearId,
  termId,
  options = {}
) {
  const match = {
    student: new mongoose.Types.ObjectId(studentId),
    academicYear: new mongoose.Types.ObjectId(academicYearId),
  };

  if (termId) {
    match.term = new mongoose.Types.ObjectId(termId);
  }

  if (options.startDate && options.endDate) {
    match.date = {
      $gte: new Date(options.startDate),
      $lte: new Date(options.endDate),
    };
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalMinutes: { $sum: "$duration" },
      },
    },
  ];

  const summary = await this.aggregate(pipeline);
  const result = {
    Present: 0,
    Absent: 0,
    Late: 0,
    Excused: 0,
    Sick: 0,
    Holiday: 0,
    Suspended: 0,
    totalDays: 0,
    totalMinutes: 0,
    attendancePercentage: 0,
    punctualityRate: 0,
  };

  summary.forEach((item) => {
    result[item._id] = item.count;
    result.totalDays += item.count;
    result.totalMinutes += item.totalMinutes || 0;
  });

  // Calculate attendance percentage (Present + Late) / Total
  const presentAndLate = result.Present + result.Late;
  const totalSchoolDays = result.Present + result.Late + result.Absent + result.Sick + result.Excused;
  
  if (totalSchoolDays > 0) {
    result.attendancePercentage = Math.round((presentAndLate / totalSchoolDays) * 100);
  }

  // Calculate punctuality rate (Present) / (Present + Late)
  if (result.Present + result.Late > 0) {
    result.punctualityRate = Math.round((result.Present / (result.Present + result.Late)) * 100);
  }

  return result;
};

// Static method to get class attendance statistics
ghanaAttendanceSchema.statics.getClassAttendanceStats = async function (
  classId,
  academicYearId,
  termId,
  date
) {
  const match = {
    class: new mongoose.Types.ObjectId(classId),
    academicYear: new mongoose.Types.ObjectId(academicYearId),
  };

  if (termId) {
    match.term = new mongoose.Types.ObjectId(termId);
  }

  if (date) {
    const targetDate = new Date(date);
    match.date = {
      $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
      $lte: new Date(targetDate.setHours(23, 59, 59, 999)),
    };
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: null,
        totalStudents: { $sum: "$count" },
        statusBreakdown: {
          $push: {
            status: "$_id",
            count: "$count",
          },
        },
      },
    },
  ];

  const result = await this.aggregate(pipeline);
  
  if (result.length === 0) {
    return {
      totalStudents: 0,
      present: 0,
      absent: 0,
      late: 0,
      attendanceRate: 0,
      statusBreakdown: [],
    };
  }

  const stats = result[0];
  const presentCount = stats.statusBreakdown.find(s => s.status === "Present")?.count || 0;
  const lateCount = stats.statusBreakdown.find(s => s.status === "Late")?.count || 0;
  const totalPresent = presentCount + lateCount;

  stats.attendanceRate = stats.totalStudents > 0 
    ? Math.round((totalPresent / stats.totalStudents) * 100) 
    : 0;

  return {
    totalStudents: stats.totalStudents,
    present: presentCount,
    late: lateCount,
    absent: stats.statusBreakdown.find(s => s.status === "Absent")?.count || 0,
    attendanceRate: stats.attendanceRate,
    statusBreakdown: stats.statusBreakdown,
  };
};

// Static method to get attendance trends
ghanaAttendanceSchema.statics.getAttendanceTrends = async function (filters = {}) {
  const match = {};

  if (filters.class) match.class = mongoose.Types.ObjectId(filters.class);
  if (filters.student) match.student = mongoose.Types.ObjectId(filters.student);
  if (filters.academicYear) match.academicYear = mongoose.Types.ObjectId(filters.academicYear);
  if (filters.term) match.term = mongoose.Types.ObjectId(filters.term);

  if (filters.startDate && filters.endDate) {
    match.date = {
      $gte: new Date(filters.startDate),
      $lte: new Date(filters.endDate),
    };
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          year: { $year: "$date" },
          month: { $month: "$date" },
          day: { $dayOfMonth: "$date" },
        },
        present: {
          $sum: { $cond: [{ $in: ["$status", ["Present", "Late"]] }, 1, 0] },
        },
        absent: {
          $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] },
        },
        total: { $sum: 1 },
      },
    },
    {
      $addFields: {
        date: {
          $dateFromParts: {
            year: "$_id.year",
            month: "$_id.month",
            day: "$_id.day",
          },
        },
        attendanceRate: {
          $multiply: [{ $divide: ["$present", "$total"] }, 100],
        },
      },
    },
    { $sort: { date: 1 } },
  ];

  return this.aggregate(pipeline);
};

// Static method to get monthly attendance report
ghanaAttendanceSchema.statics.getMonthlyAttendanceReport = async function (
  classId,
  year,
  month,
  academicYearId,
  termId
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const match = {
    class: new mongoose.Types.ObjectId(classId),
    academicYear: new mongoose.Types.ObjectId(academicYearId),
    date: { $gte: startDate, $lte: endDate },
  };

  if (termId) {
    match.term = new mongoose.Types.ObjectId(termId);
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$student",
        student: { $first: "$student" },
        totalDays: { $sum: 1 },
        present: {
          $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] },
        },
        late: {
          $sum: { $cond: [{ $eq: ["$status", "Late"] }, 1, 0] },
        },
        absent: {
          $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] },
        },
        excused: {
          $sum: { $cond: [{ $eq: ["$status", "Excused"] }, 1, 0] },
        },
        sick: {
          $sum: { $cond: [{ $eq: ["$status", "Sick"] }, 1, 0] },
        },
      },
    },
    {
      $addFields: {
        attendanceRate: {
          $multiply: [
            { $divide: [{ $add: ["$present", "$late"] }, "$totalDays"] },
            100,
          ],
        },
      },
    },
    {
      $lookup: {
        from: "ghanastudents",
        localField: "student",
        foreignField: "_id",
        as: "studentInfo",
      },
    },
    { $unwind: "$studentInfo" },
    {
      $project: {
        studentId: "$studentInfo.studentId",
        studentName: {
          $concat: [
            "$studentInfo.firstName",
            " ",
            "$studentInfo.lastName",
          ],
        },
        totalDays: 1,
        present: 1,
        late: 1,
        absent: 1,
        excused: 1,
        sick: 1,
        attendanceRate: 1,
      },
    },
    { $sort: { studentName: 1 } },
  ]);
};

// Pre-save middleware for validation
ghanaAttendanceSchema.pre("save", function (next) {
  // Validate that timeOut is after timeIn
  if (this.timeOut && this.timeIn) {
    if (this.timeOut <= this.timeIn) {
      return next(new Error("Time out must be after time in"));
    }
  }

  // Check for Ghanaian holidays
  const attendanceDate = new Date(this.date);
  const ghanaianHolidays = [
    // Add major Ghanaian holidays
    { month: 0, day: 1, name: "New Year's Day" }, // January 1
    { month: 2, day: 6, name: "Independence Day" }, // March 6
    { month: 3, day: 7, name: "Good Friday" }, // Easter
    { month: 3, day: 10, name: "Easter Monday" },
    { month: 4, day: 1, name: "Workers' Day" }, // May 1
    { month: 6, day: 1, name: "Republic Day" }, // July 1
    { month: 11, day: 25, name: "Christmas Day" }, // December 25
    { month: 11, day: 26, name: "Boxing Day" }, // December 26
  ];

  const isHoliday = ghanaianHolidays.some(holiday => 
    attendanceDate.getMonth() === holiday.month && 
    attendanceDate.getDate() === holiday.day
  );

  if (isHoliday) {
    this.isGhanaHoliday = true;
    this.holidayName = ghanaianHolidays.find(h => 
      h.month === attendanceDate.getMonth() && 
      h.day === attendanceDate.getDate()
    ).name;
  }

  next();
});

module.exports = mongoose.model("GhanaAttendance", ghanaAttendanceSchema);
