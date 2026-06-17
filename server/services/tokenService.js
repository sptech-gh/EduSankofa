/**
 * tokenService.js
 * Centralised JWT token generation for EduSankofa SMS.
 *
 * SECURITY: This module MUST NOT fall back to any hardcoded secret.
 * JWT_SECRET must be set in the environment before this module is used.
 *
 * FINDINGS ADDRESSED:
 *   FINDING-003 — Removed all || "test-jwt-secret" fallbacks
 *   FINDING-029 — Single source of truth for token generation
 */

const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

/**
 * Validate that JWT_SECRET is configured. Called at startup.
 * Throws a fatal error if the secret is missing or is the unsafe placeholder.
 */
const assertJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is not set. " +
      "Set a cryptographically random 32+ character string in your deployment environment."
    );
  }
  if (secret === "CHANGE_ME_USE_A_32_CHAR_RANDOM_SECRET_IN_PRODUCTION") {
    throw new Error(
      "FATAL: JWT_SECRET is still set to the placeholder value. " +
      "Replace it with a real 32+ character random secret before deploying."
    );
  }
  if (secret === "test-jwt-secret") {
    throw new Error(
      "FATAL: JWT_SECRET must not be set to the insecure fallback value 'test-jwt-secret'."
    );
  }
  // In test environment, allow short secrets but warn
  if (process.env.NODE_ENV !== "test" && secret.length < 32) {
    throw new Error(
      `FATAL: JWT_SECRET is only ${secret.length} characters. ` +
      "Use a minimum of 32 random characters for production."
    );
  }
};

/**
 * Sign a short-lived access token.
 * @param {object} payload - { userId, role, email }
 * @returns {string} signed JWT
 */
const signAccessToken = (payload) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  return jwt.sign(
    {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
      jti: randomUUID(),
      iss: "school-management-saas",
      aud: "school-management-client",
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "24h",
      algorithm: "HS256",
    }
  );
};

/**
 * Sign a refresh token.
 * @param {object} payload - { userId, tokenVersion }
 * @returns {string} signed JWT
 */
const signRefreshToken = (payload) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  return jwt.sign(
    {
      userId: payload.userId,
      tokenVersion: payload.tokenVersion || 0,
      jti: randomUUID(),
    },
    secret,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
      algorithm: "HS256",
    }
  );
};

/**
 * Verify and decode a token.
 * @param {string} token
 * @param {object} [options] - additional jwt.verify options
 * @returns {object} decoded payload
 */
const verifyToken = (token, options = {}) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  return jwt.verify(token, secret, {
    algorithms: ["HS256"],
    ...options,
  });
};

module.exports = { assertJwtSecret, signAccessToken, signRefreshToken, verifyToken };
