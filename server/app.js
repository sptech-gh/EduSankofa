require("dotenv").config();
// Set custom DNS resolvers to resolve mongodb+srv SRV records
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (err) {
  // Ignore fallback issues
}

// Verify JWT secret on startup
require("./services/tokenService").assertJwtSecret();

// Verify other required environment variables on startup
if (!process.env.MONGODB_URI) {
  throw new Error("FATAL: MONGODB_URI environment variable is not set.");
}
if (!process.env.NODE_ENV) {
  throw new Error("FATAL: NODE_ENV environment variable is not set.");
}

// Enforce timezone to Africa/Accra
process.env.TZ = "Africa/Accra";


const fs = require("fs");
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const hpp = require("hpp");
const logger = require("./services/logger");
const morgan = require("morgan");

const { apiLimiter, authLimiter, uploadLimiter, xssProtection, validateInput, preventInjection, corsOptions, helmetConfig } = require("./middleware/security");
const licenseGuard = require("./middleware/licenseGuard");
const { getInstance } = require("./services/licenseService");
const SchoolConfig = require("./models/SchoolConfig");
const SchoolProfile = require("./models/SchoolProfile");

const app = express();
const port = process.env.PORT || 5000;
const envFile = require("dotenv").parse(fs.readFileSync(path.resolve(__dirname, ".env"), "utf8"));

const getMongoUri = () => {
  const shellUri = String(process.env.MONGODB_URI || "").trim();
  if (shellUri && !shellUri.includes("<your-atlas-uri>") && !shellUri.includes("<") && shellUri.includes("mongodb")) {
    return shellUri;
  }

  return envFile.MONGODB_URI || "mongodb://localhost:27017/school-management";
};

const redactMongoUri = (uri) => {
  if (!uri || typeof uri !== "string") return "";
  return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^@/]+)@/i, "$1<redacted>@");
};

// =================================================================
// MIDDLEWARE SETUP - Proper Order
// =================================================================

// 1. Basic security middleware (before body parsing)
app.use(helmet(helmetConfig));
app.use(mongoSanitize());
app.use(hpp());
app.use(preventInjection);

// 2. CORS configuration
app.use(cors(corsOptions));

// 3. Rate limiting
app.use("/api/", apiLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/upload", uploadLimiter);

// 4. Request parsing middleware
app.use("/api/paystack/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// 5. Compression middleware
app.use(compression());

// 6. Security middleware that needs body parsing
app.use((req, res, next) => {
  if (req.body) {
    req.originalBody = JSON.parse(JSON.stringify(req.body));
  }
  next();
});
app.use((req, res, next) => (
  req.originalUrl === "/api/paystack/webhook" ? next() : xssProtection(req, res, next)
));
app.use((req, res, next) => (
  req.originalUrl === "/api/paystack/webhook" ? next() : validateInput(req, res, next)
));

// 7. License system initialization and middleware
const licenseService = getInstance();
app.use(licenseGuard.licenseInfoMiddleware());

// 7. Logging middleware
app.use(morgan("combined", { stream: logger.stream }));

// =================================================================
// DATABASE CONNECTION
// =================================================================

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      const mongoUri = getMongoUri();
      logger.info("Connecting to MongoDB", {
        mongoUri: redactMongoUri(mongoUri),
      });
      await mongoose.connect(
        mongoUri,
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          connectTimeoutMS: 10000,
          retryWrites: true,
          retryReads: true,
        }
      );
      logger.info("MongoDB connected successfully");
      
      // Initialize license service after DB connection
      await licenseService.init();

      try {
        const [configCount, profileCount] = await Promise.all([
          typeof SchoolConfig.countDocuments === "function" ? SchoolConfig.countDocuments({}) : 0,
          typeof SchoolProfile.countDocuments === "function" ? SchoolProfile.countDocuments({}) : 0,
        ]);

        if (configCount > 1 || profileCount > 1) {
          logger.warn("Single-school deployment invariant violated: multiple school records detected. Each server instance must connect to exactly one school database.", {
            schoolConfigCount: configCount,
            schoolProfileCount: profileCount,
          });
        }
      } catch (e) {
        logger.warn("Single-school invariant check failed", {
          error: e && e.message ? e.message : String(e),
        });
      }
    }
  } catch (err) {
    logger.error("MongoDB connection error:", {
      mongoUri: redactMongoUri(getMongoUri()),
      error: err.message,
      name: err.name,
      code: err.code,
      cause:
        err.cause && err.cause.message ? err.cause.message : err.cause || undefined,
      stack: err.stack,
    });
    // Retry connection after delay
    logger.info("Retrying MongoDB connection in 5 seconds...");
    setTimeout(connectDB, 5000);
  }
};

// Connect to MongoDB if running directly
if (require.main === module) {
  connectDB();
}

// =================================================================
// HEALTH CHECK ENDPOINT
// =================================================================

app.get("/health", (req, res) => {
  res.json({
    uptime: process.uptime(),
    message: "OK",
    timestamp: new Date().toISOString(),
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    memory: process.memoryUsage(),
  });
});

// =================================================================
// API ROUTES - All prefixed with /api
// =================================================================

