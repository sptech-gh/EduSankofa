/**
 * Attendance Service Tests
 * Unit tests for attendance management functionality
 */

const request = require('supertest');
const app = require('../app');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');

describe('Attendance Service', () => {
  let adminToken;
  let teacherToken;
  let testStudent;
  let testClass;

  beforeAll(async () => {
    // Create test tokens
    const jwt = require('jsonwebtoken');
    
    adminToken = jwt.sign(
      {
        userId: 'admin-user-id',
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
        userId: 'teacher-user-id',
        role: 'teacher',
        email: 'teacher@example.com',
        jti: 'teacher-jti',
        iss: 'school-management-saas',
        aud: 'school-management-client'
      },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    // Create test class and student
    testClass = await Class.create({
      name: 'Test Class',
      grade: 'Grade 1',
      academicYear: '2023-2024',
      term: 'Term 1'
    });

    testStudent = await Student.create({
      firstName: 'Test',
      lastName: 'Student',
      email: 'test@student.com',
      class: testClass._id,
      studentId: 'STU001'
    });
  });

  afterAll(async () => {
    // Cleanup
    await Attendance.deleteMany({});
    await Student.deleteMany({});
    await Class.deleteMany({});
  });

  describe('Attendance CRUD Operations', () => {
    test('should mark attendance with teacher token', async () => {
      const attendanceData = {
        student: testStudent._id,
        class: testClass._id,
        date: '2024-01-15',
        status: 'present',
        subject: 'Mathematics'
      };

      const response = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(attendanceData)
        .expect(201);

      expect(response.body).toHaveProperty('student', testStudent._id);
      expect(response.body).toHaveProperty('status', 'present');
    });

    test('should reject attendance marking without authentication', async () => {
      const attendanceData = {
        student: testStudent._id,
        status: 'present'
      };

      const response = await request(app)
        .post('/api/attendance')
        .send(attendanceData)
        .expect(401);

      expect(response.body).toHaveProperty('code', 'AUTH_REQUIRED');
    });

    test('should reject attendance marking with insufficient permissions', async () => {
      const studentToken = require('jsonwebtoken').sign(
        {
          userId: 'student-user-id',
          role: 'student',
          email: 'student@example.com',
          jti: 'student-jti',
          iss: 'school-management-saas',
          aud: 'school-management-client'
        },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '1h', algorithm: 'HS256' }
      );

      const attendanceData = {
        student: testStudent._id,
        status: 'present'
      };

      const response = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(attendanceData)
        .expect(403);

      expect(response.body).toHaveProperty('code', 'STUDENT_PERMISSION_DENIED');
    });

    test('should get attendance records with teacher token', async () => {
      const response = await request(app)
        .get('/api/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should get attendance by student ID', async () => {
      const response = await request(app)
        .get(`/api/attendance/student/${testStudent._id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should get attendance by class ID', async () => {
      const response = await request(app)
        .get(`/api/attendance/class/${testClass._id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Attendance Validation', () => {
    test('should reject attendance marking with missing required fields', async () => {
      const invalidData = {
        student: testStudent._id
        // Missing date, status, etc.
      };

      const response = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should reject attendance marking with invalid status', async () => {
      const invalidData = {
        student: testStudent._id,
        class: testClass._id,
        date: '2024-01-15',
        status: 'invalid-status'
      };

      const response = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should reject attendance marking for non-existent student', async () => {
      const invalidData = {
        student: '507f1f77bcf86cd799439011',
        class: testClass._id,
        date: '2024-01-15',
        status: 'present'
      };

      const response = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('Attendance Reports', () => {
    beforeEach(async () => {
      // Create test attendance records
      await Attendance.create([
        {
          student: testStudent._id,
          class: testClass._id,
          date: '2024-01-15',
          status: 'present',
          subject: 'Mathematics'
        },
        {
          student: testStudent._id,
          class: testClass._id,
          date: '2024-01-16',
          status: 'absent',
          subject: 'English'
        },
        {
          student: testStudent._id,
          class: testClass._id,
          date: '2024-01-17',
          status: 'late',
          subject: 'Science'
        }
      ]);
    });

    test('should generate attendance report for student', async () => {
      const response = await request(app)
        .get(`/api/attendance/student/${testStudent._id}/report`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('student');
      expect(response.body).toHaveProperty('records');
      expect(response.body).toHaveProperty('summary');
      expect(Array.isArray(response.body.records)).toBe(true);
    });

    test('should generate attendance report for class', async () => {
      const response = await request(app)
        .get(`/api/attendance/class/${testClass._id}/report`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('class');
      expect(response.body).toHaveProperty('records');
      expect(response.body).toHaveProperty('summary');
      expect(Array.isArray(response.body.records)).toBe(true);
    });

    test('should calculate attendance statistics', async () => {
      const response = await request(app)
        .get(`/api/attendance/class/${testClass._id}/stats`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalDays');
      expect(response.body).toHaveProperty('presentDays');
      expect(response.body).toHaveProperty('absentDays');
      expect(response.body).toHaveProperty('lateDays');
      expect(response.body).toHaveProperty('attendanceRate');
    });

    test('should filter attendance by date range', async () => {
      const response = await request(app)
        .get('/api/attendance?startDate=2024-01-15&endDate=2024-01-16')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should filter attendance by status', async () => {
      const response = await request(app)
        .get('/api/attendance?status=present')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every(record => record.status === 'present')).toBe(true);
    });
  });

  describe('Bulk Attendance Operations', () => {
    test('should mark bulk attendance for class', async () => {
      const bulkData = {
        class: testClass._id,
        date: '2024-01-18',
        attendance: [
          {
            student: testStudent._id,
            status: 'present'
          }
        ]
      };

      const response = await request(app)
        .post('/api/attendance/bulk')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(bulkData)
        .expect(201);

      expect(response.body).toHaveProperty('processed');
      expect(response.body).toHaveProperty('failed');
      expect(Array.isArray(response.body.processed)).toBe(true);
    });

    test('should handle bulk attendance with mixed results', async () => {
      // Create another test student
      const anotherStudent = await Student.create({
        firstName: 'Another',
        lastName: 'Student',
        email: 'another@student.com',
        class: testClass._id,
        studentId: 'STU002'
      });

      const bulkData = {
        class: testClass._id,
        date: '2024-01-19',
        attendance: [
          {
            student: testStudent._id,
            status: 'present'
          },
          {
            student: anotherStudent._id,
            status: 'absent'
          }
        ]
      };

      const response = await request(app)
        .post('/api/attendance/bulk')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(bulkData)
        .expect(201);

      expect(response.body).toHaveProperty('processed');
      expect(response.body.processed.length).toBe(2);
    });
  });
});
