const mongoose = require("mongoose");

const academicYearSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

academicYearSchema.pre("save", function(next) {
  if (this.startDate && this.startDate.getMonth() !== 8) { // Month 8 = September (0-indexed)
    return next(new Error("Ghana academic year must start in September"));
  }
  next();
});

academicYearSchema.index({ isActive: 1 });

module.exports = mongoose.model("AcademicYear", academicYearSchema);
