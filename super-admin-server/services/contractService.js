const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const School = require('../models/School');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const CentralLicense = require('../models/CentralLicense');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const { logger } = require('../utils/database');

class ContractService {
  // Generate service agreement contract PDF
  async generateContract(schoolId, adminId) {
    try {
      // Get school details
      const school = await School.findById(schoolId);
      if (!school) {
        throw new Error('School not found');
      }

      // Get license details
      const license = await CentralLicense.findOne({ schoolId }).populate('planId');
      if (!license) {
        throw new Error('License not found');
      }

      const plan = license.planId;
      const contractData = {
        schoolName: school.name,
        planName: plan.name,
        annualPrice: plan.pricePerYear,
        currency: 'GHS',
        maxStudents: plan.maxStudents,
        maxStaff: plan.maxStaff,
        billingCycle: plan.billingCycle,
        supportLevel: plan.supportLevel,
        features: plan.features,
        startDate: license.activatedAt || new Date(),
        expiryDate: license.expiryDate,
        duration: this.calculateDuration(license.activatedAt, license.expiryDate),
        contractNumber: this.generateContractNumber(school._id),
        generatedAt: new Date()
      };

      // Generate PDF
      const pdfBuffer = await this.createContractPDF(contractData);

      // Save contract metadata
      const contractMetadata = {
        schoolId,
        licenseId: license._id,
        contractNumber: contractData.contractNumber,
        fileName: `contract_${contractData.contractNumber}.pdf`,
        filePath: path.join(__dirname, '../contracts', contractData.fileName),
        generatedBy: adminId,
        generatedAt: contractData.generatedAt,
        contractData
      };

      // Ensure contracts directory exists
      const contractsDir = path.join(__dirname, '../contracts');
      if (!fs.existsSync(contractsDir)) {
        fs.mkdirSync(contractsDir, { recursive: true });
      }

      // Save PDF file
      fs.writeFileSync(contractMetadata.filePath, pdfBuffer);

      // Log contract generation
      await SuperAdminAuditLog.create({
        adminId,
        action: 'EXPORT_DATA', // Using existing action type
        entityType: 'system',
        entityId: schoolId,
        entityName: `Contract: ${school.name}`,
        details: {
          contractNumber: contractData.contractNumber,
          planName: plan.name,
          fileName: contractMetadata.fileName
        },
        ipAddress: '127.0.0.1', // System generated
        userAgent: 'Contract Generator',
        severity: 'medium',
        success: true
      });

      logger.info(`Contract generated: ${contractData.contractNumber} for ${school.name}`);

      return {
        success: true,
        contract: contractMetadata,
        pdfBuffer
      };

    } catch (error) {
      logger.error('Generate contract error:', error);
      throw error;
    }
  }

