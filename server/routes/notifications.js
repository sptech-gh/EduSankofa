const express = require("express");
const { body, validationResult } = require("express-validator");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

// Validation middleware
const validateNotification = [
  body("recipient").optional().isMongoId().withMessage("Invalid recipient ID"),
  body("recipients")
    .optional()
    .isArray()
    .withMessage("Recipients must be an array"),
  body("recipients.*")
    .optional()
    .isMongoId()
    .withMessage("Invalid recipient ID"),
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("message").trim().notEmpty().withMessage("Message is required"),
  body("type")
    .isIn([
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
    ])
    .withMessage("Invalid notification type"),
  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Invalid priority"),
];

// Create a single notification
router.post(
  "/",
  auth,
  authorizeRoles("admin", "staff", "teacher"),
  validateNotification,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const notification = new Notification({
        ...req.body,
        sender: req.user.userId,
      });

      await notification.save();

      await notification.populate([
        { path: "recipient", select: "name email" },
        { path: "sender", select: "name email" },
      ]);

      res.status(201).json(notification);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Create bulk notifications
router.post(
  "/bulk",
  auth,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const {
        recipients,
        title,
        message,
        type,
        priority,
        actionUrl,
        actionText,
        metadata,
      } = req.body;

      if (
        !recipients ||
        !Array.isArray(recipients) ||
        recipients.length === 0
      ) {
        return res
          .status(400)
          .json({ message: "Recipients array is required" });
      }

      if (!title || !message || !type) {
        return res
          .status(400)
          .json({ message: "Title, message, and type are required" });
      }

      // Verify all recipients exist
      const recipientUsers = await User.find({ _id: { $in: recipients } });
      if (recipientUsers.length !== recipients.length) {
        return res
          .status(400)
          .json({ message: "One or more recipients not found" });
      }

      // Create notifications for all recipients
      const notifications = recipients.map((recipientId) => ({
        recipient: recipientId,
        sender: req.user.userId,
        title,
        message,
        type,
        priority: priority || "medium",
        actionUrl,
        actionText,
        metadata,
      }));

      const createdNotifications = await Notification.createBulk(notifications);

      res.status(201).json({
        message: `${createdNotifications.length} notifications created successfully`,
        count: createdNotifications.length,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get notifications for current user
router.get("/", auth, async (req, res) => {
  try {
    const {
      status,
      type,
      priority,
      unread,
      page = 1,
      limit = 20,
      from,
      to,
    } = req.query;

    const filter = {
      recipient: req.user.userId,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } },
      ],
    };

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (unread === "true") filter.status = "unread";

    // Date range filter
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find(filter)
      .populate("sender", "name email")
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(filter);

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get unread notifications count
router.get("/unread/count", auth, async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user.userId);
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get notifications by priority
router.get("/priority/:priority", auth, async (req, res) => {
  try {
    const { priority } = req.params;
    const notifications = await Notification.getByPriority(
      req.user.userId,
      priority
    );
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get notification statistics
router.get("/stats/summary", auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [
      totalCount,
      unreadCount,
      highPriorityCount,
      urgentCount,
      todayCount,
    ] = await Promise.all([
      Notification.countDocuments({
        recipient: userId,
        status: { $ne: "deleted" },
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      }),
      Notification.getUnreadCount(userId),
      Notification.countDocuments({
        recipient: userId,
        priority: "high",
        status: { $ne: "deleted" },
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      }),
      Notification.countDocuments({
        recipient: userId,
        priority: "urgent",
        status: { $ne: "deleted" },
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      }),
      Notification.countDocuments({
        recipient: userId,
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
        status: { $ne: "deleted" },
      }),
    ]);

    res.json({
      total: totalCount,
      unread: unreadCount,
      highPriority: highPriorityCount,
      urgent: urgentCount,
      today: todayCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin: Get all notifications with filtering
router.get("/admin/all", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const {
      recipient,
      sender,
      type,
      priority,
      status,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};
    if (recipient) filter.recipient = recipient;
    if (sender) filter.sender = sender;
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find(filter)
      .populate("recipient", "name email")
      .populate("sender", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(filter);

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get notification by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate("sender", "name email")
      .populate("recipient", "name email");

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Check if user is the recipient
    if (notification.recipient._id.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Mark as read if it's unread
    if (notification.status === "unread") {
      await notification.markAsRead();
    }

    res.json(notification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Mark notification as read
router.patch("/:id/read", auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.recipient.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    await notification.markAsRead();
    res.json({ message: "Notification marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Mark all notifications as read
router.patch("/read-all", auth, async (req, res) => {
  try {
    await Notification.updateMany(
      {
        recipient: req.user.userId,
        status: "unread",
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      },
      {
        status: "read",
        readAt: new Date(),
      }
    );

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Archive notification
router.patch("/:id/archive", auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.recipient.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    await notification.markAsArchived();
    res.json({ message: "Notification archived" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete notification
router.delete("/:id", auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Allow deletion by recipient or admin
    if (
      notification.recipient.toString() !== req.user.userId &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    await notification.markAsDeleted();
    res.json({ message: "Notification deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
