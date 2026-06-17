const mongoose = require("mongoose");

const promotionEngineSchema = new mongoose.Schema(
  {
    // Core identification
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
    
    // Promotion settings
    promotionSettings: {
      // Academic criteria
      minimumAverageScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 50,
      },
      minimumGPA: {
        type: Number,
        min: 0,
        max: 4.0,
        default: 1.0,
      },
      maximumFailedSubjects: {
        type: Number,
        min: 0,
        default: 2,
      },
      
      // Attendance criteria
      minimumAttendanceRate: {
        type: Number,
        min: 0,
        max: 100,
        default: 75,
      },
      
      // Conduct criteria
      minimumConductGrade: {
        type: String,
        enum: ["Excellent", "Very Good", "Good", "Fair"],
        default: "Fair",
      },
      
      // Age criteria (for specific levels)
      maximumAgeForLevel: [{
        level: {
          type: String,
          enum: [
            "Creche", "Nursery 1", "Nursery 2", "KG 1", "KG 2",
            "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
            "JHS 1", "JHS 2", "JHS 3"
          ],
        },
        maxAge: {
          type: Number,
          required: true,
        },
      }],
      
      // Special considerations
      allowConditionalPromotion: {
        type: Boolean,
        default: true,
      },
      conditionalPromotionScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 45,
      },
      requireParentalConsent: {
        type: Boolean,
        default: false,
      },
      
      // Retention policies
      maxRetentionsPerLevel: {
        type: Number,
        min: 0,
        max: 3,
        default: 2,
      },
      retentionAgeLimit: {
        type: Number,
        default: 15,
      },
    },
    
    // Promotion results
    promotionResults: [{
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GhanaStudent",
        required: true,
      },
      currentClass: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GhanaClass",
        required: true,
      },
      currentLevel: {
        type: String,
        required: true,
      },
      
      // Academic evaluation
      academicEvaluation: {
        averageScore: {
          type: Number,
          required: true,
        },
        overallGPA: {
          type: Number,
          required: true,
        },
        failedSubjects: [{
          subjectName: String,
          grade: String,
          score: Number,
        }],
        totalSubjects: {
          type: Number,
          required: true,
        },
        classPosition: {
          position: Number,
          outOf: Number,
        },
      },
      
      // Attendance evaluation
      attendanceEvaluation: {
        totalDays: {
          type: Number,
          required: true,
        },
        presentDays: {
          type: Number,
          required: true,
        },
        attendanceRate: {
          type: Number,
          required: true,
        },
        attendanceGrade: String,
      },
      
      // Conduct evaluation
      conductEvaluation: {
        overallConduct: {
          type: String,
          required: true,
        },
        punctuality: String,
        neatness: String,
        cooperation: String,
      },
      
      // Age evaluation
      ageEvaluation: {
        currentAge: Number,
        maxAgeForLevel: Number,
        ageAppropriate: Boolean,
      },
      
      // Promotion decision
      promotionDecision: {
        promoted: {
          type: Boolean,
          required: true,
        },
        nextClass: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "GhanaClass",
        },
        nextLevel: String,
        promotionType: {
          type: String,
          enum: ["Standard", "Conditional", "Retained", "Special Consideration"],
          required: true,
        },
        reasons: [{
          type: {
            type: String,
            enum: ["Academic", "Attendance", "Conduct", "Age", "Health", "Other"],
          },
          description: String,
          weight: {
            type: Number,
            min: 0,
            max: 1,
            default: 1,
          },
        }],
        conditions: [{
          type: String,
          description: String,
          deadline: Date,
          met: {
            type: Boolean,
            default: false,
          },
        }],
      },
      
      // Retention history
      retentionHistory: [{
        academicYear: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AcademicYear",
        },
        term: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Term",
        },
        level: String,
        reason: String,
        date: {
          type: Date,
          default: Date.now,
        },
      }],
      
      // Approval workflow
      approval: {
        recommendedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        recommendedAt: Date,
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
        parentalConsent: {
          given: {
            type: Boolean,
            default: false,
          },
          givenBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          givenAt: Date,
          method: {
            type: String,
            enum: ["Written", "Electronic", "Verbal"],
          },
        },
        status: {
          type: String,
          enum: ["Pending", "Under Review", "Approved", "Rejected", "Parental Consent Required"],
          default: "Pending",
        },
        rejectionReason: String,
      },
      
      // Implementation tracking
      implementation: {
        promotedOn: Date,
        newClassAssigned: {
          type: Boolean,
          default: false,
        },
        recordsUpdated: {
          type: Boolean,
          default: false,
        },
        parentsNotified: {
          type: Boolean,
          default: false,
        },
        notifiedAt: Date,
      },
      
      // Metadata
      evaluatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      evaluatedAt: {
        type: Date,
        default: Date.now,
      },
      lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      notes: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
    }],
    
    // Summary statistics
    summary: {
      totalStudents: {
        type: Number,
        default: 0,
      },
      promoted: {
        type: Number,
        default: 0,
      },
      retained: {
        type: Number,
        default: 0,
      },
      conditionalPromotion: {
        type: Number,
        default: 0,
      },
      specialConsideration: {
        type: Number,
        default: 0,
      },
      promotionRate: {
        type: Number,
        default: 0,
      },
    },
    
    // Status and workflow
    status: {
      type: String,
      enum: ["Draft", "In Progress", "Under Review", "Approved", "Implemented", "Archived"],
      default: "Draft",
    },
    
    // Archive information
    archiveInfo: {
      archivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      archivedAt: Date,
      archiveReason: String,
      isLocked: {
        type: Boolean,
        default: false,
      },
    },
    
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    academicYearName: String,
    termName: String,
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for efficient queries
promotionEngineSchema.index({ academicYear: 1, term: 1, status: 1 });
promotionEngineSchema.index({ "promotionResults.student": 1 });
promotionEngineSchema.index({ "promotionResults.promotionDecision.promoted": 1 });
promotionEngineSchema.index({ "promotionResults.approval.status": 1 });

