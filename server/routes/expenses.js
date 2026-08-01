const express = require('express');
const mongoose = require('mongoose');
const { auth, authorizeRoles } = require('../middleware/auth');
const ExpenseVoucher = require('../models/ExpenseVoucher');
const SchoolProfile = require('../models/SchoolProfile');
const { generateVoucherNumber } = require('../utils/currency');
const { generateCSV, sendCSVResponse } = require('../utils/csvExporter');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

const toAuditRole = (role) => String(role || 'Staff')
  .trim()
  .toLowerCase()
  .split(/\s+/)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const getAuditUserName = (user) => (
  user?.name
  || [user?.firstName, user?.lastName].filter(Boolean).join(' ')
  || user?.email
  || 'Financial User'
);

const createAuditLog = async ({ req, action, resource, resourceType, resourceId, notes, session }) => {
  const log = new AuditLog({
    user: req.user._id || req.user.userId,
    userRole: toAuditRole(req.user.role),
    userName: getAuditUserName(req.user),
    action,
    category: 'FINANCIAL',
    resource,
    resourceType,
    resourceId,
    ipAddress: req.ip || '127.0.0.1',
    userAgent: req.headers['user-agent'] || '',
    notes,
  });
  await log.save({ session });
};

const getApprovalTier = (amountPesewas, schoolProfile) => {
  const pettyCashLimit = schoolProfile?.financialSettings?.pettyCashLimitPesewas;
  const majorExpenseLimit = schoolProfile?.financialSettings?.majorExpenseLimitPesewas;

  if (!Number.isInteger(pettyCashLimit) || !Number.isInteger(majorExpenseLimit)) {
    throw Object.assign(new Error('Expense approval thresholds are not configured for this school'), { statusCode: 409 });
  }
  if (pettyCashLimit >= majorExpenseLimit) {
    throw Object.assign(new Error('pettyCashLimitPesewas must be lower than majorExpenseLimitPesewas'), { statusCode: 409 });
  }

  if (amountPesewas < pettyCashLimit) return 'PETTY_CASH';
  if (amountPesewas < majorExpenseLimit) return 'STANDARD';
  return 'MAJOR';
};

const nextStatusForTier = (approvalTier) => {
  if (approvalTier === 'PETTY_CASH') return 'APPROVED';
  return 'PENDING_ACCOUNTANT_APPROVAL';
};

const isHeadApprovalRole = (role) => ['admin', 'school admin', 'headmaster', 'proprietor'].includes(String(role || '').toLowerCase());

/**
 * @route   POST /api/expenses
 * @desc    Create a new expense voucher draft
 * @access  Authenticated (Accountant, Admin, Staff)
 */
router.post('/', auth, authorizeRoles('admin', 'school admin', 'accountant', 'accounts officer', 'staff'), async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { category, description, amountPesewas, payeeName, paymentMethod } = req.body;

    if (!category || !description || !amountPesewas || !payeeName) {
      return res.status(400).json({ message: 'category, description, amountPesewas, and payeeName are required.' });
    }

    if (amountPesewas <= 0 || amountPesewas % 1 !== 0) {
      return res.status(400).json({ message: 'amountPesewas must be a positive integer in pesewas.' });
    }

    let voucher;
    await session.withTransaction(async () => {
      // 1. Prefer tenant context from authenticated user (AsyncLocalStorage)
      const { getTenantSchoolId } = require("../middleware/tenantContext");
      const tenantSchoolId = getTenantSchoolId();

      // 2. Fallback: default profile (single-school databases)
      const schoolProfile = tenantSchoolId
        ? { _id: tenantSchoolId }
        : await SchoolProfile.findOne({ key: 'default' }).session(session);

      if (!schoolProfile) {
        throw new Error('School not configured');
      }

      const schoolId = schoolProfile._id;
      const voucherNumber = await generateVoucherNumber(schoolId, session);

      voucher = new ExpenseVoucher({
        voucherNumber,
        schoolId,
        category,
        description,
        amountPesewas: Number(amountPesewas),
        payeeName,
        paymentMethod: paymentMethod || 'CASH',
        status: 'DRAFT',
        requestedBy: req.user._id || req.user.userId,
      });

      await voucher.save({ session });
      await createAuditLog({
        req,
        action: 'EXPENSE_REQUEST',
        resource: `Expense voucher ${voucher.voucherNumber}`,
        resourceType: 'Voucher',
        resourceId: voucher._id,
        notes: `Draft expense voucher created for ${payeeName}`,
        session,
      });
    });

    res.status(201).json({ success: true, voucher });
  } catch (err) {
    next(err);
  } finally {
    session.endSession();
  }
});

