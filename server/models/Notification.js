const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "announcement",
        "message",
        "grade",
        "assignment",
        "exam",
        "attendance",
        "fee",
        "event",
        "system",
        "reminder",
        "alert",
      ],
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["unread", "read", "archived", "deleted"],
      default: "unread",
    },
    actionRequired: {
      type: Boolean,
      default: false,
    },
    actionUrl: {
      type: String,
    },
    actionText: {
      type: String,
    },
    relatedEntity: {
      entityType: {
        type: String,
        enum: [
          "announcement",
          "message",
          "grade",
          "exam",
          "student",
          "subject",
          "reportcard",
        ],
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
      },
    },
    metadata: {
      category: String,
      tags: [String],
      data: mongoose.Schema.Types.Mixed,
    },
    readAt: {
      type: Date,
    },
    archivedAt: {
      type: Date,
    },
    deletedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    scheduledFor: {
      type: Date,
      default: Date.now,
    },
    deliveryMethod: {
      type: [String],
      enum: ["in-app", "email", "sms", "push"],
      default: ["in-app"],
    },
    deliveryStatus: {
      inApp: {
        delivered: { type: Boolean, default: false },
        deliveredAt: Date,
      },
      email: {
        delivered: { type: Boolean, default: false },
        deliveredAt: Date,
        opened: { type: Boolean, default: false },
        openedAt: Date,
      },
      sms: {
        delivered: { type: Boolean, default: false },
        deliveredAt: Date,
      },
      push: {
        delivered: { type: Boolean, default: false },
        deliveredAt: Date,
        clicked: { type: Boolean, default: false },
        clickedAt: Date,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
notificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, status: 1 });
notificationSchema.index({ scheduledFor: 1, status: 1 });
notificationSchema.index({ expiresAt: 1 });

// Virtual for checking if notification is expired
notificationSchema.virtual("isExpired").get(function () {
  return this.expiresAt && this.expiresAt < new Date();
});

// Method to mark as read
notificationSchema.methods.markAsRead = async function () {
  if (this.status === "unread") {
    this.status = "read";
    this.readAt = new Date();
    await this.save();
  }
};

// Method to mark as archived
notificationSchema.methods.markAsArchived = async function () {
  this.status = "archived";
  this.archivedAt = new Date();
  await this.save();
};

// Method to mark as deleted
notificationSchema.methods.markAsDeleted = async function () {
  this.status = "deleted";
  this.deletedAt = new Date();
  await this.save();
};

// Static method to get unread count for user
notificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({
    recipient: userId,
    status: "unread",
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } },
    ],
  });
};

// Static method to get notifications by priority
notificationSchema.statics.getByPriority = async function (userId, priority) {
  return this.find({
    recipient: userId,
    priority,
    status: { $in: ["unread", "read"] },
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } },
    ],
  }).sort({ createdAt: -1 });
};

// Static method to create bulk notifications
notificationSchema.statics.createBulk = async function (notifications) {
  return this.insertMany(notifications);
};

// Static method to mark delivery status
notificationSchema.methods.markDelivered = async function (method) {
  if (this.deliveryStatus[method]) {
    this.deliveryStatus[method].delivered = true;
    this.deliveryStatus[method].deliveredAt = new Date();
    await this.save();
  }
};

// Pre-save middleware to set delivery status for in-app notifications
notificationSchema.pre("save", function (next) {
  if (this.isNew && this.deliveryMethod.includes("in-app")) {
    this.deliveryStatus.inApp.delivered = true;
    this.deliveryStatus.inApp.deliveredAt = new Date();
  }
  next();
});

// TTL index to automatically delete expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Notification", notificationSchema);
