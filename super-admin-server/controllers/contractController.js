const contractService = require('../services/contractService');
const { logger } = require('../utils/database');

// Generate Contract
const generateContract = async (req, res) => {
  try {
    const { schoolId } = req.params;
    
    const result = await contractService.generateContract(schoolId, req.superAdminId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONTRACT_GENERATION_ERROR',
          message: result.message || 'Failed to generate contract'
        }
      });
    }

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.contract.fileName}"`);
    res.setHeader('Content-Length', result.pdfBuffer.length);

    // Send PDF buffer
    res.send(result.pdfBuffer);

    logger.info(`Contract downloaded: ${result.contract.contractNumber}`);

  } catch (error) {
    logger.error('Generate contract error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTRACT_GENERATION_ERROR',
        message: 'Failed to generate contract'
      }
    });
  }
};

// Get Contract History
const getContractHistory = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await contractService.getContractHistory(
      schoolId, 
      parseInt(page), 
      parseInt(limit)
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Get contract history error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTRACT_HISTORY_ERROR',
        message: 'Failed to get contract history'
      }
    });
  }
};

// Delete Contract
const deleteContract = async (req, res) => {
  try {
    const { contractNumber } = req.params;
    
    const result = await contractService.deleteContract(contractNumber, req.superAdminId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONTRACT_DELETION_ERROR',
          message: result.message || 'Failed to delete contract'
        }
      });
    }

    res.json({
      success: true,
      message: 'Contract deleted successfully'
    });

  } catch (error) {
    logger.error('Delete contract error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTRACT_DELETION_ERROR',
        message: 'Failed to delete contract'
      }
    });
  }
};

// Get Contract Preview (metadata only)
const getContractPreview = async (req, res) => {
  try {
    const { schoolId } = req.params;
    
    // Get school and license details for preview
    const School = require('../models/School');
    const CentralLicense = require('../models/CentralLicense');
    
    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SCHOOL_NOT_FOUND',
          message: 'School not found'
        }
      });
    }

    const license = await CentralLicense.findOne({ schoolId }).populate('planId');
    if (!license) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'LICENSE_NOT_FOUND',
          message: 'License not found'
        }
      });
    }

    const plan = license.planId;
    const contractData = {
      schoolName: school.name,
      planName: plan.name,
      annualPrice: plan.pricePerYear,
      currency: 'GHS',
      maxStudents: plan.maxStudents,
      maxStaff: plan.maxStaff,
      billingCycle: plan.billingCycle,
      supportLevel: plan.supportLevel,
      features: plan.features,
      startDate: license.activatedAt || new Date(),
      expiryDate: license.expiryDate,
      contractNumber: contractService.generateContractNumber(school._id)
    };

    res.json({
      success: true,
      data: {
        contract: contractData,
        downloadUrl: `/api/contracts/generate/${schoolId}`,
        historyUrl: `/api/contracts/history/${schoolId}`
      }
    });

  } catch (error) {
    logger.error('Get contract preview error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTRACT_PREVIEW_ERROR',
        message: 'Failed to get contract preview'
      }
    });
  }
};

module.exports = {
  generateContract,
  getContractHistory,
  deleteContract,
  getContractPreview
};
