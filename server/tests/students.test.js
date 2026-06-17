/**
 * Students Service Tests
 * Unit tests for student management functionality
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Student = require('../models/Student');
const Class = require('../models/Class');

describe('Students Service', () => {
  let adminToken;
  let teacherToken;
  let testStudent;
  let testClass;
  let adminUserId;
  let teacherUserId;

  beforeAll(async () => {
    // Create test tokens
    const jwt = require('jsonwebtoken');

    adminUserId = new mongoose.Types.ObjectId();
    teacherUserId = new mongoose.Types.ObjectId();

    adminToken = jwt.sign(
      {
        userId: adminUserId,
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
        userId: teacherUserId,
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

  afterAll(async () => {
    // Cleanup
    await Student.deleteMany({});
    await Class.deleteMany({});
  });

  beforeEach(async () => {
    testClass = await Class.create({
      name: 'Test Class',
      grade: 'Grade 1',
      section: 'A',
      teacher: teacherUserId,
      academicYear: '2023-2024',
      isActive: true,
    });
  });

  describe('Student CRUD Operations', () => {
    test('should create new student with admin token', async () => {
      const studentData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        dateOfBirth: '2010-01-01',
        gender: 'male',
        studentId: 'STU001'
      };

      const response = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(studentData)
        .expect(201);

      expect(response.body).toHaveProperty('firstName', 'John');
      expect(response.body).toHaveProperty('lastName', 'Doe');
      expect(response.body).toHaveProperty('email', 'john.doe@example.com');
      
      testStudent = response.body._id;
    });

    test('should reject student creation without authentication', async () => {
      const studentData = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com'
      };

      const response = await request(app)
        .post('/api/students')
        .send(studentData)
        .expect(401);

      expect(response.body).toHaveProperty('code', 'AUTH_REQUIRED');
    });

    test('should reject student creation with insufficient permissions', async () => {
      const studentData = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        dateOfBirth: '2010-01-01',
        gender: 'female',
        studentId: 'STU002'
      };

      const response = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(studentData)
        .expect(403);

      expect(response.body).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
    });

    test('should get all students with admin token', async () => {
      const response = await request(app)
        .get('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should get student by ID with admin token', async () => {
      // Create a test student
      const createResponse = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Test',
          lastName: 'Student',
          email: 'test@student.com',
          dateOfBirth: '2010-01-01',
          gender: 'male',
          studentId: 'STU003'
        });
      const studentId = createResponse.body._id;

      const response = await request(app)
        .get(`/api/students/${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('firstName', 'Test');
      expect(response.body).toHaveProperty('_id', studentId);
    });

    test('should update student with admin token', async () => {
      // Create a test student
      const createResponse = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Test',
          lastName: 'Student',
          email: 'test@student.com',
          dateOfBirth: '2010-01-01',
          gender: 'male',
          studentId: 'STU004'
        });
      const studentId = createResponse.body._id;

      const updateData = {
        firstName: 'Updated',
        lastName: 'Student'
      };

      const response = await request(app)
        .put(`/api/students/${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('firstName', 'Updated');
    });

    test('should delete student with admin token', async () => {
      // Create a test student
      const createResponse = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Test',
          lastName: 'Student',
          email: 'test@student.com',
          dateOfBirth: '2010-01-01',
          gender: 'male',
          studentId: 'STU005'
        });
      const studentId = createResponse.body._id;

      const response = await request(app)
        .delete(`/api/students/${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Student Validation', () => {
    test('should reject student creation with missing required fields', async () => {
      const invalidData = {
        firstName: 'John'
        // Missing lastName, email, etc.
      };

      const response = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    test('should reject student creation with invalid email', async () => {
      const invalidData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
        dateOfBirth: '2010-01-01',
        gender: 'male',
        studentId: 'STU999'
      };

      const response = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    test('should reject student creation with invalid date of birth', async () => {
      const invalidData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        dateOfBirth: 'future-date',
        gender: 'male',
        studentId: 'STU998'
      };

      const response = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(500);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Student Search and Filtering', () => {
    beforeEach(async () => {
      // Create test students for filtering
      await Student.create([
        {
          firstName: 'Alice',
          lastName: 'Johnson',
          email: 'alice@example.com',
          class: testClass._id,
          status: 'active'
        },
        {
          firstName: 'Bob',
          lastName: 'Smith',
          email: 'bob@example.com',
          class: testClass._id,
          status: 'inactive'
        }
      ]);
    });

    test('should filter students by status', async () => {
      const response = await request(app)
        .get('/api/students?status=active')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every(student => student.status === 'active')).toBe(true);
    });

    test('should filter students by class', async () => {
      const response = await request(app)
        .get(`/api/students?class=${testClass._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every(student => String(student.class) === String(testClass._id))).toBe(true);
    });

    test('should search students by name', async () => {
      const response = await request(app)
        .get('/api/students?search=Alice')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some(student => student.firstName === 'Alice')).toBe(true);
    });
  });
});
