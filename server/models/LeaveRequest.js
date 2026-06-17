const mongoose = require("mongoose");

const leaveRequestSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ["sick", "personal", "family", "medical", "other"],
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    documents: [
      {
        name: String,
        url: String,
        type: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    notificationSent: {
      type: Boolean,
      default: false,
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
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        comment: {
          type: String,
          required: true,
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    metadata: {
      submittedVia: String,
      ipAddress: String,
      deviceInfo: String,
      location: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
leaveRequestSchema.index({ student: 1, startDate: -1 });
leaveRequestSchema.index({ status: 1, startDate: -1 });
leaveRequestSchema.index({ approver: 1, status: 1 });

// Virtual for calculating duration in days
leaveRequestSchema.virtual("duration").get(function () {
  return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
});

// Virtual for checking if leave is current
leaveRequestSchema.virtual("isCurrent").get(function () {
  const now = new Date();
  return this.startDate <= now && this.endDate >= now;
});

// Method to check if leave can be cancelled
leaveRequestSchema.methods.canBeCancelled = function () {
  return (
    this.status === "pending" ||
    (this.status === "approved" && this.startDate > new Date())
  );
};

// Method to check if leave dates overlap with existing leaves
leaveRequestSchema.methods.checkOverlap = async function () {
  const overlappingLeaves = await this.constructor.find({
    student: this.student,
    status: { $in: ["pending", "approved"] },
    $or: [
      {
        startDate: { $lte: this.startDate },
        endDate: { $gte: this.startDate },
      },
      {
        startDate: { $lte: this.endDate },
        endDate: { $gte: this.endDate },
      },
      {
        startDate: { $gte: this.startDate },
        endDate: { $lte: this.endDate },
      },
    ],
    _id: { $ne: this._id }, // Exclude current leave request
  });

  return overlappingLeaves.length > 0;
};

// Method to approve leave request
leaveRequestSchema.methods.approve = async function (approverId) {
  if (this.status !== "pending") {
    throw new Error("Only pending leave requests can be approved");
  }

  this.status = "approved";
  this.approver = approverId;
  this.approvedAt = new Date();
  await this.save();

  // Create attendance records for the leave duration
  const Attendance = mongoose.model("Attendance");
  const currentDate = new Date(this.startDate);
  const leaves = [];

  while (currentDate <= this.endDate) {
    // Skip weekends
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      leaves.push({
        student: this.student,
        date: new Date(currentDate),
        status: "excused",
        attendanceType: "daily",
        notes: `Leave approved - ${this.type}: ${this.reason}`,
        teacher: this.approver,
        enteredBy: this.approver,
        academicYear: this.academicYear,
        semester: this.semester,
        isManualEntry: true,
      });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (leaves.length > 0) {
    await Attendance.insertMany(leaves);
  }

  return this;
};

// Method to reject leave request
leaveRequestSchema.methods.reject = async function (approverId, reason) {
  if (this.status !== "pending") {
    throw new Error("Only pending leave requests can be rejected");
  }

  this.status = "rejected";
  this.approver = approverId;
  this.rejectionReason = reason;
  this.approvedAt = new Date();
  return this.save();
};

// Method to cancel leave request
leaveRequestSchema.methods.cancel = async function () {
  if (!this.canBeCancelled()) {
    throw new Error("This leave request cannot be cancelled");
  }

  this.status = "cancelled";
  await this.save();

  // If leave was approved, remove attendance records
  if (this.status === "approved") {
    const Attendance = mongoose.model("Attendance");
    await Attendance.deleteMany({
      student: this.student,
      date: {
        $gte: this.startDate,
        $lte: this.endDate,
      },
      status: "excused",
      isManualEntry: true,
    });
  }

  return this;
};

// Static method to get leave summary for a student
leaveRequestSchema.statics.getStudentSummary = async function (
  studentId,
  academicYear,
  semester
) {
  const pipeline = [
    {
      $match: {
        student: mongoose.Types.ObjectId(studentId),
        academicYear,
        semester,
        status: { $in: ["approved", "pending"] },
      },
    },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
        totalDays: {
          $sum: {
            $ceil: {
              $divide: [
                { $subtract: ["$endDate", "$startDate"] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
      },
    },
  ];

  const summary = await this.aggregate(pipeline);
  const result = {
    sick: { count: 0, days: 0 },
    personal: { count: 0, days: 0 },
    family: { count: 0, days: 0 },
    medical: { count: 0, days: 0 },
    other: { count: 0, days: 0 },
    total: { count: 0, days: 0 },
  };

  summary.forEach((item) => {
    result[item._id] = {
      count: item.count,
      days: item.totalDays,
    };
    result.total.count += item.count;
    result.total.days += item.totalDays;
  });

  return result;
};

module.exports = mongoose.model("LeaveRequest", leaveRequestSchema);
