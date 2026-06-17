const Joi = require('joi');

// Common validation schemas
const objectIdSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId format');

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// Super Admin validation
const superAdminLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const superAdminRegisterSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required().messages({
    'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
  })
});

// School validation
const createSchoolSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  subdomain: Joi.string().min(3).max(50).pattern(/^[a-z0-9-]+$/).required(),
  deploymentType: Joi.string().valid('cloud', 'self-hosted').required(),
  planId: objectIdSchema.required()
});

const updateSchoolStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'suspended').required()
});

// License validation
const createLicenseSchema = Joi.object({
  schoolId: objectIdSchema.required(),
  planId: objectIdSchema.required(),
  maxUsers: Joi.number().integer().min(1).optional(),
  expiryYears: Joi.number().integer().min(1).max(5).default(1)
});

// Subscription Plan validation
const createSubscriptionPlanSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  maxStudents: Joi.number().integer().min(1).required(),
  maxStaff: Joi.number().integer().min(1).required(),
  features: Joi.object().optional(),
  financeModule: Joi.boolean().default(false),
  smsEnabled: Joi.boolean().default(false),
  analyticsEnabled: Joi.boolean().default(false),
  customBranding: Joi.boolean().default(false),
  pricePerYear: Joi.number().min(0).required(),
  billingCycle: Joi.string().valid('yearly', 'termly').default('yearly'),
  supportLevel: Joi.string().valid('standard', 'priority').default('standard'),
  isActive: Joi.boolean().default(true),
  isDemo: Joi.boolean().default(false)
});

const updateSubscriptionPlanSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).optional(),
  maxStudents: Joi.number().integer().min(1).optional(),
  maxStaff: Joi.number().integer().min(1).optional(),
  features: Joi.object().optional(),
  financeModule: Joi.boolean().optional(),
  smsEnabled: Joi.boolean().optional(),
  analyticsEnabled: Joi.boolean().optional(),
  customBranding: Joi.boolean().optional(),
  pricePerYear: Joi.number().min(0).optional(),
  billingCycle: Joi.string().valid('yearly', 'termly').optional(),
  supportLevel: Joi.string().valid('standard', 'priority').optional(),
  isActive: Joi.boolean().optional()
});

const renewLicenseSchema = Joi.object({
  extendYears: Joi.number().integer().min(1).max(5).required()
});

// Heartbeat validation
const heartbeatSchema = Joi.object({
  schoolId: objectIdSchema.required(),
  activeUsers: Joi.number().integer().min(0).required(),
  databaseSize: Joi.number().min(0).required(),
  version: Joi.string().required()
});

// Validation middleware
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], { 
      abortEarly: false,
      stripUnknown: true 
    });
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errorMessage,
          details: error.details
        }
      });
    }
    
    req[source] = value;
    next();
  };
};

module.exports = {
  objectIdSchema,
  paginationSchema,
  superAdminLoginSchema,
  superAdminRegisterSchema,
  createSchoolSchema,
  updateSchoolStatusSchema,
  createLicenseSchema,
  renewLicenseSchema,
  heartbeatSchema,
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  validate
};
