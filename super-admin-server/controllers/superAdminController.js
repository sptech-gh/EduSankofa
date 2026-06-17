const jwt = require('jsonwebtoken');
const SuperAdmin = require('../models/SuperAdmin');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const { hashIP } = require('../utils/helpers');
const { logger } = require('../utils/database');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
};

// Super Admin Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find super admin
    const superAdmin = await SuperAdmin.findByEmail(email);
    if (!superAdmin) {
      await SuperAdminAuditLog.create({
        adminId: null,
        action: 'LOGIN',
        entityType: 'superadmin',
        entityId: null,
        entityName: email,
        details: { reason: 'User not found' },
        ipAddress: hashIP(req.ip),
        userAgent: req.get('User-Agent') || 'Unknown',
        severity: 'medium',
        success: false,
        errorMessage: 'Invalid credentials'
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Check if account is locked
    if (superAdmin.isLocked) {
      return res.status(423).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked due to multiple failed login attempts.'
        }
      });
    }

    // Check if account is active
    if (!superAdmin.isActive) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Account is deactivated.'
        }
      });
    }

    // Verify password
    const isPasswordValid = await superAdmin.comparePassword(password);
    if (!isPasswordValid) {
      await superAdmin.incLoginAttempts();
      
      await SuperAdminAuditLog.create({
        adminId: superAdmin._id,
        action: 'LOGIN',
        entityType: 'superadmin',
        entityId: superAdmin._id,
        entityName: superAdmin.email,
        details: { reason: 'Invalid password' },
        ipAddress: hashIP(req.ip),
        userAgent: req.get('User-Agent') || 'Unknown',
        severity: 'medium',
        success: false,
        errorMessage: 'Invalid credentials'
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Reset login attempts and update last login
    await superAdmin.resetLoginAttempts();

    // Generate token
    const token = generateToken(superAdmin._id);

    // Log successful login
    await SuperAdminAuditLog.create({
      adminId: superAdmin._id,
      action: 'LOGIN',
      entityType: 'superadmin',
      entityId: superAdmin._id,
      entityName: superAdmin.email,
      details: { loginTime: new Date() },
      ipAddress: hashIP(req.ip),
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'low',
      success: true
    });

    logger.info(`Super Admin login successful: ${superAdmin.email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        superAdmin: superAdmin.toSafeObject()
      }
    });

  } catch (error) {
    logger.error('Super Admin login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_ERROR',
        message: 'Login failed. Please try again.'
      }
    });
  }
};

// Super Admin Registration (optional - can restrict to manual seed)
const register = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if super admin already exists
    const existingAdmin = await SuperAdmin.findByEmail(email);
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Super Admin with this email already exists'
        }
      });
    }

    // Create new super admin
    const superAdmin = new SuperAdmin({
      email,
      password,
      role: 'superadmin'
    });

    await superAdmin.save();

    // Log registration
    await SuperAdminAuditLog.create({
      adminId: superAdmin._id,
      action: 'CREATE_SCHOOL', // Using existing action type
      entityType: 'superadmin',
      entityId: superAdmin._id,
      entityName: superAdmin.email,
      details: { registrationTime: new Date() },
      ipAddress: hashIP(req.ip),
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'high',
      success: true
    });

    logger.info(`Super Admin registered: ${superAdmin.email}`);

    res.status(201).json({
      success: true,
      message: 'Super Admin registered successfully',
      data: {
        superAdmin: superAdmin.toSafeObject()
      }
    });

  } catch (error) {
    logger.error('Super Admin registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_ERROR',
        message: 'Registration failed. Please try again.'
      }
    });
  }
};

// Get Super Admin Profile
const getProfile = async (req, res) => {
  try {
    const superAdmin = await SuperAdmin.findById(req.superAdminId);
    
    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ADMIN_NOT_FOUND',
          message: 'Super Admin not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        superAdmin: superAdmin.toSafeObject()
      }
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_ERROR',
        message: 'Failed to get profile'
      }
    });
  }
};

// Update Super Admin Profile
const updateProfile = async (req, res) => {
  try {
    const { email } = req.body;
    const superAdmin = await SuperAdmin.findById(req.superAdminId);
    
    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ADMIN_NOT_FOUND',
          message: 'Super Admin not found'
        }
      });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== superAdmin.email) {
      const existingAdmin = await SuperAdmin.findByEmail(email);
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'Email is already taken'
          }
        });
      }
      superAdmin.email = email;
    }

    await superAdmin.save();

    // Log profile update
    await SuperAdminAuditLog.create({
      adminId: superAdmin._id,
      action: 'UPDATE_SCHOOL', // Using existing action type
      entityType: 'superadmin',
      entityId: superAdmin._id,
      entityName: superAdmin.email,
      details: { updatedFields: req.body },
      ipAddress: hashIP(req.ip),
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'medium',
      success: true
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        superAdmin: superAdmin.toSafeObject()
      }
    });

  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: 'Failed to update profile'
      }
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    // Log logout
    await SuperAdminAuditLog.create({
      adminId: req.superAdminId,
      action: 'LOGOUT',
      entityType: 'superadmin',
      entityId: req.superAdminId,
      entityName: req.superAdmin.email,
      details: { logoutTime: new Date() },
      ipAddress: hashIP(req.ip),
      userAgent: req.get('User-Agent') || 'Unknown',
      severity: 'low',
      success: true
    });

    logger.info(`Super Admin logout: ${req.superAdmin.email}`);

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_ERROR',
        message: 'Logout failed'
      }
    });
  }
};

module.exports = {
  login,
  register,
  getProfile,
  updateProfile,
  logout
};
