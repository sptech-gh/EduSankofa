const mongoose = require("mongoose");

const ghanaReportCardSchema = new mongoose.Schema(
  {
    // Core identification
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GhanaStudent",
      required: true,
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
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GhanaClass",
      required: true,
    },
    
    // Ghanaian term structure
    termName: {
      type: String,
      required: true,
      enum: ["First Term", "Second Term", "Third Term"],
    },
    gradingSystem: {
      type: String,
      required: true,
      enum: ["Basic", "BECE", "WASSCE"],
      default: "Basic",
    },
    
    // Academic performance
    subjects: [{
      subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GhanaSubject",
        required: true,
      },
      subjectName: {
        type: String,
        required: true,
      },
      subjectCode: {
        type: String,
        required: true,
      },
      
      // Ghanaian Continuous Assessment Components
      continuousAssessment: {
        classWork: {
          score: { type: Number, min: 0, max: 40, default: 0 },
          weight: { type: Number, default: 20 },
          remarks: String,
        },
        assignments: {
          score: { type: Number, min: 0, max: 40, default: 0 },
          weight: { type: Number, default: 10 },
          remarks: String,
        },
        tests: {
          score: { type: Number, min: 0, max: 40, default: 0 },
          weight: { type: Number, default: 10 },
          remarks: String,
        },
        projects: {
          score: { type: Number, min: 0, max: 40, default: 0 },
          weight: { type: Number, default: 0 },
          remarks: String,
        },
        totalScore: { type: Number, min: 0, max: 40, default: 0 },
      },
      
      // Examination score (60% weight)
      examination: {
        score: { type: Number, min: 0, max: 60, default: 0 },
        weight: { type: Number, default: 60 },
        remarks: String,
      },
      
      // Final calculations
      totalScore: { type: Number, min: 0, max: 100, default: 0 },
      grade: {
        type: String,
        enum: ["A", "B", "C", "D", "E", "F", "U", "A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
        default: "F",
      },
      gradePoint: { type: Number, min: 0, max: 4.0, default: 0 },
      position: { type: Number, min: 1 },
      remarks: String,
      
      // Teacher information
      subjectTeacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      teacherName: String,
      teacherSignature: String,
    }],
    
    // Overall performance
    overallPerformance: {
      totalSubjects: { type: Number, default: 0 },
      averageScore: { type: Number, min: 0, max: 100, default: 0 },
      totalGradePoints: { type: Number, default: 0 },
      overallGPA: { type: Number, min: 0, max: 4.0, default: 0 },
      classPosition: {
        position: { type: Number, min: 1 },
        outOf: { type: Number, min: 1 },
      },
      gradePosition: { type: Number, min: 1 },
    },
    
    // Attendance summary
    attendance: {
      totalSchoolDays: { type: Number, default: 0 },
      daysPresent: { type: Number, default: 0 },
      daysAbsent: { type: Number, default: 0 },
      daysLate: { type: Number, default: 0 },
      attendancePercentage: { type: Number, min: 0, max: 100, default: 0 },
      attendanceGrade: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
      },
    },
    
    // Conduct and behavior
    conduct: {
      punctuality: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        default: "Good",
      },
      neatness: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        default: "Good",
      },
      politeness: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        default: "Good",
      },
      honesty: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        default: "Good",
      },
      cooperation: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        default: "Good",
      },
      leadership: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        default: "Good",
      },
      overallConduct: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        default: "Good",
      },
    },
    
    // Skills and abilities
    skills: {
      reading: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        default: "Good",
      },
      writing: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        default: "Good",
      },
      mathematics: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        default: "Good",
      },
      science: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        default: "Good",
      },
      creativeArts: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        default: "Good",
      },
      physicalEducation: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        default: "Good",
      },
      ict: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair", "Poor"],
        default: "Good",
      },
    },
    
    // Teacher remarks
    classTeacherRemarks: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    
    headTeacherRemarks: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    
    // Promotion status
    promotion: {
      promoted: { type: Boolean, default: false },
      nextClass: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GhanaClass",
      },
      nextClassName: String,
      promotionCriteria: {
        averageScoreMet: { type: Boolean, default: false },
        attendanceMet: { type: Boolean, default: false },
        conductMet: { type: Boolean, default: false },
        remarks: String,
      },
      promotionDate: Date,
    },
    
    // Workflow and approval
    status: {
      type: String,
      enum: ["Draft", "Submitted", "Under Review", "Approved", "Published", "Locked"],
      default: "Draft",
    },
    
    approval: {
      submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      submittedAt: Date,
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      reviewedAt: Date,
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      approvedAt: Date,
      publishedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      publishedAt: Date,
      lockedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      lockedAt: Date,
    },
    
    // Signatures
    signatures: {
      classTeacher: {
        name: String,
        signature: String,
        date: Date,
      },
      headTeacher: {
        name: String,
        signature: String,
        date: Date,
      },
      parent: {
        name: String,
        signature: String,
        date: Date,
      },
    },
    
    // Metadata
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    academicYearName: String,
    termNumber: Number,
    className: String,
    studentName: String,
    studentId: String,
    schoolName: {
      type: String,
      default: "EduSankofa Basic School",
    },
    schoolAddress: String,
    schoolContact: String,
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for efficient queries
ghanaReportCardSchema.index({ student: 1, academicYear: 1, term: 1 });
ghanaReportCardSchema.index({ class: 1, academicYear: 1, term: 1 });
ghanaReportCardSchema.index({ status: 1 });
ghanaReportCardSchema.index({ "promotion.promoted": 1 });
ghanaReportCardSchema.index({ "overallPerformance.classPosition.position": 1 });

