const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");
const { auth } = require("../middleware/auth");
const Exam = require("../models/Exam");

// @route   POST /exams
// @desc    Create a new exam
// @access  Private
router.post(
  "/",
  [
    auth,
    check("title", "Title is required").not().isEmpty(),
    check("date", "Valid date is required").isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, date, questions } = req.body;

    try {
      const newExam = new Exam({
        title,
        date,
        questions,
        createdBy: req.user.id,
      });

      const exam = await newExam.save();
      res.json(exam);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server error");
    }
  }
);

// @route   GET /exams
// @desc    Get all exams
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const exams = await Exam.find().sort({ date: 1 });
    res.json(exams);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /exams/:id
// @desc    Get exam by ID
// @access  Private
router.get("/:id", auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ msg: "Exam not found" });
    }
    res.json(exam);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Exam not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   POST /exams/:id/submit
// @desc    Submit exam answers and get results
// @access  Private
router.post("/:id/submit", auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ msg: "Exam not found" });
    }

    const { answers } = req.body; // Array of { questionId, answer }

    let score = 0;
    exam.questions.forEach((question) => {
      const userAnswer = answers.find(
        (a) => a.questionId.toString() === question._id.toString()
      );
      if (userAnswer && userAnswer.answer === question.correctAnswer) {
        score += 1;
      }
    });

    res.json({ score, total: exam.questions.length });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
