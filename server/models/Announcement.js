const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    category: {
      type: String,
      enum: [
        "general",
        "academic",
        "event",
        "emergency",
        "maintenance",
        "holiday",
      ],
      default: "general",
    },
    targetAudience: {
      type: [String],
      enum: ["all", "students", "teachers", "staff", "parents", "admin"],
      default: ["all"],
    },
    attachments: [
      {
        filename: String,
        url: String,
        fileType: String,
        fileSize: Number,
      },
    ],
    scheduledDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "published", "expired", "archived"],
      default: "draft",
    },
    isSticky: {
      type: Boolean,
      default: false,
    },
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    tags: [String],
    viewCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
announcementSchema.index({ status: 1, scheduledDate: -1 });
announcementSchema.index({ targetAudience: 1 });
announcementSchema.index({ category: 1 });
announcementSchema.index({ author: 1 });

// Virtual for read count
announcementSchema.virtual("readCount").get(function () {
  return this.readBy.length;
});

// Method to check if user has read the announcement
announcementSchema.methods.isReadBy = function (userId) {
  return this.readBy.some((read) => read.user.toString() === userId.toString());
};

// Method to mark as read by user
announcementSchema.methods.markAsRead = function (userId) {
  if (!this.isReadBy(userId)) {
    this.readBy.push({ user: userId });
  }
};

module.exports = mongoose.model("Announcement", announcementSchema);