// API Root endpoint
app.get("/api", (req, res) => {
  res.json({
    message: "School Management SaaS API is running",
    version: "1.0.0",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    endpoints: {
      setup: "/api/setup",
      auth: "/api/auth",
      users: "/api/users",
      students: "/api/students",
      classes: "/api/classes",
      subjects: "/api/subjects",
      grades: "/api/grades",
      fees: "/api/fees",
      payments: "/api/payments",
      attendance: "/api/attendance",
      announcements: "/api/announcements",
      messages: "/api/messages",
      notifications: "/api/notifications",
      reports: "/api/report-cards",
      analytics: "/api/analytics",
      promotion: "/api/promotion",
      audit: "/api/audit",
      backup: "/api/backup",
      academicYears: "/api/academic-years",
      terms: "/api/terms",
      teacherAssignments: "/api/teacher-assignments",
      gradingSettings: "/api/grading-settings",
      schoolProfile: "/api/school-profile",
      schoolSetup: "/api/school-setup",
      exams: "/api/exams",
      enrollments: "/api/enrollments",
      parentPortal: "/api/parent-portal",
      workflows: "/api/workflows",
      integrations: "/api/integrations",
      security: "/api/security",
      rbacManagement: "/api/rbac-management",
      invoices: "/api/invoices",
      leaveRequests: "/api/leave-requests"
    }
  });
});

// Authentication routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// Setup routes (NEW)
const setupRoutes = require("./routes/setup");
app.use("/api/setup", licenseGuard.middleware(), setupRoutes);

// License management routes
const licenseRoutes = require("./routes/license");
app.use("/api/license", licenseRoutes);

// User management routes
const userRoutes = require("./routes/users");
app.use("/api/users", licenseGuard.middleware(), userRoutes);

// Security and RBAC routes
const securityRoutes = require("./routes/security");
app.use("/api/security", licenseGuard.middleware(), securityRoutes);

// RBAC Management routes (NEW)
const rbacManagementRoutes = require("./routes/rbacManagement");
app.use("/api/rbac-management", licenseGuard.middleware(), rbacManagementRoutes);


// Student management routes
const studentRoutes = require("./routes/students");
app.use("/api/students", licenseGuard.middleware(), studentRoutes);

// Academic structure routes
const enrollmentRoutes = require("./routes/enrollments");
app.use("/api/enrollments", licenseGuard.middleware(), enrollmentRoutes);

const academicYearsRoutes = require("./routes/academicYears");
app.use("/api/academic-years", licenseGuard.middleware(), academicYearsRoutes);

const termsRoutes = require("./routes/terms");
app.use("/api/terms", licenseGuard.middleware(), termsRoutes);

// School Setup routes (NEW)
const schoolSetupRoutes = require("./routes/schoolSetup");
app.use("/api/school-setup", licenseGuard.middleware(), schoolSetupRoutes);

const classesRoutes = require("./routes/classes");
app.use("/api/classes", licenseGuard.middleware(), classesRoutes);

const teacherAssignmentsRoutes = require("./routes/teacherAssignments");
app.use(
  "/api/teacher-assignments",
  licenseGuard.middleware(),
  teacherAssignmentsRoutes,
);

// Curriculum routes
const subjectsRoutes = require("./routes/subjects");
app.use("/api/subjects", licenseGuard.middleware(), subjectsRoutes);

const gradesRoutes = require("./routes/grades");
app.use("/api/grades", licenseGuard.middleware(), gradesRoutes);

const reportCardsRoutes = require("./routes/ghanaReportCards");
app.use("/api/report-cards", licenseGuard.middleware(), reportCardsRoutes);

// Assessment routes
const examRoutes = require("./routes/exams");
app.use("/api/exams", licenseGuard.middleware(), examRoutes);

// School management routes
const schoolProfileRoutes = require("./routes/schoolProfile");
app.use("/api/school-profile", licenseGuard.middleware(), schoolProfileRoutes);

const gradingSettingsRoutes = require("./routes/gradingSettings");
app.use("/api/grading-settings", licenseGuard.middleware(), gradingSettingsRoutes);

// Communication routes
const announcementsRoutes = require("./routes/announcements");
app.use("/api/announcements", licenseGuard.middleware(), announcementsRoutes);

// Announcements Management routes (NEW)
const announcementsManagementRoutes = require("./routes/announcementsManagement");
app.use("/api/announcements-management", licenseGuard.middleware(), announcementsManagementRoutes);

const messagesRoutes = require("./routes/messages");
app.use("/api/messages", licenseGuard.middleware(), messagesRoutes);

const notificationsRoutes = require("./routes/notifications");
app.use("/api/notifications", licenseGuard.middleware(), notificationsRoutes);

// Attendance and leave routes
const attendanceRoutes = require("./routes/attendance");
app.use("/api/attendance", licenseGuard.middleware(), attendanceRoutes);

const leaveRequestsRoutes = require("./routes/leaveRequests");
app.use("/api/leave-requests", licenseGuard.middleware(), leaveRequestsRoutes);

// Parent portal routes
const parentPortalRoutes = require("./routes/parentPortal");
app.use("/api/parent-portal", licenseGuard.middleware(), parentPortalRoutes);

