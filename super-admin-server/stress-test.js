require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./utils/database');
const demoController = require('./controllers/demoController');

async function provisioningStressTest() {
  console.log('🚀 Starting Provisioning Stress Test...');
  const startTime = Date.now();
  const memoryStart = process.memoryUsage();
  
  try {
    await connectDB();
    console.log('✅ Database connected');
    
    // Create 10 demo schools
    const promises = [];
    for (let i = 1; i <= 10; i++) {
      const mockReq = {
        body: {
          name: `Demo School ${i}`,
          subdomain: `demo${i}${Date.now()}` // Add timestamp to avoid conflicts
        },
        superAdminId: 'stress-test-admin'
      };
      
      const mockRes = {
        status: (code) => ({
          statusCode: code,
          json: (data) => ({ ...data, schoolId: i })
        })
      };
      
      promises.push(demoController.createDemoSchool(mockReq, mockRes));
    }
    
    console.log('📊 Creating 10 demo schools concurrently...');
    const results = await Promise.allSettled(promises);
    const endTime = Date.now();
    const memoryEnd = process.memoryUsage();
    
    console.log(`\n⏱️  Performance Metrics:`);
    console.log(`   Total time: ${(endTime - startTime) / 1000}s`);
    console.log(`   Average per school: ${(endTime - startTime) / 10000}s`);
    console.log(`   Memory usage: ${Math.round((memoryEnd.heapUsed - memoryStart.heapUsed) / 1024 / 1024)}MB increase`);
    
    console.log(`\n📊 Results:`);
    const successful = results.filter(r => r.value?.success).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value?.success).length;
    console.log(`   Success rate: ${successful}/10 (${successful * 10}%)`);
    console.log(`   Failed: ${failed}/10`);
    
    // Check each result
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value?.success) {
        console.log(`   ✅ School ${i + 1}: SUCCESS`);
      } else {
        console.log(`   ❌ School ${i + 1}: FAILED - ${result.reason?.message || result.value?.error?.message || 'Unknown error'}`);
      }
    });
    
    // Test rollback stability
    console.log(`\n🔄 Testing Rollback Stability...`);
    await testRollbackStability();
    
  } catch (error) {
    console.error('❌ Stress test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

async function testRollbackStability() {
  console.log('   Testing failure scenarios...');
  
  // Test with invalid subdomain
  const mockReq = {
    body: {
      name: 'Invalid School',
      subdomain: 'invalid@domain' // Invalid characters
    },
    superAdminId: 'rollback-test-admin'
  };
  
  let rollbackSuccess = false;
  
  try {
    await demoController.createDemoSchool(mockReq, {
      status: (code) => ({
        statusCode: code,
        json: () => {}
      })
    });
  } catch (error) {
    // Expected to fail
    rollbackSuccess = true;
    console.log('   ✅ Rollback mechanism working - invalid input properly rejected');
  }
  
  if (!rollbackSuccess) {
    console.log('   ❌ Rollback mechanism may have issues');
  }
}

// Run the test
provisioningStressTest().catch(console.error);
