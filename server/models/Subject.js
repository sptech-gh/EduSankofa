const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    credits: {
      type: Number,
      required: true,
      min: 0,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    category: {
      type: String,
      enum: ["Core", "Elective"],
      default: "Core",
    },
    department: {
      type: String,
      trim: true,
    },
    classLevels: [{
      type: String,
      trim: true,
    }],
    gradingSystem: {
      type: String,
      trim: true,
    },
    stream: {
      type: String,
      trim: true,
    },
    passMark: {
      type: Number,
      default: 50,
    },
    maxScore: {
      type: Number,
      default: 100,
    },
    isCompulsory: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

subjectSchema.index({ academicYearId: 1, termId: 1 });
subjectSchema.index({ academicYear: 1, semester: 1 });

module.exports = mongoose.model("Subject", subjectSchema);
