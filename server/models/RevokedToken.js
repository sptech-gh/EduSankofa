/**
 * RevokedToken.js
 * Persistent JWT revocation store using MongoDB with a TTL index.
 *
 * Replaces the in-memory global.__REVOKED_TOKENS__ Set that was wiped on
 * every server restart, making logout ineffective after restarts.
 *
 * FINDING ADDRESSED:
 *   FINDING-002 — Token revocation wiped on server restart
 *
 * HOW IT WORKS:
 *   - On logout, the token's JTI (JWT ID claim) is stored here.
 *   - MongoDB's TTL index automatically deletes entries after the token's
 *     natural expiry, so the collection stays lean.
 *   - On each authenticated request, auth middleware checks this collection.
 */

const mongoose = require("mongoose");

const revokedTokenSchema = new mongoose.Schema({
  jti: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  revokedAt: {
    type: Date,
    default: Date.now,
  },
  // TTL index: MongoDB will automatically delete the document after `expiresAt`.
  // Set this to the token's `exp` timestamp so revocation entries are self-cleaning.
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // TTL index: remove document when expiresAt is reached
  },
  reason: {
    type: String,
    enum: ["logout", "session_revoke", "password_change", "admin_revoke"],
    default: "logout",
  },
});

/**
 * Check whether a given JTI has been revoked.
 * @param {string} jti
 * @returns {Promise<boolean>}
 */
revokedTokenSchema.statics.isRevoked = async function (jti) {
  if (!jti) return false;
  const doc = await this.findOne({ jti }).select("_id").lean();
  return !!doc;
};

/**
 * Revoke a token by its JTI.
 * @param {string} jti - JWT ID from decoded token payload
 * @param {number} exp - JWT exp timestamp (seconds since epoch)
 * @param {string} userId - owning user ID
 * @param {string} reason - why the token was revoked
 */
revokedTokenSchema.statics.revoke = async function (jti, exp, userId, reason = "logout") {
  if (!jti) return;
  const expiresAt = exp ? new Date(exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await this.findOneAndUpdate(
    { jti },
    { jti, userId, expiresAt, reason, revokedAt: new Date() },
    { upsert: true }
  );
};

module.exports = mongoose.model("RevokedToken", revokedTokenSchema);
