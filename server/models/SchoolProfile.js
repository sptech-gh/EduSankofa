const mongoose = require("mongoose");

const schoolProfileSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default",
    },
    schoolName: {
      type: String,
      trim: true,
    },
    motto: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["Primary", "JHS", "SHS", "Combined", "International"],
      trim: true,
    },
    schoolCode: {
      type: String,
      unique: true,
      trim: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

schoolProfileSchema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model("SchoolProfile", schoolProfileSchema);
