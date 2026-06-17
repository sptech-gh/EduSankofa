const mongoose = require("mongoose");

const schoolConfigSchema = new mongoose.Schema(
  {
    schoolName: {
      type: String,
      required: true,
      trim: true,
    },
    schoolCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    address: {
      street: String,
      city: { type: String, required: true },
      region: { type: String, required: true },
      country: { type: String, default: "Ghana" },
      postalCode: String,
    },
    contact: {
      phone: { type: String, required: true },
      email: { type: String, required: true },
      website: String,
    },
    establishment: {
      type: Date,
      required: true,
    },
    schoolType: {
      type: String,
      enum: ["Public", "Private", "International"],
      required: true,
    },
    educationLevel: {
      type: String,
      enum: ["Creche", "Nursery", "Primary", "JHS", "Basic (Creche-JHS)"],
      default: "Basic (Creche-JHS)",
    },
    gradingSystem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GradingSystem",
      required: true,
    },
    currentAcademicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicYear",
    },
    currentTerm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Term",
    },
    logo: String,
    motto: String,
    vision: String,
    mission: String,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

schoolConfigSchema.index({ schoolCode: 1 });
schoolConfigSchema.index({ isActive: 1 });

module.exports = mongoose.model("SchoolConfig", schoolConfigSchema);
