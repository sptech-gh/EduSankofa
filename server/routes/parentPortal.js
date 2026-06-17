const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const Student = require("../models/Student");
const User = require("../models/User");

// @route   GET /parent-portal
// @desc    Get parent portal data for authenticated parent
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    // Assuming user role is stored in req.user.role
    if (req.user.role !== "parent") {
      return res.status(403).json({ msg: "Access denied" });
    }

    // Find the student(s) linked to this parent
    const students = await Student.find({ parentId: req.user.id });

    res.json({ students });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
