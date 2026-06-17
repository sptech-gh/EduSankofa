require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./utils/database');
const demoController = require('./controllers/demoController');

async function sequentialProvisioningTest() {
  console.log('🚀 Starting Sequential Provisioning Test...');
  const startTime = Date.now();
  const memoryStart = process.memoryUsage();
  
  try {
    await connectDB();
    console.log('✅ Database connected');
    
    let successCount = 0;
    let failCount = 0;
    const results = [];
    
    // Create 3 demo schools sequentially
    for (let i = 1; i <= 3; i++) {
      console.log(`\n📊 Creating School ${i}/3...`);
      const schoolStartTime = Date.now();
      
      const mockReq = {
        body: {
          name: `Demo School ${i}`,
          subdomain: `demo${i}${Date.now()}`
        },
        superAdminId: 'sequential-test-admin'
      };
      
      const mockRes = {
        status: (code) => ({
          statusCode: code,
          json: (data) => {
            const schoolEndTime = Date.now();
            const duration = (schoolEndTime - schoolStartTime) / 1000;
            
            if (data.success) {
              successCount++;
              console.log(`   ✅ SUCCESS - ${duration}s`);
              results.push({ school: i, status: 'success', duration });
            } else {
              failCount++;
              console.log(`   ❌ FAILED - ${duration}s - ${data.error?.message || 'Unknown error'}`);
              results.push({ school: i, status: 'failed', duration, error: data.error?.message });
            }
          }
        })
      };
      
      try {
        await demoController.createDemoSchool(mockReq, mockRes);
      } catch (error) {
        failCount++;
        console.log(`   ❌ FAILED - Exception: ${error.message}`);
        results.push({ school: i, status: 'failed', error: error.message });
      }
      
      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const endTime = Date.now();
    const memoryEnd = process.memoryUsage();
    
    console.log(`\n📊 Final Results:`);
    console.log(`   Total time: ${(endTime - startTime) / 1000}s`);
    console.log(`   Success rate: ${successCount}/3 (${Math.round(successCount * 33.3)}%)`);
    console.log(`   Failed: ${failCount}/3`);
    console.log(`   Memory usage: ${Math.round((memoryEnd.heapUsed - memoryStart.heapUsed) / 1024 / 1024)}MB increase`);
    
    // Performance analysis
    const successful = results.filter(r => r.status === 'success');
    if (successful.length > 0) {
      const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
      console.log(`   Average duration (successful): ${avgDuration}s`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

sequentialProvisioningTest().catch(console.error);
