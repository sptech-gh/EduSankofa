const express = require("express");
const { body, validationResult } = require("express-validator");
const Announcement = require("../models/Announcement");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

const roleToAudienceKey = (role) => {
  if (role === "teacher") return "teachers";
  if (role === "student") return "students";
  if (role === "staff" || role === "accounts officer") return "staff";
  if (role === "admin") return "admin";
  if (role === "parent") return "parents";
  return role;
};

const audienceKeysToRoles = (audienceKeys) => {
  const keys = Array.isArray(audienceKeys) ? audienceKeys : [];
  const roleSet = new Set();

  if (keys.includes("all")) {
    ["admin", "teacher", "student", "staff", "accounts officer", "parent"].forEach(
      (r) => roleSet.add(r)
    );
    return Array.from(roleSet);
  }

  keys.forEach((key) => {
    if (key === "teachers") roleSet.add("teacher");
    if (key === "students") roleSet.add("student");
    if (key === "staff") {
      roleSet.add("staff");
      roleSet.add("accounts officer");
    }
    if (key === "admin") roleSet.add("admin");
    if (key === "parents") roleSet.add("parent");
  });

  return Array.from(roleSet);
};

const createAnnouncementNotifications = async ({ announcement, senderId }) => {
  if (!announcement || announcement.status !== "published") return;

  const audienceRoles = audienceKeysToRoles(announcement.targetAudience);
  if (audienceRoles.length === 0) return;

  const recipients = await User.find({
    role: { $in: audienceRoles },
    status: "active",
  }).select("_id");

  const recipientIds = recipients
    .map((u) => u._id.toString())
    .filter((id) => id !== String(senderId));

  if (recipientIds.length === 0) return;

  const notifications = recipientIds.map((recipientId) => ({
    recipient: recipientId,
    sender: senderId,
    title: announcement.title,
    message:
      announcement.content.substring(0, 140) +
      (announcement.content.length > 140 ? "..." : ""),
    type: "announcement",
    priority: announcement.priority,
    actionUrl: `/announcements/${announcement._id}`,
    actionText: "View Announcement",
    relatedEntity: {
      entityType: "announcement",
      entityId: announcement._id,
    },
  }));

  await Notification.createBulk(notifications);
};

// Validation middleware
const validateAnnouncement = [
  body("title").trim().notEmpty().withMessage("Title is required"),
  body("content").trim().notEmpty().withMessage("Content is required"),
  body("priority")
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Invalid priority level"),
  body("category")
    .isIn([
      "general",
      "academic",
      "event",
      "emergency",
      "maintenance",
      "holiday",
    ])
    .withMessage("Invalid category"),
  body("targetAudience")
    .isArray()
    .withMessage("Target audience must be an array"),
  body("targetAudience.*")
    .isIn(["all", "students", "teachers", "staff", "parents", "admin"])
    .withMessage("Invalid target audience"),
];

// Create announcement
router.post(
  "/",
  auth,
  authorizeRoles("admin", "staff"),
  validateAnnouncement,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const announcement = new Announcement({
        ...req.body,
        author: req.user.userId,
      });

      await announcement.save();

      // Create notifications for target audience
      if (announcement.status === "published") {
        // TODO: Implement user filtering based on target audience
        // This would typically query users based on their roles that match the target audience
        // For now, we'll just create a placeholder for the notification creation logic
        // Example notification creation (to be implemented with actual user filtering):
        // const targetUsers = await User.find({ role: { $in: announcement.targetAudience } });
        // const notifications = targetUsers.map(user => ({
        //   recipient: user._id,
        //   sender: req.user.userId,
        //   title: announcement.title,
        //   message: announcement.content,
        //   type: "announcement",
        //   priority: announcement.priority,
        //   relatedEntity: {
        //     entityType: "announcement",
        //     entityId: announcement._id,
        //   },
        // }));
        // await Notification.createBulk(notifications);
        await createAnnouncementNotifications({
          announcement,
          senderId: req.user.userId,
        });
      }

      await announcement.populate("author", "name email");
      res.status(201).json(announcement);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get all announcements with filtering
router.get("/", auth, async (req, res) => {
  try {
    const { status, priority, category, targetAudience, from, to, search } =
      req.query;

    const filter = {};

    // Basic filters
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (targetAudience) {
      filter.$or = [
        { targetAudience: "all" },
        { targetAudience: targetAudience },
      ];
    }

    // Date range filter
    if (from || to) {
      filter.scheduledDate = {};
      if (from) filter.scheduledDate.$gte = new Date(from);
      if (to) filter.scheduledDate.$lte = new Date(to);
    }

    // Search in title and content
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    // Only show published announcements to non-admin users
    if (!["admin", "staff"].includes(req.user.role)) {
      const audienceKey = roleToAudienceKey(req.user.role);
      filter.status = "published";
      filter.scheduledDate = { $lte: new Date() };
      filter.$and = [
        {
          $or: [
            { expiryDate: { $exists: false } },
            { expiryDate: { $gt: new Date() } },
          ],
        },
        { $or: [{ targetAudience: "all" }, { targetAudience: audienceKey }] },
      ];
    }

    const announcements = await Announcement.find(filter)
      .populate("author", "name email")
      .sort({ isSticky: -1, scheduledDate: -1, createdAt: -1 });

    // Add read status for the current user
    const announcementsWithReadStatus = announcements.map((announcement) => {
      const doc = announcement.toObject();
      doc.isRead = announcement.isReadBy(req.user.userId);
      return doc;
    });

    res.json(announcementsWithReadStatus);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get unread announcements count
router.get("/unread/count", auth, async (req, res) => {
  try {
    const audienceKey = roleToAudienceKey(req.user.role);
    const count = await Announcement.countDocuments({
      status: "published",
      scheduledDate: { $lte: new Date() },
      $and: [
        {
          $or: [
            { expiryDate: { $exists: false } },
            { expiryDate: { $gt: new Date() } },
          ],
        },
        { "readBy.user": { $ne: req.user.userId } },
        { $or: [{ targetAudience: "all" }, { targetAudience: audienceKey }] },
      ],
    });

    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get announcement by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate("author", "name email")
      .populate("readBy.user", "name email");

    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    // Increment view count
    announcement.viewCount += 1;
    await announcement.save();

    // Convert to object and add read status
    const doc = announcement.toObject();
    doc.isRead = announcement.isReadBy(req.user.userId);

    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update announcement
router.put(
  "/:id",
  auth,
  authorizeRoles("admin", "staff"),
  validateAnnouncement,
  async (req, res) => {
    try {
      const existing = await Announcement.findById(req.params.id).select(
        "status"
      );
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const announcement = await Announcement.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      ).populate("author", "name email");

      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      if (
        announcement.status === "published" &&
        (!existing || existing.status !== "published")
      ) {
        await createAnnouncementNotifications({
          announcement,
          senderId: req.user.userId,
        });
      }

      res.json(announcement);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete announcement
router.delete("/:id", auth, authorizeRoles("admin"), async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    // Delete related notifications
    await Notification.deleteMany({
      "relatedEntity.entityType": "announcement",
      "relatedEntity.entityId": announcement._id,
    });

    res.json({ message: "Announcement deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Mark announcement as read
router.post("/:id/read", auth, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    announcement.markAsRead(req.user.userId);
    await announcement.save();

    res.json({ message: "Announcement marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
