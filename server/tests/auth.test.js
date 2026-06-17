/**
 * Authentication Tests
 * Unit tests for authentication middleware and services
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');

describe('Authentication Middleware', () => {
  let testToken;
  let expiredToken;
  let invalidToken;

  beforeAll(() => {
    // Generate test tokens
    testToken = jwt.sign(
      {
        userId: 'test-user-id',
        role: 'admin',
        email: 'test@example.com',
        jti: 'test-jti',
        iss: 'school-management-saas',
        aud: 'school-management-client'
      },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    expiredToken = jwt.sign(
      {
        userId: 'test-user-id',
        role: 'admin',
        email: 'test@example.com',
        jti: 'test-jti-expired',
        iss: 'school-management-saas',
        aud: 'school-management-client'
      },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '-1h', algorithm: 'HS256' }
    );

    invalidToken = 'invalid.jwt.token';
  });

  describe('Token Validation', () => {
    test('should allow access with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('role');
    });

    test('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body).toHaveProperty('code', 'AUTH_REQUIRED');
      expect(response.body).toHaveProperty('message');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('code', 'INVALID_TOKEN');
    });

    test('should reject request with expired token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('code', 'TOKEN_EXPIRED');
    });

    test('should accept token from x-auth-token header', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('x-auth-token', testToken)
        .expect(200);

      expect(response.body).toHaveProperty('id');
    });

    test('should reject malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 123)
        .expect(401);

      expect(response.body).toHaveProperty('code', 'INVALID_TOKEN_FORMAT');
    });
  });

  describe('Role Authorization', () => {
    test('should allow admin to access admin routes', async () => {
      const adminToken = jwt.sign(
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

      const response = await request(app)
        .get('/api/audit/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404); // 404 expected if no logs exist

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    test('should reject student from accessing admin routes', async () => {
      const studentToken = jwt.sign(
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

      const response = await request(app)
        .get('/api/audit/logs')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('code', 'INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('Security Headers', () => {
    test('should add security headers to authenticated requests', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.headers).toHaveProperty('x-auth-user-id');
      expect(response.headers).toHaveProperty('x-auth-user-role');
      expect(response.headers).toHaveProperty('x-auth-timestamp');
    });
  });
});
