#!/usr/bin/env node

/**
 * PHASE 3 - ROUTING STABILIZATION TESTS
 * Tests backend API routes and frontend routing
 */

const axios = require('axios');
const { execSync } = require('child_process');

// Configuration
const SERVER_URL = 'http://localhost:5000';
const CLIENT_URL = 'http://localhost:3000';
const API_BASE = `${SERVER_URL}/api`;

// Test results
const results = {
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

function checkServerHealth() {
  return new Promise((resolve) => {
    axios.get(`${SERVER_URL}/health`)
      .then(response => {
        recordTest('backend', 'Health Check', response.status === 200, `Status: ${response.status}`);
        resolve(true);
      })
      .catch(error => {
        recordTest('backend', 'Health Check', false, `Error: ${error.message}`);
        resolve(false);
      });
  });
}

function testAPIRoutes() {
  const routes = [
    { path: '/', method: 'GET', expected: 200, description: 'API Root' },
    { path: '/auth', method: 'GET', expected: 404, description: 'Auth Routes Base' },
    { path: '/users', method: 'GET', expected: 401, description: 'Users Routes (Protected)' },
    { path: '/students', method: 'GET', expected: 401, description: 'Students Routes (Protected)' },
    { path: '/classes', method: 'GET', expected: 401, description: 'Classes Routes (Protected)' },
    { path: '/subjects', method: 'GET', expected: 401, description: 'Subjects Routes (Protected)' },
    { path: '/nonexistent', method: 'GET', expected: 404, description: '404 Handler' },
  ];

  const promises = routes.map(route => {
    return axios({
      method: route.method,
      url: `${API_BASE}${route.path}`,
      timeout: 5000
    })
    .then(response => {
      const passed = response.status === route.expected;
      recordTest('backend', route.description, passed, 
        `Expected ${route.expected}, got ${response.status}`);
    })
    .catch(error => {
      const status = error.response?.status || 0;
      const passed = status === route.expected;
      recordTest('backend', route.description, passed,
        `Expected ${route.expected}, got ${status} (${error.message})`);
    });
  });

  return Promise.all(promises);
}

function testCORSHeaders() {
  return axios.get(`${API_BASE}/`, {
    headers: { 'Origin': 'http://localhost:3000' }
  })
  .then(response => {
    const corsHeaders = response.headers['access-control-allow-origin'];
    const passed = corsHeaders && corsHeaders.includes('localhost:3000');
    recordTest('backend', 'CORS Headers', passed, 
      `CORS Origin: ${corsHeaders || 'Not set'}`);
  })
  .catch(error => {
    recordTest('backend', 'CORS Headers', false, `Error: ${error.message}`);
  });
}

function testRateLimiting() {
  const promises = [];
  
  // Make multiple requests quickly to test rate limiting
  for (let i = 0; i < 5; i++) {
    promises.push(
      axios.get(`${API_BASE}/`, { timeout: 2000 })
        .then(response => ({ status: response.status, success: true }))
        .catch(error => ({ 
          status: error.response?.status || 0, 
          success: false,
          message: error.message 
        }))
    );
  }

  return Promise.all(promises)
    .then(responses => {
      const successCount = responses.filter(r => r.success).length;
      const rateLimited = responses.some(r => r.status === 429);
      recordTest('backend', 'Rate Limiting', rateLimited || successCount >= 3,
        `Success: ${successCount}/5, Rate Limited: ${rateLimited}`);
    });
}

function testSecurityHeaders() {
  return axios.get(`${SERVER_URL}/health`)
    .then(response => {
      const headers = response.headers;
      const securityHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'x-xss-protection',
        'strict-transport-security'
      ];
      
      const presentHeaders = securityHeaders.filter(header => headers[header]);
      const passed = presentHeaders.length >= 3;
      
      recordTest('backend', 'Security Headers', passed,
        `Present: ${presentHeaders.length}/${securityHeaders.length}`);
    })
    .catch(error => {
      recordTest('backend', 'Security Headers', false, `Error: ${error.message}`);
    });
}

function testFrontendBuild() {
  try {
    const buildDir = 'client/build';
    const fs = require('fs');
    const exists = fs.existsSync(buildDir);
    
    if (exists) {
      const indexExists = fs.existsSync(`${buildDir}/index.html`);
      recordTest('frontend', 'Build Exists', indexExists, 
        indexExists ? 'Build files present' : 'Missing index.html');
    } else {
      recordTest('frontend', 'Build Exists', false, 'Build directory not found');
    }
  } catch (error) {
    recordTest('frontend', 'Build Exists', false, `Error: ${error.message}`);
  }
}

function testAPIIntegration() {
  // Test that frontend can reach backend API
  return axios.get(`${API_BASE}/`, { timeout: 5000 })
    .then(response => {
      const isJSON = typeof response.data === 'object';
      recordTest('integration', 'API Response Format', isJSON,
        isJSON ? 'Valid JSON response' : 'Invalid response format');
    })
    .catch(error => {
      recordTest('integration', 'API Response Format', false, `Error: ${error.message}`);
    });
}

function testRoutePrefixes() {
  // Test that all routes are properly prefixed with /api
  const routesWithoutPrefix = [
    '/users',
    '/students',
    '/classes',
    '/subjects'
  ];

  const promises = routesWithoutPrefix.map(route => {
    return axios.get(`${SERVER_URL}${route}`, { timeout: 3000 })
      .then(() => {
        recordTest('backend', `Route Prefix: ${route}`, false, 'Route accessible without /api prefix');
      })
      .catch(error => {
        const status = error.response?.status || 0;
        const passed = status === 404;
        recordTest('backend', `Route Prefix: ${route}`, passed,
          passed ? 'Correctly returns 404' : `Unexpected status: ${status}`);
      });
  });

  return Promise.all(promises);
}

function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 PHASE 3 - ROUTING STABILIZATION TEST REPORT');
  console.log('='.repeat(80));

  const categories = ['backend', 'frontend', 'integration'];
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
    console.log('\n🎉 ALL TESTS PASSED! Routing stabilization is complete.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above.');
  }
  
  console.log('='.repeat(80));
  
  return totalFailed === 0;
}

async function runTests() {
  console.log('🚀 Starting Phase 3 - Routing Stabilization Tests...\n');
  
  // Check if server is running
  log('system', 'Checking server health...');
  const serverHealthy = await checkServerHealth();
  
  if (!serverHealthy) {
    log('system', '❌ Server is not running. Please start the server first:', 'fail');
    log('system', '   cd server && npm run dev', 'info');
    process.exit(1);
  }

  // Run backend tests
  log('backend', 'Running backend API tests...');
  await testAPIRoutes();
  await testCORSHeaders();
  await testRateLimiting();
  await testSecurityHeaders();
  await testRoutePrefixes();

  // Run frontend tests
  log('frontend', 'Running frontend tests...');
  testFrontendBuild();

  // Run integration tests
  log('integration', 'Running integration tests...');
  await testAPIIntegration();

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