/**
 * @route   GET /api/expenses
 * @desc    List expense vouchers with optional status/category filter & CSV export
 * @access  Authenticated
 */
router.get('/', auth, async (req, res, next) => {
  try {
    const { status, category, format } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const vouchers = await ExpenseVoucher.find(filter)
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    if (String(format).toLowerCase() === 'csv' || String(format).toLowerCase() === 'excel') {
      const rows = vouchers.map(v => ({
        voucherNumber: v.voucherNumber,
        category: v.category,
        payeeName: v.payeeName,
        amountGHS: (v.amountPesewas / 100).toFixed(2),
        paymentMethod: v.paymentMethod,
        status: v.status,
        requestedBy: v.requestedBy ? v.requestedBy.name : 'Unknown',
        date: v.createdAt ? new Date(v.createdAt).toISOString().slice(0, 10) : '',
      }));
      const cols = [
        { key: 'voucherNumber', label: 'Voucher No.' },
        { key: 'category', label: 'Category' },
        { key: 'payeeName', label: 'Payee' },
        { key: 'amountGHS', label: 'Amount (GHS)' },
        { key: 'paymentMethod', label: 'Method' },
        { key: 'status', label: 'Status' },
        { key: 'requestedBy', label: 'Requested By' },
        { key: 'date', label: 'Date' },
      ];
      const csvStr = generateCSV(rows, cols);
      return sendCSVResponse(res, 'expense-vouchers.csv', csvStr);
    }

    res.json({ success: true, vouchers });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PUT /api/expenses/:id/submit
 * @desc    Submit DRAFT voucher for approval
 * @access  Authenticated (Accountant, Staff)
 */
router.put('/:id/submit', auth, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    let voucher;
    await session.withTransaction(async () => {
      voucher = await ExpenseVoucher.findById(req.params.id).session(session);
      if (!voucher) throw Object.assign(new Error('Voucher not found'), { statusCode: 404 });
      if (voucher.status !== 'DRAFT') {
        throw Object.assign(new Error(`Voucher is in ${voucher.status} state. Only DRAFT can be submitted.`), { statusCode: 400 });
      }

      const schoolProfile = await SchoolProfile.findById(voucher.schoolId).session(session);
      voucher.approvalTier = getApprovalTier(voucher.amountPesewas, schoolProfile);
      voucher.status = nextStatusForTier(voucher.approvalTier);

      if (voucher.approvalTier === 'PETTY_CASH') {
        voucher.approvedBy = req.user._id || req.user.userId;
        voucher.approvedAt = new Date();
        voucher.approvalSteps.push({
          role: toAuditRole(req.user.role),
          approvedBy: req.user._id || req.user.userId,
          approvedAt: new Date(),
          decision: 'APPROVED',
          reason: 'Petty cash threshold auto-approval',
        });
      }

      await voucher.save({ session });
      await createAuditLog({
        req,
        action: voucher.approvalTier === 'PETTY_CASH' ? 'EXPENSE_APPROVE' : 'VOUCHER_ISSUE',
        resource: `Expense voucher ${voucher.voucherNumber}`,
        resourceType: 'Voucher',
        resourceId: voucher._id,
        notes: `Voucher submitted as ${voucher.approvalTier}`,
        session,
      });
    });

    res.json({ success: true, voucher });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || 'Server error' });
  } finally {
    session.endSession();
  }
});

/**
 * @route   PUT /api/expenses/:id/approve
 * @desc    Approve or reject a PENDING_APPROVAL voucher
 * @access  Authenticated (Admin, School Admin, Headteacher)
 */
