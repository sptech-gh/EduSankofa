const License = require('../models/License');
const crypto = require('crypto');
const securityAuditLogger = require('./securityAuditLogger');
const fs = require('fs');
const path = require('path');

class LicenseService {
  constructor() {
    this.currentLicense = null;
    this.lastValidation = null;
    this.validationInterval = null;
    this.init();
  }

  async init() {
    try {
      await this.loadLicense();
      this.startValidationInterval();
      console.log('[LicenseService] Initialized successfully');
    } catch (error) {
      console.error('[LicenseService] Initialization failed:', error.message);
      // Don't crash server, continue with restricted mode
    }
  }

  async loadLicense() {
    try {
      const license = await License.findActiveLicense();
      if (license) {
        this.currentLicense = license;
        await this.validateLicense();
        console.log('[LicenseService] License loaded:', license.schoolName);
      } else {
        console.warn('[LicenseService] No active license found');
        this.currentLicense = null;
      }
    } catch (error) {
      console.error('[LicenseService] Failed to load license:', error.message);
      this.currentLicense = null;
    }
  }

  async validateLicense() {
    const result = {
      isValid: false,
      isExpired: false,
      isInGracePeriod: false,
      status: 'invalid',
      message: '',
      daysUntilExpiry: 0,
      maxUsers: 0,
      currentUsers: 0
    };

    try {
      if (!this.currentLicense) {
        result.message = 'No license found';
        result.status = 'missing';
        return result;
      }

      // Check license status
      if (this.currentLicense.status === 'suspended') {
        result.message = 'License suspended';
        result.status = 'suspended';
        return result;
      }

      // Check expiry
      const now = new Date();
      const expiryDate = new Date(this.currentLicense.expiryDate);
      const gracePeriodEnd = new Date(
        expiryDate.getTime() + (this.currentLicense.gracePeriodDays * 24 * 60 * 60 * 1000)
      );

      result.isExpired = now > expiryDate;
      result.isInGracePeriod = now > expiryDate && now <= gracePeriodEnd;
      result.daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      result.maxUsers = this.currentLicense.maxUsers;
      result.currentUsers = this.currentLicense.currentUsers || 0;

      if (result.isExpired && !result.isInGracePeriod) {
        result.message = 'License expired';
        result.status = 'expired';
        await this.updateLicenseStatus('expired');
        return result;
      }

      if (result.isInGracePeriod) {
        result.message = `License expired - ${this.currentLicense.gracePeriodDays} day grace period remaining`;
        result.status = 'grace_period';
        result.isValid = true; // Allow during grace period
        return result;
      }

      // Check user limit
      if (result.currentUsers >= result.maxUsers) {
        result.message = 'User limit exceeded';
        result.status = 'user_limit_exceeded';
        return result;
      }

      // License is valid
      result.isValid = true;
      result.status = 'active';
      result.message = 'License valid';

      // Update last validation timestamp
      await License.findByIdAndUpdate(this.currentLicense._id, {
        lastValidated: new Date()
      });

      return result;

    } catch (error) {
      console.error('[LicenseService] Validation error:', error.message);
      result.message = 'Validation error';
      result.status = 'error';
      return result;
    }
  }

  async checkExpiry() {
    if (!this.currentLicense) return false;

    const validation = await this.validateLicense();
    
    if (validation.isExpired && !validation.isInGracePeriod) {
      console.warn('[LicenseService] License expired, enforcing restrictions');
      return true;
    }

    return false;
  }

  async verifyMaxUsers(currentUserCount) {
    if (!this.currentLicense) return false;

    const validation = await this.validateLicense();
    return validation.isValid && currentUserCount <= this.currentLicense.maxUsers;
  }

  generateLicenseKey() {
    return License.generateLicenseKey();
  }

  hashLicenseKey(plainKey) {
    return crypto.createHash('sha256').update(plainKey).digest('hex');
  }

  compareLicenseKey(plainKey, hashedKey) {
    const hashedInput = crypto.createHash('sha256').update(plainKey).digest('hex');
    return hashedInput === hashedKey;
  }

