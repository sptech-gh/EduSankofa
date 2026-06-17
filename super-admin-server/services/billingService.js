const paystack = require('paystack-api')(process.env.PAYSTACK_SECRET_KEY);
const crypto = require('crypto-js');
const CentralLicense = require('../models/CentralLicense');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const { logger } = require('../utils/database');

class BillingService {
  // Generate Paystack payment link for school subscription
  async generatePaymentLink(schoolData, planData, returnUrl) {
    try {
      const paymentData = {
        email: schoolData.contactEmail || `billing@${schoolData.subdomain}.schoolmgmt.com`,
        amount: planData.pricePerYear * 100, // Convert to kobo (cents)
        currency: 'GHS', // Ghana Cedis
        reference: this.generateTransactionReference(schoolData),
        callback_url: `${process.env.BASE_URL}/api/billing/webhook`,
        metadata: {
          schoolId: schoolData.id,
          planId: planData.id,
          schoolName: schoolData.name,
          planName: planData.name,
          billingCycle: planData.billingCycle,
          maxStudents: planData.maxStudents,
          maxStaff: planData.maxStaff
        },
        channels: ['card', 'bank', 'ussd', 'mobile_money'], // Ghana payment methods
        split: {
          type: 'percentage',
          bearer_type: 'account',
          subaccounts: [
            {
              subaccount: process.env.PAYSTACK_SUBACCOUNT_CODE,
              share: 100 // 100% to main account
            }
          ]
        }
      };

      const response = await paystack.transaction.initialize(paymentData);
      
      if (response.status) {
        return {
          success: true,
          paymentUrl: response.data.authorization_url,
          reference: response.data.reference,
          accessCode: response.data.access_code
        };
      } else {
        throw new Error(response.message || 'Failed to initialize payment');
      }

    } catch (error) {
      logger.error('Generate payment link error:', error);
      throw error;
    }
  }

