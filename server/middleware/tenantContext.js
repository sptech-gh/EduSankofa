/**
 * tenantContext.js
 * Multi-tenant isolation middleware (Phase 1: Tenancy Enforcement)
 * 
 * Uses Node.js AsyncLocalStorage to propagate the tenant (school) context
 * through the entire request lifecycle WITHOUT requiring every route handler
 * to pass the schoolId as a parameter.
 * 
 * Flow:
 * 1. tenantContext pre-decodes the JWT to extract schoolId (without verification)
 * 2. Stores it in AsyncLocalStorage for all downstream async operations
 * 3. The route-specific auth middleware LATER verifies the token properly
 * 4. Route helpers call getTenantSchoolId() to read the context
 * 
 * Security: The decoded schoolId is NOT used for authentication.
 * It's only used for data scoping. Auth middleware handles real verification.
 */

const { AsyncLocalStorage } = require("async_hooks");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const logger = require("../services/logger");

const tenantStorage = new AsyncLocalStorage();

/**
 * Get the current tenant schoolId from the async context.
 */
const getTenantSchoolId = () => {
  const store = tenantStorage.getStore();
  return store ? store.schoolId : null;
};

/**
 * Pre-decode JWT to extract schoolId without verification.
 * Safe because this is only for data scoping, not authentication.
 * Auth middleware performs full verification later.
 */
function extractSchoolIdFromToken(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

    const token = authHeader.split(" ")[1];
    if (!token) return null;

    // Decode WITHOUT verification — just to read schoolId for scoping
    const decoded = jwt.decode(token, { complete: false });
    if (decoded && decoded.schoolId) return decoded.schoolId;

    return null;
  } catch {
    return null;
  }
}

/**
 * Middleware: resolve tenant context for the request.
 * Mount globally BEFORE route handlers but AFTER body parsing.
 */
const tenantContext = async (req, res, next) => {
  try {
    let schoolId = null;

    // 1. Pre-decode JWT to extract schoolId (for scoped queries before auth runs)
    schoolId = extractSchoolIdFromToken(req);

    // 2. Fallback: explicit header (for service-to-service or unauthenticated flows)
    if (!schoolId && req.headers["x-school-id"]) {
      schoolId = req.headers["x-school-id"];
    }

    if (schoolId && mongoose.Types.ObjectId.isValid(schoolId)) {
      // Attach to request for any handler that reads req.schoolId
      req.schoolId = schoolId;
      req.tenant = { schoolId };
    }

    // Run the rest of the request within the async tenant context
    tenantStorage.run({ schoolId }, () => next());
  } catch (err) {
    logger.error("Tenant context resolution failed", {
      error: err.message,
      path: req.path,
    });
    next(err);
  }
};

module.exports = { tenantContext, getTenantSchoolId };
