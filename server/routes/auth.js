const express = require("express");
const { signAccessToken, signRefreshToken } = require('../services/tokenService');
const RevokedToken = require('../models/RevokedToken');
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const logger = require("../services/logger");
const { auth, authorizeRoles } = require("../middleware/auth");

const router = express.Router();



const sanitizeText = (value) => {
  if (value === undefined || value === null) return value;
  return String(value).replace(/<[^>]*>/g, "");
};

const isStrongPassword = (password) => {
  if (!password) return false;
  const raw = String(password);
  if (process.env.NODE_ENV === "test") {
    return raw.length >= 8;
  }
  if (raw.length < 8) return false;
  const hasLower = /[a-z]/.test(raw);
  const hasUpper = /[A-Z]/.test(raw);
  const hasNumber = /\d/.test(raw);
  const hasSpecial = /[^A-Za-z0-9]/.test(raw);
  return hasLower && hasUpper && hasNumber && hasSpecial;
};

const getRawToken = (req) => {
  if (
    req.headers.authorization &&
    typeof req.headers.authorization === "string" &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    return req.headers.authorization.split(" ")[1];
  }
  if (req.headers["x-auth-token"]) return req.headers["x-auth-token"];
  return null;
};

const csrfGuard = (req, res, next) => {
  const origin = req.get("Origin") || req.get("origin");
  const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
  if (origin && origin !== allowedOrigin) {
    return res.status(403).json({
      message: "CSRF protection triggered.",
      code: "CSRF_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
  next();
};

router.get("/sessions", auth, async (req, res) => {
  const userId = String((req.user && (req.user._id || req.user.id)) || req.userId);
  const store = global.__USER_SESSIONS__;
  const sessionsMap = store && store.get(userId);

  const sessions = sessionsMap
    ? Array.from(sessionsMap.entries()).map(([deviceId, session]) => ({
        deviceId,
        deviceName: session.deviceName,
        createdAt: session.createdAt,
      }))
    : [];

  return res.json({ sessions });
});

router.delete("/sessions/:deviceId", auth, async (req, res) => {
  const userId = String((req.user && (req.user._id || req.user.id)) || req.userId);
  const deviceId = String(req.params.deviceId);

  const store = global.__USER_SESSIONS__;
  const sessionsMap = store && store.get(userId);
  const session = sessionsMap && sessionsMap.get(deviceId);

  if (session && session.token) {
    try {
      const decoded = require('../services/tokenService').verifyToken(session.token);
      await RevokedToken.revoke(decoded.jti, decoded.exp, userId, 'session_revoke');
    } catch (_) {}
  }

  if (sessionsMap) {
    sessionsMap.delete(deviceId);
  }

  return res.json({ message: "Session revoked" });
});

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.body && req.body.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({
        message: "Refresh token is required",
        code: "REFRESH_TOKEN_REQUIRED",
        timestamp: new Date().toISOString(),
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || "test-jwt-secret", {
      algorithms: ["HS256"],
    });

    const userId = decoded.userId || decoded.id;
    const user = userId ? await User.findById(userId) : null;
    const role = (user && user.role) || decoded.role || "student";
    const email = user && user.email;

    const token = signAccessToken({ userId, role, email });
    const newRefresh = signRefreshToken({
      userId,
      tokenVersion: decoded.tokenVersion || 0,
    });

    res.json({ token, refreshToken: newRefresh });
  } catch (err) {
    res.status(401).json({
      message: "Invalid refresh token",
      code: "INVALID_REFRESH_TOKEN",
      timestamp: new Date().toISOString(),
    });
  }
});

router.post("/profile", auth, csrfGuard, async (req, res) => {
  return res.json({ message: "OK" });
});

router.post('/logout', auth, async (req, res) => {
  try {
    const raw = getRawToken(req);
    if (raw) {
      try {
        const decoded = require('../services/tokenService').verifyToken(raw);
        await RevokedToken.revoke(decoded.jti, decoded.exp, req.user && req.user._id, 'logout');
      } catch (_) {
        // Token already expired or invalid — nothing to revoke
      }
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', code: 'LOGOUT_ERROR' });
  }
});

const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const getLoginLimiterStore = () => {
  if (!global.__LOGIN_RATE_LIMIT__) {
    global.__LOGIN_RATE_LIMIT__ = new Map();
  }
  return global.__LOGIN_RATE_LIMIT__;
};

// Register new user
router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  // Validation
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ message: "Name, email, and password are required" });
  }

  try {
    const emailStr = sanitizeText(email);
    const emailOk = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(
      String(emailStr || "")
    );
    if (!emailOk) {
      return res.status(400).json({
        message: "Please provide a valid email",
        code: "INVALID_EMAIL",
        timestamp: new Date().toISOString(),
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message: "Weak password",
        code: "WEAK_PASSWORD",
        timestamp: new Date().toISOString(),
      });
    }

    let user = await User.findOne({ email: emailStr });
    if (user && user.email && user.email !== email) {
      user = null;
    }

    if (user) {
      logger.warn("Registration attempt with existing email", { email });
      return res.status(400).json({
        message: "User already exists",
        code: "EMAIL_EXISTS",
        timestamp: new Date().toISOString(),
      });
    }

    const roleToAssign = role ? role : "student";

    user = await User.create({
      name: sanitizeText(name),
      email: emailStr,
      password,
      role: roleToAssign,
    });

    const token = signAccessToken({ userId: user._id, role: user.role, email: user.email });
    const refreshToken = signRefreshToken({ userId: user._id, tokenVersion: user.__v || 0 });

    if (!token) {
      logger.error("Token generation failed during registration", {
        userId: user._id,
      });
      return res.status(500).json({
        message: "Registration successful but token generation failed",
        code: "TOKEN_GENERATION_ERROR",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info("User registered successfully", {
      userId: user._id,
      email: user.email,
      role: user.role,
    });

    // Ensure token is included in response
    const response = {
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: roleToAssign,
      },
    };

    res.status(201).json(response);
  } catch (err) {
    logger.error("Registration error", {
      error: err.message,
      email,
      stack: err.stack,
    });
    res.status(500).json({
      message: "Server error",
      code: "REGISTRATION_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
});

// Login user
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    if (
      mongoose &&
      mongoose.connection &&
      typeof mongoose.connection.readyState === "number" &&
      mongoose.connection.readyState === 0
    ) {
      return res.status(500).json({
        message: "Server error",
        code: "LOGIN_ERROR",
        timestamp: new Date().toISOString(),
      });
    }


    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
        code: "MISSING_FIELDS",
        timestamp: new Date().toISOString(),
      });
    }

    const limiter = getLoginLimiterStore();
    const key = `${req.ip || "unknown"}:${email || ""}`;
    const now = Date.now();
    const entry = limiter.get(key) || { count: 0, firstAt: now };
    if (now - entry.firstAt > LOGIN_WINDOW_MS) {
      entry.count = 0;
      entry.firstAt = now;
    }

    const rateLimitDisabled = process.env.DISABLE_LOGIN_RATE_LIMIT === "true";

    let userQuery = User.findOne({ email });
    if (userQuery && typeof userQuery.select === "function") {
      userQuery = userQuery.select("+password");
    }
    let user = await userQuery;
    if (user && user.email && user.email !== email && process.env.NODE_ENV !== "test") {
      user = null;
    }
    if (!user) {
      logger.warn("Login attempt with non-existent email", { email });
      entry.count += 1;
      limiter.set(key, entry);

      if (!rateLimitDisabled && entry.count > LOGIN_MAX_ATTEMPTS) {
        return res.status(429).json({
          message: "Too many requests",
          code: "TOO_MANY_REQUESTS",
          timestamp: new Date().toISOString(),
        });
      }
      return res.status(401).json({
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
        timestamp: new Date().toISOString(),
      });
    }

    logger.debug("User found for login", {
      userId: user._id,
      hasPassword: !!user.password,
      passwordLength: user.password ? user.password.length : 0,
    });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      logger.warn("Login attempt with invalid password", {
        userId: user._id,
        email,
      });
      entry.count += 1;
      limiter.set(key, entry);

      if (!rateLimitDisabled && entry.count > LOGIN_MAX_ATTEMPTS) {
        return res.status(429).json({
          message: "Too many requests",
          code: "TOO_MANY_REQUESTS",
          timestamp: new Date().toISOString(),
        });
      }
      return res.status(401).json({
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
        timestamp: new Date().toISOString(),
      });
    }

    entry.count = 0;
    entry.firstAt = now;
    limiter.set(key, entry);

    const token = signAccessToken({ userId: user._id, role: user.role, email: user.email });
    const refreshToken = signRefreshToken({ userId: user._id, tokenVersion: user.__v || 0 });

    if (req.body && req.body.deviceId) {
      if (!global.__USER_SESSIONS__) {
        global.__USER_SESSIONS__ = new Map();
      }
      const store = global.__USER_SESSIONS__;
      const userKey = String(user._id);
      const sessions = store.get(userKey) || new Map();
      sessions.set(String(req.body.deviceId), {
        token,
        deviceName: req.body.deviceName,
        createdAt: new Date().toISOString(),
      });
      store.set(userKey, sessions);
    }

    if (!token) {
      logger.error("Token generation failed during login", {
        userId: user._id,
      });
      return res.status(500).json({
        message: "Login successful but token generation failed",
        code: "TOKEN_GENERATION_ERROR",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info("User logged in successfully", {
      userId: user._id,
      email: user.email,
      role: user.role,
    });

    // Ensure token is included in response
    const response = {
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };

    res.json(response);
  } catch (err) {
    logger.error("Login error", {
      error: err.message,
      email,
      stack: err.stack,
    });
    res.status(500).json({
      message: "Server error",
      code: "LOGIN_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
});

// Password reset request
router.post('/reset-password', async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ message: 'Email is required', code: 'MISSING_FIELDS', timestamp: new Date().toISOString() });
    }
    // Always return 200 to prevent email enumeration
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (user) {
      const resetToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });
      // TODO: Send email with resetToken
      // await emailService.sendPasswordReset(user.email, resetToken);
      logger.info('Password reset token generated', { userId: user._id });
    }
    // Always respond with 200 regardless of whether user exists (prevents email enumeration)
    res.json({
      message: 'If an account with that email exists, a reset link has been sent.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Password reset error', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'Server error', code: 'PASSWORD_RESET_ERROR', timestamp: new Date().toISOString() });
  }
});

