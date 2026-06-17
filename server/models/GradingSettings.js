const mongoose = require("mongoose");

const gradingSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default",
    },
    gradingScale: {
      type: String,
      enum: ["ghana", "us"],
      default: "ghana",
    },
    classworkWeight: {
      type: Number,
      default: 0.3,
      min: 0,
      max: 1,
    },
    examWeight: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 1,
    },
  },
  { timestamps: true }
);

gradingSettingsSchema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model("GradingSettings", gradingSettingsSchema);
