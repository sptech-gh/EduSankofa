module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: [], // Disable global setup for now
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/tests/**',
    '!server/node_modules/**',
    '!server/coverage/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000,
};