// Virtual for promotion rate
promotionEngineSchema.virtual("promotionRate").get(function () {
  if (this.summary.totalStudents === 0) return 0;
  return Math.round((this.summary.promoted / this.summary.totalStudents) * 100);
});

// Method to evaluate student for promotion
promotionEngineSchema.methods.evaluateStudent = async function (student, reportCard, attendance, settings) {
  const evaluation = {
    academic: {},
    attendance: {},
    conduct: {},
    age: {},
    decision: {},
  };

  // Academic evaluation
  evaluation.academic = {
    averageScore: reportCard.overallPerformance.averageScore,
    overallGPA: reportCard.overallPerformance.overallGPA,
    failedSubjects: reportCard.subjects
      .filter(s => s.grade === "F" || s.grade === "E")
      .map(s => ({
        subjectName: s.subjectName,
        grade: s.grade,
        score: s.totalScore,
      })),
    totalSubjects: reportCard.subjects.length,
    classPosition: reportCard.overallPerformance.classPosition,
    meetsMinScore: reportCard.overallPerformance.averageScore >= settings.minimumAverageScore,
    meetsMinGPA: reportCard.overallPerformance.overallGPA >= settings.minimumGPA,
    meetsMaxFailed: evaluation.academic.failedSubjects.length <= settings.maximumFailedSubjects,
  };

  // Attendance evaluation
  evaluation.attendance = {
    totalDays: attendance.totalDays,
    presentDays: attendance.presentDays,
    attendanceRate: attendance.attendancePercentage,
    attendanceGrade: attendance.attendanceGrade,
    meetsMinAttendance: attendance.attendancePercentage >= settings.minimumAttendanceRate,
  };

  // Conduct evaluation (would come from report card)
  evaluation.conduct = {
    overallConduct: reportCard.conduct.overallConduct || "Good",
    meetsMinConduct: this.compareConductGrades(
      reportCard.conduct.overallConduct || "Good",
      settings.minimumConductGrade
    ),
  };

  // Age evaluation
  const currentAge = this.calculateAge(student.dateOfBirth);
  const maxAgeForLevel = settings.maximumAgeForLevel.find(
    setting => setting.level === student.currentLevel
  );
  
  evaluation.age = {
    currentAge,
    maxAgeForLevel: maxAgeForLevel?.maxAge || null,
    ageAppropriate: maxAgeForLevel ? currentAge <= maxAgeForLevel.maxAge : true,
  };

  // Determine promotion decision
  evaluation.decision = this.determinePromotionDecision(evaluation, settings, student);

  return evaluation;
};

