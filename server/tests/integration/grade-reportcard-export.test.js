/**
 * Integration Test: Grade → Report Card → Export Workflow
 * Tests the complete workflow from grade entry to report card export
 */

const request = require('supertest');
const app = require('../../../app');
const Student = require('../../../models/Student');
const Grade = require('../../../models/Grade');
const ReportCard = require('../../../models/ReportCard');

describe('Grade → Report Card → Export Integration', () => {
  let adminToken;
  let teacherToken;
  let testStudent;

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

    // Create test student
    testStudent = await Student.create({
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice.johnson@example.com',
      studentId: 'STU001',
      dateOfBirth: '2010-01-01'
    });
  });

  afterAll(async () => {
    // Cleanup
    await ReportCard.deleteMany({});
    await Grade.deleteMany({});
    await Student.deleteMany({});
  });

  describe('Complete Workflow Test', () => {
    test('should complete grade → report card → export workflow', async () => {
      // Step 1: Create multiple grades across different subjects
      const gradeData = [
        {
          student: testStudent._id,
          subject: 'Mathematics',
          academicYear: '2023-2024',
          term: 'Term 1',
          grade: 'A',
          score: 95,
          maxScore: 100,
          gradeType: 'exam',
          comments: 'Excellent understanding of concepts',
          date: '2024-01-15'
        },
        {
          student: testStudent._id,
          subject: 'English',
          academicYear: '2023-2024',
          term: 'Term 1',
          grade: 'B+',
          score: 87,
          maxScore: 100,
          gradeType: 'exam',
          comments: 'Good comprehension, needs improvement in writing',
          date: '2024-01-16'
        },
        {
          student: testStudent._id,
          subject: 'Science',
          academicYear: '2023-2024',
          term: 'Term 1',
          grade: 'A-',
          score: 92,
          maxScore: 100,
          gradeType: 'assignment',
          comments: 'Strong analytical skills',
          date: '2024-01-17'
        },
        {
          student: testStudent._id,
          subject: 'Social Studies',
          academicYear: '2023-2024',
          term: 'Term 1',
          grade: 'B',
          score: 83,
          maxScore: 100,
          gradeType: 'project',
          comments: 'Creative project well executed',
          date: '2024-01-18'
        },
        {
          student: testStudent._id,
          subject: 'Physical Education',
          academicYear: '2023-2024',
          term: 'Term 1',
          grade: 'A',
          score: 98,
          maxScore: 100,
          gradeType: 'participation',
          comments: 'Excellent participation and sportsmanship',
          date: '2024-01-19'
        }
      ];

      for (const grade of gradeData) {
        await request(app)
          .post('/api/grades')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send(grade)
          .expect(201);
      }

      // Step 2: Generate report card
      const reportCardResponse = await request(app)
        .post('/api/report-cards/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          academicYear: '2023-2024',
          term: 'Term 1',
          includeAttendance: true,
          includeBehavior: true
        })
        .expect(201);

      const reportCardId = reportCardResponse.body._id;
      expect(reportCardResponse.body.student).toHaveProperty('firstName', 'Alice');
      expect(reportCardResponse.body.student).toHaveProperty('lastName', 'Johnson');
      expect(reportCardResponse.body.grades.length).toBe(5);

      // Step 3: Verify report card content
      const verifyResponse = await request(app)
        .get(`/api/report-cards/${reportCardId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(verifyResponse.body.grades.length).toBe(5);
      expect(verifyResponse.body.summary).toHaveProperty('gpa');
      expect(verifyResponse.body.summary).toHaveProperty('totalGrades');
      expect(verifyResponse.body.summary).toHaveProperty('averageScore');
      expect(verifyResponse.body.summary).toHaveProperty('gradeDistribution');

      // Verify GPA calculation
      const gpa = verifyResponse.body.summary.gpa;
      expect(gpa).toBeGreaterThanOrEqual(3.0); // All A's and B's should give good GPA
      expect(gpa).toBeLessThanOrEqual(4.0); // Should be reasonable

      // Verify grade distribution
      const gradeDist = verifyResponse.body.summary.gradeDistribution;
      expect(gradeDist).toHaveProperty('A');
      expect(gradeDist).toHaveProperty('B');
      expect(gradeDist.A).toBe(2); // Mathematics and PE
      expect(gradeDist.B).toBe(2); // English and Social Studies

      // Step 4: Export report card in different formats
      const formats = ['pdf', 'excel', 'csv'];
      
      for (const format of formats) {
        const exportResponse = await request(app)
          .get(`/api/report-cards/${reportCardId}/export?format=${format}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Verify content type
        if (format === 'pdf') {
          expect(exportResponse.headers['content-type']).toMatch(/application\/pdf/);
          expect(exportResponse.headers['content-disposition']).toMatch(/attachment/);
        } else if (format === 'excel') {
          expect(exportResponse.headers['content-type']).toMatch(/application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/);
        } else if (format === 'csv') {
          expect(exportResponse.headers['content-type']).toMatch(/text\/csv/);
        }

        // Verify filename
        const contentDisposition = exportResponse.headers['content-disposition'];
        expect(contentDisposition).toContain('report-card');
        expect(contentDisposition).toContain(`alice-johnson`);
      }

      // Step 5: Verify data consistency across formats
      const jsonExportResponse = await request(app)
        .get(`/api/report-cards/${reportCardId}/export?format=json`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const exportData = jsonExportResponse.body;
      expect(exportData.student.firstName).toBe('Alice');
      expect(exportData.student.lastName).toBe('Johnson');
      expect(exportData.grades.length).toBe(5);
      expect(exportData.summary.gpa).toBe(verifyResponse.body.summary.gpa);
    });

    test('should handle report card with attendance integration', async () => {
      // Create grades
      const gradeData = [
        {
          student: testStudent._id,
          subject: 'Mathematics',
          grade: 'A',
          score: 95,
          maxScore: 100,
          date: '2024-01-15'
        },
        {
          student: testStudent._id,
          subject: 'English',
          grade: 'B',
          score: 85,
          maxScore: 100,
          date: '2024-01-16'
        }
      ];

      for (const grade of gradeData) {
        await request(app)
          .post('/api/grades')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send(grade)
          .expect(201);
      }

      // Mock attendance data
      const attendanceData = [
        {
          student: testStudent._id,
          date: '2024-01-15',
          status: 'present'
        },
        {
          student: testStudent._id,
          date: '2024-01-16',
          status: 'present'
        }
      ];

      for (const attendance of attendanceData) {
        await request(app)
          .post('/api/attendance')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send(attendance)
          .expect(201);
      }

      // Generate report card with attendance
      const reportCardResponse = await request(app)
        .post('/api/report-cards/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          academicYear: '2023-2024',
          term: 'Term 1',
          includeAttendance: true
        })
        .expect(201);

      expect(reportCardResponse.body).toHaveProperty('attendance');
      expect(reportCardResponse.body.attendance).toHaveProperty('totalDays');
      expect(reportCardResponse.body.attendance).toHaveProperty('presentDays');
      expect(reportCardResponse.body.attendance).toHaveProperty('attendanceRate');

      // Verify attendance integration
      expect(reportCardResponse.body.attendance.totalDays).toBe(2);
      expect(reportCardResponse.body.attendance.presentDays).toBe(2);
      expect(reportCardResponse.body.attendance.attendanceRate).toBe(100);
    });

    test('should handle report card with behavior comments', async () => {
      // Create grades with behavior comments
      const gradeData = [
        {
          student: testStudent._id,
          subject: 'Mathematics',
          grade: 'A',
          score: 95,
          maxScore: 100,
          gradeType: 'exam',
          behaviorComments: 'Excellent class participation, helpful to peers'
        },
        {
          student: testStudent._id,
          subject: 'English',
          grade: 'C',
          score: 75,
          maxScore: 100,
          gradeType: 'exam',
          behaviorComments: 'Needs to improve class participation, disruptive at times'
        }
      ];

      for (const grade of gradeData) {
        await request(app)
          .post('/api/grades')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send(grade)
          .expect(201);
      }

      // Generate report card with behavior
      const reportCardResponse = await request(app)
        .post('/api/report-cards/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          academicYear: '2023-2024',
          term: 'Term 1',
          includeBehavior: true
        })
        .expect(201);

      expect(reportCardResponse.body).toHaveProperty('behavior');
      expect(reportCardResponse.body.behavior).toHaveProperty('overallComments');
      expect(reportCardResponse.body.behavior).toHaveProperty('conductGrade');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle report card generation with no grades', async () => {
      const response = await request(app)
        .post('/api/report-cards/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          academicYear: '2023-2024',
          term: 'Term 1'
        })
        .expect(201);

      expect(response.body.grades.length).toBe(0);
      expect(response.body.summary.gpa).toBe(0);
      expect(response.body.summary.totalGrades).toBe(0);
    });

    test('should handle invalid export formats', async () => {
      // Create report card first
      const reportCardResponse = await request(app)
        .post('/api/report-cards/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          academicYear: '2023-2024',
          term: 'Term 1'
        })
        .expect(201);

      const reportCardId = reportCardResponse.body._id;

      // Test invalid formats
      const invalidFormats = ['xml', 'doc', 'txt', 'invalid'];
      
      for (const format of invalidFormats) {
        const response = await request(app)
          .get(`/api/report-cards/${reportCardId}/export?format=${format}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      }
    });

    test('should handle report card for non-existent student', async () => {
      const response = await request(app)
        .post('/api/report-cards/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: 'non-existent-student-id',
          academicYear: '2023-2024',
          term: 'Term 1'
        })
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should validate academic year and term parameters', async () => {
      const invalidCases = [
        {
          name: 'Invalid academic year format',
          data: { student: testStudent._id, academicYear: 'invalid-year', term: 'Term 1' }
        },
        {
          name: 'Invalid term format',
          data: { student: testStudent._id, academicYear: '2023-2024', term: 'Invalid Term' }
        },
        {
          name: 'Future academic year',
          data: { student: testStudent._id, academicYear: '2025-2026', term: 'Term 1' }
        }
      ];

      for (const testCase of invalidCases) {
        const response = await request(app)
          .post('/api/report-cards/generate')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send(testCase.data)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      }
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle bulk report card generation efficiently', async () => {
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

      // Create grades for all students
      for (const student of students) {
        for (let j = 0; j < 5; j++) {
          await request(app)
            .post('/api/grades')
            .set('Authorization', `Bearer ${teacherToken}`)
            .send({
              student: student._id,
              subject: `Subject${j}`,
              grade: j % 2 === 0 ? 'A' : 'B',
              score: 85 + (j * 2),
              maxScore: 100
            });
        }
      }

      // Generate report cards in bulk
      const startTime = Date.now();
      const reportCardPromises = students.map(student =>
        request(app)
          .post('/api/report-cards/generate')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            student: student._id,
            academicYear: '2023-2024',
            term: 'Term 1'
          })
      );

      const reportCardResponses = await Promise.all(reportCardPromises);
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(reportCardResponses.length).toBe(10);
      expect(reportCardResponses.every(r => r.status === 201)).toBe(true);
      expect(processingTime).toBeLessThan(30000); // Should process within 30 seconds

      // Export all report cards
      const exportPromises = reportCardResponses.map(r =>
        request(app)
          .get(`/api/report-cards/${r.body._id}/export?format=pdf`)
          .set('Authorization', `Bearer ${adminToken}`)
      );

      const exportResponses = await Promise.all(exportPromises);
      expect(exportResponses.length).toBe(10);
      expect(exportResponses.every(r => r.status === 200)).toBe(true);
    });

    test('should handle large dataset report generation', async () => {
      // Create substantial grade data
      const subjects = ['Math', 'English', 'Science', 'History', 'Geography', 'Physics', 'Chemistry', 'Biology', 'Literature', 'Art'];
      
      for (let i = 0; i < subjects.length; i++) {
        await request(app)
          .post('/api/grades')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({
            student: testStudent._id,
            subject: subjects[i],
            grade: String.fromCharCode(65 + (i % 5)), // A, B, C, D, E
            score: 85 + (i * 2),
            maxScore: 100
          });
      }

      // Generate comprehensive report card
      const startTime = Date.now();
      const reportResponse = await request(app)
        .post('/api/report-cards/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          student: testStudent._id,
          academicYear: '2023-2024',
          term: 'Term 1',
          includeAttendance: true,
          includeBehavior: true
        })
        .expect(201);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(reportResponse.body.grades.length).toBe(10);
      expect(reportResponse.body.summary.gpa).toBeGreaterThan(2.0);
      expect(processingTime).toBeLessThan(20000); // Should process within 20 seconds

      // Test export performance
      const exportStartTime = Date.now();
      const exportResponse = await request(app)
        .get(`/api/report-cards/${reportResponse.body._id}/export?format=excel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const exportEndTime = Date.now();
      const exportProcessingTime = exportEndTime - exportStartTime;

      expect(exportProcessingTime).toBeLessThan(25000); // Should export within 25 seconds
    });
  });
});
