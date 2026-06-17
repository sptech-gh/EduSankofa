const mongoose = require("mongoose");

const gradeBandSchema = new mongoose.Schema({
  scoreRange: {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  grade: { type: String, required: true },
  interpretation: { type: String, required: true },
  remarks: { type: String, required: true },
  gpaPoints: { type: Number, required: true },
});

const gradingSystemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    systemType: {
      type: String,
      enum: ["Ghana Basic", "Ghana JHS", "Custom"],
      default: "Ghana Basic",
    },
    passingScore: {
      type: Number,
      required: true,
      default: 50,
    },
    maxScore: {
      type: Number,
      required: true,
      default: 100,
    },
    gradeBands: [gradeBandSchema],
    assessmentWeights: {
      classAssessment: { type: Number, default: 30 },
      homework: { type: Number, default: 10 },
      tests: { type: Number, default: 20 },
      exams: { type: Number, default: 40 },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

gradingSystemSchema.index({ systemType: 1 });
gradingSystemSchema.index({ isActive: 1, isDefault: 1 });

gradingSystemSchema.pre("save", function (next) {
  // Validate that grade bands cover the entire score range without gaps
  const bands = [...this.gradeBands].sort((a, b) => a.scoreRange.min - b.scoreRange.min);
  
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    
    // Check for valid range
    if (band.scoreRange.min >= band.scoreRange.max) {
      return next(new Error(`Invalid score range for grade ${band.grade}`));
    }
    
    // Check for gaps between bands
    if (i > 0) {
      const prevBand = bands[i - 1];
      if (band.scoreRange.min !== prevBand.scoreRange.max) {
        return next(new Error(`Gap detected between grades ${prevBand.grade} and ${band.grade}`));
      }
    }
  }
  
  // Check that first band starts at 0 and last band ends at maxScore
  if (bands[0].scoreRange.min !== 0) {
    return next(new Error("Grade bands must start from 0"));
  }
  
  if (bands[bands.length - 1].scoreRange.max !== this.maxScore) {
    return next(new Error(`Grade bands must end at ${this.maxScore}`));
  }
  
  // Validate assessment weights sum to 100
  const totalWeight = 
    this.assessmentWeights.classAssessment +
    this.assessmentWeights.homework +
    this.assessmentWeights.tests +
    this.assessmentWeights.exams;
    
  if (totalWeight !== 100) {
    return next(new Error("Assessment weights must sum to 100"));
  }
  
  next();
});

module.exports = mongoose.model("GradingSystem", gradingSystemSchema);