// Method to compare conduct grades
promotionEngineSchema.methods.compareConductGrades = function (studentGrade, minimumGrade) => {
  const gradeOrder = ["Poor", "Fair", "Good", "Very Good", "Excellent"];
  const studentIndex = gradeOrder.indexOf(studentGrade);
  const minIndex = gradeOrder.indexOf(minimumGrade);
  
  return studentIndex >= minIndex;
};

// Method to calculate age
promotionEngineSchema.methods.calculateAge = function (dateOfBirth) {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// Method to determine promotion decision
promotionEngineSchema.methods.determinePromotionDecision = function (evaluation, settings, student) {
  const decision = {
    promoted: false,
    reasons: [],
    promotionType: "Standard",
    conditions: [],
  };

  // Check academic criteria
  if (!evaluation.academic.meetsMinScore) {
    decision.reasons.push({
      type: "Academic",
      description: `Average score ${evaluation.academic.averageScore} below minimum ${settings.minimumAverageScore}`,
      weight: 0.4,
    });
  }

  if (!evaluation.academic.meetsMinGPA) {
    decision.reasons.push({
      type: "Academic",
      description: `GPA ${evaluation.academic.overallGPA} below minimum ${settings.minimumGPA}`,
      weight: 0.3,
    });
  }

  if (!evaluation.academic.meetsMaxFailed) {
    decision.reasons.push({
      type: "Academic",
      description: `${evaluation.academic.failedSubjects.length} failed subjects exceeds maximum ${settings.maximumFailedSubjects}`,
      weight: 0.3,
    });
  }

  // Check attendance criteria
  if (!evaluation.attendance.meetsMinAttendance) {
    decision.reasons.push({
      type: "Attendance",
      description: `Attendance rate ${evaluation.attendance.attendanceRate}% below minimum ${settings.minimumAttendanceRate}%`,
      weight: 0.2,
    });
  }

  // Check conduct criteria
  if (!evaluation.conduct.meetsMinConduct) {
    decision.reasons.push({
      type: "Conduct",
      description: `Conduct grade "${evaluation.conduct.overallConduct}" below minimum "${settings.minimumConductGrade}"`,
      weight: 0.1,
    });
  }

  // Check age criteria
  if (!evaluation.age.ageAppropriate) {
    decision.reasons.push({
      type: "Age",
      description: `Age ${evaluation.age.currentAge} exceeds maximum ${evaluation.age.maxAgeForLevel} for level`,
      weight: 0.5,
    });
  }

  // Calculate total weight of reasons
  const totalWeight = decision.reasons.reduce((sum, reason) => sum + reason.weight, 0);

  // Make promotion decision
  if (totalWeight === 0) {
    decision.promoted = true;
    decision.promotionType = "Standard";
  } else if (totalWeight < 0.7 && settings.allowConditionalPromotion) {
    decision.promoted = true;
    decision.promotionType = "Conditional";
    
    // Add conditions for conditional promotion
    if (evaluation.academic.averageScore < settings.minimumAverageScore) {
      decision.conditions.push({
        type: "Academic",
        description: "Attend summer school to improve academic performance",
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      });
    }
    
    if (evaluation.attendance.attendanceRate < settings.minimumAttendanceRate) {
      decision.conditions.push({
        type: "Attendance",
        description: "Maintain minimum attendance rate next term",
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      });
    }
  } else {
    decision.promoted = false;
    decision.promotionType = "Retained";
  }

  // Special considerations
  if (student.hasSpecialNeeds || student.hasMedicalCondition) {
    decision.promoted = true;
    decision.promotionType = "Special Consideration";
    decision.reasons.push({
      type: "Other",
      description: "Special consideration due to special needs or medical condition",
      weight: 0,
    });
  }

  return decision;
};

// Method to run promotion for entire class
promotionEngineSchema.methods.runClassPromotion = async function (classId, settings) {
  const GhanaStudent = require("../models/GhanaStudent");
  const GhanaReportCard = require("../models/GhanaReportCard");
  const GhanaAttendance = require("../models/GhanaAttendance");

  const students = await GhanaStudent.find({ 
    currentClass: classId, 
    status: "Active" 
  });

  const results = [];

  for (const student of students) {
    try {
      // Get student's report card
      const reportCard = await GhanaReportCard.findOne({
        student: student._id,
        academicYear: this.academicYear,
        term: this.term,
        status: "Published",
      });

      if (!reportCard) {
        results.push({
          studentId: student._id,
          error: "No report card found",
        });
        continue;
      }

      // Get student's attendance
      const attendance = await GhanaAttendance.getStudentAttendanceSummary(
        student._id,
        this.academicYear,
        this.term
      );

      // Evaluate student
      const evaluation = await this.evaluateStudent(student, reportCard, attendance, settings);

      // Find next class
      const nextClass = await this.findNextClass(student, evaluation.promoted);

      // Create promotion result
      const promotionResult = {
        student: student._id,
        currentClass: student.currentClass,
        currentLevel: student.currentLevel,
        academicEvaluation: evaluation.academic,
        attendanceEvaluation: evaluation.attendance,
        conductEvaluation: evaluation.conduct,
        ageEvaluation: evaluation.age,
        promotionDecision: {
          promoted: evaluation.decision.promoted,
          nextClass: nextClass._id,
          nextLevel: nextClass.level,
          promotionType: evaluation.decision.promotionType,
          reasons: evaluation.decision.reasons,
          conditions: evaluation.decision.conditions,
        },
        evaluatedBy: this.evaluatedBy,
        evaluatedAt: new Date(),
      };

      // Add to promotion results
      this.promotionResults.push(promotionResult);
      results.push({
        studentId: student._id,
        promoted: evaluation.decision.promoted,
        promotionType: evaluation.decision.promotionType,
      });
    } catch (err) {
      results.push({
        studentId: student._id,
        error: err.message,
      });
    }
  }

  // Update summary
  this.updateSummary();

  await this.save();
  return results;
};

// Method to find next class
promotionEngineSchema.methods.findNextClass = async function (student, promoted) {
  if (!promoted) {
    // Return current class if not promoted
    const GhanaClass = require("../models/GhanaClass");
    return await GhanaClass.findById(student.currentClass);
  }

  const GhanaClass = require("../models/GhanaClass");
  const levels = GhanaClass.getGhanaianLevels();
  const currentLevelIndex = levels.findIndex(l => l.name === student.currentLevel);
  
  if (currentLevelIndex === -1 || currentLevelIndex === levels.length - 1) {
    // Student is at highest level or level not found
    return await GhanaClass.findById(student.currentClass);
  }

  const nextLevel = levels[currentLevelIndex + 1];
  
  // Find class in next level (prefer same section if available)
  const nextClass = await GhanaClass.findOne({
    level: nextLevel.name,
    section: student.currentClass?.section || "A",
  });

  return nextClass || await GhanaClass.findOne({ level: nextLevel.name });
};

// Method to update summary
promotionEngineSchema.methods.updateSummary = function () {
  const total = this.promotionResults.length;
  const promoted = this.promotionResults.filter(r => r.promotionDecision.promoted).length;
  const retained = total - promoted;
  const conditional = this.promotionResults.filter(r => r.promotionDecision.promotionType === "Conditional").length;
  const special = this.promotionResults.filter(r => r.promotionDecision.promotionType === "Special Consideration").length;

  this.summary = {
    totalStudents: total,
    promoted,
    retained,
    conditionalPromotion: conditional,
    specialConsideration: special,
    promotionRate: total > 0 ? Math.round((promoted / total) * 100) : 0,
  };
};

// Static method to create promotion engine
promotionEngineSchema.statics.createPromotionEngine = async function (academicYearId, termId, settings, createdBy) {
  const engine = new this({
    academicYear: academicYearId,
    term: termId,
    promotionSettings: settings,
    createdBy,
  });

  await engine.save();
  return engine;
};

// Static method to get promotion history for student
promotionEngineSchema.statics.getStudentPromotionHistory = async function (studentId) {
  return this.find({
    "promotionResults.student": studentId,
  })
    .populate("academicYear", "name")
    .populate("term", "name")
    .populate("promotionResults.currentClass", "name level section")
    .populate("promotionResults.nextClass", "name level section")
    .sort({ "promotionResults.evaluatedAt": -1 });
};

// Pre-save middleware
promotionEngineSchema.pre("save", function (next) {
  if (this.isModified("promotionResults")) {
    this.updateSummary();
  }
  next();
});

module.exports = mongoose.model("PromotionEngine", promotionEngineSchema);
