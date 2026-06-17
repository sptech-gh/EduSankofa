const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
  // Ignore fallback issues
}

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

// Load backend environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const User = require("../models/User");
const AcademicYear = require("../models/AcademicYear");
const Term = require("../models/Term");
const SchoolConfig = require("../models/SchoolConfig");
const GradingSystem = require("../models/GradingSystem");
const ClassModel = require("../models/Class");
const Subject = require("../models/Subject");
const Student = require("../models/Student");
const Enrollment = require("../models/Enrollment");
const Grade = require("../models/Grade");
const TeacherAssignment = require("../models/TeacherAssignment");

const GhanaClass = require("../models/GhanaClass");
const GhanaSubject = require("../models/GhanaSubject");
const GhanaStudent = require("../models/GhanaStudent");
const StudentLedger = require("../models/StudentLedger");
const GhanaFeeStructure = require("../models/GhanaFeeStructure");

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI is not set in server/.env");
    process.exit(1);
  }

  console.log("Connecting to database for school data seeding...");
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("✔ Connected to MongoDB successfully.");

  // Fetch seeded users
  const adminUser = await User.findOne({ role: "admin" });
  const teacherUser = await User.findOne({ role: "teacher" });
  const parentUser = await User.findOne({ role: "parent" });

  if (!adminUser || !teacherUser || !parentUser) {
    console.error("✖ Demo users are missing. Run seedDemoUsers.js first.");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log("Cleaning academic records, class, subject, student, and grade collections...");
  await Promise.all([
    AcademicYear.deleteMany({}),
    Term.deleteMany({}),
    SchoolConfig.deleteMany({}),
    GradingSystem.deleteMany({}),
    ClassModel.deleteMany({}),
    Subject.deleteMany({}),
    Student.deleteMany({}),
    Enrollment.deleteMany({}),
    Grade.deleteMany({}),
    TeacherAssignment.deleteMany({}),
    GhanaClass.deleteMany({}),
    GhanaSubject.deleteMany({}),
    GhanaStudent.deleteMany({}),
    StudentLedger.deleteMany({}),
    GhanaFeeStructure.deleteMany({}),
  ]);
  try {
    await StudentLedger.collection.dropIndex("transactions.receiptNumber_1");
  } catch (err) {
    // Ignore if index doesn't exist
  }
  console.log("✔ Cleanup complete.");

  // 1. Create Academic Year (September start)
  console.log("Seeding Academic Year...");
  const academicYear = await AcademicYear.create({
    name: "2025/2026",
    startDate: new Date("2025-09-01"),
    endDate: new Date("2026-07-31"),
    isActive: true,
  });

  // 2. Create Term
  console.log("Seeding Term...");
  const term = await Term.create({
    academicYear: academicYear._id,
    name: "First Term",
    order: 1,
    legacySemester: "Fall",
    startDate: new Date("2025-09-01"),
    endDate: new Date("2025-12-18"),
    isActive: true,
  });

  // 3. Create Grading System
  console.log("Seeding Grading Systems...");
  const gradingSystem = await GradingSystem.create({
    name: "Ghanaian Basic Education Grading System",
    description: "Standard WAEC grading system for Ghanaian basic schools",
    systemType: "Ghana Basic",
    passingScore: 50,
    maxScore: 100,
    gradeBands: [
      { scoreRange: { min: 80, max: 100 }, grade: "A", interpretation: "Excellent", remarks: "Outstanding Performance", gpaPoints: 4.0 },
      { scoreRange: { min: 75, max: 80 }, grade: "B2", interpretation: "Very Good", remarks: "Very Good Performance", gpaPoints: 3.5 },
      { scoreRange: { min: 70, max: 75 }, grade: "B3", interpretation: "Good", remarks: "Good Performance", gpaPoints: 3.0 },
      { scoreRange: { min: 65, max: 70 }, grade: "C4", interpretation: "Credit", remarks: "Credit Performance", gpaPoints: 2.5 },
      { scoreRange: { min: 60, max: 65 }, grade: "C5", interpretation: "Credit", remarks: "Credit Performance", gpaPoints: 2.0 },
      { scoreRange: { min: 55, max: 60 }, grade: "C6", interpretation: "Credit", remarks: "Credit Performance", gpaPoints: 1.5 },
      { scoreRange: { min: 50, max: 55 }, grade: "D7", interpretation: "Pass", remarks: "Pass Performance", gpaPoints: 1.0 },
      { scoreRange: { min: 45, max: 50 }, grade: "E8", interpretation: "Weak Pass", remarks: "Weak Performance", gpaPoints: 0.5 },
      { scoreRange: { min: 0, max: 45 }, grade: "F9", interpretation: "Fail", remarks: "Poor Performance", gpaPoints: 0.0 },
    ],
    assessmentWeights: {
      classAssessment: 30,
      homework: 10,
      tests: 20,
      exams: 40,
    },
    isDefault: true,
  });

  const primaryGradingSystem = await GradingSystem.create({
    name: "Ghanaian Primary School Grading System",
    description: "Standard letter grading system (A-F) for Ghanaian primary schools",
    systemType: "Ghana Basic",
    passingScore: 50,
    maxScore: 100,
    gradeBands: [
      { scoreRange: { min: 80, max: 100 }, grade: "A", interpretation: "Excellent", remarks: "Outstanding Performance", gpaPoints: 4.0 },
      { scoreRange: { min: 70, max: 80 }, grade: "B", interpretation: "Very Good", remarks: "Very Good Performance", gpaPoints: 3.0 },
      { scoreRange: { min: 60, max: 70 }, grade: "C", interpretation: "Good", remarks: "Good Performance", gpaPoints: 2.0 },
      { scoreRange: { min: 50, max: 60 }, grade: "D", interpretation: "Pass", remarks: "Pass Performance", gpaPoints: 1.0 },
      { scoreRange: { min: 40, max: 50 }, grade: "E", interpretation: "Weak Pass", remarks: "Weak Performance", gpaPoints: 0.5 },
      { scoreRange: { min: 0, max: 40 }, grade: "F", interpretation: "Fail", remarks: "Poor Performance", gpaPoints: 0.0 },
    ],
    assessmentWeights: {
      classAssessment: 30,
      homework: 10,
      tests: 20,
      exams: 40,
    },
    isDefault: false,
  });

  // 4. Create School Configuration
  console.log("Seeding School Configuration...");
  await SchoolConfig.create({
    schoolName: "EduSankofa Basic School",
    schoolCode: "ESB-001",
    address: {
      street: "Independence Avenue",
      city: "Accra",
      region: "Greater Accra",
    },
    contact: {
      phone: "0244123456",
      email: "info@edusankofa.edu.gh",
    },
    establishment: new Date("2015-09-01"),
    schoolType: "Private",
    currentAcademicYear: academicYear._id,
    currentTerm: term._id,
    gradingSystem: gradingSystem._id,
    isActive: true,
  });

  // 5. Create Generic and Ghana-Specific Classes
  console.log("Seeding Classes...");
  const genericClass = await ClassModel.create({
    name: "JHS 1 A",
    grade: "JHS 1",
    section: "A",
    teacher: teacherUser._id,
    capacity: 30,
    academicYear: "2025/2026",
    isActive: true,
  });

  const ghanaClass = await GhanaClass.create({
    name: "JHS 1 A",
    level: "JHS 1",
    section: "A",
    classTeacher: teacherUser._id,
    capacity: 30,
    academicYear: academicYear._id,
    term: term._id,
    isActive: true,
  });

  const primaryGenericClass = await ClassModel.create({
    name: "Primary 1 A",
    grade: "Primary 1",
    section: "A",
    teacher: teacherUser._id,
    capacity: 30,
    academicYear: "2025/2026",
    isActive: true,
  });

  const primaryGhanaClass = await GhanaClass.create({
    name: "Primary 1 A",
    level: "Primary 1",
    section: "A",
    classTeacher: teacherUser._id,
    capacity: 30,
    academicYear: academicYear._id,
    term: term._id,
    isActive: true,
  });

  // 6. Create Generic and Ghana-Specific Subjects
  console.log("Seeding Subjects...");
  const genericSub1 = await Subject.create({
    name: "English Language",
    code: "JHS1_ENG",
    credits: 3,
    teacher: teacherUser._id,
    academicYearId: academicYear._id,
    termId: term._id,
    academicYear: "2025/2026",
    semester: "Fall",
  });

  const genericSub2 = await Subject.create({
    name: "Mathematics",
    code: "JHS1_MAT",
    credits: 4,
    teacher: teacherUser._id,
    academicYearId: academicYear._id,
    termId: term._id,
    academicYear: "2025/2026",
    semester: "Fall",
  });

  const genericSub3 = await Subject.create({
    name: "Integrated Science",
    code: "JHS1_SCI",
    credits: 4,
    teacher: teacherUser._id,
    academicYearId: academicYear._id,
    termId: term._id,
    academicYear: "2025/2026",
    semester: "Fall",
  });

  // Populate generic class with subjects
  genericClass.subjects.push(genericSub1._id, genericSub2._id, genericSub3._id);
  await genericClass.save();

  // Create Ghana subjects for JHS 1
  const ghanaSubjects = await GhanaSubject.createSubjectsForLevel("JHS 1", academicYear._id, term._id);
  for (const sub of ghanaSubjects) {
    await sub.assignTeacher(teacherUser._id);
  }

  // Seeding primary generic subjects
  const primaryGenericSub1 = await Subject.create({
    name: "English Language",
    code: "P1_ENG",
    credits: 3,
    teacher: teacherUser._id,
    academicYearId: academicYear._id,
    termId: term._id,
    academicYear: "2025/2026",
    semester: "Fall",
  });

  const primaryGenericSub2 = await Subject.create({
    name: "Mathematics",
    code: "P1_MAT",
    credits: 4,
    teacher: teacherUser._id,
    academicYearId: academicYear._id,
    termId: term._id,
    academicYear: "2025/2026",
    semester: "Fall",
  });

  primaryGenericClass.subjects.push(primaryGenericSub1._id, primaryGenericSub2._id);
  await primaryGenericClass.save();

  // Create Ghana subjects for Primary 1
  const primaryGhanaSubjects = await GhanaSubject.createSubjectsForLevel("Primary 1", academicYear._id, term._id);
  for (const sub of primaryGhanaSubjects) {
    await sub.assignTeacher(teacherUser._id);
  }

  // 6.5 Create Ghana Fee Structure
  console.log("Seeding Ghana Fee Structure...");
  const feeStructure = await GhanaFeeStructure.create({
    name: "JHS 1 Tuition & Fees",
    description: "Standard tuition and ancillary fees for JHS 1",
    academicYear: academicYear._id,
    term: term._id,
    applicableLevels: ["JHS 1"],
    applicableClasses: [ghanaClass._id],
    feeItems: [
      { name: "Tuition Fee", category: "Tuition", amount: 1000, currency: "GHS", isMandatory: true, isRecurring: true, paymentFrequency: "Termly" },
      { name: "Examination Fee", category: "Examination", amount: 200, currency: "GHS", isMandatory: true, isRecurring: false, paymentFrequency: "One-time" },
      { name: "Library Fee", category: "Library", amount: 100, currency: "GHS", isMandatory: true, isRecurring: false, paymentFrequency: "One-time" },
      { name: "ICT Fee", category: "ICT", amount: 200, currency: "GHS", isMandatory: true, isRecurring: false, paymentFrequency: "One-time" },
    ],
    status: "Active",
    effectiveDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdBy: adminUser._id,
  });

  console.log("Seeding Ghana Fee Structure for Primary 1...");
  const primaryFeeStructure = await GhanaFeeStructure.create({
    name: "Primary 1 Tuition & Fees",
    description: "Standard tuition and ancillary fees for Primary 1",
    academicYear: academicYear._id,
    term: term._id,
    applicableLevels: ["Primary 1"],
    applicableClasses: [primaryGhanaClass._id],
    feeItems: [
      { name: "Tuition Fee", category: "Tuition", amount: 800, currency: "GHS", isMandatory: true, isRecurring: true, paymentFrequency: "Termly" },
      { name: "Examination Fee", category: "Examination", amount: 150, currency: "GHS", isMandatory: true, isRecurring: false, paymentFrequency: "One-time" },
      { name: "Library Fee", category: "Library", amount: 50, currency: "GHS", isMandatory: true, isRecurring: false, paymentFrequency: "One-time" },
      { name: "ICT Fee", category: "ICT", amount: 100, currency: "GHS", isMandatory: true, isRecurring: false, paymentFrequency: "One-time" },
    ],
    status: "Active",
    effectiveDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdBy: adminUser._id,
  });

  // 7. Create Generic and Ghana-Specific Student Data
  console.log("Seeding Students...");
  const studentsData = [
    { firstName: "Kwame", middleName: "Kofi", otherNames: "Adom", lastName: "Mensah", email: "kwame@mensah.com", dob: new Date("2013-05-15"), gender: "Male", pob: "Accra", region: "Greater Accra", nhisNumber: "87654321", birthCertificateNumber: "BC-123/2013", identityType: "ghana-card", identityNumber: "GHA-765432109-8" },
    { firstName: "Ama", middleName: "Serwaa", otherNames: "", lastName: "Osei", email: "ama@serwaa.com", dob: new Date("2013-08-20"), gender: "Female", pob: "Kumasi", region: "Ashanti", nhisNumber: "87654322", birthCertificateNumber: "BC-124/2013", identityType: "ghana-card", identityNumber: "GHA-765432109-9" },
    { firstName: "Kofi", middleName: "Kojo", otherNames: "", lastName: "Boateng", email: "kofi@boateng.com", dob: new Date("2013-11-10"), gender: "Male", pob: "Cape Coast", region: "Central", nhisNumber: "87654323", birthCertificateNumber: "BC-125/2013", identityType: "passport", identityNumber: "G0987654" },
  ];

  for (let i = 0; i < studentsData.length; i++) {
    const s = studentsData[i];
    const stdId = `EDU2025${(i + 1).toString().padStart(4, "0")}`;
    const admNum = `ADM202509${(i + 1).toString().padStart(4, "0")}`;

    // A. Generic Student
    const genericStudent = await Student.create({
      firstName: s.firstName,
      middleName: s.middleName,
      otherNames: s.otherNames,
      lastName: s.lastName,
      email: s.email,
      dateOfBirth: s.dob,
      gender: s.gender.toLowerCase(),
      studentId: stdId,
      admissionNumber: admNum,
      class: "JHS 1 A",
      placeOfBirth: s.pob,
      phone: "024412345" + i,
      parentId: parentUser._id,
      status: "active",
      address: {
        city: "Accra",
        region: s.region,
      },
      birthCertificateNumber: s.birthCertificateNumber,
      nhisNumber: s.nhisNumber,
      identityType: s.identityType,
      identityNumber: s.identityNumber,
    });

    // B. Link generic student in Class
    genericClass.students.push(genericStudent._id);

    // C. Create Enrollment
    await Enrollment.create({
      student: genericStudent._id,
      academicYear: academicYear._id,
      class: genericClass._id,
      status: "active",
    });

    // D. Ghana-Specific Student
    const ghanaStudent = await GhanaStudent.create({
      firstName: s.firstName,
      lastName: s.lastName,
      middleName: s.middleName,
      otherNames: s.otherNames,
      email: s.email,
      dateOfBirth: s.dob,
      gender: s.gender,
      placeOfBirth: s.pob,
      regionOfBirth: s.region,
      studentId: stdId,
      admissionNumber: admNum,
      currentClass: ghanaClass._id,
      academicYear: academicYear._id,
      term: term._id,
      admissionType: "New Admission",
      address: {
        city: "Accra",
        region: s.region,
      },
      phone: "024412345" + i,
      birthCertificate: {
        certificateNumber: s.birthCertificateNumber,
        issueDate: new Date("2020-01-15"),
        issuingAuthority: "Registry Dept",
      },
      nhis: {
        cardNumber: s.nhisNumber,
        expiryDate: new Date("2028-12-31"),
        issueDate: new Date("2023-01-01"),
      },
      ghanaCard: s.identityType === "ghana-card" ? {
        cardNumber: s.identityNumber,
        pinNumber: s.identityNumber,
        issueDate: new Date("2022-06-01"),
        expiryDate: new Date("2032-06-01"),
      } : undefined,
      guardians: [{
        type: "Father",
        firstName: "Kwadwo",
        lastName: s.lastName,
        phone: "0244111222",
        email: parentUser.email,
        userId: parentUser._id,
        isPrimary: true,
      }],
      status: "Active",
      createdBy: adminUser._id,
    });

    // E. Link Ghana Student in Ghana Class
    ghanaClass.students.push(ghanaStudent._id);

    // F. Create Fee Ledger for Ghana Student
    await StudentLedger.create({
      student: ghanaStudent._id,
      academicYear: academicYear._id,
      term: term._id,
      feeStructure: feeStructure._id,
      currency: "GHS",
      totalFees: 1500,
      totalPaid: 0,
      balance: 1500,
      feeBreakdown: [
        { feeItemName: "Tuition Fee", category: "Tuition", amount: 1000, paid: 0, balance: 1000, isMandatory: true },
        { feeItemName: "Examination Fee", category: "Examination", amount: 200, paid: 0, balance: 200, isMandatory: true },
        { feeItemName: "Library Fee", category: "Library", amount: 100, paid: 0, balance: 100, isMandatory: true },
        { feeItemName: "ICT Fee", category: "ICT", amount: 200, paid: 0, balance: 200, isMandatory: true },
      ],
      transactions: [],
      createdBy: adminUser._id,
    });

    // 8. Create some Grades for Students in JHS 1 A (Generic)
    console.log(`Seeding Grades for ${s.firstName}...`);
    await Grade.create({
      student: genericStudent._id,
      subject: genericSub1._id,
      teacher: teacherUser._id,
      gradeType: "quiz",
      title: "Quiz 1",
      score: 16 + i,
      maxScore: 20,
      weight: 1,
    });

    await Grade.create({
      student: genericStudent._id,
      subject: genericSub2._id,
      teacher: teacherUser._id,
      gradeType: "midterm",
      title: "Mid-Term Examination",
      score: 38 + (i * 2),
      maxScore: 50,
      weight: 1,
    });
  }

  // Seeding Primary 1 Students
  console.log("Seeding Primary 1 Students...");
  const primaryStudentsData = [
    { firstName: "Yaw", middleName: "Kwaku", otherNames: "Boateng", lastName: "Osei", email: "yaw@osei.com", dob: new Date("2019-03-12"), gender: "Male", pob: "Kumasi", region: "Ashanti", nhisNumber: "87654324", birthCertificateNumber: "BC-201/2019", identityType: "ghana-card", identityNumber: "GHA-765432110-1" },
    { firstName: "Abena", middleName: "Akua", otherNames: "", lastName: "Koomson", email: "abena@koomson.com", dob: new Date("2019-06-25"), gender: "Female", pob: "Accra", region: "Greater Accra", nhisNumber: "87654325", birthCertificateNumber: "BC-202/2019", identityType: "ghana-card", identityNumber: "GHA-765432110-2" },
  ];

  for (let i = 0; i < primaryStudentsData.length; i++) {
    const s = primaryStudentsData[i];
    const stdId = `EDU2025${(i + 10).toString().padStart(4, "0")}`;
    const admNum = `ADM202509${(i + 10).toString().padStart(4, "0")}`;

    // A. Generic Student
    const genericStudent = await Student.create({
      firstName: s.firstName,
      middleName: s.middleName,
      otherNames: s.otherNames,
      lastName: s.lastName,
      email: s.email,
      dateOfBirth: s.dob,
      gender: s.gender.toLowerCase(),
      studentId: stdId,
      admissionNumber: admNum,
      class: "Primary 1 A",
      placeOfBirth: s.pob,
      phone: "024412347" + i,
      parentId: parentUser._id,
      status: "active",
      address: {
        city: "Accra",
        region: s.region,
      },
      birthCertificateNumber: s.birthCertificateNumber,
      nhisNumber: s.nhisNumber,
      identityType: s.identityType,
      identityNumber: s.identityNumber,
    });

    primaryGenericClass.students.push(genericStudent._id);

    // C. Create Enrollment
    await Enrollment.create({
      student: genericStudent._id,
      academicYear: academicYear._id,
      class: primaryGenericClass._id,
      status: "active",
    });

    // D. Ghana-Specific Student
    const ghanaStudent = await GhanaStudent.create({
      firstName: s.firstName,
      lastName: s.lastName,
      middleName: s.middleName,
      otherNames: s.otherNames,
      email: s.email,
      dateOfBirth: s.dob,
      gender: s.gender,
      placeOfBirth: s.pob,
      regionOfBirth: s.region,
      studentId: stdId,
      admissionNumber: admNum,
      currentClass: primaryGhanaClass._id,
      academicYear: academicYear._id,
      term: term._id,
      admissionType: "New Admission",
      address: {
        city: "Accra",
        region: s.region,
      },
      phone: "024412347" + i,
      birthCertificate: {
        certificateNumber: s.birthCertificateNumber,
        issueDate: new Date("2020-01-15"),
        issuingAuthority: "Registry Dept",
      },
      nhis: {
        cardNumber: s.nhisNumber,
        expiryDate: new Date("2028-12-31"),
        issueDate: new Date("2023-01-01"),
      },
      ghanaCard: s.identityType === "ghana-card" ? {
        cardNumber: s.identityNumber,
        pinNumber: s.identityNumber,
        issueDate: new Date("2022-06-01"),
        expiryDate: new Date("2032-06-01"),
      } : undefined,
      guardians: [{
        type: "Father",
        firstName: "Kwabena",
        lastName: s.lastName,
        phone: "0244111333",
        email: parentUser.email,
        userId: parentUser._id,
        isPrimary: true,
      }],
      status: "Active",
      createdBy: adminUser._id,
    });

    primaryGhanaClass.students.push(ghanaStudent._id);

    // F. Create Fee Ledger
    await StudentLedger.create({
      student: ghanaStudent._id,
      academicYear: academicYear._id,
      term: term._id,
      feeStructure: primaryFeeStructure._id,
      currency: "GHS",
      totalFees: 1100,
      totalPaid: 0,
      balance: 1100,
      feeBreakdown: [
        { feeItemName: "Tuition Fee", category: "Tuition", amount: 800, paid: 0, balance: 800, isMandatory: true },
        { feeItemName: "Examination Fee", category: "Examination", amount: 150, paid: 0, balance: 150, isMandatory: true },
        { feeItemName: "Library Fee", category: "Library", amount: 50, paid: 0, balance: 50, isMandatory: true },
        { feeItemName: "ICT Fee", category: "ICT", amount: 100, paid: 0, balance: 100, isMandatory: true },
      ],
      transactions: [],
      createdBy: adminUser._id,
    });

    // G. Create Grades
    console.log(`Seeding Primary 1 Grades for ${s.firstName}...`);
    await Grade.create({
      student: genericStudent._id,
      subject: primaryGenericSub1._id,
      teacher: teacherUser._id,
      gradeType: "quiz",
      title: "Quiz 1",
      score: 18 + i,
      maxScore: 20,
      weight: 1,
    });

    await Grade.create({
      student: genericStudent._id,
      subject: primaryGenericSub2._id,
      teacher: teacherUser._id,
      gradeType: "midterm",
      title: "Mid-Term Examination",
      score: 42 + i,
      maxScore: 50,
      weight: 1,
    });
  }

  // Save the student lists in classes
  await genericClass.save();
  await ghanaClass.save();
  await primaryGenericClass.save();
  await primaryGhanaClass.save();

  // 9. Create Teacher Assignments
  console.log("Seeding Teacher Assignments...");
  await Promise.all([
    TeacherAssignment.create({
      teacher: teacherUser._id,
      class: genericClass._id,
      subject: genericSub1._id,
      academicYear: academicYear._id,
      term: term._id,
      status: "active",
    }),
    TeacherAssignment.create({
      teacher: teacherUser._id,
      class: genericClass._id,
      subject: genericSub2._id,
      academicYear: academicYear._id,
      term: term._id,
      status: "active",
    }),
    TeacherAssignment.create({
      teacher: teacherUser._id,
      class: genericClass._id,
      subject: genericSub3._id,
      academicYear: academicYear._id,
      term: term._id,
      status: "active",
    }),
    TeacherAssignment.create({
      teacher: teacherUser._id,
      class: primaryGenericClass._id,
      subject: primaryGenericSub1._id,
      academicYear: academicYear._id,
      term: term._id,
      status: "active",
    }),
    TeacherAssignment.create({
      teacher: teacherUser._id,
      class: primaryGenericClass._id,
      subject: primaryGenericSub2._id,
      academicYear: academicYear._id,
      term: term._id,
      status: "active",
    }),
  ]);

  console.log("\n==============================================");
  console.log("✔ School Data Seeded Successfully!");
  console.log("==============================================");
  console.log("- Academic Year: 2025/2026 (Active)");
  console.log("- Term: First Term (Active)");
  console.log("- Grading Systems: Ghana Basic (Default), Primary Letter Grading");
  console.log("- Classes: JHS 1 A, Primary 1 A");
  console.log("- Subjects: JHS 1 (English, Math, Science), Primary 1 (English, Math)");
  console.log("- Students: JHS 1 (Kwame, Ama, Kofi), Primary 1 (Yaw, Abena)");
  console.log("==============================================");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Seeding failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