  async activateLicense(schoolName, licenseKey, activationIP = null) {
    try {
      // Log activation attempt
      await securityAuditLogger.logLicenseActivation(schoolName, activationIP, false, 'Attempting activation');
      
      // Check if license already exists for this school
      const existingLicense = await License.findBySchoolName(schoolName);
      
      if (existingLicense && existingLicense.compareLicenseKey(licenseKey)) {
        // Reactivate existing license
        existingLicense.status = 'active';
        existingLicense.activatedAt = new Date();
        existingLicense.activationIP = activationIP;
        existingLicense.lastValidated = new Date();
        
        await existingLicense.save();
        await this.loadLicense(); // Reload current license
        
        await securityAuditLogger.logLicenseActivation(schoolName, activationIP, true, 'License reactivated successfully');
        console.log('[LicenseService] License reactivated:', schoolName);
        return {
          success: true,
          message: 'License reactivated successfully',
          license: existingLicense.toSafeObject()
        };
      }

      // Create new license activation
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year from now
      
      const licenseKeyHash = crypto.createHash('sha256').update(licenseKey).digest('hex');
      
      const newLicense = new License({
        schoolName,
        licenseKey,
        licenseKeyHash,
        expiryDate,
        status: 'active',
        activatedAt: new Date(),
        activationIP,
        lastValidated: new Date()
      });

      await newLicense.save();
      await this.loadLicense(); // Reload current license

      await securityAuditLogger.logLicenseActivation(schoolName, activationIP, true, 'License activated successfully');
      console.log('[LicenseService] License activated:', schoolName);
      return {
        success: true,
        message: 'License activated successfully',
        license: newLicense.toSafeObject()
      };

    } catch (error) {
      await securityAuditLogger.logLicenseActivation(schoolName, activationIP, false, `Activation failed: ${error.message}`);
      console.error('[LicenseService] Activation failed:', error.message);
      return {
        success: false,
        message: 'License activation failed: ' + error.message
      };
    }
  }

  async updateLicenseStatus(status) {
    if (!this.currentLicense) return;

    try {
      await License.findByIdAndUpdate(this.currentLicense._id, {
        status,
        lastValidated: new Date()
      });

      this.currentLicense.status = status;
      console.log(`[LicenseService] License status updated to: ${status}`);
    } catch (error) {
      console.error('[LicenseService] Failed to update license status:', error.message);
    }
  }

  async incrementUserCount() {
    if (!this.currentLicense) return false;

    try {
      await License.findByIdAndUpdate(this.currentLicense._id, {
        $inc: { currentUsers: 1 }
      });
      
      this.currentLicense.currentUsers += 1;
      return true;
    } catch (error) {
      console.error('[LicenseService] Failed to increment user count:', error.message);
      return false;
    }
  }

  async decrementUserCount() {
    if (!this.currentLicense) return false;

    try {
      await License.findByIdAndUpdate(this.currentLicense._id, {
        $inc: { currentUsers: -1 }
      });
      
      this.currentLicense.currentUsers = Math.max(0, this.currentLicense.currentUsers - 1);
      return true;
    } catch (error) {
      console.error('[LicenseService] Failed to decrement user count:', error.message);
      return false;
    }
  }

  getCurrentLicense() {
    return this.currentLicense ? this.currentLicense.toSafeObject() : null;
  }

  getDeploymentMode() {
    return process.env.DEPLOYMENT_MODE || 'self-hosted';
  }

  isCloudMode() {
    return this.getDeploymentMode() === 'cloud';
  }

  isSelfHostedMode() {
    return this.getDeploymentMode() === 'self-hosted';
  }

  startValidationInterval() {
    // Validate license every 5 minutes
    this.validationInterval = setInterval(async () => {
      await this.validateLicense();
    }, 5 * 60 * 1000);
  }

  stopValidationInterval() {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
  }

  async shutdown() {
    console.log('[LicenseService] Shutting down...');
    this.stopValidationInterval();
  }
}

// Singleton instance
let licenseServiceInstance = null;

module.exports = {
  getInstance: () => {
    if (!licenseServiceInstance) {
      licenseServiceInstance = new LicenseService();
    }
    return licenseServiceInstance;
  },
  
  // Direct access to methods for testing
  LicenseService,
  License
};
