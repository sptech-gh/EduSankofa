const mongoose = require('mongoose');

const centralLicenseSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  licenseKey: {
    type: String,
    required: true,
    select: false // Never expose in queries by default
  },
  licenseKeyHash: {
    type: String,
    required: true,
    index: true
  },
  expiryDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'suspended', 'expired'],
    default: 'active'
  },
  maxUsers: {
    type: Number,
    required: true,
    min: 1
  },
  currentUsers: {
    type: Number,
    default: 0,
    min: 0
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true,
    index: true
  },
  // Keep planType for backward compatibility
  planType: {
    type: String,
    enum: ['basic', 'premium', 'enterprise']
  },
  features: {
    students: {
      type: Boolean,
      default: true
    },
    attendance: {
      type: Boolean,
      default: true
    },
    fees: {
      type: Boolean,
      default: true
    },
    reports: {
      type: Boolean,
      default: true
    },
    dashboard: {
      type: Boolean,
      default: true
    },
    analytics: {
      type: Boolean,
      default: false
    },
    api: {
      type: Boolean,
      default: false
    },
    support: {
      type: Boolean,
      default: false
    }
  },
  gracePeriodDays: {
    type: Number,
    default: 7
  },
  activatedAt: {
    type: Date,
    default: null
  },
  activationIP: {
    type: String,
    default: null
  },
  lastValidated: {
    type: Date,
    default: Date.now
  },
  renewalHistory: [{
    renewedAt: Date,
    previousExpiry: Date,
    newExpiry: Date,
    renewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SuperAdmin'
    }
  }],
  suspensionHistory: [{
    suspendedAt: Date,
    reason: String,
    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SuperAdmin'
    },
    reactivatedAt: Date,
    reactivatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SuperAdmin'
    }
  }]
}, {
  timestamps: true
});

// Indexes for performance
centralLicenseSchema.index({ schoolId: 1 });
centralLicenseSchema.index({ licenseKeyHash: 1 });
centralLicenseSchema.index({ expiryDate: 1 });
centralLicenseSchema.index({ status: 1 });
centralLicenseSchema.index({ planType: 1 });
centralLicenseSchema.index({ createdAt: -1 });

// Virtual for checking if license is expired
centralLicenseSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiryDate;
});

// Virtual for checking if license is in grace period
centralLicenseSchema.virtual('isInGracePeriod').get(function() {
  if (!this.isExpired) return false;
  const gracePeriodEnd = new Date(this.expiryDate.getTime() + (this.gracePeriodDays * 24 * 60 * 60 * 1000));
  return new Date() <= gracePeriodEnd;
});

// Virtual for days until expiry
centralLicenseSchema.virtual('daysUntilExpiry').get(function() {
  const now = new Date();
  const diffTime = this.expiryDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Static methods
centralLicenseSchema.statics.findBySchool = function(schoolId) {
  return this.findOne({ schoolId }).populate('schoolId', 'name subdomain');
};

centralLicenseSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};

centralLicenseSchema.statics.findExpiringSoon = function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + days);
  
  return this.find({
    expiryDate: { $lte: cutoffDate },
    status: 'active'
  });
};

centralLicenseSchema.statics.findByLicenseKey = function(licenseKey) {
  const hash = require('crypto').createHash('sha256').update(licenseKey).digest('hex');
  return this.findOne({ licenseKeyHash: hash });
};

// Instance methods
centralLicenseSchema.methods.suspend = function(reason, suspendedBy) {
  this.status = 'suspended';
  this.suspensionHistory.push({
    suspendedAt: new Date(),
    reason,
    suspendedBy
  });
  return this.save();
};

centralLicenseSchema.methods.reactivate = function(reactivatedBy) {
  this.status = 'active';
  
  // Update last suspension record
  const lastSuspension = this.suspensionHistory
    .sort((a, b) => new Date(b.suspendedAt) - new Date(a.suspendedAt))[0];
  
  if (lastSuspension && !lastSuspension.reactivatedAt) {
    lastSuspension.reactivatedAt = new Date();
    lastSuspension.reactivatedBy = reactivatedBy;
  }
  
  return this.save();
};

centralLicenseSchema.methods.renew = function(years, renewedBy) {
  const previousExpiry = this.expiryDate;
  const newExpiry = new Date(this.expiryDate);
  newExpiry.setFullYear(newExpiry.getFullYear() + years);
  
  this.expiryDate = newExpiry;
  this.status = 'active';
  
  this.renewalHistory.push({
    renewedAt: new Date(),
    previousExpiry,
    newExpiry,
    renewedBy
  });
  
  return this.save();
};

// Pre-save middleware to maintain backward compatibility
centralLicenseSchema.pre('save', async function(next) {
  if (this.isModified('planId') && this.planId) {
    try {
      const SubscriptionPlan = mongoose.model('SubscriptionPlan');
      const plan = await SubscriptionPlan.findById(this.planId);
      if (plan) {
        // Set planType for backward compatibility
        this.planType = plan.name.toLowerCase().replace(/\s+/g, '');
        
        // Update maxUsers from plan if not set
        if (!this.maxUsers) {
          this.maxUsers = plan.maxStudents + plan.maxStaff;
        }
        
        // Copy features from plan
        if (plan.features && Object.keys(plan.features).length > 0) {
          this.features = plan.features;
        }
      }
    } catch (error) {
      console.error('Error setting plan compatibility:', error);
    }
  }
  next();
});

centralLicenseSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.licenseKey; // Never expose raw key
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('CentralLicense', centralLicenseSchema);
