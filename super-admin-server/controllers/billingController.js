const billingService = require('../services/billingService');
const School = require('../models/School');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const { logger } = require('../utils/database');

// Generate Payment Link
const generatePaymentLink = async (req, res) => {
  try {
    const { schoolId, planId, returnUrl } = req.body;
    
    // Get school details
    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SCHOOL_NOT_FOUND',
          message: 'School not found'
        }
      });
    }

    // Get subscription plan
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Subscription plan not found or inactive'
        }
      });
    }

    // Generate payment link
    const paymentResult = await billingService.generatePaymentLink(
      { ...school.toObject(), id: school._id },
      { ...plan.toObject(), id: plan._id },
      returnUrl || `${process.env.BASE_URL}/billing/success`
    );

    // Log payment link generation
    await SuperAdminAuditLog.create({
      adminId: req.superAdminId,
      action: 'RENEW_LICENSE',
      entityType: 'license',
      entityId: school._id,
      entityName: school.name,
      details: {
        planName: plan.name,
        amount: plan.pricePerYear,
        currency: 'GHS',
        paymentUrl: paymentResult.paymentUrl,
        reference: paymentResult.reference
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'medium',
      success: true
    });

    res.json({
      success: true,
      message: 'Payment link generated successfully',
      data: {
        paymentUrl: paymentResult.paymentUrl,
        reference: paymentResult.reference,
        accessCode: paymentResult.accessCode,
        amount: plan.pricePerYear,
        currency: 'GHS',
        plan: plan.toSafeObject(),
        school: school.toSafeObject()
      }
    });

  } catch (error) {
    logger.error('Generate payment link error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PAYMENT_LINK_ERROR',
        message: 'Failed to generate payment link'
      }
    });
  }
};

// Paystack Webhook Handler
const handlePaystackWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const body = JSON.stringify(req.body);

    // Verify webhook signature
    if (!billingService.verifyWebhookSignature(body, signature)) {
      logger.warn('Invalid webhook signature received');
      return res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    const event = req.body;
    const { event: eventType, data } = event;

    // Process different event types
    switch (eventType) {
      case 'charge.success':
        const paymentResult = await billingService.processSuccessfulPayment(data, {
          ip: req.ip,
          userAgent: req.get('User-Agent') || 'Paystack Webhook'
        });
        
        if (paymentResult.success) {
          logger.info(`Payment webhook processed: ${data.reference}`);
        } else {
          logger.warn(`Payment webhook processing failed: ${paymentResult.message}`);
        }
        break;

      case 'charge.failed':
        await billingService.processFailedPayment(data, {
          ip: req.ip,
          userAgent: req.get('User-Agent') || 'Paystack Webhook'
        });
        logger.warn(`Payment failed webhook: ${data.reference}`);
        break;

      case 'transfer.success':
        logger.info(`Transfer successful: ${data.reference}`);
        break;

      case 'transfer.failed':
        logger.warn(`Transfer failed: ${data.reference}`);
        break;

      default:
        logger.info(`Unhandled webhook event: ${eventType}`);
    }

    res.status(200).json({
      success: true,
      message: 'Webhook processed'
    });

  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
};

// Get Payment History
const getPaymentHistory = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await billingService.getPaymentHistory(schoolId, parseInt(page), parseInt(limit));

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PAYMENT_HISTORY_ERROR',
        message: 'Failed to get payment history'
      }
    });
  }
};

// Check Renewal Status
const checkRenewalStatus = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const result = await billingService.checkRenewalStatus(schoolId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Check renewal status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RENEWAL_STATUS_ERROR',
        message: 'Failed to check renewal status'
      }
    });
  }
};

// Create School with Payment (New flow)
const createSchoolWithPayment = async (req, res) => {
  try {
    const { name, subdomain, deploymentType, planId, contactEmail } = req.body;
    
    // Check if subdomain already exists
    const existingSchool = await School.findBySubdomain(subdomain);
    if (existingSchool) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SUBDOMAIN_EXISTS',
          message: 'Subdomain is already taken'
        }
      });
    }

    // Get subscription plan
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Subscription plan not found or inactive'
        }
      });
    }

    // Create school record (pending until payment)
    const school = new School({
      name,
      subdomain,
      deploymentType,
      contactEmail,
      status: 'pending_payment'
    });

    await school.save();

    // Generate payment link
    const paymentResult = await billingService.generatePaymentLink(
      { ...school.toObject(), id: school._id, contactEmail },
      { ...plan.toObject(), id: plan._id },
      `${process.env.BASE_URL}/billing/success?schoolId=${school._id}`
    );

    // Log school creation with payment
    await SuperAdminAuditLog.create({
      adminId: req.superAdminId,
      action: 'CREATE_SCHOOL',
      entityType: 'school',
      entityId: school._id,
      entityName: school.name,
      details: {
        name,
        subdomain,
        deploymentType,
        planId,
        planName: plan.name,
        contactEmail,
        status: 'pending_payment',
        paymentUrl: paymentResult.paymentUrl,
        reference: paymentResult.reference
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'high',
      success: true
    });

    logger.info(`School created with payment: ${school.name} - ${paymentResult.reference}`);

    res.status(201).json({
      success: true,
      message: 'School created. Please complete payment to activate.',
      data: {
        school: school.toSafeObject(),
        paymentUrl: paymentResult.paymentUrl,
        reference: paymentResult.reference,
        accessCode: paymentResult.accessCode,
        amount: plan.pricePerYear,
        currency: 'GHS',
        plan: plan.toSafeObject(),
        nextSteps: [
          'Complete payment using the provided payment link',
          'School will be automatically provisioned after successful payment',
          'You will receive credentials via email'
        ]
      }
    });

  } catch (error) {
    logger.error('Create school with payment error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_SCHOOL_PAYMENT_ERROR',
        message: 'Failed to create school with payment'
      }
    });
  }
};

module.exports = {
  generatePaymentLink,
  handlePaystackWebhook,
  getPaymentHistory,
  checkRenewalStatus,
  createSchoolWithPayment
};
