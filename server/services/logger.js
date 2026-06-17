const winston = require("winston");
const { format } = winston;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define level based on environment
const level = () => {
  const env = process.env.NODE_ENV || "development";
  return env === "development" ? "debug" : "warn";
};

// Define colors for each level
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

// Add colors to winston
winston.addColors(colors);

// Create format for logs
const logFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  format.colorize({ all: true }),
  format.printf((info) => {
    const { timestamp, level, message, ...args } = info;
    const additionalInfo = Object.keys(args).length
      ? JSON.stringify(args, null, 2)
      : "";
    return `${timestamp} [${level}]: ${message} ${additionalInfo}`;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: logFormat,
  transports:
    process.env.NODE_ENV === "test"
      ? [new winston.transports.Console()]
      : [
          // Write all logs to console
          new winston.transports.Console(),

          // Write all error logs to error.log
          new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
            format: format.combine(format.uncolorize(), format.json()),
          }),

          // Write all logs to combined.log
          new winston.transports.File({
            filename: "logs/combined.log",
            format: format.combine(format.uncolorize(), format.json()),
          }),
        ],
  // Don't exit on uncaught errors
  exitOnError: false,
});

// Create a stream object for Morgan middleware
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
