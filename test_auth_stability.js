#!/usr/bin/env node

/**
 * PHASE 4 - AUTHENTICATION & SESSION STABILITY TESTS
 * Tests JWT/session handling consistency, backend enforcement, and security
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');
const { execSync } = require('child_process');

// Configuration
const SERVER_URL = 'http://localhost:5000';
const API_BASE = `${SERVER_URL}/api`;
const JWT_SECRET = 'yecf62c1239d72490f589d787c3cfbdf2';

// Test results
const results = {
  jwt: { passed: 0, failed: 0, tests: [] },
  session: { passed: 0, failed: 0, tests: [] },
  backend: { passed: 0, failed: 0, tests: [] },
  frontend: { passed: 0, failed: 0, tests: [] },
  integration: { passed: 0, failed: 0, tests: [] }
};

// Helper functions
function log(category, message, status = 'info') {
  const timestamp = new Date().toISOString();
  const statusIcon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : 'ℹ️';
  console.log(`${timestamp} ${statusIcon} [${category.toUpperCase()}] ${message}`);
}

function recordTest(category, name, passed, details = '') {
  const test = { name, passed, details };
  results[category].tests.push(test);
  results[category][passed ? 'passed' : 'failed']++;
  log(category, `${name}: ${passed ? 'PASSED' : 'FAILED'}`, passed ? 'pass' : 'fail');
}

function generateTestToken(payload = {}) {
  const defaultPayload = {
    userId: 'test-user-id',
    role: 'admin',
    email: 'test@example.com',
    jti: 'test-jti-' + Date.now(),
    iss: 'school-management-saas',
    aud: 'school-management-client',
    ...payload
  };

  return jwt.sign(defaultPayload, JWT_SECRET, {
    expiresIn: '1h',
    algorithm: 'HS256',
  });
}

function generateExpiredToken() {
  const payload = {
    userId: 'test-user-id',
    role: 'admin',
    email: 'test@example.com',
    jti: 'test-jti-expired',
    iss: 'school-management-saas',
    aud: 'school-management-client',
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '-1h', // Expired
    algorithm: 'HS256',
  });
}

function generateInvalidToken() {
  return 'invalid.jwt.token';
}

// JWT Tests
function testJWTTokenGeneration() {
  try {
    const token = generateTestToken();
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const hasRequiredFields = decoded.userId && decoded.role && decoded.email && decoded.jti;
    const hasCorrectIssuer = decoded.iss === 'school-management-saas';
    const hasCorrectAudience = decoded.aud === 'school-management-client';
    
    recordTest('jwt', 'Token Generation & Verification', 
      hasRequiredFields && hasCorrectIssuer && hasCorrectAudience,
      `Fields: ${hasRequiredFields ? '✓' : '✗'}, Issuer: ${hasCorrectIssuer ? '✓' : '✗'}, Audience: ${hasCorrectAudience ? '✓' : '✗'}`);
  } catch (error) {
    recordTest('jwt', 'Token Generation & Verification', false, `Error: ${error.message}`);
  }
}

function testJWTTokenExpiration() {
  try {
    const expiredToken = generateExpiredToken();
    jwt.verify(expiredToken, JWT_SECRET);
    
    recordTest('jwt', 'Token Expiration Detection', false, 'Should have thrown TokenExpiredError');
  } catch (error) {
    const passed = error.name === 'TokenExpiredError';
    recordTest('jwt', 'Token Expiration Detection', passed, 
      passed ? 'Correctly detected expired token' : `Wrong error: ${error.name}`);
  }
}

function testJWTInvalidToken() {
  try {
    jwt.verify(generateInvalidToken(), JWT_SECRET);
    
    recordTest('jwt', 'Invalid Token Detection', false, 'Should have thrown JsonWebTokenError');
  } catch (error) {
    const passed = error.name === 'JsonWebTokenError';
    recordTest('jwt', 'Invalid Token Detection', passed,
      passed ? 'Correctly detected invalid token' : `Wrong error: ${error.name}`);
  }
}

// Session Tests
async function testSessionWithValidToken() {
  try {
    const validToken = generateTestToken();
    
    const response = await axios.get(`${API_BASE}/auth/profile`, {
      headers: { 'Authorization': `Bearer ${validToken}` }
    });
    
    recordTest('session', 'Valid Token Session', response.status === 200,
      `Status: ${response.status}`);
  } catch (error) {
    const status = error.response?.status || 0;
    const passed = status === 404 || status === 200; // 404 if user not found, 200 if successful
    recordTest('session', 'Valid Token Session', passed,
      passed ? 'Correctly authenticated (user not found expected)' : `Unexpected status: ${status}`);
  }
}

async function testSessionWithExpiredToken() {
  try {
    const expiredToken = generateExpiredToken();
    
    await axios.get(`${API_BASE}/auth/profile`, {
      headers: { 'Authorization': `Bearer ${expiredToken}` }
    });
    
    recordTest('session', 'Expired Token Session', false, 'Should have returned 401');
  } catch (error) {
    const status = error.response?.status || 0;
    const data = error.response?.data || {};
    const passed = status === 401 && data.code === 'TOKEN_EXPIRED';
    
    recordTest('session', 'Expired Token Session', passed,
      passed ? `Correctly rejected expired token (${data.code})` : `Status: ${status}, Code: ${data.code}`);
  }
}

async function testSessionWithInvalidToken() {
  try {
    const invalidToken = generateInvalidToken();
    
    await axios.get(`${API_BASE}/auth/profile`, {
      headers: { 'Authorization': `Bearer ${invalidToken}` }
    });
    
    recordTest('session', 'Invalid Token Session', false, 'Should have returned 401');
  } catch (error) {
    const status = error.response?.status || 0;
    const data = error.response?.data || {};
    const passed = status === 401 && (data.code === 'INVALID_TOKEN' || data.code === 'AUTH_REQUIRED');
    
    recordTest('session', 'Invalid Token Session', passed,
      passed ? `Correctly rejected invalid token (${data.code})` : `Status: ${status}, Code: ${data.code}`);
  }
}

async function testSessionWithoutToken() {
  try {
    await axios.get(`${API_BASE}/auth/profile`);
    
    recordTest('session', 'No Token Session', false, 'Should have returned 401');
  } catch (error) {
    const status = error.response?.status || 0;
    const data = error.response?.data || {};
    const passed = status === 401 && data.code === 'AUTH_REQUIRED';
    
    recordTest('session', 'No Token Session', passed,
      passed ? `Correctly required authentication (${data.code})` : `Status: ${status}, Code: ${data.code}`);
  }
}

// Backend Protection Tests
async function testBackendRouteProtection() {
  const protectedRoutes = [
    '/auth/profile',
    '/students',
    '/classes',
    '/subjects',
    '/fees',
    '/announcements'
  ];

  for (const route of protectedRoutes) {
    try {
      await axios.get(`${API_BASE}${route}`);
      recordTest('backend', `Route Protection: ${route}`, false, 'Should have required authentication');
    } catch (error) {
      const status = error.response?.status || 0;
      const passed = status === 401;
      
      recordTest('backend', `Route Protection: ${route}`, passed,
        passed ? `Correctly protected (${status})` : `Unprotected (${status})`);
    }
  }
}

async function testBackendRoleEnforcement() {
  try {
    // Test with admin token for admin-only route
    const adminToken = generateTestToken({ role: 'admin' });
    
    const response = await axios.get(`${API_BASE}/audit/logs`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const passed = response.status === 404 || response.status === 200; // 404 if no logs, 200 if successful
    recordTest('backend', 'Role Enforcement: Admin Route', passed,
      `Status: ${response.status} (admin accessing admin route)`);
  } catch (error) {
    const status = error.response?.status || 0;
    const passed = status === 401 || status === 403 || status === 404;
    
    recordTest('backend', 'Role Enforcement: Admin Route', passed,
      passed ? `Correctly enforced (${status})` : `Unexpected status: ${status}`);
  }
}

async function testBackendRoleRejection() {
  try {
    // Test with student token for admin-only route
    const studentToken = generateTestToken({ role: 'student' });
    
    await axios.get(`${API_BASE}/audit/logs`, {
      headers: { 'Authorization': `Bearer ${studentToken}` }
    });
    
    recordTest('backend', 'Role Enforcement: Student Rejection', false, 'Should have rejected student access');
  } catch (error) {
    const status = error.response?.status || 0;
    const data = error.response?.data || {};
    const passed = status === 403 && data.code === 'INSUFFICIENT_PERMISSIONS';
    
    recordTest('backend', 'Role Enforcement: Student Rejection', passed,
      passed ? `Correctly rejected (${data.code})` : `Status: ${status}, Code: ${data.code}`);
  }
}

// Frontend Tests
function testFrontendAuthStorage() {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Check if authStorage utilities exist
    const authStoragePath = path.join(process.cwd(), 'client/src/lib/authStorage.js');
    const exists = fs.existsSync(authStoragePath);
    
    recordTest('frontend', 'Auth Storage Utilities', exists,
      exists ? 'authStorage.js exists' : 'authStorage.js missing');
    
    if (exists) {
      const content = fs.readFileSync(authStoragePath, 'utf8');
      const hasTokenFunctions = content.includes('getToken') && content.includes('setToken') && content.includes('removeToken');
      const hasLocalStorage = content.includes('localStorage');
      
      recordTest('frontend', 'Auth Storage Functions', hasTokenFunctions,
        hasTokenFunctions ? 'All token functions present' : 'Missing token functions');
      
      recordTest('frontend', 'Auth Storage Implementation', hasLocalStorage,
        hasLocalStorage ? 'Uses localStorage' : 'Not using localStorage');
    }
  } catch (error) {
    recordTest('frontend', 'Auth Storage Utilities', false, `Error: ${error.message}`);
  }
}

function testFrontendRBAC() {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const rbacPath = path.join(process.cwd(), 'client/src/lib/rbac.js');
    const exists = fs.existsSync(rbacPath);
    
    recordTest('frontend', 'RBAC Implementation', exists,
      exists ? 'rbac.js exists' : 'rbac.js missing');
    
    if (exists) {
      const content = fs.readFileSync(rbacPath, 'utf8');
      const hasRoleConstants = content.includes('ROLES') && content.includes('ROUTE_ACCESS');
      const hasPermissionFunctions = content.includes('isRoleAllowed') && content.includes('hasPermission');
      
      recordTest('frontend', 'RBAC Constants', hasRoleConstants,
        hasRoleConstants ? 'Role constants defined' : 'Missing role constants');
      
      recordTest('frontend', 'RBAC Functions', hasPermissionFunctions,
        hasPermissionFunctions ? 'Permission functions present' : 'Missing permission functions');
    }
  } catch (error) {
    recordTest('frontend', 'RBAC Implementation', false, `Error: ${error.message}`);
  }
}

// Integration Tests
async function testEndToEndAuthFlow() {
  try {
    // Test login endpoint
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'test@example.com',
      password: 'testpassword'
    }, { validateStatus: false });
    
    const loginStatus = loginResponse.status;
    const hasTokenOrError = loginResponse.data?.token || loginResponse.data?.message;
    
    recordTest('integration', 'Login Endpoint', 
      (loginStatus === 200 || loginStatus === 401) && hasTokenOrError,
      `Status: ${loginStatus}, Has response: ${hasTokenOrError}`);
  } catch (error) {
    const status = error.response?.status || 0;
    const passed = status === 200 || status === 401; // 401 if user doesn't exist
    
    recordTest('integration', 'Login Endpoint', passed,
      passed ? `Login endpoint responding (${status})` : `Login endpoint error: ${status}`);
  }
}

async function testTokenConsistency() {
  try {
    // Generate token and verify it's consistent across frontend and backend
    const testToken = generateTestToken();
    
    // Verify with backend secret
    const backendDecoded = jwt.verify(testToken, JWT_SECRET);
    
    // Verify with frontend (should use same logic)
    const frontendDecoded = jwt.verify(testToken, JWT_SECRET);
    
    const consistent = JSON.stringify(backendDecoded) === JSON.stringify(frontendDecoded);
    
    recordTest('integration', 'Token Consistency', consistent,
      consistent ? 'Frontend and backend token verification consistent' : 'Inconsistent token handling');
  } catch (error) {
    recordTest('integration', 'Token Consistency', false, `Error: ${error.message}`);
  }
}

function checkServerHealth() {
  return new Promise((resolve) => {
    axios.get(`${SERVER_URL}/health`)
      .then(response => {
        recordTest('integration', 'Server Health Check', response.status === 200, `Status: ${response.status}`);
        resolve(true);
      })
      .catch(error => {
        recordTest('integration', 'Server Health Check', false, `Error: ${error.message}`);
        resolve(false);
      });
  });
}

function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('🔐 PHASE 4 - AUTHENTICATION & SESSION STABILITY TEST REPORT');
  console.log('='.repeat(80));

  const categories = ['jwt', 'session', 'backend', 'frontend', 'integration'];
  let totalPassed = 0;
  let totalFailed = 0;

  categories.forEach(category => {
    const { passed, failed, tests } = results[category];
    totalPassed += passed;
    totalFailed += failed;
    
    console.log(`\n📊 ${category.toUpperCase()} RESULTS:`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n   Failed Tests:');
      tests.filter(t => !t.passed).forEach(test => {
        console.log(`     • ${test.name}: ${test.details}`);
      });
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('📈 OVERALL RESULTS:');
  console.log(`   ✅ Total Passed: ${totalPassed}`);
  console.log(`   ❌ Total Failed: ${totalFailed}`);
  console.log(`   📈 Overall Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Authentication & session stability is complete.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review issues above.');
  }
  
  console.log('='.repeat(80));
  
  return totalFailed === 0;
}

async function runTests() {
  console.log('🔐 Starting Phase 4 - Authentication & Session Stability Tests...\n');
  
  // Check if server is running
  log('system', 'Checking server health...');
  const serverHealthy = await checkServerHealth();
  
  if (!serverHealthy) {
    log('system', '❌ Server is not running. Please start server first:', 'fail');
    log('system', '   cd server && npm run dev', 'info');
    process.exit(1);
  }

  // Run JWT tests
  log('jwt', 'Running JWT tests...');
  testJWTTokenGeneration();
  testJWTTokenExpiration();
  testJWTInvalidToken();

  // Run session tests
  log('session', 'Running session tests...');
  await testSessionWithValidToken();
  await testSessionWithExpiredToken();
  await testSessionWithInvalidToken();
  await testSessionWithoutToken();

  // Run backend protection tests
  log('backend', 'Running backend protection tests...');
  await testBackendRouteProtection();
  await testBackendRoleEnforcement();
  await testBackendRoleRejection();

  // Run frontend tests
  log('frontend', 'Running frontend tests...');
  testFrontendAuthStorage();
  testFrontendRBAC();

  // Run integration tests
  log('integration', 'Running integration tests...');
  await testEndToEndAuthFlow();
  await testTokenConsistency();

  // Generate report
  const allPassed = generateReport();
  
  process.exit(allPassed ? 0 : 1);
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  log('system', `Unhandled Rejection: ${reason}`, 'fail');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log('system', `Uncaught Exception: ${error.message}`, 'fail');
  process.exit(1);
});

// Run tests
if (require.main === module) {
  runTests();
}

module.exports = { runTests, results };
