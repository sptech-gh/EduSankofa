const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const { generateLicenseKey, hashLicenseKey, calculateExpiryDate } = require('../utils/helpers');
const { logger } = require('../utils/database');

class SchoolProvisioningService {
  constructor() {
    this.mongoClient = null;
  }

  // Initialize MongoDB connection for provisioning
  async initializeConnection() {
    try {
      const mongoUri = process.env.MONGODB_URI;
      this.mongoClient = new MongoClient(mongoUri);
      await this.mongoClient.connect();
      logger.info('Provisioning service connected to MongoDB');
      return true;
    } catch (error) {
      logger.error('Failed to connect provisioning service:', error);
      throw error;
    }
  }

  // Provision new school with database and license
  async provisionSchool(schoolData, planData, superAdminId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    let databaseName = null;
    
    try {
      // Step 1: Generate database name (Atlas limit: 38 bytes)
      const timestamp = Date.now().toString(36); // Shorter timestamp
      const cleanSubdomain = schoolData.subdomain.replace(/[^a-z0-9]/g, '_').substring(0, 20);
      databaseName = `sch_${cleanSubdomain}_${timestamp}`; // sch_demo_abc123 - under 38 bytes
      
      // Step 2: Create new database for school
      const schoolDb = this.mongoClient.db(databaseName);
      
      // Step 3: Initialize school database with collections and indexes
      await this.initializeSchoolDatabase(schoolDb, schoolData, planData);
      
      // Step 4: Create default admin user
      const adminCredentials = await this.createDefaultAdmin(schoolDb, schoolData);
      
      // Step 5: Generate license
      const licenseData = await this.generateSchoolLicense(schoolData, planData, superAdminId, databaseName);
      
      // Step 6: Update school record with database name and license
      const School = require('../models/School');
      const school = await School.findByIdAndUpdate(
        schoolData.id,
        { 
          databaseName,
          licenseId: licenseData.license._id,
          status: 'active'
        },
        { session, new: true }
      );

      // Step 7: Seed demo data if demo plan
      if (planData.isDemo) {
        await this.seedDemoData(schoolDb, planData);
      }

      await session.commitTransaction();

      logger.info(`School provisioned successfully: ${school.name} (${databaseName})`);

      return {
        success: true,
        school: school.toSafeObject(),
        databaseName,
        adminCredentials,
        license: licenseData.license.toSafeObject(),
        licenseKey: licenseData.licenseKey
      };

    } catch (error) {
      await session.abortTransaction();
      logger.error('School provisioning failed:', error);
      
      // Cleanup on failure
      try {
        if (databaseName) {
          await this.mongoClient.db(databaseName).dropDatabase();
        }
      } catch (cleanupError) {
        logger.error('Failed to cleanup after provisioning failure:', cleanupError);
      }

      throw error;
    } finally {
      session.endSession();
    }
  }

  // Initialize school database with basic collections and indexes
  async initializeSchoolDatabase(db, schoolData, planData) {
    // Users collection
    await db.createCollection('users');
    await db.collection('users').createIndexes([
      { key: { email: 1 }, unique: true },
      { key: { role: 1 } },
      { key: { isActive: 1 } }
    ]);

    // Students collection
    await db.createCollection('students');
    await db.collection('students').createIndexes([
      { key: { schoolId: 1 } },
      { key: { class: 1 } },
      { key: { isActive: 1 } }
    ]);

    // Teachers collection
    await db.createCollection('teachers');
    await db.collection('teachers').createIndexes([
      { key: { schoolId: 1 } },
      { key: { department: 1 } },
      { key: { isActive: 1 } }
    ]);

    // Classes collection
    await db.createCollection('classes');
    await db.collection('classes').createIndexes([
      { key: { schoolId: 1 } },
      { key: { name: 1 } }
    ]);

    // Subjects collection
    await db.createCollection('subjects');
    await db.collection('subjects').createIndexes([
      { key: { schoolId: 1 } },
      { key: { name: 1 } }
    ]);

    // Attendance collection
    await db.createCollection('attendance');
    await db.collection('attendance').createIndexes([
      { key: { studentId: 1, date: 1 } },
      { key: { classId: 1, date: 1 } }
    ]);

    // Fees collection
    await db.createCollection('fees');
    await db.collection('fees').createIndexes([
      { key: { studentId: 1 } },
      { key: { type: 1 } },
      { key: { status: 1 } }
    ]);

    // Reports collection
    await db.createCollection('reports');
    await db.collection('reports').createIndexes([
      { key: { schoolId: 1 } },
      { key: { type: 1 } },
      { key: { generatedAt: 1 } }
    ]);

    // Settings collection
    await db.createCollection('settings');
    await db.collection('settings').createIndex({ key: 1 }, { unique: true });

    // Initialize default settings
    await db.collection('settings').insertOne({
      key: 'school_info',
      value: {
        name: schoolData.name,
        subdomain: schoolData.subdomain,
        plan: planData.name,
        maxStudents: planData.maxStudents,
        maxStaff: planData.maxStaff,
        features: planData.features,
        createdAt: new Date()
      }
    });

    logger.info(`Database initialized: ${db.databaseName}`);
  }

