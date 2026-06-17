const express = require("express");
const { body, validationResult } = require("express-validator");
const SchoolProfile = require("../models/SchoolProfile");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

const validateProfile = [
  body("schoolName").optional().trim().notEmpty().withMessage("schoolName cannot be empty"),
  body("email").optional().isEmail().withMessage("Invalid email"),
  body("logoUrl").optional().isString(),
];

const getOrCreateProfile = async () => {
  let doc = await SchoolProfile.findOne({ key: "default" });
  if (!doc) {
    doc = new SchoolProfile({ key: "default" });
    await doc.save();
  }
  return doc;
};

router.get("/", auth, async (req, res) => {
  try {
    const doc = await getOrCreateProfile();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.put(
  "/",
  auth,
  authorizeRoles("admin", "staff"),
  validateProfile,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const doc = await getOrCreateProfile();

      const fields = [
        "schoolName",
        "motto",
        "address",
        "city",
        "region",
        "phone",
        "email",
        "logoUrl",
      ];

      fields.forEach((field) => {
        if (req.body[field] !== undefined) {
          doc[field] = req.body[field];
        }
      });

      await doc.save();
      res.json(doc);
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