  // Verify Paystack transaction
  async verifyTransaction(reference) {
    try {
      const response = await paystack.transaction.verify(reference);
      
      if (response.status && response.data.status === 'success') {
        return {
          success: true,
          transaction: response.data
        };
      } else {
        return {
          success: false,
          message: response.message || 'Transaction verification failed'
        };
      }

    } catch (error) {
      logger.error('Verify transaction error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Process successful payment and activate license
  async processSuccessfulPayment(transaction, webhookData) {
    try {
      const { metadata } = transaction;
      const { schoolId, planId } = metadata;

      // Check if this transaction has already been processed
      const existingLicense = await CentralLicense.findOne({
        schoolId,
        'paymentHistory.transactionReference': transaction.reference
      });

      if (existingLicense) {
        logger.warn(`Transaction already processed: ${transaction.reference}`);
        return { success: false, message: 'Transaction already processed' };
      }

      // Find or create license for the school
      let license = await CentralLicense.findOne({ schoolId });
      
      if (!license) {
        // Create new license
        const { generateLicenseKey, hashLicenseKey, calculateExpiryDate } = require('../utils/helpers');
        const licenseKey = generateLicenseKey();
        const licenseKeyHash = hashLicenseKey(licenseKey);
        const expiryDate = calculateExpiryDate(1); // 1 year from payment

        license = new CentralLicense({
          schoolId,
          planId,
          licenseKey,
          licenseKeyHash,
          expiryDate,
          status: 'active',
          maxUsers: metadata.maxStudents + metadata.maxStaff,
          features: {
            students: true,
            attendance: true,
            fees: true,
            reports: true,
            dashboard: true
          },
          activatedAt: new Date(),
          activationIP: webhookData.ip,
          paymentHistory: [{
            transactionReference: transaction.reference,
            amount: transaction.amount / 100, // Convert back from kobo
            currency: transaction.currency,
            paidAt: transaction.paid_at,
            paymentMethod: transaction.channel,
            status: 'success'
          }]
        });

        await license.save();

        // Update school status to active
        const School = require('../models/School');
        await School.findByIdAndUpdate(schoolId, { status: 'active' });

      } else {
        // Update existing license
        license.status = 'active';
        license.expiryDate = new Date(transaction.paid_at);
        license.expiryDate.setFullYear(license.expiryDate.getFullYear() + 1);
        license.paymentHistory.push({
          transactionReference: transaction.reference,
          amount: transaction.amount / 100,
          currency: transaction.currency,
          paidAt: transaction.paid_at,
          paymentMethod: transaction.channel,
          status: 'success'
        });

        await license.save();
      }

      // Log successful payment
      await SuperAdminAuditLog.create({
        adminId: null, // System initiated
        action: 'RENEW_LICENSE',
        entityType: 'license',
        entityId: license._id,
        entityName: `License payment for ${metadata.schoolName}`,
        details: {
          transactionReference: transaction.reference,
          amount: transaction.amount / 100,
          currency: transaction.currency,
          planName: metadata.planName,
          paymentMethod: transaction.channel,
          paidAt: transaction.paid_at
        },
        ipAddress: webhookData.ip,
        userAgent: 'Paystack Webhook',
        severity: 'high',
        success: true
      });

      logger.info(`Payment processed successfully: ${transaction.reference} for ${metadata.schoolName}`);

      return {
        success: true,
        license: license.toSafeObject(),
        licenseKey: license.licenseKey // Return key for new licenses
      };

    } catch (error) {
      logger.error('Process successful payment error:', error);
      throw error;
    }
  }

  // Handle failed payment
  async processFailedPayment(transaction, webhookData) {
    try {
      const { metadata } = transaction;
      
      // Log failed payment
      await SuperAdminAuditLog.create({
        adminId: null,
        action: 'RENEW_LICENSE',
        entityType: 'license',
        entityId: metadata?.schoolId,
        entityName: metadata?.schoolName || 'Unknown',
        details: {
          transactionReference: transaction.reference,
          amount: transaction.amount / 100,
          currency: transaction.currency,
          status: 'failed',
          gatewayResponse: transaction.gateway_response,
          failureReason: transaction.message
        },
        ipAddress: webhookData.ip,
        userAgent: 'Paystack Webhook',
        severity: 'medium',
        success: false
      });

      logger.warn(`Payment failed: ${transaction.reference} - ${transaction.message}`);

      return { success: true };

    } catch (error) {
      logger.error('Process failed payment error:', error);
      throw error;
    }
  }

  // Verify Paystack webhook signature
  verifyWebhookSignature(body, signature) {
    try {
      const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
      const hash = crypto.HmacSHA512(body, secret).toString(crypto.enc.Hex);
      
      return hash === signature;
    } catch (error) {
      logger.error('Webhook signature verification error:', error);
      return false;
    }
  }

  // Generate unique transaction reference
  generateTransactionReference(schoolData) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `SCH_${schoolData.subdomain}_${timestamp}_${random}`;
  }

  // Get payment history for a school
  async getPaymentHistory(schoolId, page = 1, limit = 10) {
    try {
      const license = await CentralLicense.findOne({ schoolId });
      
      if (!license || !license.paymentHistory) {
        return {
          success: true,
          payments: [],
          total: 0
        };
      }

      const payments = license.paymentHistory
        .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))
        .slice((page - 1) * limit, page * limit);

      return {
        success: true,
        payments,
        total: license.paymentHistory.length,
        page,
        limit
      };

    } catch (error) {
      logger.error('Get payment history error:', error);
      return {
        success: false,
        message: 'Failed to get payment history'
      };
    }
  }

  // Check if license is due for renewal
  async checkRenewalStatus(schoolId) {
    try {
      const license = await CentralLicense.findOne({ schoolId });
      
      if (!license) {
        return { needsRenewal: false, reason: 'No license found' };
      }

      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      if (license.expiryDate <= now) {
        return { 
          needsRenewal: true, 
          reason: 'expired',
          expiryDate: license.expiryDate,
          daysUntilExpiry: 0
        };
      } else if (license.expiryDate <= thirtyDaysFromNow) {
        const daysUntilExpiry = Math.ceil((license.expiryDate - now) / (1000 * 60 * 60 * 24));
        return { 
          needsRenewal: true, 
          reason: 'expiring_soon',
          expiryDate: license.expiryDate,
          daysUntilExpiry
        };
      }

      return { 
        needsRenewal: false, 
        reason: 'active',
        expiryDate: license.expiryDate,
        daysUntilExpiry: Math.ceil((license.expiryDate - now) / (1000 * 60 * 60 * 24))
      };

    } catch (error) {
      logger.error('Check renewal status error:', error);
      return { needsRenewal: false, reason: 'Error checking status' };
    }
  }
}

module.exports = new BillingService();
