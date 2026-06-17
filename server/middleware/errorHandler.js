const logger = require("../services/logger");

const errorHandler = (err, req, res, next) => {
  // Generate correlation ID for tracking
  const correlationId = req.correlationId || "unknown";

  // Log error with context
  logger.error("Error occurred", {
    correlationId,
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.user?.id || "anonymous",
    timestamp: new Date().toISOString(),
  });

  // Centralized handling for JWT errors
  if (
    err.name === "JsonWebTokenError" ||
    err.name === "TokenExpiredError" ||
    err.name === "NotBeforeError"
  ) {
    let message = "Invalid token";
    let code = "INVALID_TOKEN";

    if (err.name === "TokenExpiredError") {
      message = "Token has expired";
      code = "TOKEN_EXPIRED";
    } else if (err.name === "NotBeforeError") {
      message = "Token not active";
      code = "TOKEN_NOT_ACTIVE";
    }

    return res.status(401).json({
      message,
      code,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));

    logger.warn("Validation error", {
      correlationId,
      errors,
      userId: req.user?.id,
    });

    return res.status(400).json({
      message: "Validation Error",
      errors,
      code: "VALIDATION_ERROR",
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  // MongoDB duplicate key error
  if (err.name === "MongoError" && err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];

    logger.warn("Duplicate entry attempt", {
      correlationId,
      field,
      value,
      userId: req.user?.id,
    });

    return res.status(409).json({
      message: "Duplicate Entry",
      field,
      code: "DUPLICATE_ERROR",
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  // MongoDB cast error (invalid ObjectId)
  if (err.name === "CastError") {
    logger.warn("Invalid ID format", {
      correlationId,
      value: err.value,
      path: err.path,
      userId: req.user?.id,
    });

    return res.status(400).json({
      message: "Invalid ID format",
      code: "INVALID_ID",
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  // Rate limiting error
  if (err.status === 429) {
    logger.warn("Rate limit exceeded", {
      correlationId,
      ip: req.ip,
      userId: req.user?.id,
    });

    return res.status(429).json({
      message: "Too many requests",
      code: "RATE_LIMIT_EXCEEDED",
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  // Request size limit error
  if (err.type === "entity.too.large") {
    logger.warn("Request too large", {
      correlationId,
      limit: err.limit,
      length: err.length,
      userId: req.user?.id,
    });

    return res.status(413).json({
      message: "Request entity too large",
      code: "PAYLOAD_TOO_LARGE",
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  // Syntax error in JSON
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    logger.warn("Invalid JSON syntax", {
      correlationId,
      userId: req.user?.id,
    });

    return res.status(400).json({
      message: "Invalid request",
      code: "INVALID_JSON",
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  // Default server error
  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode === 500 ? "Internal Server Error" : err.message;

  // Don't expose internal errors in production
  const response = {
    message,
    code: err.code || "SERVER_ERROR",
    correlationId,
    timestamp: new Date().toISOString(),
  };

  // Only include stack trace in development
  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
    response.details = err.details;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
