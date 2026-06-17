const mongoose = require("mongoose");

const ghanaAnnouncementSchema = new mongoose.Schema(
  {
    // Core announcement data
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    
    // Author information
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorRole: {
      type: String,
      required: true,
      enum: ["Super Admin", "School Admin", "Teacher", "Accountant", "Staff"],
    },
    
    // Priority and categorization
    priority: {
      type: String,
      required: true,
      enum: ["Low", "Medium", "High", "Urgent", "Critical"],
      default: "Medium",
    },
    category: {
      type: String,
      required: true,
      enum: [
        "General",
        "Academic", 
        "Events",
        "Emergency",
        "Holiday",
        "Examination",
        "Sports",
        "Cultural",
        "PTA Meeting",
        "School Fees",
        "Admission",
        "Graduation",
        "Maintenance",
        "Health & Safety",
        "Ghana Education Service",
      ],
      default: "General",
    },
    
    // Targeting options
    targetAudience: {
      type: [String],
      required: true,
      enum: [
        "All Users", "Students", "Teachers", "Parents", "Admin", "Staff",
        "Accountants", "Class Teachers", "Subject Teachers", "Heads of Department"
      ],
      default: ["All Users"],
    },
    
    // Specific targeting
    targetClasses: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "GhanaClass",
    }],
    targetLevels: [{
      type: String,
      enum: [
        "Creche", "Nursery 1", "Nursery 2", "KG 1", "KG 2",
        "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
        "JHS 1", "JHS 2", "JHS 3"
      ],
    }],
    targetStudents: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "GhanaStudent",
    }],
    targetParents: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    targetTeachers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    
    // Scheduling
    scheduledDate: {
      type: Date,
      default: Date.now,
    },
    publishDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
    },
    
    // Status and visibility
    status: {
      type: String,
      required: true,
      enum: ["Draft", "Scheduled", "Published", "Expired", "Archived", "Cancelled"],
      default: "Draft",
    },
    isSticky: {
      type: Boolean,
      default: false,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    
    // Media and attachments
    attachments: [{
      filename: {
        type: String,
        required: true,
      },
      originalName: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
      fileType: {
        type: String,
        required: true,
        enum: ["image", "document", "video", "audio", "pdf"],
      },
      fileSize: {
        type: Number,
        required: true,
      },
      mimeType: String,
      description: String,
    }],
    
    // Images
    bannerImage: {
      url: String,
      alt: String,
      caption: String,
    },
    
    // Tracking and analytics
    readBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      readAt: {
        type: Date,
        default: Date.now,
      },
      device: {
        type: String,
        enum: ["Web", "Mobile", "Tablet", "Email", "SMS"],
      },
      ipAddress: String,
    }],
    viewCount: {
      type: Number,
      default: 0,
    },
    clickCount: {
      type: Number,
      default: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
    },
    
    // Engagement
    reactions: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      type: {
        type: String,
        enum: ["Like", "Love", "Laugh", "Wow", "Sad", "Angry"],
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
    comments: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      content: {
        type: String,
        required: true,
        maxlength: 1000,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      isEdited: {
        type: Boolean,
        default: false,
      },
      editedAt: Date,
      parentComment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GhanaAnnouncement.comments",
      },
      likes: [{
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        likedAt: {
          type: Date,
          default: Date.now,
        },
      }],
    }],
    
    // Notification settings
    sendEmail: {
      type: Boolean,
      default: true,
    },
    sendSMS: {
      type: Boolean,
      default: false,
    },
    sendPush: {
      type: Boolean,
      default: true,
    },
    notificationSent: {
      type: Boolean,
      default: false,
    },
    notificationSentAt: Date,
    
    // Ghanaian specific features
    isGhanaianHoliday: {
      type: Boolean,
      default: false,
    },
    holidayName: {
      type: String,
      trim: true,
    },
    regionSpecific: {
      type: Boolean,
      default: false,
    },
    targetRegions: [{
      type: String,
      enum: [
        "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern",
        "Greater Accra", "North East", "Northern", "Oti", "Savannah",
        "Upper East", "Upper West", "Volta", "Western", "Western North"
      ],
    }],
    
    // Language support
    language: {
      type: String,
      enum: ["English", "Twi", "Ewe", "Ga", "Dagbani", "Other"],
      default: "English",
    },
    translations: [{
      language: {
        type: String,
        required: true,
      },
      title: {
        type: String,
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
      summary: String,
    }],
    
    // Tags and metadata
    tags: [String],
    keywords: [String],
    
    // Approval workflow
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,
    rejectionReason: String,
    
    // Version control
    version: {
      type: Number,
      default: 1,
    },
    previousVersions: [{
      version: Number,
      title: String,
      content: String,
      modifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      modifiedAt: {
        type: Date,
        default: Date.now,
      },
      reason: String,
    }],
    
    // Related announcements
    relatedAnnouncements: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "GhanaAnnouncement",
    }],
    
    // Analytics
    analytics: {
      emailSent: { type: Number, default: 0 },
      emailDelivered: { type: Number, default: 0 },
      emailOpened: { type: Number, default: 0 },
      smsSent: { type: Number, default: 0 },
      smsDelivered: { type: Number, default: 0 },
      pushSent: { type: Number, default: 0 },
      pushDelivered: { type: Number, default: 0 },
      pushOpened: { type: Number, default: 0 },
    },
    
    // Metadata
    metadata: {
      source: String,
      campaign: String,
      template: String,
      batchId: String,
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for efficient queries
ghanaAnnouncementSchema.index({ status: 1, scheduledDate: -1 });
ghanaAnnouncementSchema.index({ targetAudience: 1 });
ghanaAnnouncementSchema.index({ category: 1 });
ghanaAnnouncementSchema.index({ author: 1 });
ghanaAnnouncementSchema.index({ priority: 1, status: 1 });
ghanaAnnouncementSchema.index({ expiryDate: 1 });
ghanaAnnouncementSchema.index({ isSticky: 1, status: 1 });
ghanaAnnouncementSchema.index({ targetClasses: 1 });
ghanaAnnouncementSchema.index({ targetLevels: 1 });
ghanaAnnouncementSchema.index({ publishDate: 1 });

// Virtual for read count
ghanaAnnouncementSchema.virtual("readCount").get(function () {
  return this.readBy.length;
});

// Virtual for reaction counts
ghanaAnnouncementSchema.virtual("reactionCounts").get(function () {
  const counts = {
    Like: 0,
    Love: 0,
    Laugh: 0,
    Wow: 0,
    Sad: 0,
    Angry: 0,
  };

  this.reactions.forEach(reaction => {
    counts[reaction.type]++;
  });

  return counts;
});

// Virtual for total engagement
ghanaAnnouncementSchema.virtual("totalEngagement").get(function () {
  return this.readCount + this.viewCount + this.clickCount + 
         this.shareCount + this.reactions.length + this.comments.length;
});

// Method to check if user has read the announcement
ghanaAnnouncementSchema.methods.isReadBy = function (userId) {
  return this.readBy.some((read) => read.user.toString() === userId.toString());
};

// Method to mark as read by user
ghanaAnnouncementSchema.methods.markAsRead = function (userId, device = "Web", ipAddress = null) {
  if (!this.isReadBy(userId)) {
    this.readBy.push({ 
      user: userId, 
      device, 
      ipAddress 
    });
    this.viewCount++;
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to add reaction
ghanaAnnouncementSchema.methods.addReaction = function (userId, reactionType) {
  // Remove existing reaction by this user
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  
  // Add new reaction
  this.reactions.push({
    user: userId,
    type: reactionType,
  });
  
  return this.save();
};

// Method to remove reaction
ghanaAnnouncementSchema.methods.removeReaction = function (userId) {
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  return this.save();
};

// Method to add comment
ghanaAnnouncementSchema.methods.addComment = function (userId, content, parentCommentId = null) {
  const comment = {
    user: userId,
    content,
    parentComment: parentCommentId,
  };
  
  this.comments.push(comment);
  return this.save();
};

// Method to check if user can view announcement
ghanaAnnouncementSchema.methods.canView = function (user) {
  // Check if announcement is published
  if (this.status !== "Published") {
    return false;
  }
  
  // Check if expired
  if (this.expiryDate && new Date() > this.expiryDate) {
    return false;
  }
  
  // Check if user is in target audience
  if (this.targetAudience.includes("All Users")) {
    return true;
  }
  
  if (user) {
    // Check role-based targeting
    if (this.targetAudience.includes(user.role)) {
      return true;
    }
    
    // Check specific user targeting
    if (this.targetStudents && user.role === "student") {
      return this.targetStudents.some(id => id.toString() === user._id.toString());
    }
    
    if (this.targetTeachers && user.role === "teacher") {
      return this.targetTeachers.some(id => id.toString() === user._id.toString());
    }
    
    if (this.targetParents && user.role === "parent") {
      return this.targetParents.some(id => id.toString() === user._id.toString());
    }
  }
  
  return false;
};

// Method to get translated content
ghanaAnnouncementSchema.methods.getTranslatedContent = function (language = "English") {
  if (language === "English") {
    return {
      title: this.title,
      content: this.content,
      summary: this.summary,
    };
  }
  
  const translation = this.translations.find(t => t.language === language);
  if (translation) {
    return {
      title: translation.title,
      content: translation.content,
      summary: translation.summary,
    };
  }
  
  // Fallback to English
  return {
    title: this.title,
    content: this.content,
    summary: this.summary,
  };
};

// Static method to get announcements for user
ghanaAnnouncementSchema.statics.getForUser = async function (userId, userRole, options = {}) {
  const {
    limit = 20,
    skip = 0,
    status = "Published",
    category,
    priority,
    unreadOnly = false,
  } = options;

  const match = {
    status,
    $or: [
      { targetAudience: "All Users" },
      { targetAudience: userRole },
    ],
  };

  if (category) match.category = category;
  if (priority) match.priority = priority;

  // Don't show expired announcements
  match.$or = match.$or.map(audience => ({
    ...audience,
    $or: [
      { expiryDate: { $exists: false } },
      { expiryDate: { $gt: new Date() } },
    ],
  }));

  if (unreadOnly) {
    match["readBy.user"] = { $ne: userId };
  }

  const announcements = await this.find(match)
    .populate("author", "firstName lastName email")
    .populate("targetClasses", "name level section")
    .sort({ isSticky: -1, scheduledDate: -1 })
    .limit(limit)
    .skip(skip);

  return announcements;
};

// Static method to get announcement statistics
ghanaAnnouncementSchema.statics.getStatistics = async function (filters = {}) {
  const match = {};
  
  if (filters.author) match.author = filters.author;
  if (filters.category) match.category = filters.category;
  if (filters.status) match.status = filters.status;
  if (filters.startDate && filters.endDate) {
    match.scheduledDate = {
      $gte: new Date(filters.startDate),
      $lte: new Date(filters.endDate),
    };
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        published: {
          $sum: { $cond: [{ $eq: ["$status", "Published"] }, 1, 0] },
        },
        draft: {
          $sum: { $cond: [{ $eq: ["$status", "Draft"] }, 1, 0] },
        },
        scheduled: {
          $sum: { $cond: [{ $eq: ["$status", "Scheduled"] }, 1, 0] },
        },
        expired: {
          $sum: { $cond: [{ $eq: ["$status", "Expired"] }, 1, 0] },
        },
        totalViews: { $sum: "$viewCount" },
        totalReads: { $sum: { $size: "$readBy" } },
        totalReactions: { $sum: { $size: "$reactions" } },
        totalComments: { $sum: { $size: "$comments" } },
      },
    },
  ];

  const result = await this.aggregate(pipeline);
  return result[0] || {
    total: 0,
    published: 0,
    draft: 0,
    scheduled: 0,
    expired: 0,
    totalViews: 0,
    totalReads: 0,
    totalReactions: 0,
    totalComments: 0,
  };
};

// Static method to get trending announcements
ghanaAnnouncementSchema.statics.getTrending = async function (limit = 10) {
  const pipeline = [
    {
      $match: {
        status: "Published",
        scheduledDate: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    },
    {
      $addFields: {
        engagementScore: {
          $add: [
            { $multiply: [{ $size: "$readBy" }, 1] },
            { $multiply: ["$viewCount", 0.5] },
            { $multiply: [{ $size: "$reactions" }, 2] },
            { $multiply: [{ $size: "$comments" }, 1.5] },
            { $multiply: ["$shareCount", 3] },
          ],
        },
      },
    },
    { $sort: { engagementScore: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "author",
        foreignField: "_id",
        as: "authorInfo",
      },
    },
    { $unwind: "$authorInfo" },
  ];

  return this.aggregate(pipeline);
};

// Pre-save middleware for validation
ghanaAnnouncementSchema.pre("save", function (next) {
  // Validate that publish date is not before scheduled date
  if (this.publishDate && this.scheduledDate) {
    if (this.publishDate < this.scheduledDate) {
      return next(new Error("Publish date cannot be before scheduled date"));
    }
  }

  // Validate that expiry date is after publish date
  if (this.expiryDate && this.publishDate) {
    if (this.expiryDate <= this.publishDate) {
      return next(new Error("Expiry date must be after publish date"));
    }
  }

  // Auto-publish if scheduled date is in the past
  if (this.status === "Scheduled" && this.scheduledDate <= new Date()) {
    this.status = "Published";
    this.publishDate = new Date();
  }

  // Auto-expire if expiry date is in the past
  if (this.status === "Published" && this.expiryDate && this.expiryDate <= new Date()) {
    this.status = "Expired";
  }

  next();
});

module.exports = mongoose.model("GhanaAnnouncement", ghanaAnnouncementSchema);
