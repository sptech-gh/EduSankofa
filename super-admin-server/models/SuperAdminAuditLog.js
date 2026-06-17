const mongoose = require('mongoose');

const superAdminAuditLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'CREATE_SCHOOL',
      'UPDATE_SCHOOL',
      'SUSPEND_SCHOOL',
      'ACTIVATE_SCHOOL',
      'DELETE_SCHOOL',
      'CREATE_LICENSE',
      'UPDATE_LICENSE',
      'SUSPEND_LICENSE',
      'RENEW_LICENSE',
      'LOGIN',
      'LOGOUT',
      'VIEW_DASHBOARD',
      'EXPORT_DATA',
      'SYSTEM_CONFIG'
    ]
  },
  entityType: {
    type: String,
    required: true,
    enum: ['school', 'license', 'superadmin', 'system']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  entityName: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  auditErrors: [{
    timestamp: Date,
    type: String,
    message: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  }],
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for performance
superAdminAuditLogSchema.index({ adminId: 1, timestamp: -1 });
superAdminAuditLogSchema.index({ action: 1, timestamp: -1 });
superAdminAuditLogSchema.index({ entityType: 1, entityId: 1 });
superAdminAuditLogSchema.index({ timestamp: -1 });
superAdminAuditLogSchema.index({ severity: 1, timestamp: -1 });

// Static methods
superAdminAuditLogSchema.statics.findByAdmin = function(adminId, limit = 100) {
  return this.find({ adminId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('adminId', 'email');
};

superAdminAuditLogSchema.statics.findByAction = function(action, limit = 100) {
  return this.find({ action })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('adminId', 'email');
};

superAdminAuditLogSchema.statics.findByEntity = function(entityType, entityId, limit = 50) {
  return this.find({ entityType, entityId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('adminId', 'email');
};

superAdminAuditLogSchema.statics.getRecentActivity = function(hours = 24, limit = 50) {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.find({
    timestamp: { $gte: startTime }
  })
  .sort({ timestamp: -1 })
  .limit(limit)
  .populate('adminId', 'email');
};

superAdminAuditLogSchema.statics.getActivityStats = function(days = 30) {
  const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startTime }
      }
    },
    {
      $group: {
        _id: {
          action: '$action',
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp'
            }
          }
        },
        count: { $sum: 1 },
        successCount: {
          $sum: { $cond: ['$success', 1, 0] }
        },
        failureCount: {
          $sum: { $cond: ['$success', 0, 1] }
        }
      }
    },
    {
      $sort: { '_id.date': -1, count: -1 }
    }
  ]);
};

// Instance methods
superAdminAuditLogSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('SuperAdminAuditLog', superAdminAuditLogSchema);
