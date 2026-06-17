const mongoose = require("mongoose");

const reportCardSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
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
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
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
    subjects: [
      {
        subject: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subject",
          required: true,
        },
        grades: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Grade",
          },
        ],
        classworkScore: {
          type: Number,
          min: 0,
          max: 100,
        },
        examScore: {
          type: Number,
          min: 0,
          max: 100,
        },
        totalScore: {
          type: Number,
          min: 0,
          max: 100,
        },
        finalGrade: {
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
        credits: {
          type: Number,
          required: true,
        },
        gradePoints: {
          type: Number,
        },
      },
    ],
    overallGPA: {
      type: Number,
      min: 0,
      max: 4.0,
    },
    totalCredits: {
      type: Number,
      default: 0,
    },
    totalGradePoints: {
      type: Number,
      default: 0,
    },
    totalScore: {
      type: Number,
      min: 0,
    },
    averageScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    classRank: {
      position: {
        type: Number,
        min: 1,
      },
      outOf: {
        type: Number,
        min: 1,
      },
    },
    attendance: {
      totalDays: {
        type: Number,
        default: 0,
      },
      presentDays: {
        type: Number,
        default: 0,
      },
      attendancePercentage: {
        type: Number,
        min: 0,
        max: 100,
      },
    },
    teacherComments: {
      type: String,
      trim: true,
    },
    principalComments: {
      type: String,
      trim: true,
    },
    conduct: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    promotionStatus: {
      promoted: {
        type: Boolean,
      },
      nextGrade: {
        type: String,
        trim: true,
      },
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    publishedDate: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Calculate GPA and grade points before saving
reportCardSchema.pre("save", function (next) {
  let totalCredits = 0;
  let totalGradePoints = 0;

  this.subjects.forEach((subject) => {
    if (subject.finalGrade !== undefined && subject.credits) {
      // Convert percentage to grade points (4.0 scale)
      let gradePoints = 0;
      if (subject.finalGrade >= 80) gradePoints = 4.0;
      else if (subject.finalGrade >= 70) gradePoints = 3.0;
      else if (subject.finalGrade >= 60) gradePoints = 2.0;
      else if (subject.finalGrade >= 45) gradePoints = 1.0;
      else if (subject.finalGrade >= 35) gradePoints = 0.5;
      else gradePoints = 0.0;

      subject.gradePoints = gradePoints;
      totalCredits += subject.credits;
      totalGradePoints += gradePoints * subject.credits;

      // Set letter grade
      if (subject.finalGrade >= 80) subject.letterGrade = "A";
      else if (subject.finalGrade >= 70) subject.letterGrade = "B";
      else if (subject.finalGrade >= 60) subject.letterGrade = "C";
      else if (subject.finalGrade >= 45) subject.letterGrade = "D";
      else if (subject.finalGrade >= 35) subject.letterGrade = "E";
      else subject.letterGrade = "F";
    }
  });

  this.totalCredits = totalCredits;
  this.totalGradePoints = totalGradePoints;
  this.overallGPA =
    totalCredits > 0
      ? Math.round((totalGradePoints / totalCredits) * 100) / 100
      : 0;

  // Calculate attendance percentage
  if (this.attendance.totalDays > 0) {
    this.attendance.attendancePercentage =
      Math.round(
        (this.attendance.presentDays / this.attendance.totalDays) * 100 * 100
      ) / 100;
  }

  next();
});

// Index for efficient queries
reportCardSchema.index({ student: 1, academicYear: 1, semester: 1 });
reportCardSchema.index({ class: 1, academicYear: 1, semester: 1 });

module.exports = mongoose.model("ReportCard", reportCardSchema);