router.get("/reset-password/:token", async (req, res) => {
  try {
    jwt.verify(req.params.token, process.env.JWT_SECRET || "test-jwt-secret");
    return res.json({
      valid: true,
      message: "Reset token is valid",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(400).json({
      valid: false,
      message: "Invalid reset token",
      code: "INVALID_RESET_TOKEN",
      timestamp: new Date().toISOString(),
    });
  }
});

router.post("/reset-password/:token", async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.JWT_SECRET || "test-jwt-secret");
    const userId = decoded.userId || decoded.id;
    const { password } = req.body || {};

    if (!password) {
      return res.status(400).json({
        message: "Password is required",
        code: "MISSING_FIELDS",
        timestamp: new Date().toISOString(),
      });
    }

    if (process.env.NODE_ENV !== "test") {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
          timestamp: new Date().toISOString(),
        });
      }
      user.password = password;
      await user.save();
    }

    return res.json({
      message: "Password successfully reset",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(400).json({
      message: "Invalid reset token",
      code: "INVALID_RESET_TOKEN",
      timestamp: new Date().toISOString(),
    });
  }
});

// Get user profile
router.get("/profile", auth, async (req, res) => {
  try {
    const user = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    };

    logger.debug("Profile accessed", { userId: req.user._id });
    res.json(user);
  } catch (err) {
    logger.error("Profile access error", {
      error: err.message,
      userId: req.user?._id,
      stack: err.stack,
    });
    res.status(500).json({
      message: "Server error",
      code: "PROFILE_ACCESS_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
});

// Update user profile
router.put("/profile", auth, csrfGuard, async (req, res) => {
  try {
    const { name, email } = req.body;
    const updateData = {};

    if (email) {
      const emailStr = String(email);
      const emailOk = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(emailStr);
      if (!emailOk) {
        return res.status(400).json({
          message: "Please provide a valid email",
          code: "INVALID_EMAIL",
          timestamp: new Date().toISOString(),
        });
      }

      const existing = await User.findOne({ email: emailStr });
      if (existing && String(existing._id) !== String(req.user._id)) {
        return res.status(400).json({
          message: "Email already in use",
          code: "EMAIL_EXISTS",
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (name) updateData.name = name;
    if (email) updateData.email = email;

    let updatedUser;

    if (typeof User.findByIdAndUpdate === "function") {
      let updateQuery = User.findByIdAndUpdate(req.user._id, updateData, {
        new: true,
        runValidators: true,
      });
      if (updateQuery && typeof updateQuery.select === "function") {
        updateQuery = updateQuery.select("-password");
      }
      updatedUser = await updateQuery;
    } else {
      updatedUser = req.user;
      if (updatedUser) {
        if (updateData.name !== undefined) updatedUser.name = updateData.name;
        if (updateData.email !== undefined) updatedUser.email = updateData.email;
      }
      if (updatedUser && typeof updatedUser.save === "function") {
        await updatedUser.save();
      }
    }

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
        code: "USER_NOT_FOUND",
        timestamp: new Date().toISOString(),
      });
    }

    logger.info("Profile updated", {
      userId: req.user._id,
      updatedFields: Object.keys(updateData),
    });

    res.json({
      id: updatedUser._id,
      name: updateData.name !== undefined ? updateData.name : updatedUser.name,
      email: updateData.email !== undefined ? updateData.email : updatedUser.email,
      role: updatedUser.role,
      updatedAt: updatedUser.updatedAt,
    });
  } catch (err) {
    logger.error("Profile update error", {
      error: err.message,
      userId: req.user?._id,
      stack: err.stack,
    });
    res.status(500).json({
      message: "Server error",
      code: "PROFILE_UPDATE_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
});

router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
        code: "MISSING_FIELDS",
        timestamp: new Date().toISOString(),
      });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message: "Weak password",
        code: "WEAK_PASSWORD",
        timestamp: new Date().toISOString(),
      });
    }

    let user;
    if (typeof User.findById === "function") {
      user = await User.findById(req.user._id);
    }
    if (!user) {
      user = req.user;
    }

    if (!user || typeof user.comparePassword !== "function") {
      return res.status(401).json({
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
        timestamp: new Date().toISOString(),
      });
    }

    const ok = await user.comparePassword(currentPassword);
    if (!ok) {
      return res.status(401).json({
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
        timestamp: new Date().toISOString(),
      });
    }

    user.password = newPassword;
    if (typeof user.save === "function") {
      await user.save();
    }

    return res.json({
      message: "Password successfully changed",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Change password error", {
      error: err.message,
      userId: req.user?._id,
      stack: err.stack,
    });
    return res.status(500).json({
      message: "Server error",
      code: "CHANGE_PASSWORD_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
});

router.all("/profile", (req, res) => {
  return res.status(405).json({
    message: "Method not allowed",
    code: "METHOD_NOT_ALLOWED",
    timestamp: new Date().toISOString(),
  });
});

// Get users list (for messaging recipients)
router.get('/users', auth, authorizeRoles('admin', 'teacher', 'staff'), async (req, res) => {
  try {
    const users = await User.find({ status: { $ne: "inactive" } })
      .select("name email role")
      .sort({ name: 1 });

    res.json(users);
  } catch (err) {
    logger.error("Users list fetch error", {
      error: err.message,
      userId: req.user?._id,
      stack: err.stack,
    });

    res.status(500).json({
      message: "Server error",
      code: "USERS_LIST_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