router.put('/:id/approve', auth, authorizeRoles('admin', 'school admin', 'accountant', 'headmaster', 'proprietor'), async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { action, rejectionReason } = req.body;
    let voucher;
    await session.withTransaction(async () => {
      voucher = await ExpenseVoucher.findById(req.params.id).session(session);
      if (!voucher) throw Object.assign(new Error('Voucher not found'), { statusCode: 404 });
      if (!['PENDING_APPROVAL', 'PENDING_ACCOUNTANT_APPROVAL', 'PENDING_HEAD_APPROVAL'].includes(voucher.status)) {
        throw Object.assign(new Error(`Voucher is in ${voucher.status} state. Only pending vouchers can be approved.`), { statusCode: 400 });
      }

      const normalizedAction = String(action || 'APPROVE').trim().toUpperCase();
      if (!['APPROVE', 'REJECT'].includes(normalizedAction)) {
        throw Object.assign(new Error('action must be APPROVE or REJECT'), { statusCode: 400 });
      }

      if (voucher.status === 'PENDING_ACCOUNTANT_APPROVAL' && String(req.user.role).toLowerCase() !== 'accountant' && !['admin', 'school admin'].includes(String(req.user.role).toLowerCase())) {
        throw Object.assign(new Error('Accountant approval is required for this voucher'), { statusCode: 403 });
      }
      if (voucher.status === 'PENDING_HEAD_APPROVAL' && !isHeadApprovalRole(req.user.role)) {
        throw Object.assign(new Error('Headmaster or proprietor approval is required for this voucher'), { statusCode: 403 });
      }

      const approvalRole = voucher.status === 'PENDING_HEAD_APPROVAL'
        ? (String(req.user.role).toLowerCase() === 'proprietor' ? 'Proprietor' : 'Headmaster')
        : 'Accountant';

      voucher.approvalSteps.push({
        role: approvalRole,
        approvedBy: req.user._id || req.user.userId,
        approvedAt: new Date(),
        decision: normalizedAction === 'REJECT' ? 'REJECTED' : 'APPROVED',
        reason: rejectionReason,
      });

      if (normalizedAction === 'REJECT') {
        voucher.status = 'REJECTED';
        voucher.rejectionReason = rejectionReason || 'Rejected by approver';
      } else if (voucher.approvalTier === 'MAJOR' && voucher.status === 'PENDING_ACCOUNTANT_APPROVAL') {
        voucher.status = 'PENDING_HEAD_APPROVAL';
      } else {
        voucher.status = 'APPROVED';
        voucher.approvedBy = req.user._id || req.user.userId;
        voucher.approvedAt = new Date();
      }

      await voucher.save({ session });
      await createAuditLog({
        req,
        action: normalizedAction === 'REJECT' ? 'EXPENSE_REJECT' : 'EXPENSE_APPROVE',
        resource: `Expense voucher ${voucher.voucherNumber}`,
        resourceType: 'Voucher',
        resourceId: voucher._id,
        notes: rejectionReason || `${approvalRole} ${normalizedAction.toLowerCase()}d voucher`,
        session,
      });
    });

    res.json({ success: true, voucher });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || 'Server error' });
  } finally {
    session.endSession();
  }
});

/**
 * @route   PUT /api/expenses/:id/pay
 * @desc    Mark APPROVED voucher as PAID
 * @access  Authenticated (Accountant, Accounts Officer, Admin)
 */
router.put('/:id/pay', auth, authorizeRoles('admin', 'school admin', 'accountant', 'accounts officer'), async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { paymentReference } = req.body;
    let voucher;
    await session.withTransaction(async () => {
      voucher = await ExpenseVoucher.findById(req.params.id).session(session);
      if (!voucher) throw Object.assign(new Error('Voucher not found'), { statusCode: 404 });
      if (voucher.status !== 'APPROVED') {
        throw Object.assign(new Error(`Voucher is in ${voucher.status} state. Only APPROVED vouchers can be marked as PAID.`), { statusCode: 400 });
      }

      voucher.status = 'PAID';
      voucher.paidAt = new Date();
      if (paymentReference) voucher.paymentReference = paymentReference;

      await voucher.save({ session });
      await createAuditLog({
        req,
        action: 'VOUCHER_ISSUE',
        resource: `Expense voucher ${voucher.voucherNumber}`,
        resourceType: 'Voucher',
        resourceId: voucher._id,
        notes: paymentReference ? `Voucher paid with reference ${paymentReference}` : 'Voucher marked as paid',
        session,
      });
    });

    res.json({ success: true, voucher });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message || 'Server error' });
  } finally {
    session.endSession();
  }
});

module.exports = router;
