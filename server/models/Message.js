const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipients: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: Date,
        deletedAt: Date,
      },
    ],
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    parentMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    thread: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    attachments: [
      {
        filename: String,
        url: String,
        fileType: String,
        fileSize: Number,
      },
    ],
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
    },
    status: {
      type: String,
      enum: ["draft", "sent", "archived", "deleted"],
      default: "sent",
    },
    type: {
      type: String,
      enum: ["direct", "group", "system"],
      default: "direct",
    },
    metadata: {
      replyCount: {
        type: Number,
        default: 0,
      },
      forwardCount: {
        type: Number,
        default: 0,
      },
      isForwarded: {
        type: Boolean,
        default: false,
      },
      originalMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
    },
    scheduledFor: {
      type: Date,
    },
    tags: [String],
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ "recipients.user": 1, createdAt: -1 });
messageSchema.index({ thread: 1, createdAt: 1 });
messageSchema.index({ status: 1 });

// Virtual for unread count
messageSchema.virtual("unreadCount").get(function () {
  return this.recipients.filter((r) => !r.readAt).length;
});

// Method to mark message as read for a user
messageSchema.methods.markAsRead = async function (userId) {
  const recipient = this.recipients.find(
    (r) => r.user.toString() === userId.toString()
  );
  if (recipient && !recipient.readAt) {
    recipient.readAt = new Date();
    await this.save();
  }
};

// Method to mark message as deleted for a user
messageSchema.methods.markAsDeleted = async function (userId) {
  const recipient = this.recipients.find(
    (r) => r.user.toString() === userId.toString()
  );
  if (recipient && !recipient.deletedAt) {
    recipient.deletedAt = new Date();
    await this.save();
  }
};

// Method to check if message is read by user
messageSchema.methods.isReadBy = function (userId) {
  const recipient = this.recipients.find(
    (r) => r.user.toString() === userId.toString()
  );
  return recipient && recipient.readAt;
};

// Method to check if message is deleted by user
messageSchema.methods.isDeletedBy = function (userId) {
  const recipient = this.recipients.find(
    (r) => r.user.toString() === userId.toString()
  );
  return recipient && recipient.deletedAt;
};

// Static method to get unread count for a user
messageSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({
    "recipients.user": userId,
    "recipients.readAt": { $exists: false },
    "recipients.deletedAt": { $exists: false },
    status: "sent",
  });
};

// Static method to get thread messages
messageSchema.statics.getThread = async function (threadId) {
  return this.find({ thread: threadId })
    .sort({ createdAt: 1 })
    .populate("sender", "name email")
    .populate("recipients.user", "name email");
};

// Pre-save middleware to set thread ID if it's a reply
messageSchema.pre("save", function (next) {
  if (this.parentMessage && !this.thread) {
    this.thread = this.parentMessage;
  }
  next();
});

module.exports = mongoose.model("Message", messageSchema);