// Admin parent management routes (NEW - admin-initiated parent accounts)
const adminParentsRoutes = require("./routes/adminParents");
app.use("/api/admin/parents", licenseGuard.middleware(), adminParentsRoutes);

// Ghana Billing Module routes
const adminFeesRoutes = require("./routes/adminFees");
app.use("/api/admin/fees", licenseGuard.middleware(), adminFeesRoutes);
app.use("/api/admin", licenseGuard.middleware(), adminFeesRoutes);

const billingEngine = require("./routes/billingEngine");
app.use("/api/payments", licenseGuard.middleware(), billingEngine.paymentsRouter);
app.use("/api/bills", licenseGuard.middleware(), billingEngine.billsRouter);

const paystackRoutes = require("./routes/paystack");
app.use("/api/paystack", paystackRoutes);

const expensesRoutes = require("./routes/expenses");
app.use("/api/expenses", licenseGuard.middleware(), expensesRoutes);

const financialManagementRoutes = require("./routes/financialManagement");
app.use("/api/financial", licenseGuard.middleware(), financialManagementRoutes);

const teacherPortalRoutes = require("./routes/teacherPortal");
app.use("/api/teacher", licenseGuard.middleware(), teacherPortalRoutes);

// Headmaster / Proprietor portal routes (NEW)
const headmasterRoutes = require("./routes/headmaster");
app.use("/api/headmaster", licenseGuard.middleware(), headmasterRoutes);

// Staff Payroll routes (NEW)
const payrollRoutes = require("./routes/payroll");
app.use("/api/payroll", licenseGuard.middleware(), payrollRoutes);

// Budget & Variance routes (NEW)
const budgetRoutes = require("./routes/budget");
app.use("/api/budget", licenseGuard.middleware(), budgetRoutes);

// Financial management routes
const feeRoutes = require("./routes/fees");
app.use("/api/fees", licenseGuard.middleware(), feeRoutes);

const invoiceRoutes = require("./routes/invoices");
app.use("/api/invoices", licenseGuard.middleware(), invoiceRoutes);

// Advanced features routes
const analyticsRoutes = require("./routes/analytics");
app.use("/api/analytics", licenseGuard.middleware(), analyticsRoutes);

const dashboardAnalyticsRoutes = require("./routes/dashboardAnalytics");
app.use("/api/dashboard", licenseGuard.middleware(), dashboardAnalyticsRoutes);
// Keep /api/accountant as an intentional alias for finance dashboard clients.
app.use("/api/accountant", licenseGuard.middleware(), dashboardAnalyticsRoutes);

const promotionRoutes = require("./routes/promotion");
app.use("/api/promotion", licenseGuard.middleware(), promotionRoutes);

const complianceReportsRoutes = require("./routes/complianceReports");
app.use("/api/reports", complianceReportsRoutes);

const auditRoutes = require("./routes/audit");
app.use("/api/audit", licenseGuard.middleware(), auditRoutes);

const backupRoutes = require("./routes/backup");
app.use("/api/backup", licenseGuard.middleware(), backupRoutes);

const workflowsRoutes = require("./routes/workflows");
app.use("/api/workflows", licenseGuard.middleware(), workflowsRoutes);

const integrationsRoutes = require("./routes/integrations");
app.use("/api/integrations", licenseGuard.middleware(), integrationsRoutes);

// =================================================================
// STATIC FILE SERVING (Production only)
// =================================================================

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/build")));
  
  // Handle React routing - return index.html for any non-API routes
  app.get("*", (req, res, next) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(__dirname, "../client/build", "index.html"));
    } else {
      next();
    }
  });
}

// =================================================================
// ERROR HANDLING
// =================================================================

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({
    message: "API endpoint not found",
    code: "API_NOT_FOUND",
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler for non-API routes (development only)
if (process.env.NODE_ENV !== "production") {
  app.use("*", (req, res) => {
    res.status(404).json({
      message: "Route not found",
      code: "ROUTE_NOT_FOUND",
      path: req.path,
      method: req.method,
      suggestion: req.path.startsWith("/api") 
        ? "Check API documentation for available endpoints"
        : "This is a backend API server. Use the frontend application for UI.",
      timestamp: new Date().toISOString(),
    });
  });
}

// Global error handler (must be last)
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// =================================================================
// GRACEFUL SHUTDOWN
// =================================================================

process.on("SIGTERM", () => {
  logger.info(
    "SIGTERM signal received. Closing HTTP server and database connection"
  );
  
  // Shutdown license service
  licenseService.shutdown();
  
  mongoose.connection.close(() => {
    logger.info("MongoDB connection closed");
    process.exit(0);
  });
});

// =================================================================
// SERVER STARTUP
// =================================================================

// Export app for testing
module.exports = app;

// Start server only if file is run directly (not imported)
if (require.main === module) {
  app.listen(port, () => {
    logger.info(`Server is running on port: ${port}`);
    logger.info(`API endpoints available at: http://localhost:${port}/api`);
    logger.info(`Health check available at: http://localhost:${port}/health`);
  });
}
