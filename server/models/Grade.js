const mongoose = require("mongoose");

const gradeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
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
    gradeType: {
      type: String,
      enum: [
        "assignment",
        "quiz",
        "midterm",
        "final",
        "project",
        "participation",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
    },
    maxScore: {
      type: Number,
      required: true,
      min: 1,
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    letterGrade: {
      type: String,
      enum: [
        "A+",
        "A",
        "A-",
        "B+",
        "B",
        "B-",
        "C+",
        "C",
        "C-",
        "D+",
        "D",
        "D-",
        "E",
        "F",
      ],
    },
    weight: {
      type: Number,
      default: 1,
      min: 0,
    },
    dueDate: {
      type: Date,
    },
    submittedDate: {
      type: Date,
      default: Date.now,
    },
    comments: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },
  },
  { timestamps: true }
);

// Calculate percentage before saving
gradeSchema.pre("save", function (next) {
  if (this.score !== undefined && this.maxScore !== undefined) {
    this.percentage =
      Math.round((this.score / this.maxScore) * 100 * 100) / 100;

    // Calculate letter grade based on percentage
    if (this.percentage >= 80) this.letterGrade = "A";
    else if (this.percentage >= 70) this.letterGrade = "B";
    else if (this.percentage >= 60) this.letterGrade = "C";
    else if (this.percentage >= 45) this.letterGrade = "D";
    else if (this.percentage >= 35) this.letterGrade = "E";
    else this.letterGrade = "F";
  }
  next();
});

// Index for efficient queries
gradeSchema.index({ student: 1, subject: 1 });
gradeSchema.index({ teacher: 1 });

module.exports = mongoose.model("Grade", gradeSchema);
