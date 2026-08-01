const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  subdomain: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/,
    maxlength: 50
  },
  databaseName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  deploymentType: {
    type: String,
    required: true,
    enum: ['cloud', 'self-hosted'],
    default: 'self-hosted'
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'suspended', 'pending', 'pending_payment', 'expired'],
    default: 'pending'
  },
  licenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CentralLicense',
    default: null
  },
  contactEmail: {
    type: String,
    lowercase: true,
    trim: true
  },
  contactPhone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  settings: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    locale: {
      type: String,
      default: 'en-US'
    }
  },
  metadata: {
    totalStudents: {
      type: Number,
      default: 0
    },
    totalTeachers: {
      type: Number,
      default: 0
    },
    lastActiveAt: {
      type: Date,
      default: null
    }
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for performance
schoolSchema.index({ subdomain: 1 });
schoolSchema.index({ databaseName: 1 });
schoolSchema.index({ status: 1 });
schoolSchema.index({ deploymentType: 1 });
schoolSchema.index({ licenseId: 1 });
schoolSchema.index({ isDeleted: 1 });
schoolSchema.index({ createdAt: -1 });

// Virtual for checking if school is active
schoolSchema.virtual('isActive').get(function() {
  return this.status === 'active' && !this.isDeleted;
});

// Pre-save middleware to generate database name if not provided
schoolSchema.pre('save', function(next) {
  if (!this.databaseName) {
    this.databaseName = `school_${this.subdomain.replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  }
  next();
});

// Static methods
schoolSchema.statics.findBySubdomain = function(subdomain) {
  return this.findOne({ 
    subdomain: subdomain.toLowerCase(),
    isDeleted: false 
  });
};

schoolSchema.statics.findActive = function() {
  return this.find({ 
    status: 'active',
    isDeleted: false 
  });
};

schoolSchema.statics.findSuspended = function() {
  return this.find({ 
    status: 'suspended',
    isDeleted: false 
  });
};

schoolSchema.statics.softDelete = function(id) {
  return this.findByIdAndUpdate(id, { 
    isDeleted: true,
    status: 'suspended'
  });
};

// Instance methods
schoolSchema.methods.suspend = function() {
  this.status = 'suspended';
  return this.save();
};

schoolSchema.methods.activate = function() {
  this.status = 'active';
  return this.save();
};

schoolSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('School', schoolSchema);
