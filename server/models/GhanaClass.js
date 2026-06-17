const mongoose = require("mongoose");

// Ghanaian class levels with proper structure
const GHANAIAN_CLASS_LEVELS = {
  "Creche": { order: 1, ageRange: "3-4", duration: "1 year" },
  "Nursery 1": { order: 2, ageRange: "4-5", duration: "1 year" },
  "Nursery 2": { order: 3, ageRange: "5-6", duration: "1 year" },
  "KG 1": { order: 4, ageRange: "6-7", duration: "1 year" },
  "KG 2": { order: 5, ageRange: "7-8", duration: "1 year" },
  "Primary 1": { order: 6, ageRange: "8-9", duration: "1 year" },
  "Primary 2": { order: 7, ageRange: "9-10", duration: "1 year" },
  "Primary 3": { order: 8, ageRange: "10-11", duration: "1 year" },
  "Primary 4": { order: 9, ageRange: "11-12", duration: "1 year" },
  "Primary 5": { order: 10, ageRange: "12-13", duration: "1 year" },
  "Primary 6": { order: 11, ageRange: "13-14", duration: "1 year" },
  "JHS 1": { order: 12, ageRange: "14-15", duration: "1 year" },
  "JHS 2": { order: 13, ageRange: "15-16", duration: "1 year" },
  "JHS 3": { order: 14, ageRange: "16-17", duration: "1 year" },
  "SHS 1": { order: 15, ageRange: "17-18", duration: "1 year" },
  "SHS 2": { order: 16, ageRange: "18-19", duration: "1 year" },
  "SHS 3": { order: 17, ageRange: "19-20", duration: "1 year" },
  "A-Level": { order: 18, ageRange: "17-19", duration: "2 years" }
};

const ghanaClassSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: String,
      required: true,
      enum: Object.keys(GHANAIAN_CLASS_LEVELS),
    },
    section: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      enum: ["A", "B", "C", "D", "E", "F"],
    },
    stream: {
      type: String,
      trim: true,
      enum: ["General", "Science", "Arts", "Business", "Technical"],
    },
    classTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assistantTeachers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    students: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "GhanaStudent",
    }],
    subjects: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
    }],
    capacity: {
      type: Number,
      default: 30,
      min: 10,
      max: 60,
    },
    currentEnrollment: {
      type: Number,
      default: 0,
    },
    roomNumber: {
      type: String,
      trim: true,
    },
    floor: {
      type: String,
      trim: true,
    },
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
    isActive: {
      type: Boolean,
      default: true,
    },
    promotionRules: {
      automaticPromotion: { type: Boolean, default: true },
      minimumAttendance: { type: Number, default: 85 },
      minimumAverageScore: { type: Number, default: 50 },
      requireConductAssessment: { type: Boolean, default: true },
    },
    metadata: {
      ageRange: String,
      order: Number,
      duration: String,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
ghanaClassSchema.index({ level: 1, section: 1, academicYear: 1 }, { unique: true });
ghanaClassSchema.index({ academicYear: 1, term: 1 });
ghanaClassSchema.index({ classTeacher: 1 });
ghanaClassSchema.index({ isActive: 1 });

// Pre-save middleware to set metadata based on level
ghanaClassSchema.pre("save", function (next) {
  if (this.isModified("level") || this.isNew) {
    const levelInfo = GHANAIAN_CLASS_LEVELS[this.level];
    if (levelInfo) {
      this.metadata = {
        ageRange: levelInfo.ageRange,
        order: levelInfo.order,
        duration: levelInfo.duration,
      };
    }
  }
  next();
});

// Static method to get next class for promotion
ghanaClassSchema.statics.getNextLevel = function (currentLevel) {
  const currentOrder = GHANAIAN_CLASS_LEVELS[currentLevel]?.order;
  if (!currentOrder) return null;
  
  const nextLevel = Object.entries(GHANAIAN_CLASS_LEVELS).find(
    ([, info]) => info.order === currentOrder + 1
  );
  
  return nextLevel ? nextLevel[0] : null;
};

// Static method to get all Ghanaian class levels
ghanaClassSchema.statics.getGhanaianLevels = function () {
  return Object.entries(GHANAIAN_CLASS_LEVELS).map(([name, info]) => ({
    name,
    ...info,
  }));
};

// Instance method to check if class can accept more students
ghanaClassSchema.methods.canAcceptStudent = function () {
  return this.currentEnrollment < this.capacity;
};

// Instance method to add student
ghanaClassSchema.methods.addStudent = function (studentId) {
  if (!this.canAcceptStudent()) {
    throw new Error("Class is at full capacity");
  }
  
  if (!this.students.includes(studentId)) {
    this.students.push(studentId);
    this.currentEnrollment = this.students.length;
  }
  
  return this.save();
};

// Instance method to remove student
ghanaClassSchema.methods.removeStudent = function (studentId) {
  this.students = this.students.filter(id => !id.equals(studentId));
  this.currentEnrollment = this.students.length;
  return this.save();
};

module.exports = mongoose.model("GhanaClass", ghanaClassSchema);
