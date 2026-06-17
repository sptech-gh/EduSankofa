const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  maxStudents: {
    type: Number,
    required: true,
    min: 1
  },
  maxStaff: {
    type: Number,
    required: true,
    min: 1
  },
  features: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  financeModule: {
    type: Boolean,
    default: false
  },
  smsEnabled: {
    type: Boolean,
    default: false
  },
  analyticsEnabled: {
    type: Boolean,
    default: false
  },
  customBranding: {
    type: Boolean,
    default: false
  },
  pricePerYear: {
    type: Number,
    required: true,
    min: 0
  },
  billingCycle: {
    type: String,
    enum: ['yearly', 'termly'],
    default: 'yearly'
  },
  supportLevel: {
    type: String,
    enum: ['standard', 'priority'],
    default: 'standard'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDemo: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for performance
subscriptionPlanSchema.index({ name: 1 });
subscriptionPlanSchema.index({ isActive: 1 });
subscriptionPlanSchema.index({ isDemo: 1 });
subscriptionPlanSchema.index({ pricePerYear: 1 });

// Static methods
subscriptionPlanSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ pricePerYear: 1 });
};

subscriptionPlanSchema.statics.findDemo = function() {
  return this.findOne({ isDemo: true, isActive: true });
};

subscriptionPlanSchema.statics.findByName = function(name) {
  return this.findOne({ name: name, isActive: true });
};

// Instance methods
subscriptionPlanSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Pre-save middleware to set default features based on plan type
subscriptionPlanSchema.pre('save', function(next) {
  if (this.isNew && !this.features || Object.keys(this.features).length === 0) {
    this.features = {
      students: true,
      attendance: true,
      fees: true,
      reports: true,
      dashboard: true,
      finance: this.financeModule,
      sms: this.smsEnabled,
      analytics: this.analyticsEnabled,
      branding: this.customBranding
    };
  }
  next();
});

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