  // Create PDF document
  async createContractPDF(data) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50
          }
        });

        // Add content to PDF
        doc.fontSize(20).text('SCHOOL MANAGEMENT SYSTEM', { align: 'center' });
        doc.fontSize(16).text('Service Agreement', { align: 'center' });
        doc.moveDown();

        // Contract header
        doc.fontSize(12).text(`Contract Number: ${data.contractNumber}`);
        doc.text(`Date: ${data.generatedAt.toLocaleDateString()}`);
        doc.moveDown();

        // Parties
        doc.fontSize(14).text('Parties to this Agreement:', { underline: true });
        doc.fontSize(12);
        doc.text(`Service Provider: School Management System Ltd.`);
        doc.text(`Client: ${data.schoolName}`);
        doc.moveDown();

        // Service Description
        doc.fontSize(14).text('Service Description:', { underline: true });
        doc.fontSize(12);
        doc.text(`Plan: ${data.planName}`);
        doc.text(`Maximum Students: ${data.maxStudents}`);
        doc.text(`Maximum Staff: ${data.maxStaff}`);
        doc.text(`Billing Cycle: ${data.billingCycle}`);
        doc.text(`Support Level: ${data.supportLevel}`);
        doc.moveDown();

        // Features
        doc.fontSize(14).text('Included Features:', { underline: true });
        doc.fontSize(12);
        if (data.features) {
          Object.entries(data.features).forEach(([feature, enabled]) => {
            if (enabled) {
              doc.text(`• ${this.formatFeatureName(feature)}`);
            }
          });
        }
        doc.moveDown();

        // Financial Terms
        doc.fontSize(14).text('Financial Terms:', { underline: true });
        doc.fontSize(12);
        doc.text(`Annual Subscription Fee: ${data.currency} ${data.annualPrice.toLocaleString()}`);
        doc.text(`Billing Cycle: ${data.billingCycle}`);
        doc.text(`Contract Duration: ${data.duration}`);
        doc.text(`Start Date: ${data.startDate.toLocaleDateString()}`);
        doc.text(`Expiry Date: ${data.expiryDate.toLocaleDateString()}`);
        doc.moveDown();

        // Terms and Conditions
        doc.fontSize(14).text('Terms and Conditions:', { underline: true });
        doc.fontSize(10);
        doc.text('1. Service Provision');
        doc.text('   The Service Provider agrees to provide access to the School Management System according to the selected plan specifications.');
        doc.moveDown();
        doc.text('2. Payment Terms');
        doc.text('   The Client agrees to pay the annual subscription fee as specified above.');
        doc.text('   Payment is due upon contract signing and annually thereafter.');
        doc.moveDown();
        doc.text('3. Service Availability');
        doc.text('   The Service Provider shall maintain 99.9% uptime availability.');
        doc.text('   Scheduled maintenance will be communicated in advance.');
        doc.moveDown();
        doc.text('4. Suspension Clause');
        doc.text('   Services may be suspended for non-payment or violation of terms.');
        doc.text('   Client will be notified 7 days before suspension for non-payment.');
        doc.moveDown();
        doc.text('5. Renewal Terms');
        doc.text('   Contract will automatically renew unless cancelled 30 days before expiry.');
        doc.text('   Renewal rates will be communicated 60 days before expiry.');
        doc.moveDown();
        doc.text('6. Support Services');
        doc.text(`   ${data.supportLevel === 'priority' ? 'Priority support available via email and phone during business hours.' : 'Standard support available via email during business hours.'}`);
        doc.moveDown();
        doc.text('7. Data Protection');
        doc.text('   Client data will be stored securely and backed up regularly.');
        doc.text('   Data ownership remains with the Client.');
        doc.moveDown();
        doc.text('8. Termination');
        doc.text('   Either party may terminate with 30 days written notice.');
        doc.text('   No refunds for partial years of service.');
        doc.moveDown();

        // Governing Law
        doc.fontSize(14).text('Governing Law:', { underline: true });
        doc.fontSize(12);
        doc.text('This agreement shall be governed by and construed in accordance with the laws of Ghana.');
        doc.moveDown();

        // Signatures
        doc.fontSize(14).text('Signatures:', { underline: true });
        doc.fontSize(12);
        doc.text('Service Provider:');
        doc.text('_____________________________');
        doc.text('School Management System Ltd.');
        doc.text('Date: _________________');
        doc.moveDown();
        doc.text('Client:');
        doc.text('_____________________________');
        doc.text(`${data.schoolName}`);
        doc.text('Date: _________________');
        doc.moveDown();

        // Footer
        doc.fontSize(8).text('This is a system-generated contract. For questions, contact support@schoolmgmt.com', { align: 'center' });

        // Finalize PDF
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  // Generate unique contract number
  generateContractNumber(schoolId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CONTRACT_${schoolId.toString().slice(-6)}_${timestamp}_${random}`;
  }

  // Calculate contract duration
  calculateDuration(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffYears = Math.floor(diffDays / 365);
    const remainingDays = diffDays % 365;
    
    if (diffYears > 0) {
      return `${diffYears} year${diffYears > 1 ? 's' : ''}${remainingDays > 0 ? ` ${remainingDays} days` : ''}`;
    }
    return `${diffDays} days`;
  }

  // Format feature names for display
  formatFeatureName(feature) {
    const featureNames = {
      students: 'Student Management',
      attendance: 'Attendance Tracking',
      fees: 'Fee Management',
      reports: 'Reporting System',
      dashboard: 'Admin Dashboard',
      finance: 'Finance Module',
      sms: 'SMS Notifications',
      analytics: 'Advanced Analytics',
      branding: 'Custom Branding'
    };
    return featureNames[feature] || feature;
  }

  // Get contract history for a school
  async getContractHistory(schoolId, page = 1, limit = 10) {
    try {
      const contracts = await SuperAdminAuditLog.find({
        entityId: schoolId,
        entityType: 'system',
        'details.contractNumber': { $exists: true }
      })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('adminId', 'email');

      const total = await SuperAdminAuditLog.countDocuments({
        entityId: schoolId,
        entityType: 'system',
        'details.contractNumber': { $exists: true }
      });

      return {
        success: true,
        contracts: contracts.map(log => ({
          contractNumber: log.details.contractNumber,
          fileName: log.details.fileName,
          generatedAt: log.timestamp,
          generatedBy: log.adminId?.email || 'System',
          planName: log.details.planName
        })),
        total,
        page,
        limit
      };

    } catch (error) {
      logger.error('Get contract history error:', error);
      return {
        success: false,
        message: 'Failed to get contract history'
      };
    }
  }

  // Delete contract file
  async deleteContract(contractNumber, adminId) {
    try {
      const contract = await SuperAdminAuditLog.findOne({
        'details.contractNumber': contractNumber
      });

      if (!contract) {
        return { success: false, message: 'Contract not found' };
      }

      const filePath = path.join(__dirname, '../contracts', contract.details.fileName);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Log contract deletion
      await SuperAdminAuditLog.create({
        adminId,
        action: 'EXPORT_DATA',
        entityType: 'system',
        entityId: contract.entityId,
        entityName: `Contract Deletion: ${contractNumber}`,
        details: {
          contractNumber,
          fileName: contract.details.fileName,
          action: 'deleted'
        },
        ipAddress: '127.0.0.1',
        userAgent: 'Contract Generator',
        severity: 'medium',
        success: true
      });

      logger.info(`Contract deleted: ${contractNumber}`);

      return { success: true };

    } catch (error) {
      logger.error('Delete contract error:', error);
      return {
        success: false,
        message: 'Failed to delete contract'
      };
    }
  }
}

module.exports = new ContractService();
