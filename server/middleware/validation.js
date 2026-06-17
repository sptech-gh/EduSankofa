const { body, param, query, validationResult } = require("express-validator");
const logger = require("../services/logger");

// Common validation rules
const commonValidations = {
  email: body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),

  password: body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),

  name: body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Name can only contain letters and spaces"),

  objectId: param("id").isMongoId().withMessage("Invalid ID format"),

  role: body("role")
    .optional()
    .isIn(["admin", "teacher", "student", "parent", "staff", "accounts officer"])
    .withMessage("Invalid role specified"),

  page: query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  limit: query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
};

// Validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const correlationId = req.correlationId || "unknown";

    logger.warn("Validation failed", {
      correlationId,
      errors: errors.array(),
      url: req.url,
      method: req.method,
      userId: req.user?.id,
    });

    res.status(400).json({
      message: "Validation failed",
      errors: errors.array().map((error) => ({
        field: error.param,
        message: error.msg,
        value: error.value,
      })),
      code: "VALIDATION_ERROR",
      correlationId,
      timestamp: new Date().toISOString(),
    });
  };
};

// Specific validation sets
const validationSets = {
  // Auth validations
  register: [
    commonValidations.name,
    commonValidations.email,
    commonValidations.password,
    commonValidations.role,
  ],

  login: [
    commonValidations.email,
    body("password").notEmpty().withMessage("Password is required"),
  ],

  // Student validations
  createStudent: [
    body("firstName")
      .trim()
      .isLength({ min: 2, max: 30 })
      .withMessage("First name must be between 2 and 30 characters"),

    body("lastName")
      .trim()
      .isLength({ min: 2, max: 30 })
      .withMessage("Last name must be between 2 and 30 characters"),

    commonValidations.email,

    body("dateOfBirth")
      .isISO8601()
      .withMessage("Please provide a valid date of birth"),

    body("gender")
      .isIn(["male", "female", "other"])
      .withMessage("Gender must be male, female, or other"),

    body("phone")
      .optional()
      .isMobilePhone()
      .withMessage("Please provide a valid phone number"),

    body("address")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Address must not exceed 200 characters"),
  ],

  updateStudent: [
    commonValidations.objectId,
    body("firstName")
      .optional()
      .trim()
      .isLength({ min: 2, max: 30 })
      .withMessage("First name must be between 2 and 30 characters"),

    body("lastName")
      .optional()
      .trim()
      .isLength({ min: 2, max: 30 })
      .withMessage("Last name must be between 2 and 30 characters"),

    body("email")
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage("Please provide a valid email"),

    body("phone")
      .optional()
      .isMobilePhone()
      .withMessage("Please provide a valid phone number"),
  ],

  // Fee validations
  createFee: [
    body("studentId").isMongoId().withMessage("Invalid student ID"),

    body("amount")
      .isFloat({ min: 0 })
      .withMessage("Amount must be a positive number"),

    body("type")
      .isIn(["tuition", "library", "transport", "exam", "other"])
      .withMessage("Invalid fee type"),

    body("dueDate").isISO8601().withMessage("Please provide a valid due date"),

    body("description")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Description must not exceed 500 characters"),
  ],

  // Message validations
  createMessage: [
    body("recipientId").isMongoId().withMessage("Invalid recipient ID"),

    body("subject")
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage("Subject must be between 1 and 100 characters"),

    body("content")
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage("Content must be between 1 and 1000 characters"),
  ],

  // Common validations
  objectId: [commonValidations.objectId],
  pagination: [commonValidations.page, commonValidations.limit],
};

// Sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Remove any potential XSS attempts
  const sanitizeValue = (value) => {
    if (typeof value === "string") {
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/javascript:/gi, "")
        .replace(/on\w+\s*=/gi, "");
    }
    return value;
  };

  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === "object" && obj[key] !== null) {
          sanitizeObject(obj[key]);
        } else {
          obj[key] = sanitizeValue(obj[key]);
        }
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};

module.exports = {
  validate,
  validationSets,
  sanitizeInput,
  commonValidations,
};
