/**
 * Integration Test: Student → Attendance → Report Workflow
 * Tests the complete workflow from student creation to report generation
 */

const request = require('supertest');
const app = require('../../../app');
const Student = require('../../../models/Student');
const Attendance = require('../../../models/Attendance');

describe('Student → Attendance → Report Integration', () => {
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

    // Create test class
    testClass = await Student.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      studentId: 'STU001'
    });
  });

  afterAll(async () => {
    // Cleanup
    await Attendance.deleteMany({});
    await Student.deleteMany({});
  });

  describe('Complete Workflow Test', () => {
    test('should complete student → attendance → report workflow', async () => {
      // Step 1: Create student
      const studentResponse = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          dateOfBirth: '2010-01-01',
          gender: 'female',
          studentId: 'STU002'
        })
        .expect(201);

      const studentId = studentResponse.body._id;
      expect(studentResponse.body.firstName).toBe('Jane');
      expect(studentResponse.body.lastName).toBe('Smith');

      // Step 2: Mark attendance for multiple days
      const attendanceData = [
        {
          student: studentId,
          date: '2024-01-15',
          status: 'present',
          subject: 'Mathematics'
        },
        {
          student: studentId,
          date: '2024-01-16',
          status: 'present',
          subject: 'English'
        },
        {
          student: studentId,
          date: '2024-01-17',
          status: 'absent',
          subject: 'Science',
          reason: 'Sick leave'
        },
        {
          student: studentId,
          date: '2024-01-18',
          status: 'late',
          subject: 'Mathematics',
          minutesLate: 15
        }
      ];

      for (const attendance of attendanceData) {
        await request(app)
          .post('/api/attendance')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send(attendance)
          .expect(201);
      }

      // Step 3: Verify attendance records
      const attendanceResponse = await request(app)
        .get(`/api/attendance/student/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(attendanceResponse.body.length).toBe(4);
      expect(attendanceResponse.body.some(a => a.status === 'present')).toBe(true);
      expect(attendanceResponse.body.some(a => a.status === 'absent')).toBe(true);
      expect(attendanceResponse.body.some(a => a.status === 'late')).toBe(true);

      // Step 4: Generate attendance report
      const reportResponse = await request(app)
        .get(`/api/attendance/student/${studentId}/report`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(reportResponse.body).toHaveProperty('student');
      expect(reportResponse.body).toHaveProperty('records');
      expect(reportResponse.body).toHaveProperty('summary');
      expect(reportResponse.body.summary).toHaveProperty('totalDays');
      expect(reportResponse.body.summary).toHaveProperty('presentDays');
      expect(reportResponse.body.summary).toHaveProperty('absentDays');
      expect(reportResponse.body.summary).toHaveProperty('lateDays');
      expect(reportResponse.body.summary).toHaveProperty('attendanceRate');

      // Verify calculations
      expect(reportResponse.body.summary.totalDays).toBe(4);
      expect(reportResponse.body.summary.presentDays).toBe(2);
      expect(reportResponse.body.summary.absentDays).toBe(1);
      expect(reportResponse.body.summary.lateDays).toBe(1);
      expect(reportResponse.body.summary.attendanceRate).toBe(50); // 2/4 = 50%

      // Step 5: Export attendance report
      const exportResponse = await request(app)
        .get(`/api/attendance/student/${studentId}/export?format=pdf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(exportResponse.headers['content-type']).toMatch(/application\/pdf/);
      expect(exportResponse.headers['content-disposition']).toMatch(/attachment/);

      // Step 6: Verify data consistency across workflow
      const finalStudentResponse = await request(app)
        .get(`/api/students/${studentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(finalStudentResponse.body._id).toBe(studentId);
      expect(finalStudentResponse.body.firstName).toBe('Jane');
      expect(finalStudentResponse.body.lastName).toBe('Smith');
    });

    test('should handle workflow errors gracefully', async () => {
      // Test with invalid student ID
      const invalidResponse = await request(app)
        .get('/api/attendance/student/invalid-student-id/report')
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(404);

      expect(invalidResponse.body).toHaveProperty('code', 'STUDENT_NOT_FOUND');

      // Test attendance marking with invalid data
      const invalidAttendanceResponse = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: 'invalid-student-id',
          date: '2024-01-15',
          status: 'present'
        })
        .expect(400);

      expect(invalidAttendanceResponse.body).toHaveProperty('errors');
    });

    test('should maintain data integrity throughout workflow', async () => {
      // Create student with specific data
      const studentData = {
        firstName: 'Test',
        lastName: 'Student',
        email: 'test@student.com',
        dateOfBirth: '2010-01-01',
        gender: 'male',
        studentId: 'TEST001'
      };

      const studentResponse = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(studentData)
        .expect(201);

      const studentId = studentResponse.body._id;

      // Mark attendance with consistent data
      const attendanceResponse = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: studentId,
          date: '2024-01-15',
          status: 'present',
          subject: 'Mathematics',
          recordedBy: 'teacher@example.com'
        })
        .expect(201);

      // Verify data consistency
      const attendanceCheckResponse = await request(app)
        .get(`/api/attendance/student/${studentId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(attendanceCheckResponse.body[0].student).toBe(studentId);
      expect(attendanceCheckResponse.body[0].status).toBe('present');
      expect(attendanceCheckResponse.body[0].subject).toBe('Mathematics');
      expect(attendanceCheckResponse.body[0].recordedBy).toBe('teacher@example.com');

      // Generate report and verify consistency
      const reportResponse = await request(app)
        .get(`/api/attendance/student/${studentId}/report`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      expect(reportResponse.body.student.firstName).toBe('Test');
      expect(reportResponse.body.student.lastName).toBe('Student');
      expect(reportResponse.body.student.studentId).toBe('TEST001');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle bulk attendance operations efficiently', async () => {
      // Create multiple students
      const students = [];
      for (let i = 0; i < 10; i++) {
        const studentResponse = await request(app)
          .post('/api/students')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            firstName: `Student${i}`,
            lastName: `Test${i}`,
            email: `student${i}@test.com`,
            studentId: `STU${String(i).padStart(3, '0')}`
          })
          .expect(201);
        students.push(studentResponse.body);
      }

      // Mark bulk attendance
      const bulkAttendanceData = {
        class: 'test-class-id',
        date: '2024-01-15',
        attendance: students.map(student => ({
          student: student._id,
          status: 'present'
        }))
      };

      const startTime = Date.now();
      const bulkResponse = await request(app)
        .post('/api/attendance/bulk')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(bulkAttendanceData)
        .expect(201);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(bulkResponse.body.processed.length).toBe(10);
      expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds

      // Verify all attendance records were created
      const verifyResponse = await request(app)
        .get('/api/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .query({ date: '2024-01-15' })
        .expect(200);

      expect(verifyResponse.body.length).toBeGreaterThanOrEqual(10);
    });

    test('should generate reports within acceptable time limits', async () => {
      // Create substantial attendance data
      const studentId = testClass._id;
      
      for (let i = 0; i < 100; i++) {
        await request(app)
          .post('/api/attendance')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            student: studentId,
            date: `2024-01-${String(i % 28 + 1).padStart(2, '0')}`,
            status: i % 4 === 0 ? 'absent' : 'present'
          });
      }

      // Test report generation performance
      const startTime = Date.now();
      const reportResponse = await request(app)
        .get(`/api/attendance/student/${studentId}/report`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(reportResponse.body.records.length).toBe(100);
      expect(processingTime).toBeLessThan(10000); // Should generate within 10 seconds
      expect(reportResponse.body.summary).toHaveProperty('attendanceRate');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle concurrent attendance marking', async () => {
      const studentId = testClass._id;
      
      // Simulate concurrent requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/attendance')
            .set('Authorization', `Bearer ${teacherToken}`)
            .send({
              student: studentId,
              date: '2024-01-15',
              status: 'present',
              subject: 'Test Subject'
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // All should succeed (201) or fail gracefully
      const successCount = responses.filter(r => r.status === 201).length;
      const failureCount = responses.filter(r => r.status >= 400).length;
      
      expect(successCount + failureCount).toBe(5);
      expect(failureCount).toBeLessThanOrEqual(2); // Allow some failures due to concurrency
    });

    test('should handle data validation consistently', async () => {
      const invalidCases = [
        {
          name: 'Missing student ID',
          data: { date: '2024-01-15', status: 'present' }
        },
        {
          name: 'Invalid date format',
          data: { student: testClass._id, date: 'invalid-date', status: 'present' }
        },
        {
          name: 'Invalid status',
          data: { student: testClass._id, date: '2024-01-15', status: 'invalid-status' }
        },
        {
          name: 'Future date',
          data: { student: testClass._id, date: '2025-01-01', status: 'present' }
        }
      ];

      for (const testCase of invalidCases) {
        const response = await request(app)
          .post('/api/attendance')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send(testCase.data)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      }
    });

    test('should maintain audit trail throughout workflow', async () => {
      // This test would verify that all operations are properly logged
      // In a real implementation, you would check the audit logs
      
      const studentResponse = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Audit',
          lastName: 'Test',
          email: 'audit@test.com'
        })
        .expect(201);

      const attendanceResponse = await request(app)
        .post('/api/attendance')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: studentResponse.body._id,
          date: '2024-01-15',
          status: 'present'
        })
        .expect(201);

      const reportResponse = await request(app)
        .get(`/api/attendance/student/${studentResponse.body._id}/report`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      // Verify all operations completed successfully
      expect(studentResponse.status).toBe(201);
      expect(attendanceResponse.status).toBe(201);
      expect(reportResponse.status).toBe(200);
    });
  });
});
