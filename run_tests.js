#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Phase 5
 * Runs all unit tests, integration tests, and regression tests
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  server: {
    testDir: 'server/tests',
    command: 'npm test',
    coverageDir: 'server/coverage',
    timeout: 60000 // 60 seconds
  },
  client: {
    testDir: 'client/src',
    command: 'npm test -- --watchAll=false',
    timeout: 30000 // 30 seconds
  }
};

// ANSI color codes for output
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

function colorLog(message, color = 'white') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logSection(title) {
  console.log(`\n${COLORS.cyan}═════════════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.cyan}║ ${title}${COLORS.reset}`);
  console.log(`${COLORS.cyan}═════════════════════════════════════════════════════════${COLORS.reset}`);
}

function logSuccess(message) {
  colorLog(`✅ ${message}`, 'green');
}

function logError(message) {
  colorLog(`❌ ${message}`, 'red');
}

function logWarning(message) {
  colorLog(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  colorLog(`ℹ️  ${message}`, 'blue');
}

function runCommand(command, cwd, timeout = 30000) {
  try {
    logInfo(`Running: ${command}`);
    const result = execSync(command, {
      cwd,
      stdio: 'pipe',
      encoding: 'utf8',
      timeout
    });
    return { success: true, output: result, error: null };
  } catch (error) {
    return { success: false, output: null, error: error.message };
  }
}

function checkTestSetup(testDir) {
  const testPath = path.join(process.cwd(), testDir);
  
  if (!fs.existsSync(testPath)) {
    logError(`Test directory not found: ${testPath}`);
    return false;
  }

  const setupFile = path.join(testPath, 'setup.js');
  if (!fs.existsSync(setupFile)) {
    logWarning(`Setup file not found: ${setupFile}`);
  }

  // Count test files
  const testFiles = fs.readdirSync(testPath).filter(file => file.endsWith('.test.js'));
  logInfo(`Found ${testFiles.length} test files in ${testDir}`);

  return true;
}

function runServerTests() {
  logSection('Backend Server Tests');
  
  if (!checkTestSetup(TEST_CONFIG.server.testDir)) {
    return { success: false, message: 'Server test setup failed' };
  }

  // Run server tests
  const serverResult = runCommand(TEST_CONFIG.server.command, 'server', TEST_CONFIG.server.timeout);
  
  if (serverResult.success) {
    logSuccess('Server tests completed successfully');
    console.log(serverResult.output);
  } else {
    logError(`Server tests failed: ${serverResult.error}`);
    return { success: false, message: `Server tests failed: ${serverResult.error}` };
  }

  // Check coverage
  if (fs.existsSync(TEST_CONFIG.server.coverageDir)) {
    logInfo('Coverage report generated');
  }

  return { success: true, message: 'Server tests passed' };
}

function runClientTests() {
  logSection('Frontend Client Tests');
  
  // Check if client tests exist
  const clientTestPath = path.join(process.cwd(), 'client/src');
  if (!fs.existsSync(clientTestPath)) {
    logWarning('Client test directory not found');
    return { success: true, message: 'Client tests skipped (no tests found)' };
  }

  // Run client tests
  const clientResult = runCommand(TEST_CONFIG.client.command, 'client', TEST_CONFIG.client.timeout);
  
  if (clientResult.success) {
    logSuccess('Client tests completed successfully');
    console.log(clientResult.output);
  } else {
    logError(`Client tests failed: ${clientResult.error}`);
    return { success: false, message: `Client tests failed: ${clientResult.error}` };
  }

  return { success: true, message: 'Client tests passed' };
}

function runIntegrationTests() {
  logSection('Integration Tests');
  
  const integrationDir = path.join(process.cwd(), 'server/tests/integration');
  if (!fs.existsSync(integrationDir)) {
    logError('Integration test directory not found');
    return { success: false, message: 'Integration tests directory not found' };
  }

  // Get integration test files
  const integrationFiles = fs.readdirSync(integrationDir).filter(file => file.endsWith('.test.js'));
  
  if (integrationFiles.length === 0) {
    logWarning('No integration tests found');
    return { success: true, message: 'Integration tests skipped (no tests found)' };
  }

  logInfo(`Found ${integrationFiles.length} integration test files`);
  
  // Run each integration test file
  const results = [];
  for (const file of integrationFiles) {
    const testFile = path.join(integrationDir, file);
    const result = runCommand(`node ${testFile}`, 'server', 60000);
    
    if (result.success) {
      logSuccess(`Integration test ${file} passed`);
      results.push({ file, status: 'passed' });
    } else {
      logError(`Integration test ${file} failed: ${result.error}`);
      results.push({ file, status: 'failed', error: result.error });
    }
  }

  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  
  logInfo(`Integration tests: ${passedCount} passed, ${failedCount} failed`);
  
  if (failedCount > 0) {
    return { success: false, message: `${failedCount} integration tests failed` };
  }

  return { success: true, message: 'All integration tests passed' };
}

function runRegressionTests() {
  logSection('Regression Tests');
  
  // Run critical workflow tests
  const criticalWorkflows = [
    'student-attendance-report.test.js',
    'fee-payment-receipt.test.js',
    'grade-reportcard-export.test.js'
  ];

  const results = [];
  for (const workflow of criticalWorkflows) {
    const workflowPath = path.join('server/tests/integration', workflow);
    
    if (!fs.existsSync(workflowPath)) {
      logWarning(`Workflow test not found: ${workflow}`);
      continue;
    }

    const result = runCommand(`node ${workflowPath}`, 'server', 90000);
    
    if (result.success) {
      logSuccess(`Regression test ${workflow} passed`);
      results.push({ workflow, status: 'passed' });
    } else {
      logError(`Regression test ${workflow} failed: ${result.error}`);
      results.push({ workflow, status: 'failed', error: result.error });
    }
  }

  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  
  logInfo(`Regression tests: ${passedCount} passed, ${failedCount} failed`);
  
  if (failedCount > 0) {
    return { success: false, message: `${failedCount} regression tests failed` };
  }

  return { success: true, message: 'All regression tests passed' };
}

function generateTestReport(results) {
  logSection('Test Report Summary');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`\n${COLORS.magenta}╔══════════════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.magenta}║                    TEST EXECUTION SUMMARY                      ║${COLORS.reset}`);
  console.log(`${COLORS.magenta}╠══════════════════════════════════════════════════╣${COLORS.reset}`);
  console.log(`${COLORS.magenta}║ Total Test Suites: ${totalTests.toString().padStart(2)}                     ║${COLORS.reset}`);
  console.log(`${COLORS.magenta}║ Passed: ${passedTests.toString().padStart(2)}${' '.repeat(38)}║${COLORS.reset}`);
  console.log(`${COLORS.magenta}║ Failed: ${failedTests.toString().padStart(2)}${' '.repeat(38)}║${COLORS.reset}`);
  
  if (failedTests === 0) {
    console.log(`${COLORS.magenta}║ Status: ${COLORS.green}ALL TESTS PASSED${' '.repeat(35)}║${COLORS.reset}`);
  } else {
    console.log(`${COLORS.magenta}║ Status: ${COLORS.red}SOME TESTS FAILED${' '.repeat(35)}║${COLORS.reset}`);
  }
  
  console.log(`${COLORS.magenta}╠════════════════════════════════════════════════╣${COLORS.reset}`);
  console.log(`${COLORS.magenta}║                    DETAILED RESULTS                               ║${COLORS.reset}`);
  console.log(`${COLORS.magenta}╚══════════════════════════════════════════════╝${COLORS.reset}`);
  
  // Detailed results
  for (const [testName, result] of Object.entries(results)) {
    const status = result.success ? 'PASSED' : 'FAILED';
    const statusColor = result.success ? 'green' : 'red';
    const statusSymbol = result.success ? '✅' : '❌';
    
    console.log(`${statusSymbol} ${testName}: ${COLORS[statusColor]}${status}${COLORS.reset}`);
    
    if (!result.success && result.error) {
      console.log(`   Error: ${COLORS.red}${result.error}${COLORS.reset}`);
    }
  }
  
  console.log('\n');
  
  return failedTests === 0;
}

function main() {
  console.log(`${COLORS.cyan}
╔═════════════════════════════════════════════════════════╗
║              PHASE 5 - TEST STABILIZATION RUNNER           ║
║              Comprehensive Test Execution Suite                ║
╚═══════════════════════════════════════════════════╝${COLORS.reset}
  `);

  const results = {};
  
  // Run server tests
  results.server = runServerTests();
  
  // Run client tests
  results.client = runClientTests();
  
  // Run integration tests
  results.integration = runIntegrationTests();
  
  // Run regression tests
  results.regression = runRegressionTests();
  
  // Generate comprehensive report
  const allTestsPassed = generateTestReport(results);
  
  // Exit with appropriate code
  process.exit(allTestsPassed ? 0 : 1);
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

// Run main function
if (require.main === module) {
  main();
}
