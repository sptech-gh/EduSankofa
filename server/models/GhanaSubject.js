const mongoose = require("mongoose");

// Ghanaian curriculum subjects by level
const GHANAIAN_SUBJECTS = {
  "Creche": [
    "Language Development", "Number Work", "Creative Arts", "Physical Development",
    "Social & Emotional Development", "Practical Life Skills", "Music & Movement"
  ],
  "Nursery 1": [
    "English Language", "Mathematics", "Creative Arts", "Physical Education",
    "Environmental Studies", "Religious & Moral Education", "Music & Dance"
  ],
  "Nursery 2": [
    "English Language", "Mathematics", "Creative Arts", "Physical Education",
    "Environmental Studies", "Religious & Moral Education", "Music & Dance"
  ],
  "KG 1": [
    "English Language", "Mathematics", "Creative Arts", "Physical Education",
    "Environmental Studies", "Religious & Moral Education", "Music & Dance"
  ],
  "KG 2": [
    "English Language", "Mathematics", "Creative Arts", "Physical Education",
    "Environmental Studies", "Religious & Moral Education", "Music & Dance", "ICT Basics"
  ],
  "Primary 1": [
    "English Language", "Mathematics", "Integrated Science", "Social Studies",
    "Creative Arts", "Physical Education", "Religious & Moral Education", "Ghanaian Language", "ICT"
  ],
  "Primary 2": [
    "English Language", "Mathematics", "Integrated Science", "Social Studies",
    "Creative Arts", "Physical Education", "Religious & Moral Education", "Ghanaian Language", "ICT"
  ],
  "Primary 3": [
    "English Language", "Mathematics", "Integrated Science", "Social Studies",
    "Creative Arts", "Physical Education", "Religious & Moral Education", "Ghanaian Language", "ICT", "French"
  ],
  "Primary 4": [
    "English Language", "Mathematics", "Integrated Science", "Social Studies",
    "Creative Arts", "Physical Education", "Religious & Moral Education", "Ghanaian Language", "ICT", "French", "Basic Design & Technology"
  ],
  "Primary 5": [
    "English Language", "Mathematics", "Integrated Science", "Social Studies",
    "Creative Arts", "Physical Education", "Religious & Moral Education", "Ghanaian Language", "ICT", "French", "Basic Design & Technology"
  ],
  "Primary 6": [
    "English Language", "Mathematics", "Integrated Science", "Social Studies",
    "Creative Arts", "Physical Education", "Religious & Moral Education", "Ghanaian Language", "ICT", "French", "Basic Design & Technology"
  ],
  "JHS 1": [
    "English Language", "Mathematics", "Integrated Science", "Social Studies",
    "Creative Arts & Design", "Physical Education", "Religious & Moral Education", "Ghanaian Language", "ICT", "French", "Basic Design & Technology"
  ],
  "JHS 2": [
    "English Language", "Mathematics", "Integrated Science", "Social Studies",
    "Creative Arts & Design", "Physical Education", "Religious & Moral Education", "Ghanaian Language", "ICT", "French", "Basic Design & Technology"
  ],
  "JHS 3": [
    "English Language", "Mathematics", "Integrated Science", "Social Studies",
    "Creative Arts & Design", "Physical Education", "Religious & Moral Education", "Ghanaian Language", "ICT", "French", "Basic Design & Technology", "Career Technology"
  ],
  "SHS 1": [
    "Core Mathematics", "English Language", "Integrated Science", "Social Studies",
    "Elective Mathematics", "Physics", "Chemistry", "Biology", "Economics", "Geography", "History", "Government", "Literature in English", "Financial Accounting", "Business Management"
  ],
  "SHS 2": [
    "Core Mathematics", "English Language", "Integrated Science", "Social Studies",
    "Elective Mathematics", "Physics", "Chemistry", "Biology", "Economics", "Geography", "History", "Government", "Literature in English", "Financial Accounting", "Business Management"
  ],
  "SHS 3": [
    "Core Mathematics", "English Language", "Integrated Science", "Social Studies",
    "Elective Mathematics", "Physics", "Chemistry", "Biology", "Economics", "Geography", "History", "Government", "Literature in English", "Financial Accounting", "Business Management"
  ],
  "A-Level": [
    "Mathematics", "Physics", "Chemistry", "Biology", "Economics", "Geography", "History", "Government", "English Literature", "Accounting"
  ]
};

const ghanaSubjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "Core", "Elective", "Practical", "Language", "Science", 
        "Arts", "Technical", "Physical", "Moral", "Technology"
      ],
      required: true,
    },
    levels: [{
      type: String,
      enum: Object.keys(GHANAIAN_SUBJECTS),
      required: true,
    }],
    isCompulsory: {
      type: Boolean,
      default: false,
    },
    credits: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 1,
    },
    weeklyPeriods: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      default: 1,
    },
    teachers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
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
    assessmentComponents: {
      classAssessment: { type: Number, default: 30 },
      homework: { type: Number, default: 10 },
      tests: { type: Number, default: 20 },
      exams: { type: Number, default: 40 },
    },
    resources: [{
      type: { type: String, enum: ["Textbook", "Workbook", "Lab", "Equipment", "Software"] },
      name: String,
      quantity: Number,
      condition: { type: String, enum: ["New", "Good", "Fair", "Poor"] },
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound indexes
ghanaSubjectSchema.index({ code: 1 }, { unique: true });
ghanaSubjectSchema.index({ academicYear: 1, term: 1 });
ghanaSubjectSchema.index({ levels: 1 });
ghanaSubjectSchema.index({ category: 1 });
ghanaSubjectSchema.index({ isActive: 1 });

// Static method to get subjects by level
ghanaSubjectSchema.statics.getSubjectsByLevel = function (level) {
  return GHANAIAN_SUBJECTS[level] || [];
};

// Static method to get all Ghanaian subjects structure
ghanaSubjectSchema.statics.getGhanaianCurriculum = function () {
  return GHANAIAN_SUBJECTS;
};

// Static method to create subjects for a level
ghanaSubjectSchema.statics.createSubjectsForLevel = async function (level, academicYear, term) {
  const subjectNames = GHANAIAN_SUBJECTS[level];
  if (!subjectNames) {
    throw new Error(`Invalid level: ${level}`);
  }

  const subjects = [];
  for (const subjectName of subjectNames) {
    const code = `${level.substring(0, 3).toUpperCase()}_${subjectName.substring(0, 3).toUpperCase()}`;
    
    // Determine category based on subject name
    let category = "Core";
    if (subjectName.includes("English") || subjectName.includes("Language") || subjectName.includes("French")) {
      category = "Language";
    } else if (subjectName.includes("Science") || subjectName.includes("Mathematics")) {
      category = "Science";
    } else if (subjectName.includes("Arts") || subjectName.includes("Creative")) {
      category = "Arts";
    } else if (subjectName.includes("Physical") || subjectName.includes("PE")) {
      category = "Physical";
    } else if (subjectName.includes("Technology") || subjectName.includes("ICT") || subjectName.includes("Design")) {
      category = "Technical";
    } else if (subjectName.includes("Moral") || subjectName.includes("Religious")) {
      category = "Moral";
    }

    const subject = new this({
      name: subjectName,
      code: code,
      category: category,
      levels: [level],
      isCompulsory: ["English Language", "Mathematics", "Integrated Science", "Social Studies"].includes(subjectName),
      academicYear: academicYear,
      term: term,
    });

    subjects.push(subject);
  }

  return this.insertMany(subjects);
};

// Instance method to assign teacher
ghanaSubjectSchema.methods.assignTeacher = function (teacherId) {
  if (!this.teachers.includes(teacherId)) {
    this.teachers.push(teacherId);
  }
  return this.save();
};

// Instance method to remove teacher
ghanaSubjectSchema.methods.removeTeacher = function (teacherId) {
  this.teachers = this.teachers.filter(id => !id.equals(teacherId));
  return this.save();
};

module.exports = mongoose.model("GhanaSubject", ghanaSubjectSchema);