// Virtual for total continuous assessment score
ghanaReportCardSchema.virtual("totalContinuousAssessmentScore").get(function () {
  return this.subjects.reduce((total, subject) => {
    return total + (subject.continuousAssessment?.totalScore || 0);
  }, 0);
});

// Virtual for total examination score
ghanaReportCardSchema.virtual("totalExaminationScore").get(function () {
  return this.subjects.reduce((total, subject) => {
    return total + (subject.examination?.score || 0);
  }, 0);
});

// Pre-save middleware for calculations
ghanaReportCardSchema.pre("save", async function (next) {
  try {
    // Calculate subject scores and grades
    let totalScore = 0;
    let totalGradePoints = 0;
    let totalSubjects = 0;

    this.subjects.forEach(subject => {
      // Calculate continuous assessment total
      const caTotal = (subject.continuousAssessment.classWork.score || 0) +
                      (subject.continuousAssessment.assignments.score || 0) +
                      (subject.continuousAssessment.tests.score || 0) +
                      (subject.continuousAssessment.projects.score || 0);
      
      // Cap continuous assessment at 40
      const caWeighted = Math.min(caTotal, 40);
      subject.continuousAssessment.totalScore = caWeighted;
      
      // Cap exam at 60
      const examWeighted = Math.min(subject.examination.score || 0, 60);
      subject.examination.score = examWeighted;
      
      // Calculate total score (CA + Exam)
      subject.totalScore = caWeighted + examWeighted;
      
      // Determine grade based on selected Ghanaian grading system
      if (this.gradingSystem === "WASSCE") {
        // West African Senior School Certificate Examination (SHS)
        if (subject.totalScore >= 80) {
          subject.grade = "A1";
          subject.gradePoint = 4.0;
        } else if (subject.totalScore >= 70) {
          subject.grade = "B2";
          subject.gradePoint = 3.5;
        } else if (subject.totalScore >= 65) {
          subject.grade = "B3";
          subject.gradePoint = 3.0;
        } else if (subject.totalScore >= 60) {
          subject.grade = "C4";
          subject.gradePoint = 2.5;
        } else if (subject.totalScore >= 55) {
          subject.grade = "C5";
          subject.gradePoint = 2.0;
        } else if (subject.totalScore >= 50) {
          subject.grade = "C6";
          subject.gradePoint = 1.5;
        } else if (subject.totalScore >= 45) {
          subject.grade = "D7";
          subject.gradePoint = 1.0;
        } else if (subject.totalScore >= 40) {
          subject.grade = "E8";
          subject.gradePoint = 0.5;
        } else {
          subject.grade = "F9";
          subject.gradePoint = 0.0;
        }
      } else if (this.gradingSystem === "BECE") {
        // Basic Education Certificate Examination (JHS 3)
        if (subject.totalScore >= 90) {
          subject.grade = "1";
          subject.gradePoint = 4.0;
        } else if (subject.totalScore >= 80) {
          subject.grade = "2";
          subject.gradePoint = 3.5;
        } else if (subject.totalScore >= 70) {
          subject.grade = "3";
          subject.gradePoint = 3.0;
        } else if (subject.totalScore >= 60) {
          subject.grade = "4";
          subject.gradePoint = 2.5;
        } else if (subject.totalScore >= 55) {
          subject.grade = "5";
          subject.gradePoint = 2.0;
        } else if (subject.totalScore >= 50) {
          subject.grade = "6";
          subject.gradePoint = 1.5;
        } else if (subject.totalScore >= 45) {
          subject.grade = "7";
          subject.gradePoint = 1.0;
        } else if (subject.totalScore >= 40) {
          subject.grade = "8";
          subject.gradePoint = 0.5;
        } else {
          subject.grade = "9";
          subject.gradePoint = 0.0;
        }
      } else {
        // Basic school / Primary grading
        if (subject.totalScore >= 80) {
          subject.grade = "A";
          subject.gradePoint = 4.0;
        } else if (subject.totalScore >= 70) {
          subject.grade = "B";
          subject.gradePoint = 3.0;
        } else if (subject.totalScore >= 60) {
          subject.grade = "C";
          subject.gradePoint = 2.0;
        } else if (subject.totalScore >= 50) {
          subject.grade = "D";
          subject.gradePoint = 1.0;
        } else if (subject.totalScore >= 40) {
          subject.grade = "E";
          subject.gradePoint = 0.5;
        } else {
          subject.grade = "F";
          subject.gradePoint = 0.0;
        }
      }
      
      totalScore += subject.totalScore;
      totalGradePoints += subject.gradePoint;
      totalSubjects++;
    });

    // Calculate overall performance
    this.overallPerformance.totalSubjects = totalSubjects;
    this.overallPerformance.averageScore = totalSubjects > 0 ? Math.round(totalScore / totalSubjects) : 0;
    this.overallPerformance.totalGradePoints = totalGradePoints;
    this.overallPerformance.overallGPA = totalSubjects > 0 ? Math.round((totalGradePoints / totalSubjects) * 100) / 100 : 0;

    // Calculate attendance percentage and grade
    if (this.attendance.totalSchoolDays > 0) {
      this.attendance.attendancePercentage = Math.round((this.attendance.daysPresent / this.attendance.totalSchoolDays) * 100);
      
      if (this.attendance.attendancePercentage >= 95) {
        this.attendance.attendanceGrade = "Excellent";
      } else if (this.attendance.attendancePercentage >= 90) {
        this.attendance.attendanceGrade = "Very Good";
      } else if (this.attendance.attendancePercentage >= 80) {
        this.attendance.attendanceGrade = "Good";
      } else if (this.attendance.attendancePercentage >= 70) {
        this.attendance.attendanceGrade = "Fair";
      } else {
        this.attendance.attendanceGrade = "Poor";
      }
    }

    // Calculate overall conduct grade
    const conductGrades = Object.values(this.conduct);
    const excellentCount = conductGrades.filter(g => g === "Excellent").length;
    const veryGoodCount = conductGrades.filter(g => g === "Very Good").length;
    const goodCount = conductGrades.filter(g => g === "Good").length;
    
    if (excellentCount >= 4) {
      this.conduct.overallConduct = "Excellent";
    } else if (veryGoodCount >= 4 || (excellentCount + veryGoodCount) >= 4) {
      this.conduct.overallConduct = "Very Good";
    } else if (goodCount >= 4) {
      this.conduct.overallConduct = "Good";
    } else {
      this.conduct.overallConduct = "Fair";
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Static method to calculate class positions
ghanaReportCardSchema.statics.calculateClassPositions = async function (classId, academicYearId, termId) {
  const reportCards = await this.find({
    class: classId,
    academicYear: academicYearId,
    term: termId,
    status: "Published"
  }).sort({ "overallPerformance.averageScore": -1 });

  if (reportCards.length === 0) return [];

  const bulkOps = reportCards.map((card, index) => ({
    updateOne: {
      filter: { _id: card._id },
      update: {
        $set: {
          "overallPerformance.classPosition": {
            position: index + 1,
            outOf: reportCards.length
          }
        }
      }
    }
  }));

  await this.bulkWrite(bulkOps);

  reportCards.forEach((card, index) => {
    card.overallPerformance.classPosition = {
      position: index + 1,
      outOf: reportCards.length
    };
  });

  return reportCards;
};

// Static method to get report card summary
ghanaReportCardSchema.statics.getClassSummary = async function (classId, academicYearId, termId) {
  const reportCards = await this.find({
    class: classId,
    academicYear: academicYearId,
    term: termId,
    status: "Published"
  }).populate("student", "firstName lastName studentId");

  const summary = {
    totalStudents: reportCards.length,
    averageScore: 0,
    averageGPA: 0,
    attendanceRate: 0,
    promotionRate: 0,
    gradeDistribution: {
      A: 0, B: 0, C: 0, D: 0, E: 0, F: 0
    },
    conductDistribution: {
      Excellent: 0, VeryGood: 0, Good: 0, Fair: 0, Poor: 0
    }
  };

  if (reportCards.length > 0) {
    const totalScore = reportCards.reduce((sum, card) => sum + card.overallPerformance.averageScore, 0);
    const totalGPA = reportCards.reduce((sum, card) => sum + card.overallPerformance.overallGPA, 0);
    const totalAttendance = reportCards.reduce((sum, card) => sum + card.attendance.attendancePercentage, 0);
    const promotedCount = reportCards.filter(card => card.promotion.promoted).length;

    summary.averageScore = Math.round(totalScore / reportCards.length);
    summary.averageGPA = Math.round((totalGPA / reportCards.length) * 100) / 100;
    summary.attendanceRate = Math.round(totalAttendance / reportCards.length);
    summary.promotionRate = Math.round((promotedCount / reportCards.length) * 100);

    // Calculate grade distribution
    reportCards.forEach(card => {
      card.subjects.forEach(subject => {
        summary.gradeDistribution[subject.grade]++;
      });
      summary.conductDistribution[card.conduct.overallConduct]++;
    });
  }

  return summary;
};

// Method to lock report card
ghanaReportCardSchema.methods.lock = function (userId) {
  this.status = "Locked";
  this.approval.lockedBy = userId;
  this.approval.lockedAt = new Date();
  return this.save();
};

// Method to check if can be edited
ghanaReportCardSchema.methods.canEdit = function () {
  return !["Published", "Locked"].includes(this.status);
};

// Method to check if can be approved
ghanaReportCardSchema.methods.canApprove = function () {
  return this.status === "Submitted";
};

// Method to generate PDF data
ghanaReportCardSchema.methods.generatePDFData = function () {
  return {
    studentInfo: {
      name: this.studentName,
      id: this.studentId,
      class: this.className,
      academicYear: this.academicYearName,
      term: this.termName,
    },
    subjects: this.subjects.map(subject => ({
      name: subject.subjectName,
      code: subject.subjectCode,
      ca: subject.continuousAssessment.totalScore,
      exam: subject.examination.score,
      total: subject.totalScore,
      grade: subject.grade,
      gradePoint: subject.gradePoint,
      position: subject.position,
      remarks: subject.remarks,
    })),
    overallPerformance: this.overallPerformance,
    attendance: this.attendance,
    conduct: this.conduct,
    skills: this.skills,
    remarks: {
      classTeacher: this.classTeacherRemarks,
      headTeacher: this.headTeacherRemarks,
    },
    promotion: this.promotion,
    signatures: this.signatures,
    schoolInfo: {
      name: this.schoolName,
      address: this.schoolAddress,
      contact: this.schoolContact,
    },
  };
};

module.exports = mongoose.model("GhanaReportCard", ghanaReportCardSchema);
