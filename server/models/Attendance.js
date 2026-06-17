const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["present", "absent", "late", "excused", "sick"],
      required: true,
    },
    timeIn: {
      type: Date,
    },
    timeOut: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    attendanceType: {
      type: String,
      enum: ["daily", "class", "event"],
      default: "daily",
    },
    period: {
      type: String,
      trim: true,
    },
    academicYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicYear",
    },
    termId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Term",
    },
    academicYear: {
      type: String,
      required: true,
    },
    semester: {
      type: String,
      enum: ["Fall", "Spring", "Summer"],
      required: true,
    },
    isManualEntry: {
      type: Boolean,
      default: false,
    },
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    modificationReason: {
      type: String,
      trim: true,
    },
    modificationHistory: [
      {
        modifiedAt: {
          type: Date,
          default: Date.now,
        },
        modifiedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        modificationReason: {
          type: String,
          trim: true,
        },
        previous: {
          status: {
            type: String,
            enum: ["present", "absent", "late", "excused", "sick"],
          },
          timeIn: Date,
          timeOut: Date,
          notes: String,
        },
      },
    ],
    metadata: {
      location: String,
      device: String,
      ipAddress: String,
      gpsCoordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
attendanceSchema.index({ student: 1, date: 1 });
attendanceSchema.index({ student: 1, academicYearId: 1, termId: 1 });
attendanceSchema.index({ student: 1, academicYear: 1, semester: 1 });
attendanceSchema.index({ teacher: 1, date: 1 });
attendanceSchema.index({ subject: 1, date: 1 });
attendanceSchema.index({ date: 1, status: 1 });

// Ensure one attendance record per student per day for daily attendance
attendanceSchema.index(
  { student: 1, date: 1, attendanceType: 1, subject: 1 },
  {
    unique: true,
    partialFilterExpression: { attendanceType: { $in: ["daily", "class"] } },
  }
);

// Virtual for calculating duration
attendanceSchema.virtual("duration").get(function () {
  if (this.timeIn && this.timeOut) {
    return Math.round((this.timeOut - this.timeIn) / (1000 * 60)); // Duration in minutes
  }
  return null;
});

// Method to check if attendance is late
attendanceSchema.methods.isLate = function () {
  return this.status === "late";
};

// Method to check if attendance is valid for the day
attendanceSchema.methods.isValidForDay = function () {
  const today = new Date();
  const attendanceDate = new Date(this.date);
  return attendanceDate.toDateString() === today.toDateString();
};

// Static method to get attendance summary for a student
attendanceSchema.statics.getStudentSummary = async function (
  studentId,
  academicYear,
  semester,
  options = {}
) {
  const pipeline = [
    {
      $match: {
        student: new mongoose.Types.ObjectId(studentId),
        academicYear,
        semester,
        ...(options.attendanceType ? { attendanceType: options.attendanceType } : {}),
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ];

  const summary = await this.aggregate(pipeline);
  const result = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    sick: 0,
    total: 0,
  };

  summary.forEach((item) => {
    result[item._id] = item.count;
    result.total += item.count;
  });

  result.attendancePercentage =
    result.total > 0
      ? Math.round(
          ((result.present + result.late) / result.total) * 100 * 100
        ) / 100
      : 0;

  return result;
};

attendanceSchema.statics.getStudentSummaryByIds = async function (
  studentId,
  { academicYearId, termId, attendanceType = "daily" } = {}
) {
  if (!academicYearId) {
    throw new Error("academicYearId is required");
  }

  const match = {
    student: new mongoose.Types.ObjectId(studentId),
    academicYearId: new mongoose.Types.ObjectId(academicYearId),
  };

  if (termId) match.termId = new mongoose.Types.ObjectId(termId);
  if (attendanceType) match.attendanceType = attendanceType;

  const summary = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    sick: 0,
    total: 0,
  };

  summary.forEach((item) => {
    result[item._id] = item.count;
    result.total += item.count;
  });

  result.attendancePercentage =
    result.total > 0
      ? Math.round(
          ((result.present + result.late) / result.total) * 100 * 100
        ) / 100
      : 0;

  return result;
};

// Static method to get class attendance for a specific date
attendanceSchema.statics.getClassAttendance = async function (subjectId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    subject: subjectId,
    date: { $gte: startOfDay, $lte: endOfDay },
  })
    .populate("student", "firstName lastName email")
    .populate("teacher", "name email")
    .sort({ "student.lastName": 1, "student.firstName": 1 });
};

// Static method to get attendance trends
attendanceSchema.statics.getAttendanceTrends = async function (filters = {}) {
  const matchStage = {};

  if (filters.student)
    matchStage.student = mongoose.Types.ObjectId(filters.student);
  if (filters.subject)
    matchStage.subject = mongoose.Types.ObjectId(filters.subject);
  if (filters.academicYear) matchStage.academicYear = filters.academicYear;
  if (filters.semester) matchStage.semester = filters.semester;
  if (filters.startDate && filters.endDate) {
    matchStage.date = {
      $gte: new Date(filters.startDate),
      $lte: new Date(filters.endDate),
    };
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: {
          year: { $year: "$date" },
          month: { $month: "$date" },
          day: { $dayOfMonth: "$date" },
        },
        present: {
          $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] },
        },
        absent: {
          $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
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

module.exports = mongoose.model("Attendance", attendanceSchema);
