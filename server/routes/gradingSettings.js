const express = require("express");
const { body, validationResult } = require("express-validator");
const GradingSettings = require("../models/GradingSettings");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

const validateSettings = [
  body("gradingScale").optional().isIn(["ghana", "us"]),
  body("classworkWeight")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("classworkWeight must be between 0 and 1"),
  body("examWeight")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("examWeight must be between 0 and 1"),
  body().custom((payload) => {
    if (payload.classworkWeight === undefined && payload.examWeight === undefined) {
      return true;
    }

    const cw = payload.classworkWeight === undefined ? null : Number(payload.classworkWeight);
    const ex = payload.examWeight === undefined ? null : Number(payload.examWeight);

    const cwVal = cw === null ? undefined : cw;
    const exVal = ex === null ? undefined : ex;

    const sum = (cwVal || 0) + (exVal || 0);
    if (Math.abs(sum - 1) > 0.0001) {
      throw new Error("classworkWeight + examWeight must equal 1");
    }

    return true;
  }),
];

const getOrCreateSettings = async () => {
  let doc = await GradingSettings.findOne({ key: "default" });
  if (!doc) {
    doc = new GradingSettings({ key: "default" });
    await doc.save();
  }
  return doc;
};

router.get("/", auth, async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.put(
  "/",
  auth,
  authorizeRoles("admin", "staff"),
  validateSettings,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const doc = await getOrCreateSettings();

      if (req.body.gradingScale !== undefined) doc.gradingScale = req.body.gradingScale;
      if (req.body.classworkWeight !== undefined)
        doc.classworkWeight = Number(req.body.classworkWeight);
      if (req.body.examWeight !== undefined) doc.examWeight = Number(req.body.examWeight);

      await doc.save();
      res.json(doc);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
