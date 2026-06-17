require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./utils/database');
const demoController = require('./controllers/demoController');

async function singleTest() {
  console.log('🚀 Single Demo School Test...');
  
  try {
    await connectDB();
    console.log('✅ Database connected');
    
    const mockReq = {
      body: {
        name: 'Test Demo School',
        subdomain: `testdemo${Date.now()}`
      },
      superAdminId: 'single-test-admin'
    };
    
    let result = null;
    
    const mockRes = {
      status: (code) => ({
        statusCode: code,
        json: (data) => {
          result = data;
          console.log(`📊 Result: ${data.success ? 'SUCCESS' : 'FAILED'}`);
          if (data.success) {
            console.log(`   School: ${data.data.school.name}`);
            console.log(`   Database: ${data.data.databaseName}`);
            console.log(`   Admin: ${data.data.adminCredentials.email}`);
            console.log(`   License expires: ${data.data.license.expiryDate}`);
          } else {
            console.log(`   Error: ${data.error?.message}`);
          }
        }
      })
    };
    
    await demoController.createDemoSchool(mockReq, mockRes);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

singleTest().catch(console.error);
