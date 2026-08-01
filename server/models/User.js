const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const logger = require("../services/logger");

// Debug log levels
logger.level = "debug";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false, // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: {
        values: [
          "super admin", "school admin", "admin", "teacher", "student",
          "staff", "accountant", "accounts officer", "parent", "librarian",
          "counselor", "head teacher", "deputy head teacher", "subject head",
          "class teacher", "administrative staff", "support staff",
          "headmaster", "proprietor",
        ],
        message: "{VALUE} is not a valid role",
      },
      default: "student",
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchoolProfile",
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    staffId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    forcePasswordChange: {
      type: Boolean,
      default: false,
    },
    gesCertificationLevel: {
      type: String,
      enum: ["Untrained", "CERT A", "DIPLOMA", "DEGREE", "POSTGRADUATE"],
      default: "Untrained",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    
    // ── Parent Account Setup (one-time password setup for admin-created parent accounts) ──
    passwordSetupToken: String,
    passwordSetupTokenExpiry: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ── Payroll Profile (populated for staff roles) ──────────────────────────
    payroll: {
      basicSalaryPesewas: { type: Number, min: 0 },  // monthly basic salary in pesewas
      allowances: [{
        name: { type: String, trim: true },
        amountPesewas: { type: Number, min: 0 },
        isTaxable: { type: Boolean, default: true },
        isActive: { type: Boolean, default: true },
      }],
      deductions: [{
        name: { type: String, trim: true },
        amountPesewas: { type: Number, min: 0 },
        isRecurring: { type: Boolean, default: true },
        startMonth: { type: String },   // "YYYY-MM"
        endMonth: { type: String },     // "YYYY-MM" or null = indefinite
      }],
      bankName: { type: String, trim: true },
      bankBranch: { type: String, trim: true },
      accountNumber: { type: String, trim: true },  // stored encrypted in production
      ssnitNumber: { type: String, trim: true },
      tinNumber: { type: String, trim: true },      // GRA Tax Identification Number
      appliedReliefCodes: [{ type: String, trim: true, uppercase: true }],
      employmentType: {
        type: String,
        enum: ["FULL_TIME", "PART_TIME", "CONTRACT"],
        default: "FULL_TIME",
      },
      isOnPayroll: { type: Boolean, default: true },
      department: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

// Password hashing middleware
userSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) {
      logger.debug("Password not modified, skipping hash", {
        userId: this._id,
        hasPassword: !!this.password,
      });
      return next();
    }

    logger.debug("Hashing password", {
      userId: this._id,
      passwordBeforeHash: !!this.password,
    });

    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
    const salt = await bcrypt.genSalt(saltRounds);
    this.password = await bcrypt.hash(this.password, salt);

    logger.debug("Password hashed successfully", {
      userId: this._id,
      hasPasswordAfterHash: !!this.password,
      passwordLength: this.password.length,
    });

    if (this.isModified("password") && !this.isNew) {
      this.passwordChangedAt = Date.now() - 1000; // Ensure token is created after password change
    }

    next();
  } catch (error) {
    logger.error("Password hashing failed", {
      error: error.message,
      userId: this._id,
    });
    next(error);
  }
});

// Password comparison method
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    logger.debug("Comparing passwords", {
      userId: this._id,
      hasStoredPassword: !!this.password,
      storedPasswordLength: this.password ? this.password.length : 0,
      hasCandidatePassword: !!candidatePassword,
      candidatePasswordLength: candidatePassword ? candidatePassword.length : 0,
    });

    if (!this.password || !candidatePassword) {
      logger.error("Missing password for comparison", {
        userId: this._id,
        hasStoredPassword: !!this.password,
        hasCandidatePassword: !!candidatePassword,
      });
      return false;
    }

    const isMatch = await bcrypt.compare(candidatePassword, this.password);

    logger.debug("Password comparison result", {
      userId: this._id,
      isMatch,
    });

    return isMatch;
  } catch (error) {
    logger.error("Password comparison failed", {
      error: error.message,
      userId: this._id,
    });
    throw error;
  }
};

// Generate JWT token
userSchema.methods.generateAuthToken = function () {
  try {
    const { signAccessToken } = require("../services/tokenService");
    const token = signAccessToken({
      userId: this._id,
      role: this.role,
      email: this.email,
      schoolId: this.schoolId,
      forcePasswordChange: this.forcePasswordChange,
    });

    logger.debug("Token generated successfully", {
      userId: this._id,
      role: this.role,
    });

    return token;
  } catch (error) {
    logger.error("Token generation failed", {
      error: error.message,
      userId: this._id,
    });
    throw error;
  }
};

// Check if password was changed after token was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function () {
  try {
    const resetToken = crypto.randomBytes(32).toString("hex");

    this.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    return resetToken;
  } catch (error) {
    logger.error("Password reset token creation failed", {
      error: error.message,
      userId: this._id,
    });
    throw error;
  }
};

// Static method to verify JWT token
userSchema.statics.verifyToken = async function (token) {
  try {
    const { verifyToken } = require("../services/tokenService");
    const decoded = verifyToken(token, {
      issuer: "school-management-saas",
      audience: "school-management-client",
    });

    const user = await this.findById(decoded.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user changed password after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      throw new Error("User recently changed password. Please login again");
    }

    return decoded;
  } catch (error) {
    logger.error("Token verification failed", {
      error: error.message,
    });
    throw error;
  }
};

module.exports = mongoose.model("User", userSchema);
