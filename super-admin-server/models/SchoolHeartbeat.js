const mongoose = require('mongoose');

const schoolHeartbeatSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  lastPing: {
    type: Date,
    required: true,
    default: Date.now
  },
  activeUsers: {
    type: Number,
    required: true,
    min: 0
  },
  databaseSize: {
    type: Number,
    required: true,
    min: 0
  },
  version: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'warning'],
    default: 'online'
  },
  metrics: {
    cpuUsage: Number,
    memoryUsage: Number,
    diskUsage: Number,
    networkLatency: Number
  },
  errors: [{
    timestamp: Date,
    type: String,
    message: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  }],
  uptime: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for performance
schoolHeartbeatSchema.index({ schoolId: 1 });
schoolHeartbeatSchema.index({ lastPing: -1 });
schoolHeartbeatSchema.index({ status: 1 });

// Static methods
schoolHeartbeatSchema.statics.findBySchool = function(schoolId) {
  return this.findOne({ schoolId }).sort({ lastPing: -1 });
};

schoolHeartbeatSchema.statics.findOnline = function() {
  const timeoutMinutes = parseInt(process.env.HEARTBEAT_TIMEOUT_MINUTES) || 10;
  const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
  
  return this.find({
    lastPing: { $gte: cutoffTime }
  }).populate('schoolId', 'name subdomain');
};

schoolHeartbeatSchema.statics.findOffline = function() {
  const timeoutMinutes = parseInt(process.env.HEARTBEAT_TIMEOUT_MINUTES) || 10;
  const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
  
  return this.find({
    lastPing: { $lt: cutoffTime }
  }).populate('schoolId', 'name subdomain');
};

schoolHeartbeatSchema.statics.getSchoolMetrics = function(schoolId, hours = 24) {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        schoolId: mongoose.Types.ObjectId(schoolId),
        lastPing: { $gte: startTime }
      }
    },
    {
      $group: {
        _id: null,
        avgActiveUsers: { $avg: '$activeUsers' },
        maxActiveUsers: { $max: '$activeUsers' },
        minActiveUsers: { $min: '$activeUsers' },
        avgDatabaseSize: { $avg: '$databaseSize' },
        maxDatabaseSize: { $max: '$databaseSize' },
        minDatabaseSize: { $min: '$databaseSize' },
        totalPings: { $sum: 1 },
        errorCount: { $sum: { $size: '$errors' } }
      }
    }
  ]);
};

// Instance methods
schoolHeartbeatSchema.methods.isOnline = function() {
  const timeoutMinutes = parseInt(process.env.HEARTBEAT_TIMEOUT_MINUTES) || 10;
  const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
  return this.lastPing >= cutoffTime;
};

schoolHeartbeatSchema.methods.addError = function(type, message, severity = 'medium') {
  this.errors.push({
    timestamp: new Date(),
    type,
    message,
    severity
  });
  
  // Keep only last 50 errors
  if (this.errors.length > 50) {
    this.errors = this.errors.slice(-50);
  }
  
  return this.save();
};

schoolHeartbeatSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('SchoolHeartbeat', schoolHeartbeatSchema);