  // Create default admin user for the school
  async createDefaultAdmin(db, schoolData) {
    const crypto = require('crypto');
    const bcrypt = require('bcryptjs');
    
    try {
      // Generate secure random password
      const password = crypto.randomBytes(12).toString('hex');
      const hashedPassword = await bcrypt.hash(password, 12);

      const adminUser = {
        email: `admin@${schoolData.subdomain}.schoolmgmt.com`,
        password: hashedPassword,
        firstName: 'School',
        lastName: 'Administrator',
        role: 'admin',
        isActive: true,
        isFirstLogin: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('users').insertOne(adminUser);

      logger.info(`Default admin created for ${schoolData.name}: ${adminUser.email}`);

      return {
        email: adminUser.email,
        password: password // Return the plain password for initial setup
      };

    } catch (error) {
      logger.error('Create default admin failed:', error);
      throw error;
    }
  }

  // Initialize school database with basic collections and indexes
  async initializeSchoolDatabase(db, schoolData, planData) {
    // Users collection
  await db.createCollection('users');
  await db.collection('users').createIndexes([
    { key: { email: 1 }, unique: true },
    { key: { role: 1 } },
    { key: { isActive: 1 } }
  ]);

  // Students collection
  await db.createCollection('students');
  await db.collection('students').createIndexes([
    { key: { schoolId: 1 } },
    { key: { class: 1 } },
    { key: { isActive: 1 } }
  ]);

  // Teachers collection
  await db.createCollection('teachers');
  await db.collection('teachers').createIndexes([
    { key: { schoolId: 1 } },
    { key: { department: 1 } },
    { key: { isActive: 1 } }
  ]);

  // Classes collection
  await db.createCollection('classes');
  await db.collection('classes').createIndexes([
    { key: { schoolId: 1 } },
    { key: { name: 1 } }
  ]);

  // Subjects collection
  await db.createCollection('subjects');
  await db.collection('subjects').createIndexes([
    { key: { schoolId: 1 } },
    { key: { name: 1 } }
  ]);

  // Attendance collection
  await db.createCollection('attendance');
  await db.collection('attendance').createIndexes([
    { key: { studentId: 1, date: 1 } },
    { key: { classId: 1, date: 1 } }
  ]);

  // Fees collection
  await db.createCollection('fees');
  await db.collection('fees').createIndexes([
    { key: { studentId: 1 } },
    { key: { type: 1 } },
    { key: { status: 1 } }
  ]);

  // Reports collection
  await db.createCollection('reports');
  await db.collection('reports').createIndexes([
    { key: { schoolId: 1 } },
    { key: { type: 1 } },
    { key: { generatedAt: 1 } }
  ]);

  // Settings collection
  await db.createCollection('settings');
  await db.collection('settings').createIndex({ key: 1 }, { unique: true });

  // Initialize default settings
  await db.collection('settings').insertOne({
    key: 'school_info',
    value: {
      name: schoolData.name,
      subdomain: schoolData.subdomain,
      plan: planData.name,
      maxStudents: planData.maxStudents,
      maxStaff: planData.maxStaff,
      features: planData.features,
      createdAt: new Date()
    }
  });

  // Seed demo data if demo plan
  async seedDemoData(db, planData) {
    if (!planData.isDemo) return;

    // Create sample classes
    const classes = [
      { name: 'JSS 1A', level: 'JSS 1', capacity: 30 },
      { name: 'JSS 1B', level: 'JSS 1', capacity: 30 },
      { name: 'JSS 2A', level: 'JSS 2', capacity: 30 },
      { name: 'JSS 3A', level: 'JSS 3', capacity: 30 }
    ];

    const insertedClasses = await db.collection('classes').insertMany(classes);

    // Create sample subjects
    const subjects = [
      { name: 'Mathematics', code: 'MATH', category: 'core' },
      { name: 'English Language', code: 'ENG', category: 'core' },
      { name: 'Integrated Science', code: 'SCI', category: 'core' },
      { name: 'Social Studies', code: 'SST', category: 'core' },
      { name: 'Ghanaian Language', code: 'GHANA', category: 'core' }
    ];

    await db.collection('subjects').insertMany(subjects);

    // Create sample students (50 students)
    const students = [];
    for (let i = 1; i <= 50; i++) {
      const classIndex = Math.floor(Math.random() * insertedClasses.insertedIds.length);
      students.push({
        firstName: `Student${i}`,
        lastName: `Demo${i}`,
        email: `student${i}@demo.school`,
        classId: insertedClasses.insertedIds[classIndex],
        admissionNumber: `ADM${String(i).padStart(4, '0')}`,
        gender: Math.random() > 0.5 ? 'male' : 'female',
        dateOfBirth: new Date(2005 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        isActive: true,
        createdAt: new Date()
      });
    }

    await db.collection('students').insertMany(students);

    // Create sample teachers (5 teachers)
    const teachers = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@demo.school',
        role: 'teacher',
        department: 'Academic',
        subjects: ['Mathematics', 'English Language'],
        isActive: true,
        createdAt: new Date()
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@demo.school',
        role: 'teacher',
        department: 'Academic',
        subjects: ['Integrated Science', 'Social Studies'],
        isActive: true,
        createdAt: new Date()
      },
      {
        firstName: 'Kwame',
        lastName: 'Asante',
        email: 'kwame.asante@demo.school',
        role: 'teacher',
        department: 'Academic',
        subjects: ['Ghanaian Language', 'Social Studies'],
        isActive: true,
        createdAt: new Date()
      },
      {
        firstName: 'Ama',
        lastName: 'Owusu',
        email: 'ama.owusu@demo.school',
        role: 'teacher',
        department: 'Academic',
        subjects: ['Mathematics', 'Integrated Science'],
        isActive: true,
        createdAt: new Date()
      },
      {
        firstName: 'Kofi',
        lastName: 'Annor',
        email: 'kofi.annor@demo.school',
        role: 'accountant',
        department: 'Administration',
        isActive: true,
        createdAt: new Date()
      }
    ];

    await db.collection('teachers').insertMany(teachers);

    logger.info('Demo data seeded successfully');
  }

  // Generate license for school
  async generateSchoolLicense(schoolData, planData, superAdminId, databaseName) {
    const CentralLicense = require('../models/CentralLicense');
    const { generateLicenseKey, hashLicenseKey, calculateExpiryDate } = require('../utils/helpers');
    
    const licenseKey = generateLicenseKey();
    const licenseKeyHash = hashLicenseKey(licenseKey);
    
    // Set expiry based on plan type
    let expiryDate;
    if (planData.isDemo) {
      // Demo schools expire in 30 days
      expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else {
      // Regular schools expire in 1 year
      expiryDate = calculateExpiryDate(1);
    }

    const license = new CentralLicense({
      schoolId: schoolData.id,
      planId: planData.id,
      licenseKey,
      licenseKeyHash,
      expiryDate,
      status: 'active',
      maxUsers: planData.maxStudents + planData.maxStaff,
      features: planData.features,
      activatedAt: new Date(),
      activationIP: '127.0.0.1' // Will be updated with actual IP
    });

    await license.save();

    logger.info(`License generated for ${schoolData.name}: ${planData.name} (${planData.isDemo ? 'Demo' : 'Paid'})`);

    return { license, licenseKey };
  }

  // Close connection
  async closeConnection() {
    if (this.mongoClient) {
      await this.mongoClient.close();
      logger.info('Provisioning service connection closed');
    }
  }
}

module.exports = new SchoolProvisioningService();
