const express = require("express");
const { body, validationResult } = require("express-validator");
const Message = require("../models/Message");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

// Validation middleware
const validateMessage = [
  body("recipients")
    .isArray({ min: 1 })
    .withMessage("At least one recipient is required"),
  body("recipients.*").isMongoId().withMessage("Invalid recipient ID"),
  body("subject").trim().notEmpty().withMessage("Subject is required"),
  body("content").trim().notEmpty().withMessage("Content is required"),
  body("priority")
    .optional()
    .isIn(["low", "normal", "high"])
    .withMessage("Invalid priority"),
];

// Send a new message
router.post("/", auth, validateMessage, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      recipients,
      subject,
      content,
      priority,
      attachments,
      scheduledFor,
    } = req.body;

    // Verify all recipients exist
    const recipientUsers = await User.find({ _id: { $in: recipients } });
    if (recipientUsers.length !== recipients.length) {
      return res
        .status(400)
        .json({ message: "One or more recipients not found" });
    }

    // Create message
    const message = new Message({
      sender: req.user.userId,
      recipients: recipients.map((id) => ({ user: id })),
      subject,
      content,
      priority: priority || "normal",
      attachments: attachments || [],
      scheduledFor: scheduledFor || new Date(),
      type: recipients.length > 1 ? "group" : "direct",
    });

    await message.save();

    // Create notifications for recipients
    const notifications = recipients.map((recipientId) => ({
      recipient: recipientId,
      sender: req.user.userId,
      title: `New message: ${subject}`,
      message: content.substring(0, 100) + (content.length > 100 ? "..." : ""),
      type: "message",
      priority: priority || "medium",
      actionRequired: true,
      actionUrl: `/messages/${message._id}`,
      actionText: "View Message",
      relatedEntity: {
        entityType: "message",
        entityId: message._id,
      },
    }));

    await Notification.createBulk(notifications);

    await message.populate([
      { path: "sender", select: "name email" },
      { path: "recipients.user", select: "name email" },
    ]);

    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get messages for current user (inbox)
router.get("/", auth, async (req, res) => {
  try {
    const { type, status, unread, search, page = 1, limit = 20 } = req.query;
    const filter = {
      "recipients.user": req.user.userId,
      "recipients.deletedAt": { $exists: false },
    };

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (unread === "true") {
      filter["recipients.readAt"] = { $exists: false };
    }

    if (search) {
      filter.$or = [
        { subject: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find(filter)
      .populate("sender", "name email")
      .populate("recipients.user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments(filter);

    // Add read status for current user
    const messagesWithStatus = messages.map((message) => {
      const doc = message.toObject();
      doc.isRead = message.isReadBy(req.user.userId);
      doc.isDeleted = message.isDeletedBy(req.user.userId);
      return doc;
    });

    res.json({
      messages: messagesWithStatus,
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

// Get sent messages
router.get("/sent", auth, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const filter = { sender: req.user.userId };

    if (search) {
      filter.$or = [
        { subject: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find(filter)
      .populate("recipients.user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments(filter);

    res.json({
      messages,
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

// Get unread messages count
router.get("/unread/count", auth, async (req, res) => {
  try {
    const count = await Message.getUnreadCount(req.user.userId);
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get message by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate("sender", "name email")
      .populate("recipients.user", "name email")
      .populate("parentMessage")
      .populate("thread");

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Check if user is sender or recipient
    const isRecipient = message.recipients.some(
      (r) => r.user._id.toString() === req.user.userId
    );
    const isSender = message.sender._id.toString() === req.user.userId;

    if (!isRecipient && !isSender) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Mark as read if user is recipient
    if (isRecipient) {
      await message.markAsRead(req.user.userId);
    }

    const doc = message.toObject();
    doc.isRead = message.isReadBy(req.user.userId);
    doc.isDeleted = message.isDeletedBy(req.user.userId);

    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Reply to a message
router.post("/:id/reply", auth, validateMessage, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const parentMessage = await Message.findById(req.params.id);
    if (!parentMessage) {
      return res.status(404).json({ message: "Parent message not found" });
    }

    // Check if user is sender or recipient of parent message
    const isRecipient = parentMessage.recipients.some(
      (r) => r.user.toString() === req.user.userId
    );
    const isSender = parentMessage.sender.toString() === req.user.userId;

    if (!isRecipient && !isSender) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { recipients, subject, content, priority } = req.body;

    // Create reply message
    const replyMessage = new Message({
      sender: req.user.userId,
      recipients: recipients.map((id) => ({ user: id })),
      subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
      content,
      priority: priority || "normal",
      parentMessage: parentMessage._id,
      thread: parentMessage.thread || parentMessage._id,
      type: recipients.length > 1 ? "group" : "direct",
    });

    await replyMessage.save();

    // Update reply count in parent message
    parentMessage.metadata.replyCount += 1;
    await parentMessage.save();

    // Create notifications for recipients
    const notifications = recipients.map((recipientId) => ({
      recipient: recipientId,
      sender: req.user.userId,
      title: `Reply: ${subject}`,
      message: content.substring(0, 100) + (content.length > 100 ? "..." : ""),
      type: "message",
      priority: priority || "medium",
      actionRequired: true,
      actionUrl: `/messages/${replyMessage._id}`,
      actionText: "View Reply",
      relatedEntity: {
        entityType: "message",
        entityId: replyMessage._id,
      },
    }));

    await Notification.createBulk(notifications);

    await replyMessage.populate([
      { path: "sender", select: "name email" },
      { path: "recipients.user", select: "name email" },
    ]);

    res.status(201).json(replyMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Forward a message
router.post("/:id/forward", auth, validateMessage, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const originalMessage = await Message.findById(req.params.id);
    if (!originalMessage) {
      return res.status(404).json({ message: "Original message not found" });
    }

    // Check if user has access to the message
    const isRecipient = originalMessage.recipients.some(
      (r) => r.user.toString() === req.user.userId
    );
    const isSender = originalMessage.sender.toString() === req.user.userId;

    if (!isRecipient && !isSender) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { recipients, subject, content } = req.body;

    // Create forwarded message
    const forwardedMessage = new Message({
      sender: req.user.userId,
      recipients: recipients.map((id) => ({ user: id })),
      subject: subject.startsWith("Fwd:")
        ? subject
        : `Fwd: ${originalMessage.subject}`,
      content: `${content}\n\n--- Forwarded Message ---\n${originalMessage.content}`,
      type: recipients.length > 1 ? "group" : "direct",
      metadata: {
        isForwarded: true,
        originalMessage: originalMessage._id,
      },
    });

    await forwardedMessage.save();

    // Update forward count in original message
    originalMessage.metadata.forwardCount += 1;
    await originalMessage.save();

    await forwardedMessage.populate([
      { path: "sender", select: "name email" },
      { path: "recipients.user", select: "name email" },
    ]);

    res.status(201).json(forwardedMessage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Mark message as read
router.patch("/:id/read", auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    await message.markAsRead(req.user.userId);
    res.json({ message: "Message marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete message (soft delete)
router.delete("/:id", auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    await message.markAsDeleted(req.user.userId);
    res.json({ message: "Message deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get message thread
router.get("/:id/thread", auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const threadId = message.thread || message._id;
    const threadMessages = await Message.getThread(threadId);

    // Filter messages user has access to
    const accessibleMessages = threadMessages.filter((msg) => {
      const isRecipient = msg.recipients.some(
        (r) => r.user._id.toString() === req.user.userId
      );
      const isSender = msg.sender._id.toString() === req.user.userId;
      return isRecipient || isSender;
    });

    res.json(accessibleMessages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
