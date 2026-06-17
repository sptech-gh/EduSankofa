const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
    },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    withdrawnAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

enrollmentSchema.index({ student: 1, academicYear: 1 }, { unique: true });
enrollmentSchema.index({ academicYear: 1, class: 1, status: 1 });
enrollmentSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model("Enrollment", enrollmentSchema);
