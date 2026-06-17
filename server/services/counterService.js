/**
 * counterService.js
 * Atomic, race-condition-safe counter for sequential ID generation.
 *
 * Uses MongoDB's findOneAndUpdate with $inc to atomically increment a sequence.
 * This replaces the "findOne + sort + increment" pattern that caused race conditions
 * in student ID and receipt number generation.
 *
 * FINDINGS ADDRESSED:
 *   FINDING-013 — Race condition in student ID / admission number generation
 *   FINDING-018 — Race condition in receipt number generation
 */

const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // counter key e.g. "studentId-2026"
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

/**
 * Atomically increment and return the next sequence number for a given key.
 * @param {string} key - unique counter identifier (e.g. "studentId-2026")
 * @returns {Promise<number>} next sequence number (1-indexed)
 */
const nextSeq = async (key, session = null) => {
  const options = { upsert: true, new: true };
  if (session) options.session = session;
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    options
  );
  return doc.seq;
};

module.exports = { nextSeq, Counter };
