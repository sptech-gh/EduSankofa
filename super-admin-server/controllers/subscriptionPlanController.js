const SubscriptionPlan = require('../models/SubscriptionPlan');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const { buildPaginationResponse, paginate } = require('../utils/helpers');
const { logger } = require('../utils/database');

// Create Subscription Plan
const createSubscriptionPlan = async (req, res) => {
  try {
    const planData = req.body;
    
    // Check if plan name already exists
    const existingPlan = await SubscriptionPlan.findByName(planData.name);
    if (existingPlan) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PLAN_EXISTS',
          message: 'Subscription plan with this name already exists'
        }
      });
    }

    // Create new plan
    const plan = new SubscriptionPlan(planData);
    await plan.save();

    // Log plan creation
    await SuperAdminAuditLog.create({
      adminId: req.superAdminId,
      action: 'CREATE_LICENSE', // Using existing action type
      entityType: 'license',
      entityId: plan._id,
      entityName: `Subscription Plan: ${plan.name}`,
      details: {
        name: plan.name,
        maxStudents: plan.maxStudents,
        maxStaff: plan.maxStaff,
        pricePerYear: plan.pricePerYear,
        billingCycle: plan.billingCycle
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'high',
      success: true
    });

    logger.info(`Subscription plan created: ${plan.name}`);

    res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully',
      data: {
        plan: plan.toSafeObject()
      }
    });

  } catch (error) {
    logger.error('Create subscription plan error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_PLAN_ERROR',
        message: 'Failed to create subscription plan'
      }
    });
  }
};

// List Subscription Plans
const listSubscriptionPlans = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'pricePerYear', sortOrder = 'asc', isActive, isDemo } = req.query;
    
    // Build query
    const query = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (isDemo !== undefined) {
      query.isDemo = isDemo === 'true';
    }

    // Pagination
    const { skip, limit: limitNum } = paginate(page, limit);
    
    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [plans, total] = await Promise.all([
      SubscriptionPlan.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      SubscriptionPlan.countDocuments(query)
    ]);

    const response = buildPaginationResponse(plans, page, limitNum, total);

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    logger.error('List subscription plans error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_PLANS_ERROR',
        message: 'Failed to list subscription plans'
      }
    });
  }
};

// Get Subscription Plan
const getSubscriptionPlan = async (req, res) => {
  try {
    const { id } = req.params;
    
    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Subscription plan not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        plan: plan.toSafeObject()
      }
    });

  } catch (error) {
    logger.error('Get subscription plan error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_PLAN_ERROR',
        message: 'Failed to get subscription plan'
      }
    });
  }
};

// Update Subscription Plan
const updateSubscriptionPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Subscription plan not found'
        }
      });
    }

    // Check if name is being changed and if it conflicts
    if (updateData.name && updateData.name !== plan.name) {
      const existingPlan = await SubscriptionPlan.findByName(updateData.name);
      if (existingPlan) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'PLAN_NAME_EXISTS',
            message: 'Subscription plan with this name already exists'
          }
        });
      }
    }

    // Update plan
    Object.assign(plan, updateData);
    await plan.save();

    // Log plan update
    await SuperAdminAuditLog.create({
      adminId: req.superAdminId,
      action: 'UPDATE_LICENSE', // Using existing action type
      entityType: 'license',
      entityId: plan._id,
      entityName: `Subscription Plan: ${plan.name}`,
      details: {
        updatedFields: Object.keys(updateData),
        previousData: plan.toObject(),
        newData: updateData
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'medium',
      success: true
    });

    logger.info(`Subscription plan updated: ${plan.name}`);

    res.json({
      success: true,
      message: 'Subscription plan updated successfully',
      data: {
        plan: plan.toSafeObject()
      }
    });

  } catch (error) {
    logger.error('Update subscription plan error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_PLAN_ERROR',
        message: 'Failed to update subscription plan'
      }
    });
  }
};

// Delete Subscription Plan (Soft Delete)
const deleteSubscriptionPlan = async (req, res) => {
  try {
    const { id } = req.params;
    
    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Subscription plan not found'
        }
      });
    }

    // Check if plan is in use by any active licenses
    const CentralLicense = require('../models/CentralLicense');
    const activeLicenses = await CentralLicense.countDocuments({ 
      planId: id, 
      status: 'active' 
    });

    if (activeLicenses > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PLAN_IN_USE',
          message: 'Cannot delete plan that is in use by active licenses'
        }
      });
    }

    // Soft delete by setting isActive to false
    plan.isActive = false;
    await plan.save();

    // Log plan deletion
    await SuperAdminAuditLog.create({
      adminId: req.superAdminId,
      action: 'DELETE_LICENSE', // Using existing action type
      entityType: 'license',
      entityId: plan._id,
      entityName: `Subscription Plan: ${plan.name}`,
      details: {
        deletionType: 'soft',
        reason: 'Admin deletion'
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'high',
      success: true
    });

    logger.info(`Subscription plan deleted: ${plan.name}`);

    res.json({
      success: true,
      message: 'Subscription plan deleted successfully'
    });

  } catch (error) {
    logger.error('Delete subscription plan error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_PLAN_ERROR',
        message: 'Failed to delete subscription plan'
      }
    });
  }
};

// Get Active Plans for Frontend
const getActivePlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.findActive();
    
    res.json({
      success: true,
      data: {
        plans: plans.map(plan => plan.toSafeObject())
      }
    });

  } catch (error) {
    logger.error('Get active plans error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ACTIVE_PLANS_ERROR',
        message: 'Failed to get active subscription plans'
      }
    });
  }
};

module.exports = {
  createSubscriptionPlan,
  listSubscriptionPlans,
  getSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getActivePlans
};
