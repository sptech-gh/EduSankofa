const crypto = require('crypto');

// Generate secure random license key
const generateLicenseKey = () => {
  const prefix = 'EDU-';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(16).toString('hex').toUpperCase();
  return `${prefix}${timestamp}-${random}`;
};

// Hash license key for storage
const hashLicenseKey = (licenseKey) => {
  return crypto.createHash('sha256').update(licenseKey).digest('hex');
};

// Compare license key with hash
const compareLicenseKey = (licenseKey, hashedKey) => {
  const hashedInput = hashLicenseKey(licenseKey);
  return hashedInput === hashedKey;
};

// Generate secure random string
const generateSecureRandom = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Hash IP address for privacy
const hashIP = (ip) => {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
};

// Calculate expiry date
const calculateExpiryDate = (years = 1) => {
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + years);
  return expiryDate;
};

// Check if date is within X days
const isWithinDays = (date, days) => {
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= days && diffDays >= 0;
};

// Format date for response
const formatDate = (date) => {
  return date.toISOString();
};

// Paginate results
const paginate = (page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  return { skip, limit: parseInt(limit) };
};

// Build pagination response
const buildPaginationResponse = (data, page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};

module.exports = {
  generateLicenseKey,
  hashLicenseKey,
  compareLicenseKey,
  generateSecureRandom,
  hashIP,
  calculateExpiryDate,
  isWithinDays,
  formatDate,
  paginate,
  buildPaginationResponse
};
