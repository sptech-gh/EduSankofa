const mongoose = require("mongoose");

const termSchema = new mongoose.Schema(
  {
    academicYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
    },
    name: {
      type: String,
      enum: ["First Term", "Second Term", "Third Term"],
      required: true,
    },
    order: {
      type: Number,
      enum: [1, 2, 3],
      required: true,
    },
    legacySemester: {
      type: String,
      enum: ["Fall", "Spring", "Summer"],
      required: false,
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

termSchema.index({ academicYear: 1, name: 1 }, { unique: true });
termSchema.index({ academicYear: 1, order: 1 }, { unique: true });
termSchema.index({ academicYear: 1, isActive: 1 });

module.exports = mongoose.model("Term", termSchema);
