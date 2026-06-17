/**
 * Test Setup File
 * Global test configuration and utilities
 */

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  // Ignore
}

const mongoose = require('mongoose');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test utilities
global.createTestToken = (payload = {}) => {
  const jwt = require('jsonwebtoken');
  const defaultPayload = {
    userId: 'test-user-id',
    role: 'admin',
    email: 'test@example.com',
    jti: 'test-jti-' + Date.now(),
    iss: 'school-management-saas',
    aud: 'school-management-client',
    ...payload
  };

  return jwt.sign(defaultPayload, process.env.JWT_SECRET, {
    expiresIn: '1h',
    algorithm: 'HS256'
  });
};

// Setup and teardown
beforeAll(async () => {
  // Connect to test database
  const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/school-management-test';
  await mongoose.connect(mongoUri);
}, 30000); // Increase timeout to 30 seconds

afterAll(async () => {
  // Clean up database connection
  await mongoose.connection.close();
}, 30000);

beforeEach(async () => {
  // Clean up collections before each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
