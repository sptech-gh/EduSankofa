const PDFDocument = require("pdfkit");
const fs = require("fs");
const { formatGHS } = require("../utils/currency");

const DATA_PROTECTION_NOTICE =
  "This document contains personal data protected under the Data Protection Act, 2012 (Act 843) of Ghana. Unauthorised disclosure is prohibited.";

/**
 * Helper to draw a horizontal divider line
 */
function drawDivider(doc, y) {
  doc.strokeColor("#cccccc").lineWidth(1).moveTo(50, y).lineTo(545, y).stroke();
}

function addComplianceFootersToBufferedDoc(doc, footerText = DATA_PROTECTION_NOTICE) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottomY = doc.page.height - 72;
    doc.save();
    drawDivider(doc, bottomY - 8);
    doc.fontSize(8).fillColor("#444444");
    doc.text(footerText, 50, bottomY, { width: 495, align: "center" });
    doc.text(`Page ${i + 1}`, 50, bottomY + 12, { width: 495, align: "center" });
    doc.restore();
  }
}

const formatActorName = (actor) => {
  if (!actor || typeof actor !== "object") return actor || "N/A";
  return actor.name || [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email || "N/A";
};

/**
 * Generate PDF for a Student Bill
 */
function generateBillPDF(stream, bill, school, student) {
  const doc = new PDFDocument({ size: "A4", margin: { top: 50, left: 50, right: 50, bottom: 100 }, bufferPages: true });
  doc.pipe(stream);

  // Background Watermark for DRAFT status
  if (bill.status === "DRAFT") {
    doc.save();
    doc.fontSize(48);
    doc.fillColor("#e32636");
    doc.opacity(0.1);
    doc.rotate(-45, { origin: [300, 400] });
    doc.text("FOR OFFICIAL USE ONLY", 100, 400, { align: "center" });
    doc.restore();
  }

  // Header Details
  doc.fillColor("#333333");
  doc.fontSize(20).text(school.schoolName || "EduSankofa Academy", { align: "center" });
  doc.fontSize(10);
  if (school.motto) doc.text(`"${school.motto}"`, { align: "center" });
  if (school.address) doc.text(school.address, { align: "center" });
  if (school.phone) doc.text(`Phone: ${school.phone}`, { align: "center" });
  doc.moveDown(1);

  drawDivider(doc, doc.y);
  doc.moveDown(1);

  // Bill Information Block
  const startY = doc.y;
  doc.fontSize(12).text("BILL FOR STUDENT FEES", 50, startY, { underline: true });
  doc.fontSize(10);
  doc.text(`Student: ${student ? `${student.firstName} ${student.lastName}` : "Unknown"} (${student ? student.studentId : ""})`, 50, startY + 20);
  doc.text(`Class: ${bill.classCode || (student && student.currentClass?.name) || ""}`, 50, startY + 35);
  doc.text(`Academic Year: ${bill.academicYear}`, 50, startY + 50);
  doc.text(`Term: Term ${bill.term}`, 50, startY + 65);

  doc.text(`Bill Ref: BILL-${bill._id.toString().substring(18).toUpperCase()}`, 350, startY + 20);
  doc.text(`Date Issued: ${bill.issuedDate ? new Date(bill.issuedDate).toLocaleDateString("en-GH") : new Date().toLocaleDateString("en-GH")}`, 350, startY + 35);
  doc.text(`Due Date: ${new Date(bill.dueDate).toLocaleDateString("en-GH")}`, 350, startY + 50);
  doc.text(`Status: ${bill.status}`, 350, startY + 65);

  doc.moveDown(5);
  drawDivider(doc, doc.y);
  doc.moveDown(1);

  // Table Headers
  const tableTop = doc.y;
  doc.fontSize(10).font("Helvetica-Bold");
  doc.text("Fee Item & Category", 50, tableTop);
  doc.text("Original", 250, tableTop, { width: 80, align: "right" });
  doc.text("Discount", 340, tableTop, { width: 80, align: "right" });
  doc.text("Final", 430, tableTop, { width: 80, align: "right" });
  doc.font("Helvetica");

  doc.moveDown(0.5);
  let currentY = doc.y;

  // Table Rows
  (bill.lineItems || []).forEach((item) => {
    currentY += 15;
    doc.text(`${item.feeComponentName} (${item.category})`, 50, currentY);
    doc.text(formatGHS(item.originalAmountPesewas), 250, currentY, { width: 80, align: "right" });
    doc.text(formatGHS(item.discountAmountPesewas), 340, currentY, { width: 80, align: "right" });
    doc.text(formatGHS(item.finalAmountPesewas), 430, currentY, { width: 80, align: "right" });
  });

  currentY += 20;
  doc.strokeColor("#cccccc").lineWidth(0.5).moveTo(50, currentY).lineTo(545, currentY).stroke();

  // Summary Totals
  currentY += 10;
  doc.text("Total Billed:", 320, currentY);
  doc.text(formatGHS(bill.totalFinalPesewas), 430, currentY, { width: 80, align: "right" });

  currentY += 15;
  doc.text("Total Paid:", 320, currentY);
  doc.text(formatGHS(bill.totalPaidPesewas), 430, currentY, { width: 80, align: "right" });

  currentY += 15;
  doc.font("Helvetica-Bold");
  doc.text("Outstanding Balance:", 320, currentY);
  doc.text(formatGHS(bill.outstandingPesewas), 430, currentY, { width: 80, align: "right" });
  doc.font("Helvetica");

  // Footer notes
  if (bill.notes) {
    currentY += 40;
    doc.fontSize(9).text(`Notes: ${bill.notes}`, 50, currentY, { width: 450 });
  }

  addComplianceFootersToBufferedDoc(doc);
  doc.end();
}

/**
 * Generate PDF for a Payment Receipt
 */
function generateReceiptPDF(stream, payment, school, student, isReprint = false) {
  const doc = new PDFDocument({ size: "A4", margin: { top: 50, left: 50, right: 50, bottom: 100 }, bufferPages: true });
  doc.pipe(stream);

  // Background Watermark for DUPLICATE reprint
  if (isReprint || payment.isReprint || (payment.reprintCount && payment.reprintCount > 0)) {
    doc.save();
    doc.fontSize(60);
    doc.fillColor("#dc2626");
    doc.opacity(0.15);
    doc.rotate(-45, { origin: [300, 400] });
    doc.text("DUPLICATE", 100, 400, { align: "center" });
    doc.restore();
  }

  // Header Details
  doc.fillColor("#333333");
  if (school.logoUrl && fs.existsSync(school.logoUrl)) {
    doc.image(school.logoUrl, 50, 45, { fit: [60, 60] });
  }
  doc.fontSize(20).text(school.schoolName || "EduSankofa Academy", { align: "center" });
  doc.fontSize(10);
  if (school.motto) doc.text(`"${school.motto}"`, { align: "center" });
  if (school.address) doc.text(school.address, { align: "center" });
  if (school.phone) doc.text(`Phone: ${school.phone}`, { align: "center" });
  doc.moveDown(1);

  drawDivider(doc, doc.y);
  doc.moveDown(1);

  // Receipt details block
  const startY = doc.y;
  doc.fontSize(12).text("OFFICIAL PAYMENT RECEIPT", 50, startY, { underline: true });
  doc.fontSize(10);
  doc.text(`Student: ${student ? `${student.firstName} ${student.lastName}` : "Unknown"} (${student ? student.studentId : ""})`, 50, startY + 20);
  doc.text(`Academic Year: ${payment.academicYear}`, 50, startY + 35);
  doc.text(`Term: Term ${payment.term}`, 50, startY + 50);

  doc.text(`Receipt No: ${payment.receiptNumber}`, 350, startY + 20);
  doc.text(`Payment Date: ${new Date(payment.paymentDate).toLocaleDateString("en-GH")}`, 350, startY + 35);
  doc.text(`Payment Method: ${payment.paymentMethod}`, 350, startY + 50);
  doc.text(`Cashier: ${formatActorName(payment.receivedByStaffId || payment.processedBy)}`, 350, startY + 65);

  doc.moveDown(5);
  drawDivider(doc, doc.y);
  doc.moveDown(1);

  // Payment Breakdown Table
  const tableTop = doc.y;
  doc.fontSize(10).font("Helvetica-Bold");
  doc.text("Transaction Item", 50, tableTop);
  doc.text("Amount Paid", 400, tableTop, { width: 100, align: "right" });
  doc.font("Helvetica");

  doc.moveDown(0.5);
  let currentY = doc.y + 15;

  const bill = payment.billId && typeof payment.billId === "object" ? payment.billId : null;
  const billLines = Array.isArray(bill?.lineItems) ? bill.lineItems : [];
  if (billLines.length > 0) {
    billLines.forEach((item) => {
      doc.text(`${item.feeComponentName} (${item.category})`, 50, currentY, { width: 330 });
      doc.text(formatGHS(item.paidAmountPesewas || 0), 400, currentY, { width: 100, align: "right" });
      currentY += 15;
    });
  } else {
    doc.text(`Fee Payment Reference (Bill ID: ${payment.billId.toString().substring(18).toUpperCase()})`, 50, currentY);
    doc.text(formatGHS(payment.amountPesewas), 400, currentY, { width: 100, align: "right" });
  }

  currentY += 25;
  doc.strokeColor("#cccccc").lineWidth(0.5).moveTo(50, currentY).lineTo(545, currentY).stroke();

  // Summary total line
  currentY += 10;
  doc.font("Helvetica-Bold");
  doc.text("Total Paid:", 300, currentY);
  doc.text(formatGHS(payment.amountPesewas), 400, currentY, { width: 100, align: "right" });
  currentY += 15;
  doc.text("Remaining Balance:", 300, currentY);
  doc.text(formatGHS(bill?.outstandingPesewas || 0), 400, currentY, { width: 100, align: "right" });
  doc.font("Helvetica");

  // Payment Specific Metadata Details
  currentY += 30;
  doc.fontSize(10).text("Transaction Details:", 50, currentY, { underline: true });
  currentY += 15;

  if (["MTN_MOMO", "TELECEL_CASH", "AIRTELTIGO_MONEY"].includes(payment.paymentMethod)) {
    doc.text(`MoMo Operator: ${payment.momoNetwork}`, 50, currentY);
    doc.text(`Phone Number: ${payment.momoPhone}`, 50, currentY + 15);
    doc.text(`Reference: ${payment.momoReference}`, 50, currentY + 30);
  } else if (payment.paymentMethod === "BANK_TRANSFER") {
    doc.text(`Bank Name: ${payment.bankName}`, 50, currentY);
    doc.text(`Transaction Reference: ${payment.bankTransactionRef}`, 50, currentY + 15);
    if (payment.bankBranch) {
      doc.text(`Branch: ${payment.bankBranch}`, 50, currentY + 30);
    }
  } else if (payment.paymentMethod === "CASH") {
    doc.text(`Received By (Staff ID): ${payment.receivedByStaffId}`, 50, currentY);
    doc.text(`Manual Receipt Number: ${payment.cashReceiptNumber}`, 50, currentY + 15);
  } else if (payment.paymentMethod === "CHEQUE") {
    doc.text(`Cheque Number: ${payment.chequeNumber}`, 50, currentY);
    doc.text(`Bank Name: ${payment.bankName}`, 50, currentY + 15);
    doc.text(`Clearance Status: ${payment.clearanceStatus || "PENDING"}`, 50, currentY + 30);
  } else if (payment.paymentMethod === "POS") {
    doc.text(`Terminal ID: ${payment.posTerminalId}`, 50, currentY);
    doc.text(`Reference: ${payment.posReference}`, 50, currentY + 15);
    doc.text(`Card Type: ${payment.cardType}`, 50, currentY + 30);
  }

  // Footer notes
  if (payment.notes) {
    currentY += 60;
    doc.fontSize(9).text(`Notes: ${payment.notes}`, 50, currentY, { width: 450 });
  }

  addComplianceFootersToBufferedDoc(doc);
  doc.end();
}

/**
 * Generate PDF for a Class Fee Schedule
 */
function generateSchedulePDF(stream, schedule, school) {
  const doc = new PDFDocument({ size: "A4", margin: { top: 50, left: 50, right: 50, bottom: 100 }, bufferPages: true });
  doc.pipe(stream);

  // Header Details
  doc.fillColor("#333333");
  doc.fontSize(20).text(school.schoolName || "EduSankofa Academy", { align: "center" });
  doc.fontSize(10);
  if (school.motto) doc.text(`"${school.motto}"`, { align: "center" });
  if (school.address) doc.text(school.address, { align: "center" });
  if (school.phone) doc.text(`Phone: ${school.phone}`, { align: "center" });
  doc.moveDown(1);

  drawDivider(doc, doc.y);
  doc.moveDown(1);

  // Schedule Info Block
  const startY = doc.y;
  doc.fontSize(12).text("TERM CLASS FEE SCHEDULE", 50, startY, { underline: true });
  doc.fontSize(10);
  doc.text(`Class Level: ${schedule.classCode}`, 50, startY + 20);
  doc.text(`Academic Year: ${schedule.academicYear}`, 50, startY + 35);
  doc.text(`Term: Term ${schedule.term}`, 50, startY + 50);

  doc.text(`Published Date: ${schedule.publishedAt ? new Date(schedule.publishedAt).toLocaleDateString("en-GH") : "Unpublished"}`, 350, startY + 20);
  doc.text(`Schedule Ref: SCHED-${schedule._id.toString().substring(18).toUpperCase()}`, 350, startY + 35);

  doc.moveDown(5);
  drawDivider(doc, doc.y);
  doc.moveDown(1);

  // Table Headers
  const tableTop = doc.y;
  doc.fontSize(10).font("Helvetica-Bold");
  doc.text("Fee Component & Category", 50, tableTop);
  doc.text("Due Date", 300, tableTop);
  doc.text("Amount (GHS)", 450, tableTop, { width: 80, align: "right" });
  doc.font("Helvetica");

  doc.moveDown(0.5);
  let currentY = doc.y;

  let totalScheduleAmount = 0;

  (schedule.fees || []).forEach((item) => {
    currentY += 15;
    const name = item.feeComponentId?.name || "Standard Fee";
    const cat = item.feeComponentId?.category || "TUITION";
    totalScheduleAmount += item.amountPesewas;

    doc.text(`${name} (${cat})`, 50, currentY);
    doc.text(new Date(item.dueDate).toLocaleDateString("en-GH"), 300, currentY);
    doc.text(formatGHS(item.amountPesewas), 450, currentY, { width: 80, align: "right" });
  });

  currentY += 20;
  doc.strokeColor("#cccccc").lineWidth(0.5).moveTo(50, currentY).lineTo(545, currentY).stroke();

  currentY += 10;
  doc.font("Helvetica-Bold");
  doc.text("Total Term Package:", 300, currentY);
  doc.text(formatGHS(totalScheduleAmount), 450, currentY, { width: 80, align: "right" });
  doc.font("Helvetica");

  addComplianceFootersToBufferedDoc(doc);
  doc.end();
}

/**
 * Generate PDF for a Ghana Report Card
 * Follows GES/NaCCA standards for Basic 1-6 (SBC) and JHS 1-3 (traditional)
 */
function generateReportCardPDF(stream, reportCard, school, student) {
  const doc = new PDFDocument({ size: "A4", margin: { top: 40, left: 40, right: 40, bottom: 100 }, bufferPages: true });
  doc.pipe(stream);

  // School Header
  doc.fillColor("#333333");
  if (school.logoUrl && require('fs').existsSync(school.logoUrl)) {
    doc.image(school.logoUrl, 40, 40, { fit: [50, 50] });
  }
  doc.fontSize(18).font("Helvetica-Bold").text(school.schoolName || "EduSankofa Academy", { align: "center" });
  doc.fontSize(9).font("Helvetica");
  if (school.motto) doc.text(`"${school.motto}"`, { align: "center" });
  if (school.address) doc.text(school.address, { align: "center" });
  if (school.phone) doc.text(`Tel: ${school.phone}`, { align: "center" });
  doc.moveDown(0.5);

  // Report Card Title
  doc.fontSize(14).font("Helvetica-Bold").fillColor("#000000");
  doc.text("TERMLY ACADEMIC REPORT CARD", { align: "center" });
  doc.moveDown(1);

  drawDivider(doc, doc.y);
  doc.moveDown(0.5);

  // Student Information Block
  const infoY = doc.y;
  doc.fontSize(9).font("Helvetica");
  doc.text(`Student Name: ${student.firstName} ${student.lastName}`, 40, infoY);
  doc.text(`Student ID: ${student.studentId}`, 40, infoY + 12);
  doc.text(`Class: ${reportCard.className || 'N/A'}`, 40, infoY + 24);
  
  doc.text(`Academic Year: ${reportCard.academicYearName}`, 350, infoY);
  doc.text(`Term: ${reportCard.termName}`, 350, infoY + 12);
  doc.text(`Date Issued: ${new Date().toLocaleDateString("en-GH")}`, 350, infoY + 24);

  doc.moveDown(3);
  drawDivider(doc, doc.y);
  doc.moveDown(0.5);

  // Subjects Table
  const tableTop = doc.y;
  doc.fontSize(8).font("Helvetica-Bold");
  doc.text("Subject", 40, tableTop, { width: 120 });
  
  // Different headers for SBC vs Traditional
  if (reportCard.gradingSystem === "Basic") {
    // Standards-Based Curriculum (KG - Basic 6)
    doc.text("Descriptor", 170, tableTop, { width: 150 });
    doc.text("Teacher Remarks", 330, tableTop, { width: 185 });
  } else {
    // Traditional/BECE (JHS 1-3)
    doc.text("CA (30)", 170, tableTop, { width: 40, align: "center" });
    doc.text("Exam (70)", 215, tableTop, { width: 40, align: "center" });
    doc.text("Total (100)", 260, tableTop, { width: 45, align: "center" });
    doc.text("Grade", 310, tableTop, { width: 35, align: "center" });
    doc.text("Position", 350, tableTop, { width: 40, align: "center" });
    doc.text("Remarks", 395, tableTop, { width: 120 });
  }
  
  doc.font("Helvetica");
  let currentY = tableTop + 15;

  // Subject Rows
  (reportCard.subjects || []).forEach((subject, idx) => {
    if (currentY > 700) {
      doc.addPage();
      currentY = 50;
    }

    doc.fontSize(8);
    doc.text(subject.subjectName || subject.subjectCode || "Subject", 40, currentY, { width: 120 });
    
    if (reportCard.gradingSystem === "Basic") {
      // SBC: Show competency descriptor
      const descriptor = subject.competencyDescriptor || subject.grade || "N/A";
      doc.text(descriptor, 170, currentY, { width: 150 });
      doc.text(subject.remarks || "-", 330, currentY, { width: 185 });
    } else {
      // Traditional: Show scores and grade
      doc.text(String(subject.continuousAssessment?.totalScore || "-"), 170, currentY, { width: 40, align: "center" });
      doc.text(String(subject.examination?.score || "-"), 215, currentY, { width: 40, align: "center" });
      doc.text(String(subject.totalScore || "-"), 260, currentY, { width: 45, align: "center" });
      doc.text(subject.grade || "-", 310, currentY, { width: 35, align: "center" });
      doc.text(subject.position ? `${subject.position}/${reportCard.classSize || '?'}` : "-", 350, currentY, { width: 40, align: "center" });
      doc.text(subject.remarks || "-", 395, currentY, { width: 120 });
    }
    
    currentY += 18;
  });

  currentY += 5;
  drawDivider(doc, currentY);
  currentY += 10;

  // Overall Performance Summary
  if (reportCard.overallPerformance) {
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("Overall Performance:", 40, currentY);
    doc.font("Helvetica");
    currentY += 12;
    
    if (reportCard.overallPerformance.totalScore !== undefined) {
      doc.text(`Total Score: ${reportCard.overallPerformance.totalScore}`, 40, currentY);
      currentY += 12;
    }
    if (reportCard.overallPerformance.averageScore !== undefined) {
      doc.text(`Average Score: ${reportCard.overallPerformance.averageScore.toFixed(1)}%`, 40, currentY);
      currentY += 12;
    }
    if (reportCard.overallPerformance.classPosition) {
      doc.text(`Class Position: ${reportCard.overallPerformance.classPosition} of ${reportCard.classSize || '?'}`, 40, currentY);
      currentY += 12;
    }
    currentY += 5;
  }

  // Attendance
  if (reportCard.attendance) {
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("Attendance:", 40, currentY);
    doc.font("Helvetica");
    currentY += 12;
    doc.text(`Days Present: ${reportCard.attendance.daysPresent || 0}`, 40, currentY);
    doc.text(`Days Absent: ${reportCard.attendance.daysAbsent || 0}`, 200, currentY);
    doc.text(`Days Late: ${reportCard.attendance.daysLate || 0}`, 350, currentY);
    currentY += 12;
    if (reportCard.attendance.attendancePercentage !== undefined) {
      doc.text(`Attendance Rate: ${reportCard.attendance.attendancePercentage.toFixed(1)}%`, 40, currentY);
    }
    currentY += 15;
  }

  // Conduct & Skills (for SBC)
  if (reportCard.conduct || reportCard.skills) {
    if (currentY > 650) {
      doc.addPage();
      currentY = 50;
    }
    
    if (reportCard.conduct) {
      doc.fontSize(9).font("Helvetica-Bold");
      doc.text("Conduct:", 40, currentY);
      doc.font("Helvetica");
      currentY += 12;
      doc.fontSize(8).text(reportCard.conduct, 40, currentY, { width: 515 });
      currentY += 20;
    }
    
    if (reportCard.skills && Array.isArray(reportCard.skills) && reportCard.skills.length > 0) {
      doc.fontSize(9).font("Helvetica-Bold");
      doc.text("Skills Assessment:", 40, currentY);
      doc.font("Helvetica");
      currentY += 12;
      reportCard.skills.forEach(skill => {
        doc.fontSize(8).text(`${skill.skillName}: ${skill.rating || 'N/A'}`, 40, currentY);
        currentY += 12;
      });
      currentY += 5;
    }
  }

  // Teacher Remarks
  if (currentY > 650) {
    doc.addPage();
    currentY = 50;
  }

  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("Class Teacher's Remarks:", 40, currentY);
  doc.font("Helvetica");
  currentY += 12;
  doc.fontSize(8).text(reportCard.classTeacherRemarks || "No remarks provided.", 40, currentY, { width: 515 });
  currentY += 25;

  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("Headteacher's Remarks:", 40, currentY);
  doc.font("Helvetica");
  currentY += 12;
  doc.fontSize(8).text(reportCard.headTeacherRemarks || "No remarks provided.", 40, currentY, { width: 515 });
  currentY += 30;

  // Promotion/Next Term
  if (reportCard.promotion) {
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text(`Next Term Status: ${reportCard.promotion.status || 'Pending'}`, 40, currentY);
    if (reportCard.promotion.nextClass) {
      doc.font("Helvetica");
      currentY += 12;
      doc.text(`Promoted to: ${reportCard.promotion.nextClass}`, 40, currentY);
    }
    currentY += 20;
  }

  // Resumption Date
  if (reportCard.nextTermResumptionDate) {
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text(`Next Term Resumes: ${new Date(reportCard.nextTermResumptionDate).toLocaleDateString("en-GH")}`, 40, currentY);
    currentY += 20;
  }

  // Signatures
  currentY += 10;
  drawDivider(doc, currentY);
  currentY += 15;
  
  doc.fontSize(8).font("Helvetica");
  doc.text("Class Teacher: _____________________", 40, currentY);
  doc.text("Date: ___________", 40, currentY + 20);
  
  doc.text("Headteacher: _____________________", 300, currentY);
  doc.text("Date: ___________", 300, currentY + 20);

  // Act 843 footer on all pages
  addComplianceFootersToBufferedDoc(doc);
  doc.end();
}

module.exports = {
  generateBillPDF,
  generateReceiptPDF,
  generateSchedulePDF,
  generateReportCardPDF,
};
