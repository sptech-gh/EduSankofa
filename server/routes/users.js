const express = require("express");
const User = require("../models/User");
const { auth, authorizeRoles } = require("../middleware/auth");
const router = express.Router();

// Get users by role (e.g., teachers)
router.get("/", auth, authorizeRoles("admin", "staff"), async (req, res) => {
  try {
    const { role } = req.query;
    const query = role ? { role } : {};

    const users = await User.find(query)
      .select("name email role")
      .sort({ name: 1 });

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server error",
      code: "USER_FETCH_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
