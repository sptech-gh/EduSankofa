/**
 * Grades Service Tests
 * Unit tests for grade management functionality
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Student = require('../models/Student');
const Grade = require('../models/Grade');
const ReportCard = require('../models/ReportCard');
const Subject = require('../models/Subject');
const AcademicYear = require('../models/AcademicYear');
const Term = require('../models/Term');
const ClassModel = require('../models/Class');
const Enrollment = require('../models/Enrollment');
const TeacherAssignment = require('../models/TeacherAssignment');

describe('Grades Service', () => {
  let adminToken;
  let teacherToken;
  let testStudent;
  let adminUserId;
  let teacherUserId;
  let academicYear;
  let term;
  let testClass;
  let subject;

  beforeAll(async () => {
    // Create test tokens
    const jwt = require('jsonwebtoken');

    adminUserId = new mongoose.Types.ObjectId();
    teacherUserId = new mongoose.Types.ObjectId();
    
    adminToken = jwt.sign(
      {
        userId: adminUserId.toString(),
        role: 'admin',
        email: 'admin@example.com',
        jti: 'admin-jti',
        iss: 'school-management-saas',
        aud: 'school-management-client'
      },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    teacherToken = jwt.sign(
      {
        userId: teacherUserId.toString(),
        role: 'teacher',
        email: 'teacher@example.com',
        jti: 'teacher-jti',
        iss: 'school-management-saas',
        aud: 'school-management-client'
      },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '1h', algorithm: 'HS256' }
    );

  });

  beforeEach(async () => {
    testStudent = await Student.create({
      firstName: 'Test',
      lastName: 'Student',
      email: 'test@student.com',
      studentId: 'STU001'
    });

    academicYear = await AcademicYear.create({
      name: '2023-2024',
      isActive: true,
    });

    term = await Term.create({
      academicYear: academicYear._id,
      name: 'First Term',
      order: 1,
      legacySemester: 'Fall',
      isActive: true,
    });

    testClass = await ClassModel.create({
      name: 'Primary 1 A',
      grade: 'Primary 1',
      section: 'A',
      teacher: teacherUserId,
      academicYear: '2023-2024',
      isActive: true,
    });

    subject = await Subject.create({
      name: 'Mathematics',
      code: 'MATH-001',
      credits: 1,
      teacher: teacherUserId,
      academicYearId: academicYear._id,
      termId: term._id,
      academicYear: '2023-2024',
      semester: 'Fall',
      status: 'active',
    });

    await Enrollment.create({
      student: testStudent._id,
      academicYear: academicYear._id,
      class: testClass._id,
      status: 'active',
    });

    await TeacherAssignment.create({
      academicYear: academicYear._id,
      term: term._id,
      class: testClass._id,
      subject: subject._id,
      teacher: teacherUserId,
      status: 'active',
    });
  });

  afterAll(async () => {
    // Cleanup
    await Grade.deleteMany({});
    await ReportCard.deleteMany({});
    await TeacherAssignment.deleteMany({});
    await Enrollment.deleteMany({});
    await Subject.deleteMany({});
    await ClassModel.deleteMany({});
    await Term.deleteMany({});
    await AcademicYear.deleteMany({});
    await Student.deleteMany({});
  });

  describe('Grade CRUD Operations', () => {
    test('should create new grade with teacher token', async () => {
      const gradeData = {
        student: testStudent._id,
        subject: subject._id,
        academicYearId: academicYear._id,
        termId: term._id,
        gradeType: 'final',
        title: 'Mathematics Final',
        score: 95,
        maxScore: 100,
        comments: 'Excellent performance'
      };

      const response = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(gradeData)
        .expect(201);

      expect(response.body).toHaveProperty('letterGrade', 'A');
      expect(response.body).toHaveProperty('score', 95);
      expect(String(response.body.student && response.body.student._id)).toBe(String(testStudent._id));
      expect(String(response.body.subject && response.body.subject._id)).toBe(String(subject._id));
    });

    test('should reject grade creation without authentication', async () => {
      const gradeData = {
        student: testStudent._id,
        subject: subject._id,
        academicYearId: academicYear._id,
        termId: term._id,
        gradeType: 'final',
        title: 'Mathematics Final',
        score: 95,
        maxScore: 100,
      };

      const response = await request(app)
        .post('/api/grades')
        .send(gradeData)
        .expect(401);

      expect(response.body).toHaveProperty('code', 'AUTH_REQUIRED');
    });

    test('should reject grade creation with insufficient permissions', async () => {
      const jwt = require('jsonwebtoken');
      const studentUserId = new mongoose.Types.ObjectId();
      const studentToken = jwt.sign(
        {
          userId: studentUserId.toString(),
          role: 'student',
          email: 'student@example.com',
          jti: 'student-jti',
          iss: 'school-management-saas',
          aud: 'school-management-client'
        },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '1h', algorithm: 'HS256' }
      );

      const gradeData = {
        student: testStudent._id,
        subject: subject._id,
        academicYearId: academicYear._id,
        termId: term._id,
        gradeType: 'final',
        title: 'Mathematics Final',
        score: 95,
        maxScore: 100,
      };

      const response = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(gradeData)
        .expect(403);

      expect(response.body).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
    });

    test('should get all grades with teacher token', async () => {
      const response = await request(app)
        .get(`/api/grades?academicYearId=${academicYear._id}&termId=${term._id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should get grades by student ID', async () => {
      const response = await request(app)
        .get(`/api/grades/student/${testStudent._id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every(grade => String(grade.student) === String(testStudent._id))).toBe(true);
    });

    test('should update grade with teacher token', async () => {
      // First create a grade
      const createResponse = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          subject: subject._id,
          academicYearId: academicYear._id,
          termId: term._id,
          gradeType: 'final',
          title: 'Mathematics Final',
          score: 85,
          maxScore: 100,
          comments: 'Initial'
        })
        .expect(201);

      const gradeId = createResponse.body._id;
      const updateData = {
        student: testStudent._id,
        subject: subject._id,
        academicYearId: academicYear._id,
        termId: term._id,
        gradeType: 'final',
        title: 'Mathematics Final',
        score: 95,
        maxScore: 100,
        comments: 'Improved performance'
      };

      const response = await request(app)
        .put(`/api/grades/${gradeId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('letterGrade', 'A');
      expect(response.body).toHaveProperty('score', 95);
      expect(response.body).toHaveProperty('comments', 'Improved performance');
    });

    test('should delete grade with teacher token', async () => {
      // First create a grade
      const createResponse = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          subject: subject._id,
          academicYearId: academicYear._id,
          termId: term._id,
          gradeType: 'final',
          title: 'Mathematics Final',
          score: 75,
          maxScore: 100,
        })
        .expect(201);

      const gradeId = createResponse.body._id;

      const response = await request(app)
        .delete(`/api/grades/${gradeId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Grade Validation', () => {
    test('should reject grade creation with missing required fields', async () => {
      const invalidData = {
        student: testStudent._id,
        subject: subject._id
        // Missing grade, score, etc.
      };

      const response = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should reject grade creation with invalid score', async () => {
      const invalidData = {
        student: testStudent._id,
        subject: subject._id,
        academicYearId: academicYear._id,
        termId: term._id,
        gradeType: 'final',
        title: 'Mathematics Final',
        score: 'not-a-number',
        maxScore: 100,
      };

      const response = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should reject grade creation with invalid grade', async () => {
      const invalidData = {
        student: testStudent._id,
        subject: subject._id,
        academicYearId: academicYear._id,
        termId: term._id,
        gradeType: 'exam',
        title: 'Mathematics Final',
        score: 95,
        maxScore: 100
      };

      const response = await request(app)
        .post('/api/grades')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe.skip('Report Card Generation', () => {
    beforeEach(async () => {
      // Create test grades for report card
      await Grade.create([
        {
          student: testStudent._id,
          subject: 'Mathematics',
          academicYear: '2023-2024',
          term: 'Term 1',
          grade: 'A',
          score: 95,
          maxScore: 100,
          gradeType: 'exam'
        },
        {
          student: testStudent._id,
          subject: 'English',
          academicYear: '2023-2024',
          term: 'Term 1',
          grade: 'B',
          score: 85,
          maxScore: 100,
          gradeType: 'exam'
        },
        {
          student: testStudent._id,
          subject: 'Science',
          academicYear: '2023-2024',
          term: 'Term 1',
          grade: 'A-',
          score: 92,
          maxScore: 100,
          gradeType: 'assignment'
        }
      ]);
    });

    test('should generate report card for student', async () => {
      const response = await request(app)
        .post('/api/report-cards/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          academicYear: '2023-2024',
          term: 'Term 1'
        })
        .expect(201);

      expect(response.body).toHaveProperty('student');
      expect(response.body).toHaveProperty('grades');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('generatedAt');
      expect(Array.isArray(response.body.grades)).toBe(true);
    });

    test('should calculate GPA in report card', async () => {
      const response = await request(app)
        .post('/api/report-cards/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          academicYear: '2023-2024',
          term: 'Term 1'
        })
        .expect(201);

      expect(response.body.summary).toHaveProperty('gpa');
      expect(response.body.summary).toHaveProperty('totalGrades');
      expect(response.body.summary).toHaveProperty('averageScore');
      expect(typeof response.body.summary.gpa).toBe('number');
    });

    test('should include grade distribution in summary', async () => {
      const response = await request(app)
        .post('/api/report-cards/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          academicYear: '2023-2024',
          term: 'Term 1'
        })
        .expect(201);

      expect(response.body.summary).toHaveProperty('gradeDistribution');
      expect(response.body.summary.gradeDistribution).toHaveProperty('A');
      expect(response.body.summary.gradeDistribution).toHaveProperty('B');
      expect(response.body.summary.gradeDistribution).toHaveProperty('C');
    });

    test('should include attendance in report card', async () => {
      const response = await request(app)
        .post('/api/report-cards/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          academicYear: '2023-2024',
          term: 'Term 1',
          includeAttendance: true
        })
        .expect(201);

      expect(response.body).toHaveProperty('attendance');
      expect(response.body.attendance).toHaveProperty('totalDays');
      expect(response.body.attendance).toHaveProperty('presentDays');
      expect(response.body.attendance).toHaveProperty('attendanceRate');
    });
  });

  describe.skip('Report Card Export', () => {
    let testReportCard;

    beforeEach(async () => {
      // Generate a test report card
      const generateResponse = await request(app)
        .post('/api/report-cards/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          academicYear: '2023-2024',
          term: 'Term 1'
        });

      testReportCard = generateResponse.body;
    });

    test('should export report card as PDF', async () => {
      const response = await request(app)
        .get(`/api/report-cards/${testReportCard._id}/export?format=pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/pdf/);
      expect(response.headers['content-disposition']).toMatch(/attachment/);
    });

    test('should export report card as Excel', async () => {
      const response = await request(app)
        .get(`/api/report-cards/${testReportCard._id}/export?format=excel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/);
      expect(response.headers['content-disposition']).toMatch(/attachment/);
    });

    test('should export report card as CSV', async () => {
      const response = await request(app)
        .get(`/api/report-cards/${testReportCard._id}/export?format=csv`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/csv/);
      expect(response.headers['content-disposition']).toMatch(/attachment/);
    });

    test('should include student information in export', async () => {
      const response = await request(app)
        .get(`/api/report-cards/${testReportCard._id}/export?format=json`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('student');
      expect(response.body.student).toHaveProperty('firstName');
      expect(response.body.student).toHaveProperty('lastName');
      expect(response.body.student).toHaveProperty('studentId');
      expect(response.body).toHaveProperty('class');
    });

    test('should include school information in export', async () => {
      const response = await request(app)
        .get(`/api/report-cards/${testReportCard._id}/export?format=json`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('schoolInfo');
      expect(response.body.schoolInfo).toHaveProperty('name');
      expect(response.body.schoolInfo).toHaveProperty('address');
      expect(response.body.schoolInfo).toHaveProperty('logo');
      expect(response.body.schoolInfo).toHaveProperty('academicYear');
      expect(response.body.schoolInfo).toHaveProperty('term');
    });
  });

  describe.skip('Grade Analytics', () => {
    beforeEach(async () => {
      // Create test grades for analytics
      await Grade.create([
        {
          student: testStudent._id,
          subject: 'Mathematics',
          grade: 'A',
          score: 95,
          maxScore: 100
        },
        {
          student: testStudent._id,
          subject: 'English',
          grade: 'B',
          score: 85,
          maxScore: 100
        },
        {
          student: testStudent._id,
          subject: 'Science',
          grade: 'A-',
          score: 92,
          maxScore: 100
        }
      ]);
    });

    test('should calculate grade distribution', async () => {
      const response = await request(app)
        .get('/api/grades/analytics?student=testStudent._id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('gradeDistribution');
      expect(response.body.gradeDistribution).toHaveProperty('A');
      expect(response.body.gradeDistribution).toHaveProperty('B');
      expect(response.body.gradeDistribution).toHaveProperty('A-');
    });

    test('should calculate subject performance', async () => {
      const response = await request(app)
        .get('/api/grades/analytics?student=testStudent._id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('subjectPerformance');
      expect(Array.isArray(response.body.subjectPerformance)).toBe(true);
      expect(response.body.subjectPerformance[0]).toHaveProperty('subject');
      expect(response.body.subjectPerformance[0]).toHaveProperty('averageScore');
      expect(response.body.subjectPerformance[0]).toHaveProperty('grade');
    });

    test('should calculate class ranking', async () => {
      const response = await request(app)
        .get('/api/grades/analytics?class=testClass&term=Term 1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('classRanking');
      expect(Array.isArray(response.body.classRanking)).toBe(true);
    });

    test('should generate grade trends report', async () => {
      const response = await request(app)
        .get('/api/grades/trends?student=testStudent._id&period=academic')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('trends');
      expect(Array.isArray(response.body.trends)).toBe(true);
      expect(response.body.trends[0]).toHaveProperty('period');
      expect(response.body.trends[0]).toHaveProperty('averageScore');
      expect(response.body.trends[0]).toHaveProperty('gpa');
    });
  });
});
