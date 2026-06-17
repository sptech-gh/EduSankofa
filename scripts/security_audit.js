#!/usr/bin/env node

/**
 * Security Audit Script
 * Comprehensive security vulnerability assessment
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const API_BASE = `${SERVER_URL}/api`;

// Security audit results
const auditResults = {
  vulnerabilities: [],
  recommendations: [],
  score: 0,
  totalChecks: 0
};

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'white') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Vulnerability check functions
async function checkUnprotectedRoutes() {
  logInfo('Checking for unprotected routes...');
  
  const unprotectedRoutes = [
    '/api/users',
    '/api/students',
    '/api/fees',
    '/api/grades',
    '/api/attendance',
    '/api/payments'
  ];

  for (const route of unprotectedRoutes) {
    try {
      const response = await axios.get(`${API_BASE}${route}`, { timeout: 5000 });
      if (response.status === 200) {
        auditResults.vulnerabilities.push({
          type: 'UNPROTECTED_ROUTE',
          severity: 'HIGH',
          route: route,
          description: `Route ${route} is accessible without authentication`
        });
        logError(`Unprotected route found: ${route}`);
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        logSuccess(`Route ${route} is properly protected`);
      } else {
        auditResults.vulnerabilities.push({
          type: 'ROUTE_ERROR',
          severity: 'MEDIUM',
          route: route,
          description: `Error checking route ${route}: ${error.message}`
        });
        logWarning(`Error checking route ${route}: ${error.message}`);
      }
    }
  }
}

async function checkCORSConfiguration() {
  logInfo('Checking CORS configuration...');
  
  try {
    const response = await axios.get(`${API_BASE}/`, {
      headers: { 'Origin': 'http://malicious-site.com' },
      timeout: 5000
    });
    
    const corsHeaders = response.headers['access-control-allow-origin'];
    if (corsHeaders && corsHeaders.includes('*')) {
      auditResults.vulnerabilities.push({
        type: 'OPEN_CORS',
        severity: 'HIGH',
        description: 'CORS allows requests from any origin'
      });
      logError('Open CORS policy detected');
    } else {
      logSuccess('CORS policy appears secure');
    }
  } catch (error) {
    logWarning(`CORS check failed: ${error.message}`);
  }
}

async function checkSecurityHeaders() {
  logInfo('Checking security headers...');
  
  try {
    const response = await axios.get(`${SERVER_URL}/health`, { timeout: 5000 });
    const headers = response.headers;
    
    const securityHeaders = [
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'content-security-policy',
      'referrer-policy'
    ];
    
    let missingHeaders = [];
    for (const header of securityHeaders) {
      if (!headers[header]) {
        missingHeaders.push(header);
      }
    }
    
    if (missingHeaders.length > 0) {
      auditResults.vulnerabilities.push({
        type: 'MISSING_SECURITY_HEADERS',
        severity: 'MEDIUM',
        headers: missingHeaders,
        description: `Missing security headers: ${missingHeaders.join(', ')}`
      });
      logError(`Missing security headers: ${missingHeaders.join(', ')}`);
    } else {
      logSuccess('Security headers are properly configured');
    }
  } catch (error) {
    logWarning(`Security headers check failed: ${error.message}`);
  }
}

async function checkRateLimiting() {
  logInfo('Checking rate limiting...');
  
  try {
    const startTime = Date.now();
    const requests = [];
    
    // Send multiple requests quickly
    for (let i = 0; i < 10; i++) {
      requests.push(
        axios.get(`${API_BASE}/health`, { timeout: 2000 })
          .catch(err => ({ status: err.response?.status || 0, error: err.message }))
      );
    }
    
    const results = await Promise.all(requests);
    const endTime = Date.now();
    
    const successCount = results.filter(r => r.status === 200).length;
    const rateLimitedCount = results.filter(r => r.status === 429).length;
    
    if (rateLimitedCount > 0) {
      logSuccess('Rate limiting is working');
    } else if (successCount >= 8) {
      auditResults.vulnerabilities.push({
        type: 'NO_RATE_LIMITING',
        severity: 'HIGH',
        description: 'Rate limiting appears to be disabled or ineffective'
      });
      logError('Rate limiting may not be working properly');
    } else {
      logSuccess('Rate limiting appears to be working');
    }
  } catch (error) {
    logWarning(`Rate limiting check failed: ${error.message}`);
  }
}

async function checkInputValidation() {
  logInfo('Checking input validation...');
  
  const maliciousInputs = [
    { name: 'SQL Injection', value: "'; DROP TABLE users; --" },
    { name: 'XSS', value: '<script>alert("XSS")</script>' },
    { name: 'Path Traversal', value: '../../../etc/passwd' },
    { name: 'Command Injection', value: '; cat /etc/passwd' },
    { name: 'NoSQL Injection', value: '{"$ne": null}' }
  ];
  
  for (const input of maliciousInputs) {
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        email: input.value,
        password: 'test'
      }, { timeout: 5000 });
      
      // Check if the malicious input was properly handled
      if (response.status === 400) {
        logSuccess(`${input.name} attempt properly blocked`);
      } else if (response.status === 500) {
        logWarning(`${input.name} attempt caused server error (may be blocked)`);
      } else {
        auditResults.vulnerabilities.push({
          type: 'INPUT_VALIDATION_BYPASS',
          severity: 'HIGH',
          inputType: input.name,
          payload: input.value,
          description: `${input.name} attempt may not be properly validated`
        });
        logError(`${input.name} attempt may not be properly blocked`);
      }
    } catch (error) {
      logWarning(`${input.name} check failed: ${error.message}`);
    }
  }
}

async function checkInformationDisclosure() {
  logInfo('Checking for information disclosure...');
  
  try {
    const response = await axios.get(`${API_BASE}/`, { timeout: 5000 });
    const data = response.data;
    
    // Check for sensitive information in response
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /private.*key/i,
      /token.*secret/i,
      /database.*url/i,
      /internal.*error/i
    ];
    
    const responseString = JSON.stringify(data);
    const disclosures = [];
    
    for (const pattern of sensitivePatterns) {
      if (pattern.test(responseString)) {
        disclosures.push(pattern.source);
      }
    }
    
    if (disclosures.length > 0) {
      auditResults.vulnerabilities.push({
        type: 'INFORMATION_DISCLOSURE',
        severity: 'MEDIUM',
        patterns: disclosures,
        description: `Potential information disclosure: ${disclosures.join(', ')}`
      });
      logError(`Information disclosure detected: ${disclosures.join(', ')}`);
    } else {
      logSuccess('No obvious information disclosure detected');
    }
  } catch (error) {
    logWarning(`Information disclosure check failed: ${error.message}`);
  }
}

async function checkAuthenticationSecurity() {
  logInfo('Checking authentication security...');
  
  try {
    // Test with expired token
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2MWUyMzQzLTQyZTQtMjE6MzA6MDAiLCJyb2UiOiJhZG1pbiIsImV4cGUiLCJpYXQiOjE2MzQ0MDAwMDAsImV4cGUiOjE2MzQ0MDAwMH0.invalid';
    
    const response = await axios.get(`${API_BASE}/auth/profile`, {
      headers: { 'Authorization': `Bearer ${expiredToken}` },
      timeout: 5000
    });
    
    if (response.status === 401) {
      logSuccess('Expired tokens are properly rejected');
    } else {
      auditResults.vulnerabilities.push({
        type: 'WEAK_TOKEN_VALIDATION',
        severity: 'HIGH',
        description: 'Expired tokens may not be properly validated'
      });
      logError('Expired token validation may be weak');
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      logSuccess('Expired tokens are properly rejected');
    } else {
      logWarning(`Authentication security check failed: ${error.message}`);
    }
  }
}

async function checkFileUploadSecurity() {
  logInfo('Checking file upload security...');
  
  try {
    const maliciousFiles = [
      { name: 'PHP Web Shell', filename: 'shell.php', content: '<?php system($_GET["cmd"]); ?>' },
      { name: 'JavaScript File', filename: 'malicious.js', content: 'require("child_process").exec("rm -rf /")' },
      { name: 'Large File', filename: 'large.txt', content: 'x'.repeat(10 * 1024 * 1024) } // 10MB
    ];
    
    for (const file of maliciousFiles) {
      try {
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', Buffer.from(file.content), {
          filename: file.name,
          contentType: 'text/plain'
        });
        
        const response = await axios.post(`${API_BASE}/upload`, form, {
          headers: { ...form.getHeaders() },
          timeout: 5000
        });
        
        if (response.status === 400) {
          logSuccess(`${file.name} upload properly blocked`);
        } else {
          auditResults.vulnerabilities.push({
            type: 'FILE_UPLOAD_VULNERABILITY',
            severity: 'HIGH',
            fileType: file.name,
            description: `Malicious file upload may not be properly blocked`
          });
          logError(`${file.name} upload may not be properly blocked`);
        }
      } catch (error) {
        if (error.response && error.response.status === 400) {
          logSuccess(`${file.name} upload properly blocked`);
        } else {
          logWarning(`${file.name} upload check failed: ${error.message}`);
        }
      }
    }
  } catch (error) {
    logWarning(`File upload security check failed: ${error.message}`);
  }
}

function calculateSecurityScore() {
  const severityWeights = {
    'HIGH': 10,
    'MEDIUM': 5,
    'LOW': 1
  };
  
  let totalScore = 100;
  for (const vuln of auditResults.vulnerabilities) {
    const weight = severityWeights[vuln.severity] || 5;
    totalScore -= weight;
  }
  
  auditResults.score = Math.max(0, totalScore);
  return auditResults.score;
}

function generateRecommendations() {
  const recommendations = [];
  
  // Analyze vulnerabilities and generate recommendations
  const vulnTypes = auditResults.vulnerabilities.map(v => v.type);
  
  if (vulnTypes.includes('UNPROTECTED_ROUTE')) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Authentication',
      description: 'Implement authentication middleware on all sensitive routes',
      solution: 'Add auth middleware to route definitions'
    });
  }
  
  if (vulnTypes.includes('OPEN_CORS')) {
    recommendations.push({
      priority: 'HIGH',
      category: 'CORS',
      description: 'Restrict CORS to specific origins',
      solution: 'Update CORS configuration to whitelist specific domains'
    });
  }
  
  if (vulnTypes.includes('MISSING_SECURITY_HEADERS')) {
    recommendations.push({
      priority: 'MEDIUM',
      category: 'Security Headers',
      description: 'Add missing security headers',
      solution: 'Implement helmet.js or add security headers manually'
    });
  }
  
  if (vulnTypes.includes('INPUT_VALIDATION_BYPASS')) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Input Validation',
      description: 'Implement proper input validation and sanitization',
      solution: 'Use validator library and input sanitization middleware'
    });
  }
  
  if (vulnTypes.includes('WEAK_TOKEN_VALIDATION')) {
    recommendations.push({
      priority: 'HIGH',
      category: 'Authentication',
      description: 'Implement proper JWT token validation',
      solution: 'Add token expiration checks and proper error handling'
    });
  }
  
  auditResults.recommendations = recommendations;
  return recommendations;
}

async function generateReport() {
  const score = calculateSecurityScore();
  const recommendations = generateRecommendations();
  
  console.log('\n' + '='.repeat(80));
  console.log('🔒 SECURITY AUDIT REPORT');
  console.log('='.repeat(80));
  
  console.log(`\n📊 SECURITY SCORE: ${score}/100`);
  
  if (score >= 90) {
    log('EXCELLENT - System is well secured', 'green');
  } else if (score >= 70) {
    log('GOOD - System has decent security', 'green');
  } else if (score >= 50) {
    log('FAIR - System needs security improvements', 'yellow');
  } else {
    log('POOR - System has significant security issues', 'red');
  }
  
  console.log(`\n🔍 VULNERABILITIES FOUND: ${auditResults.vulnerabilities.length}`);
  
  if (auditResults.vulnerabilities.length > 0) {
    const severityCounts = {};
    for (const vuln of auditResults.vulnerabilities) {
      severityCounts[vuln.severity] = (severityCounts[vuln.severity] || 0) + 1;
    }
    
    for (const [severity, count] of Object.entries(severityCounts)) {
      log(`  ${severity}: ${count}`, severity === 'HIGH' ? 'red' : severity === 'MEDIUM' ? 'yellow' : 'blue');
    }
    
    console.log('\n📋 VULNERABILITY DETAILS:');
    for (const vuln of auditResults.vulnerabilities) {
      log(`  • ${vuln.type}: ${vuln.description}`, vuln.severity === 'HIGH' ? 'red' : 'yellow');
    }
  }
  
  console.log(`\n💡 RECOMMENDATIONS: ${recommendations.length}`);
  
  if (recommendations.length > 0) {
    for (const rec of recommendations) {
      log(`\n  🎯 PRIORITY: ${rec.priority}`, rec.priority === 'HIGH' ? 'red' : 'yellow');
      log(`  📂 CATEGORY: ${rec.category}`, 'blue');
      log(`  📝 DESCRIPTION: ${rec.description}`, 'white');
      log(`  🔧 SOLUTION: ${rec.solution}`, 'green');
    }
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Save detailed report
  const reportData = {
    timestamp: new Date().toISOString(),
    score: score,
    vulnerabilities: auditResults.vulnerabilities,
    recommendations: recommendations,
    totalChecks: auditResults.totalChecks
  };
  
  try {
    fs.writeFileSync('security_audit_report.json', JSON.stringify(reportData, null, 2));
    logSuccess('Detailed report saved to security_audit_report.json');
  } catch (error) {
    logWarning(`Failed to save report: ${error.message}`);
  }
  
  return reportData;
}

// Main audit function
async function runSecurityAudit() {
  console.log('🔒 Starting Security Audit...');
  console.log(`🎯 Target: ${SERVER_URL}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  
  try {
    // Check if server is running
    await axios.get(`${SERVER_URL}/health`, { timeout: 5000 });
    logSuccess('Server is running and accessible');
  } catch (error) {
    logError('Server is not running or not accessible');
    logError('Please start the server before running security audit');
    process.exit(1);
  }
  
  // Run security checks
  await checkUnprotectedRoutes();
  await checkCORSConfiguration();
  await checkSecurityHeaders();
  await checkRateLimiting();
  await checkInputValidation();
  await checkInformationDisclosure();
  await checkAuthenticationSecurity();
  await checkFileUploadSecurity();
  
  auditResults.totalChecks = 8;
  
  // Generate final report
  const report = await generateReport();
  
  return report;
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

// Run audit if called directly
if (require.main === module) {
  runSecurityAudit().then(() => {
    logSuccess('Security audit completed');
    process.exit(0);
  }).catch((error) => {
    logError(`Security audit failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runSecurityAudit };
