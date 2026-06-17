require('dotenv').config();
const mongoose = require('mongoose');
const SubscriptionPlan = require('./models/SubscriptionPlan');
const { connectDB } = require('./utils/database');

// Seed Demo Plan
async function seedDemoPlan() {
  try {
    await connectDB();
    
    // Check if demo plan already exists
    const existingDemoPlan = await SubscriptionPlan.findOne({ isDemo: true });
    if (existingDemoPlan) {
      console.log('Demo plan already exists');
      return;
    }

    // Create demo plan
    const demoPlan = new SubscriptionPlan({
      name: 'Demo Plan',
      description: '30-day free trial with limited features and sample data',
      maxStudents: 50,
      maxStaff: 10,
      features: {
        students: true,
        attendance: true,
        fees: true,
        reports: true,
        dashboard: true,
        finance: false, // Disabled in demo
        sms: false, // Disabled in demo
        analytics: false, // Disabled in demo
        branding: false // Disabled in demo
      },
      financeModule: false,
      smsEnabled: false,
      analyticsEnabled: false,
      customBranding: false,
      pricePerYear: 0, // Free
      billingCycle: 'yearly',
      supportLevel: 'standard',
      isActive: true,
      isDemo: true
    });

    await demoPlan.save();
    console.log('Demo plan created successfully');

  } catch (error) {
    console.error('Error seeding demo plan:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Also seed basic subscription plans
async function seedBasicPlans() {
  try {
    await connectDB();
    
    const plans = [
      {
        name: 'Basic Plan',
        description: 'Perfect for small schools with essential features',
        maxStudents: 100,
        maxStaff: 20,
        features: {
          students: true,
          attendance: true,
          fees: true,
          reports: true,
          dashboard: true,
          finance: false,
          sms: false,
          analytics: false,
          branding: false
        },
        financeModule: false,
        smsEnabled: false,
        analyticsEnabled: false,
        customBranding: false,
        pricePerYear: 1200, // GHS 1,200 per year
        billingCycle: 'yearly',
        supportLevel: 'standard',
        isActive: true,
        isDemo: false
      },
      {
        name: 'Premium Plan',
        description: 'Great for growing schools with advanced features',
        maxStudents: 500,
        maxStaff: 50,
        features: {
          students: true,
          attendance: true,
          fees: true,
          reports: true,
          dashboard: true,
          finance: true,
          sms: true,
          analytics: true,
          branding: false
        },
        financeModule: true,
        smsEnabled: true,
        analyticsEnabled: true,
        customBranding: false,
        pricePerYear: 3600, // GHS 3,600 per year
        billingCycle: 'yearly',
        supportLevel: 'priority',
        isActive: true,
        isDemo: false
      },
      {
        name: 'Enterprise Plan',
        description: 'Complete solution for large institutions',
        maxStudents: 2000,
        maxStaff: 200,
        features: {
          students: true,
          attendance: true,
          fees: true,
          reports: true,
          dashboard: true,
          finance: true,
          sms: true,
          analytics: true,
          branding: true
        },
        financeModule: true,
        smsEnabled: true,
        analyticsEnabled: true,
        customBranding: true,
        pricePerYear: 12000, // GHS 12,000 per year
        billingCycle: 'yearly',
        supportLevel: 'priority',
        isActive: true,
        isDemo: false
      }
    ];

    for (const planData of plans) {
      const existingPlan = await SubscriptionPlan.findOne({ name: planData.name });
      if (!existingPlan) {
        const plan = new SubscriptionPlan(planData);
        await plan.save();
        console.log(`Created plan: ${planData.name}`);
      } else {
        console.log(`Plan already exists: ${planData.name}`);
      }
    }

    console.log('Basic subscription plans seeded successfully');

  } catch (error) {
    console.error('Error seeding basic plans:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run seeding
if (require.main === module) {
  console.log('Seeding subscription plans...');
  seedDemoPlan();
  seedBasicPlans();
  console.log('Seeding completed');
}

module.exports = { seedDemoPlan, seedBasicPlans };
