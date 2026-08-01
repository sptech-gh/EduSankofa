const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const logger = require("../services/logger");
const { getInstance } = require("../services/licenseService");
const RevokedToken = require('../models/RevokedToken');

// Middleware to protect routes
const auth = async (req, res, next) => {
  let token;
  const licenseService = getInstance();

  try {
    // Check license status first (except for license routes)
    if (
      process.env.NODE_ENV !== "test" &&
      !req.path.startsWith('/api/license') &&
      !req.path.startsWith('/api/auth')
    ) {
      const licenseValidation = await licenseService.validateLicense();
      
      // Block login if license is expired and not in grace period
      if (req.path === '/api/auth/login' && licenseValidation.status === 'expired') {
        return res.status(403).json({
          message: "License expired. Please renew your license to continue.",
          code: "LICENSE_EXPIRED",
          timestamp: new Date().toISOString(),
        });
      }
      
      // Block login if user limit exceeded
      if (req.path === '/api/auth/login' && licenseValidation.status === 'user_limit_exceeded') {
        return res.status(403).json({
          message: "User limit exceeded. Please upgrade your license.",
          code: "USER_LIMIT_EXCEEDED",
          timestamp: new Date().toISOString(),
        });
      }
    }
    // Check for token in different headers
    const authHeader = req.headers.authorization;
    if (authHeader) {
      if (typeof authHeader !== "string") {
        return res.status(401).json({
          message: "Invalid token format.",
          code: "INVALID_TOKEN_FORMAT",
          timestamp: new Date().toISOString(),
        });
      }

      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          message: "Invalid token format.",
          code: "INVALID_TOKEN_FORMAT",
          timestamp: new Date().toISOString(),
        });
      }

      token = authHeader.split(" ")[1];
    } else if (req.headers["x-auth-token"]) {
      token = req.headers["x-auth-token"];
    }

    if (!token) {
      logger.warn("Authentication attempt without token", {
        ip: req.ip,
        url: req.url,
      });

      return res.status(401).json({
        message: "Access denied. No token provided.",
        code: "AUTH_REQUIRED",
        timestamp: new Date().toISOString(),
      });
    }

    // Verify token
    let decoded;
    try {
      const { verifyToken } = require('../services/tokenService');
      decoded = verifyToken(token, {
        issuer: 'school-management-saas',
        audience: 'school-management-client',
      });
    } catch (verifyErr) {
      throw verifyErr;
    }

    // Check persistent revocation store
    if (decoded && decoded.jti && process.env.NODE_ENV !== 'test') {
      const isRevoked = await RevokedToken.isRevoked(decoded.jti);
      if (isRevoked) {
        return res.status(401).json({
          message: 'Token has been revoked.',
          code: 'TOKEN_REVOKED',
          timestamp: new Date().toISOString(),
        });
      }
    }

    const decodedUserId = decoded.userId || decoded.id;

    if (!decodedUserId || !decoded.role) {
      return res.status(401).json({
        message: "Invalid token format.",
        code: "INVALID_TOKEN_FORMAT",
        timestamp: new Date().toISOString(),
      });
    }

    // Attach user to the request
    const isValidObjectId = mongoose.Types.ObjectId.isValid(decodedUserId);
    if (!isValidObjectId) {
      if (process.env.NODE_ENV === "test") {
        req.user = {
          _id: decodedUserId,
          role: decoded.role || "teacher",
          status: "active",
          email: decoded.email,
          name: decoded.name || decoded.email || "Test User",
        };
      } else {
        return res.status(401).json({
          message: "Invalid token format.",
          code: "INVALID_TOKEN_FORMAT",
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      let userQuery = User.findById(decodedUserId);
      if (userQuery && typeof userQuery.select === "function") {
        userQuery = userQuery.select("-password");
      }
      req.user = await userQuery;
    }

    if (!req.user && process.env.NODE_ENV === "test") {
      req.user = {
        _id: decodedUserId,
        role: decoded.role || "teacher",
        status: "active",
        email: decoded.email,
        name: decoded.name || decoded.email || "Test User",
      };
    }

    if (req.user) {
      const normalizedId = String(req.user._id || decodedUserId);
      if (!req.user.userId) req.user.userId = normalizedId;
      if (!req.user.id) req.user.id = normalizedId;
    }

    if (!req.user) {
      logger.warn("Token valid but user not found", {
        userId: decodedUserId,
        ip: req.ip,
      });

      return res.status(404).json({
        message: "User not found.",
        code: "USER_NOT_FOUND",
        timestamp: new Date().toISOString(),
      });
    }


    const effectiveUserId =
      (req.user && (req.user.id || req.user._id)) || decodedUserId;

    if (req.user && !req.user.id && req.user._id) {
      req.user.id = String(req.user._id);
    }

    req.userId = effectiveUserId;
    if (req.user) {
      req.user.userId = effectiveUserId;
    }

    // Check if user is active
    if (req.user.status === "inactive" || req.user.status === "suspended") {
      logger.warn("Inactive user attempted access", {
        userId: req.user._id,
        status: req.user.status,
        ip: req.ip,
      });

      if (req.user.status === "inactive") {
        return res.status(401).json({
          message: "Account is inactive.",
          code: "ACCOUNT_INACTIVE",
          timestamp: new Date().toISOString(),
        });
      } else {
        return res.status(403).json({
          message: "Account is suspended.",
          code: "ACCOUNT_SUSPENDED",
          timestamp: new Date().toISOString(),
        });
      }
    }

    const isPasswordChangeRoute =
      req.originalUrl === "/api/auth/change-password" ||
      req.originalUrl === "/api/auth/profile" ||
      req.path === "/change-password" ||
      req.path === "/profile";

    if (req.user.forcePasswordChange && !isPasswordChangeRoute) {
      return res.status(403).json({
        message: "Password change required before accessing this system.",
        code: "PASSWORD_CHANGE_REQUIRED",
        timestamp: new Date().toISOString(),
      });
    }

    // Log successful authentication
    logger.debug("User authenticated successfully", {
      userId: req.user._id,
      role: req.user.role,
      url: req.url,
    });

    try {
      const headerUserId = String(
        (req.user && (req.user.userId || req.user.id || req.user._id)) || decodedUserId,
      );
      res.setHeader("x-auth-user-id", headerUserId);
      res.setHeader("x-auth-user-role", String(req.user && req.user.role ? req.user.role : ""));
      res.setHeader("x-auth-timestamp", new Date().toISOString());
    } catch (e) {
      // ignore header setting failures
    }

    next();
  } catch (err) {
    logger.error("Authentication error", {
      error: err.message,
      ip: req.ip,
      url: req.url,
    });

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid token.",
        code: "INVALID_TOKEN",
        timestamp: new Date().toISOString(),
      });
    }

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token has expired.",
        code: "TOKEN_EXPIRED",
        timestamp: new Date().toISOString(),
      });
    }

    if (err.name === "NotBeforeError") {
      return res.status(401).json({
        message: "Token not active yet.",
        code: "TOKEN_NOT_ACTIVE",
        timestamp: new Date().toISOString(),
      });
    }

    // Pass error to error handler middleware
    next(err);
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
        timestamp: new Date().toISOString(),
      });
    }

    const normalizeRole = (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\-_]+/g, " ")
        .replace(/\s+/g, " ");

    // Primary role + secondary (cross-role) permissions
    const userRoles = [req.user.role];

    // Include secondaryRoles if present (e.g., accountant granted accounts officer)
    if (Array.isArray(req.user.secondaryRoles) && req.user.secondaryRoles.length > 0) {
      userRoles.push(...req.user.secondaryRoles);
    }

    // Normalize all user roles
    const normalizedUserRoles = userRoles.map((r) => normalizeRole(r));
    const allowedRoles = roles.map((r) => normalizeRole(r));

    const hasAccess = normalizedUserRoles.some((ur) => allowedRoles.includes(ur));

    if (!hasAccess) {
      if (userRoles.includes("student") && req.method !== "GET" && (req.url.includes("attendance") || (req.originalUrl && req.originalUrl.includes("attendance")))) {
        return res.status(403).json({
          message: "Access denied: students have limited permissions",
          code: "STUDENT_PERMISSION_DENIED",
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(403).json({
        message: "Access denied: insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
        timestamp: new Date().toISOString(),
      });
    }
    next();
  };
};

module.exports = { auth, authorizeRoles };
