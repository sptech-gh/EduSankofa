const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const User = require("../models/User");

// @route   POST /security/2fa
// @desc    Enable or verify two-factor authentication (mock implementation)
// @access  Private
router.post("/2fa", auth, async (req, res) => {
  try {
    const { action, code } = req.body;

    if (!action) {
      return res.status(400).json({ msg: "Action is required" });
    }

    // Mock 2FA logic
    if (action === "enable") {
      // Enable 2FA for user (mock)
      console.log(`2FA enabled for user ${req.user.id}`);
      return res.json({ msg: "Two-factor authentication enabled" });
    } else if (action === "verify") {
      if (!code) {
        return res.status(400).json({ msg: "Verification code is required" });
      }
      // Verify 2FA code (mock)
      if (code === "123456") {
        return res.json({ msg: "Two-factor authentication verified" });
      } else {
        return res.status(400).json({ msg: "Invalid verification code" });
      }
    } else {
      return res.status(400).json({ msg: "Invalid action" });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /security/audit-logs
// @desc    Get audit logs (mock implementation)
// @access  Private
router.get("/audit-logs", auth, async (req, res) => {
  try {
    // Mock audit logs data
    const logs = [
      {
        id: 1,
        action: "User login",
        userId: req.user.id,
        timestamp: new Date(),
      },
      {
        id: 2,
        action: "Password change",
        userId: req.user.id,
        timestamp: new Date(),
      },
    ];
    res.json(logs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
