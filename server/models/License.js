const mongoose = require('mongoose');
const crypto = require('crypto');

const licenseSchema = new mongoose.Schema({
  schoolName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  licenseKey: {
    type: String,
    required: true,
    trim: true,
    select: false // Never expose in queries by default
  },
  licenseKeyHash: {
    type: String,
    required: false, // Will be set by pre-save hook
    trim: true,
    index: true
  },
  deploymentType: {
    type: String,
    enum: ['cloud', 'self-hosted'],
    required: true,
    default: 'self-hosted'
  },
  expiryDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'expired', 'trial'],
    required: true,
    default: 'trial',
    index: true
  },
  maxUsers: {
    type: Number,
    required: true,
    min: 1,
    default: 50
  },
  currentUsers: {
    type: Number,
    default: 0,
    min: 0
  },
  activatedAt: {
    type: Date,
    default: null
  },
  lastValidated: {
    type: Date,
    default: Date.now
  },
  activationIP: {
    type: String,
    default: null
  },
  gracePeriodDays: {
    type: Number,
    default: 7,
    min: 0,
    max: 30
  },
  features: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      students: true,
      attendance: true,
      fees: true,
      reports: true,
      dashboard: true
    }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'licenses'
});

// Compound indexes for performance
licenseSchema.index({ schoolName: 1, status: 1 });
licenseSchema.index({ expiryDate: 1, status: 1 });

// Virtual fields
licenseSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiryDate;
});

licenseSchema.virtual('isInGracePeriod').get(function() {
  const now = new Date();
  const gracePeriodEnd = new Date(this.expiryDate.getTime() + (this.gracePeriodDays * 24 * 60 * 60 * 1000));
  return now > this.expiryDate && now <= gracePeriodEnd;
});

licenseSchema.virtual('daysUntilExpiry').get(function() {
  const now = new Date();
  const diffTime = this.expiryDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to hash license key
licenseSchema.pre('save', function(next) {
  if (this.isModified('licenseKey') && this.licenseKey) {
    this.licenseKeyHash = crypto.createHash('sha256').update(this.licenseKey).digest('hex');
  }
  next();
});

// Instance methods
licenseSchema.methods.hashLicenseKey = function(plainKey) {
  return crypto.createHash('sha256').update(plainKey).digest('hex');
};

licenseSchema.methods.compareLicenseKey = function(plainKey) {
  const hashedInput = crypto.createHash('sha256').update(plainKey).digest('hex');
  return hashedInput === this.licenseKeyHash;
};

licenseSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.licenseKey; // Never expose raw key
  delete obj.__v;
  return obj;
};

// Static methods
licenseSchema.statics.generateLicenseKey = function() {
  const prefix = 'EDU-';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `${prefix}${timestamp}-${random}`;
};

licenseSchema.statics.findBySchoolName = function(schoolName) {
  return this.findOne({ schoolName: new RegExp(`^${schoolName}$`, 'i') });
};

licenseSchema.statics.findActiveLicense = function() {
  return this.findOne({ 
    status: 'active',
    expiryDate: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('License', licenseSchema);
