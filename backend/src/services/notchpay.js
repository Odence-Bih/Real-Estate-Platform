/**
 * Notch Pay Integration Service
 * Handles payment initiation, verification, and webhook processing
 * for MTN Mobile Money and Orange Money in Cameroon.
 *
 * Docs: https://docs.notchpay.co
 */

const crypto = require('crypto')

const NOTCHPAY_BASE_URL = 'https://api.notchpay.co'
const PUBLIC_KEY = process.env.NOTCH_PAY_PUBLIC_KEY
const SECRET_KEY = process.env.NOTCH_PAY_SECRET_KEY
const WEBHOOK_SECRET = process.env.NOTCH_PAY_WEBHOOK_SECRET

/**
 * Initialize a payment
 * @param {Object} params
 * @param {number} params.amount - Amount in FCFA
 * @param {string} params.currency - Currency code (default: XAF)
 * @param {string} params.email - Customer email
 * @param {string} params.phone - Customer phone (for mobile money)
 * @param {string} params.description - Payment description
 * @param {string} params.reference - Internal reference (escrow ID)
 * @param {string} params.callback_url - URL for redirect after payment
 * @returns {Promise<Object>} Payment initialization response
 */
async function initializePayment({
  amount,
  currency = 'XAF',
  email,
  phone,
  description,
  reference,
  callback_url,
}) {
  if (!PUBLIC_KEY) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NOTCH_PAY_PUBLIC_KEY not configured')
    }
    console.warn('NOTCH_PAY_PUBLIC_KEY not set — returning mock payment')
    return {
      status: 'Accepted',
      transaction: {
        reference: `mock_${reference}_${Date.now()}`,
        amount,
        currency,
        status: 'pending',
        authorization_url: `${callback_url}?reference=mock_${reference}_${Date.now()}&status=complete`,
      },
    }
  }

  const response = await fetch(`${NOTCHPAY_BASE_URL}/payments/initialize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: PUBLIC_KEY,
    },
    body: JSON.stringify({
      amount,
      currency,
      email,
      phone,
      description,
      reference,
      callback: callback_url,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || 'Payment initialization failed')
  }

  return data
}

/**
 * Verify a payment by reference
 * @param {string} reference - Notch Pay transaction reference
 * @returns {Promise<Object>} Payment verification response
 */
async function verifyPayment(reference) {
  if (!SECRET_KEY) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NOTCH_PAY_SECRET_KEY not configured')
    }
    console.warn('NOTCH_PAY_SECRET_KEY not set — returning mock verification')
    return {
      status: 'Accepted',
      transaction: {
        reference,
        status: 'complete',
        amount: 0,
        currency: 'XAF',
      },
    }
  }

  const response = await fetch(
    `${NOTCHPAY_BASE_URL}/payments/${reference}`,
    {
      headers: {
        Authorization: SECRET_KEY,
      },
    }
  )

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || 'Payment verification failed')
  }

  return data
}

/**
 * Initiate a transfer/payout to a Mobile Money account
 * @param {Object} params
 * @param {number} params.amount - Amount in FCFA
 * @param {string} params.phone - Recipient phone number
 * @param {string} params.description - Payout description
 * @param {string} params.reference - Internal reference
 * @returns {Promise<Object>} Transfer response
 */
async function initiatePayout({
  amount,
  phone,
  description,
  reference,
}) {
  if (!SECRET_KEY) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NOTCH_PAY_SECRET_KEY not configured')
    }
    console.warn('NOTCH_PAY_SECRET_KEY not set — returning mock payout')
    return {
      status: 'Accepted',
      transfer: {
        reference: `mock_payout_${reference}_${Date.now()}`,
        amount,
        status: 'pending',
      },
    }
  }

  const response = await fetch(`${NOTCHPAY_BASE_URL}/transfers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: SECRET_KEY,
    },
    body: JSON.stringify({
      amount,
      currency: 'XAF',
      recipient: phone,
      description,
      reference,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || 'Payout initiation failed')
  }

  return data
}

/**
 * Verify webhook signature
 * @param {string} signature - X-Notch-Signature header value
 * @param {string} payload - Raw request body
 * @returns {boolean}
 */
function verifyWebhookSignature(signature, payload) {
  if (!WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL: NOTCH_PAY_WEBHOOK_SECRET not set in production — rejecting webhook')
      return false
    }
    console.warn('NOTCH_PAY_WEBHOOK_SECRET not set — skipping verification (dev mode)')
    return true
  }

  const hash = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')

  return hash === signature
}

module.exports = {
  initializePayment,
  verifyPayment,
  initiatePayout,
  verifyWebhookSignature,
}
