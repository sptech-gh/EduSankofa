/**
 * Paystack Integration Service
 * EduSankofa School Management System — Ghana
 * 
 * Handles GHS Mobile Money (MTN, Telecel, AirtelTigo) & Card payments via Paystack.
 * All amounts are natively handled in Pesewas (1 GHS = 100 Pesewas).
 */

const crypto = require('crypto');
const axios = require('axios');
const logger = require('./logger');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const requirePaystackSecret = () => {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('Paystack Error: PAYSTACK_SECRET_KEY is not configured.');
  }
  return PAYSTACK_SECRET_KEY;
};

/**
 * Initialize a Paystack payment transaction for a student bill.
 * @param {Object} params
 * @param {string} params.email - Payer email address
 * @param {number} params.amountPesewas - Amount in pesewas (integer)
 * @param {string} params.reference - Unique payment reference number
 * @param {string} [params.callbackUrl] - Redirection URL post payment
 * @param {Object} [params.metadata] - Extra metadata (studentId, billId, schoolId)
 * @returns {Promise<{ authorization_url: string, access_code: string, reference: string }>}
 */
async function initializeTransaction({ email, amountPesewas, reference, callbackUrl, metadata = {} }) {
  const secret = requirePaystackSecret();
  if (!email || !amountPesewas || !reference) {
    throw new Error('Paystack Error: email, amountPesewas, and reference are required.');
  }

  if (amountPesewas <= 0 || amountPesewas % 1 !== 0) {
    throw new Error('Paystack Error: amountPesewas must be a positive integer.');
  }

  const payload = {
    email: String(email).trim().toLowerCase(),
    amount: Math.round(amountPesewas), // Paystack accepts amounts in pesewas for GHS
    currency: 'GHS',
    reference: String(reference).trim(),
    callback_url: callbackUrl || `${process.env.FRONTEND_URL || 'http://localhost:3001'}/accountant`,
    metadata: {
      ...metadata,
      system: 'EduSankofa',
      country: 'Ghana',
    },
    channels: ['mobile_money', 'card', 'bank'],
  };

  try {
    const response = await axios.post(`${PAYSTACK_BASE_URL}/transaction/initialize`, payload, {
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    if (response.data && response.data.status) {
      logger.info('Paystack transaction initialized', { reference, amountPesewas });
      return response.data.data;
    } else {
      throw new Error(response.data?.message || 'Paystack initialization failed');
    }
  } catch (err) {
    logger.error('Paystack transaction initialization failed', {
      error: err.message,
      reference,
      status: err.response?.status,
    });
    // Fallback for development/testing if API key is not configured
    throw new Error(err.response?.data?.message || err.message || 'Failed to initialize Paystack transaction');
  }
}

/**
 * Verify a Paystack transaction by reference.
 * @param {string} reference - Transaction reference
 * @returns {Promise<Object>} Paystack transaction data
 */
async function verifyTransaction(reference) {
  const secret = requirePaystackSecret();
  if (!reference) {
    throw new Error('Paystack Error: reference is required for verification.');
  }

  try {
    const response = await axios.get(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      timeout: 15000,
    });

    if (response.data && response.data.status) {
      return response.data.data;
    } else {
      throw new Error(response.data?.message || 'Paystack verification returned unsuccessful status');
    }
  } catch (err) {
    logger.error('Paystack transaction verification failed', { error: err.message, reference });
    throw new Error(err.response?.data?.message || err.message || 'Paystack transaction verification failed');
  }
}

/**
 * Verifies Paystack webhook SHA512 signature.
 * Uses constant-time comparison to prevent timing attacks.
 * @param {string|Buffer} rawBody - Raw request body
 * @param {string} signatureHeader - x-paystack-signature header
 * @returns {boolean} True if signature is valid
 */
function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = requirePaystackSecret();
  if (!signatureHeader || !rawBody) return false;
  const hash = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');
  
  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(signatureHeader, 'hex')
    );
  } catch (err) {
    // timingSafeEqual throws if buffers have different lengths
    return false;
  }
}

module.exports = {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
};
