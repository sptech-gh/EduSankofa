const mongoose = require("mongoose");

const teacherAssignmentSchema = new mongoose.Schema(
  {
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
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

teacherAssignmentSchema.index(
  { academicYear: 1, term: 1, class: 1, subject: 1 },
  { unique: true }
);
teacherAssignmentSchema.index({ teacher: 1, academicYear: 1, term: 1 });

module.exports = mongoose.model("TeacherAssignment", teacherAssignmentSchema);
