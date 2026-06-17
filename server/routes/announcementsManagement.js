const express = require("express");
const { body, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const GhanaAnnouncement = require("../models/GhanaAnnouncement");
const GhanaStudent = require("../models/GhanaStudent");
const GhanaClass = require("../models/GhanaClass");
const User = require("../models/User");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/announcements/";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|mp4|mp3/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only images, documents, and media files are allowed."));
    }
  }
});

// ============= ANNOUNCEMENT CREATION =============

// Create new announcement
router.post(
  "/create",
  auth,
  authorizeRoles("admin", "staff", "teacher"),
  upload.array("attachments", 5),
  [
    body("title").trim().isLength({ min: 3, max: 200 }).withMessage("Title must be 3-200 characters"),
    body("content").trim().isLength({ min: 10, max: 5000 }).withMessage("Content must be 10-5000 characters"),
    body("summary").optional().trim().isLength({ max: 500 }).withMessage("Summary must be max 500 characters"),
    body("priority").isIn(["Low", "Medium", "High", "Urgent", "Critical"]).withMessage("Invalid priority"),
    body("category").isIn([
      "General", "Academic", "Events", "Emergency", "Holiday", "Examination",
      "Sports", "Cultural", "PTA Meeting", "School Fees", "Admission",
      "Graduation", "Maintenance", "Health & Safety", "Ghana Education Service"
    ]).withMessage("Invalid category"),
    body("targetAudience").isArray({ min: 1 }).withMessage("Target audience is required"),
    body("language").optional().isIn(["English", "Twi", "Ewe", "Ga", "Dagbani", "Other"]).withMessage("Invalid language"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        content,
        summary,
        priority,
        category,
        targetAudience,
        targetLevels,
        targetClasses,
        targetStudents,
        targetParents,
        targetTeachers,
        scheduledDate,
        expiryDate,
        isSticky,
        isPublic,
        sendEmail,
        sendSMS,
        sendPush,
        language,
        tags,
        keywords,
        regionSpecific,
        targetRegions,
        isGhanaianHoliday,
        holidayName,
        requiresApproval,
      } = req.body;

      // Process attachments
      const attachments = [];
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          attachments.push({
            filename: file.filename,
            originalName: file.originalname,
            url: `/uploads/announcements/${file.filename}`,
            fileType: getFileType(file.mimetype),
            fileSize: file.size,
            mimeType: file.mimetype,
          });
        });
      }

      // Process banner image
      let bannerImage = null;
      if (req.files && req.files.bannerImage) {
        const bannerFile = req.files.bannerImage;
        bannerImage = {
          url: `/uploads/announcements/${bannerFile.filename}`,
          alt: req.body.bannerAlt || title,
          caption: req.body.bannerCaption || "",
        };
      }

      // Create announcement
      const announcement = new GhanaAnnouncement({
        title,
        content,
        summary,
        author: req.user._id,
        authorRole: req.user.role,
        priority,
        category,
        targetAudience: Array.isArray(targetAudience) ? targetAudience : [targetAudience],
        targetLevels: targetLevels ? (Array.isArray(targetLevels) ? targetLevels : [targetLevels]) : [],
        targetClasses: targetClasses ? (Array.isArray(targetClasses) ? targetClasses : [targetClasses]) : [],
        targetStudents: targetStudents ? (Array.isArray(targetStudents) ? targetStudents : [targetStudents]) : [],
        targetParents: targetParents ? (Array.isArray(targetParents) ? targetParents : [targetParents]) : [],
        targetTeachers: targetTeachers ? (Array.isArray(targetTeachers) ? targetTeachers : [targetTeachers]) : [],
        scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isSticky: isSticky === "true",
        isPublic: isPublic !== "false",
        sendEmail: sendEmail !== "false",
        sendSMS: sendSMS === "true",
        sendPush: sendPush !== "false",
        language: language || "English",
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
        keywords: keywords ? (Array.isArray(keywords) ? keywords : [keywords]) : [],
        regionSpecific: regionSpecific === "true",
        targetRegions: targetRegions ? (Array.isArray(targetRegions) ? targetRegions : [targetRegions]) : [],
        isGhanaianHoliday: isGhanaianHoliday === "true",
        holidayName: holidayName || "",
        requiresApproval: requiresApproval === "true",
        attachments,
        bannerImage,
      });

      // Handle approval workflow
      if (requiresApproval === "true" && req.user.role !== "admin") {
        announcement.status = "Draft";
      } else if (scheduledDate && new Date(scheduledDate) > new Date()) {
        announcement.status = "Scheduled";
        announcement.publishDate = new Date(scheduledDate);
      } else {
        announcement.status = "Published";
        announcement.publishDate = new Date();
      }

      await announcement.save();

      // Send notifications (this would be handled by a notification service)
      if (announcement.status === "Published" && (sendEmail !== "false" || sendPush !== "false")) {
        // TODO: Implement notification service
        console.log("Notifications would be sent here");
      }

      const populatedAnnouncement = await GhanaAnnouncement.findById(announcement._id)
        .populate("author", "firstName lastName email role")
        .populate("targetClasses", "name level section")
        .populate("targetStudents", "firstName lastName studentId")
        .populate("targetParents", "firstName lastName email")
        .populate("targetTeachers", "firstName lastName email");

      res.status(201).json({
        message: "Announcement created successfully",
        announcement: populatedAnnouncement,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get announcements for user
router.get(
  "/my-announcements",
  auth,
  async (req, res) => {
    try {
      const {
        limit = 20,
        skip = 0,
        category,
        priority,
        unreadOnly,
        language,
      } = req.query;

      const announcements = await GhanaAnnouncement.getForUser(
        req.user._id,
        req.user.role,
        {
          limit: parseInt(limit),
          skip: parseInt(skip),
          category,
          priority,
          unreadOnly: unreadOnly === "true",
        }
      );

      // Filter by language if specified
      let filteredAnnouncements = announcements;
      if (language && language !== "English") {
        filteredAnnouncements = announcements.map(announcement => ({
          ...announcement.toObject(),
          ...announcement.getTranslatedContent(language),
        }));
      }

      res.json({
        announcements: filteredAnnouncements,
        pagination: {
          limit: parseInt(limit),
          skip: parseInt(skip),
          total: announcements.length,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= ANNOUNCEMENT MANAGEMENT =============

// Get all announcements (admin view)
router.get(
  "/all",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const {
        limit = 20,
        skip = 0,
        status,
        category,
        priority,
        author,
        startDate,
        endDate,
        search,
      } = req.query;

      const match = {};
      
      if (status) match.status = status;
      if (category) match.category = category;
      if (priority) match.priority = priority;
      if (author) match.author = author;
      
      if (startDate && endDate) {
        match.scheduledDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }
      
      if (search) {
        match.$or = [
          { title: { $regex: search, $options: "i" } },
          { content: { $regex: search, $options: "i" } },
          { summary: { $regex: search, $options: "i" } },
          { tags: { $in: [new RegExp(search, "i")] } },
        ];
      }

      const announcements = await GhanaAnnouncement.find(match)
        .populate("author", "firstName lastName email role")
        .populate("targetClasses", "name level section")
        .sort({ isSticky: -1, scheduledDate: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await GhanaAnnouncement.countDocuments(match);

      res.json({
        announcements,
        pagination: {
          limit: parseInt(limit),
          skip: parseInt(skip),
          total,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get single announcement
router.get(
  "/:announcementId",
  auth,
  async (req, res) => {
    try {
      const { announcementId } = req.params;

      const announcement = await GhanaAnnouncement.findById(announcementId)
        .populate("author", "firstName lastName email role")
        .populate("targetClasses", "name level section")
        .populate("targetStudents", "firstName lastName studentId")
        .populate("targetParents", "firstName lastName email")
        .populate("targetTeachers", "firstName lastName email")
        .populate("comments.user", "firstName lastName email")
        .populate("comments.parentComment", "user")
        .populate("comments.likes.user", "firstName lastName")
        .populate("relatedAnnouncements", "title scheduledDate");

      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      // Check if user can view this announcement
      if (!announcement.canView(req.user)) {
        return res.status(403).json({ message: "Not authorized to view this announcement" });
      }

      // Mark as read
      if (!announcement.isReadBy(req.user._id)) {
        await announcement.markAsRead(req.user._id, "Web", req.ip);
      }

      res.json(announcement);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Update announcement
router.put(
  "/:announcementId",
  auth,
  authorizeRoles("admin", "staff"),
  upload.array("attachments", 5),
  [
    body("title").optional().trim().isLength({ min: 3, max: 200 }).withMessage("Title must be 3-200 characters"),
    body("content").optional().trim().isLength({ min: 10, max: 5000 }).withMessage("Content must be 10-5000 characters"),
    body("priority").optional().isIn(["Low", "Medium", "High", "Urgent", "Critical"]).withMessage("Invalid priority"),
    body("category").optional().isIn([
      "General", "Academic", "Events", "Emergency", "Holiday", "Examination",
      "Sports", "Cultural", "PTA Meeting", "School Fees", "Admission",
      "Graduation", "Maintenance", "Health & Safety", "Ghana Education Service"
    ]).withMessage("Invalid category"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { announcementId } = req.params;
      const updates = req.body;

      const announcement = await GhanaAnnouncement.findById(announcementId);
      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      // Check authorization
      if (req.user.role !== "admin" && announcement.author.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Not authorized to update this announcement" });
      }

      // Store previous version for version control
      const previousVersion = {
        version: announcement.version,
        title: announcement.title,
        content: announcement.content,
        modifiedBy: req.user._id,
        reason: updates.reason || "Updated content",
      };
      announcement.previousVersions.push(previousVersion);
      announcement.version++;

      // Update fields
      Object.keys(updates).forEach(key => {
        if (key !== "reason" && updates[key] !== undefined) {
          announcement[key] = updates[key];
        }
      });

      // Handle new attachments
      if (req.files && req.files.length > 0) {
        const newAttachments = req.files.map(file => ({
          filename: file.filename,
          originalName: file.originalname,
          url: `/uploads/announcements/${file.filename}`,
          fileType: getFileType(file.mimetype),
          fileSize: file.size,
          mimeType: file.mimetype,
        }));
        announcement.attachments.push(...newAttachments);
      }

      announcement.lastModifiedBy = req.user._id;
      await announcement.save();

      const updatedAnnouncement = await GhanaAnnouncement.findById(announcementId)
        .populate("author", "firstName lastName email role")
        .populate("targetClasses", "name level section");

      res.json({
        message: "Announcement updated successfully",
        announcement: updatedAnnouncement,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Delete announcement
router.delete(
  "/:announcementId",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const { announcementId } = req.params;

      const announcement = await GhanaAnnouncement.findById(announcementId);
      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      // Check authorization
      if (req.user.role !== "admin" && announcement.author.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Not authorized to delete this announcement" });
      }

      // Delete attachments from filesystem
      announcement.attachments.forEach(attachment => {
        const filePath = path.join("uploads/announcements", attachment.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });

      await GhanaAnnouncement.findByIdAndDelete(announcementId);

      res.json({ message: "Announcement deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= ENGAGEMENT FEATURES =============

// Mark announcement as read
router.post(
  "/:announcementId/read",
  auth,
  async (req, res) => {
    try {
      const { announcementId } = req.params;
      const { device = "Web" } = req.body;

      const announcement = await GhanaAnnouncement.findById(announcementId);
      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      if (!announcement.canView(req.user)) {
        return res.status(403).json({ message: "Not authorized to view this announcement" });
      }

      await announcement.markAsRead(req.user._id, device, req.ip);

      res.json({ message: "Announcement marked as read" });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Add reaction to announcement
router.post(
  "/:announcementId/react",
  auth,
  [
    body("reaction").isIn(["Like", "Love", "Laugh", "Wow", "Sad", "Angry"]).withMessage("Invalid reaction"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { announcementId } = req.params;
      const { reaction } = req.body;

      const announcement = await GhanaAnnouncement.findById(announcementId);
      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      if (!announcement.canView(req.user)) {
        return res.status(403).json({ message: "Not authorized to react to this announcement" });
      }

      await announcement.addReaction(req.user._id, reaction);

      res.json({ message: "Reaction added successfully" });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Remove reaction from announcement
router.delete(
  "/:announcementId/react",
  auth,
  async (req, res) => {
    try {
      const { announcementId } = req.params;

      const announcement = await GhanaAnnouncement.findById(announcementId);
      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      await announcement.removeReaction(req.user._id);

      res.json({ message: "Reaction removed successfully" });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Add comment to announcement
router.post(
  "/:announcementId/comment",
  auth,
  [
    body("content").trim().isLength({ min: 1, max: 1000 }).withMessage("Comment must be 1-1000 characters"),
    body("parentCommentId").optional().isMongoId().withMessage("Invalid parent comment ID"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { announcementId } = req.params;
      const { content, parentCommentId } = req.body;

      const announcement = await GhanaAnnouncement.findById(announcementId);
      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      if (!announcement.canView(req.user)) {
        return res.status(403).json({ message: "Not authorized to comment on this announcement" });
      }

      await announcement.addComment(req.user._id, content, parentCommentId);

      const updatedAnnouncement = await GhanaAnnouncement.findById(announcementId)
        .populate("comments.user", "firstName lastName email")
        .populate("comments.parentComment", "user");

      res.json({
        message: "Comment added successfully",
        comments: updatedAnnouncement.comments,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// ============= ANALYTICS AND REPORTING =============

// Get announcement statistics
router.get(
  "/statistics",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const {
        author,
        category,
        status,
        startDate,
        endDate,
      } = req.query;

      const filters = {};
      if (author) filters.author = author;
      if (category) filters.category = category;
      if (status) filters.status = status;
      if (startDate && endDate) {
        filters.startDate = startDate;
        filters.endDate = endDate;
      }

      const statistics = await GhanaAnnouncement.getStatistics(filters);

      res.json({
        statistics,
        filters,
        period: { startDate, endDate },
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get trending announcements
router.get(
  "/trending",
  auth,
  async (req, res) => {
    try {
      const { limit = 10 } = req.query;

      const trendingAnnouncements = await GhanaAnnouncement.getTrending(parseInt(limit));

      res.json({
        trending: trendingAnnouncements,
        limit: parseInt(limit),
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Get announcement engagement details
router.get(
  "/:announcementId/analytics",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const { announcementId } = req.params;

      const announcement = await GhanaAnnouncement.findById(announcementId)
        .populate("readBy.user", "firstName lastName email role")
        .populate("reactions.user", "firstName lastName email")
        .populate("comments.user", "firstName lastName email");

      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      const analytics = {
        basic: {
          views: announcement.viewCount,
          reads: announcement.readCount,
          shares: announcement.shareCount,
          clicks: announcement.clickCount,
        },
        engagement: {
          totalReactions: announcement.reactions.length,
          reactionCounts: announcement.reactionCounts,
          totalComments: announcement.comments.length,
          totalEngagement: announcement.totalEngagement,
        },
        audience: {
          targetAudience: announcement.targetAudience,
          actualReaders: announcement.readBy.map(read => ({
            user: read.user,
            readAt: read.readAt,
            device: read.device,
          })),
        },
        notifications: announcement.analytics,
      };

      res.json({
        announcement: {
          id: announcement._id,
          title: announcement.title,
          category: announcement.category,
          priority: announcement.priority,
          status: announcement.status,
          scheduledDate: announcement.scheduledDate,
          author: announcement.author,
        },
        analytics,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

// Helper function to determine file type
function getFileType(mimetype) {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  if (mimetype.includes("pdf")) return "pdf";
  return "document";
}

module.exports = router;
