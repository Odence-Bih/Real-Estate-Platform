const express = require('express')
const router = express.Router()
const { authenticate, requireAdmin } = require('../middleware/auth')
const { supabaseAdmin } = require('../config/supabase')
const {
  initializePayment,
  verifyPayment,
  verifyWebhookSignature,
} = require('../services/notchpay')

const {
  notifyEscrowHeld,
  notifyEscrowReleased,
  notifyDisputeRaised,
  notifyDisputeResolved,
} = require('../services/notifications')

const COMMISSION_RATE = 0.1 // 10%
const DISPUTE_WINDOW_HOURS = 72

// POST /api/escrow/initiate — buyer initiates escrow payment
router.post('/initiate', authenticate, async (req, res) => {
  const { listing_id, amount } = req.body

  if (!listing_id || !amount || amount <= 0) {
    return res.status(400).json({ error: 'listing_id and valid amount are required' })
  }

  try {
    // Get listing + seller info
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('id, owner_id, title, price, transaction_type, status')
      .eq('id', listing_id)
      .single()

    if (!listing) return res.status(404).json({ error: 'Listing not found' })
    if (listing.status !== 'available') {
      return res.status(400).json({ error: 'Listing is no longer available' })
    }
    if (listing.owner_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot buy your own listing' })
    }

    // Get buyer profile
    const { data: buyer } = await supabaseAdmin
      .from('user_profiles')
      .select('email, phone')
      .eq('id', req.user.id)
      .single()

    // Calculate commission
    const commissionAmount = Math.round(amount * COMMISSION_RATE)
    const netPayout = amount - commissionAmount

    // Create escrow record
    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from('escrow_transactions')
      .insert({
        listing_id,
        buyer_id: req.user.id,
        seller_id: listing.owner_id,
        amount_fcfa: amount,
        commission_amount: commissionAmount,
        net_payout: netPayout,
        status: 'pending',
      })
      .select()
      .single()

    if (escrowError) throw escrowError

    // Initialize Notch Pay payment
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const paymentResult = await initializePayment({
      amount,
      email: buyer.email,
      phone: buyer.phone,
      description: `Escrow payment for: ${listing.title}`,
      reference: escrow.id,
      callback_url: `${frontendUrl}/dashboard/escrow?escrow=${escrow.id}`,
    })

    // Update escrow with payment reference
    await supabaseAdmin
      .from('escrow_transactions')
      .update({
        payment_reference: paymentResult.transaction?.reference,
        notchpay_transaction_id: paymentResult.transaction?.reference,
      })
      .eq('id', escrow.id)

    res.status(201).json({
      escrow_id: escrow.id,
      payment_url: paymentResult.transaction?.authorization_url,
      payment_reference: paymentResult.transaction?.reference,
    })
  } catch (err) {
    console.error('Escrow initiation error:', err)
    res.status(500).json({ error: 'Failed to initiate escrow payment' })
  }
})

// POST /api/escrow/webhook — Notch Pay webhook (unauthenticated)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-notch-signature']
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)

  if (!verifyWebhookSignature(signature, rawBody)) {
    return res.status(401).json({ error: 'Invalid webhook signature' })
  }

  const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

  try {
    // Store webhook event
    await supabaseAdmin.from('payment_webhook_events').insert({
      event_type: event.event || event.type || 'unknown',
      payload: event,
      processed: false,
    })

    const transaction = event.data?.transaction || event.data
    if (!transaction?.reference) {
      return res.json({ received: true })
    }

    // Find the escrow by payment reference
    const { data: escrow } = await supabaseAdmin
      .from('escrow_transactions')
      .select('id, status')
      .eq('payment_reference', transaction.reference)
      .single()

    if (!escrow) {
      return res.json({ received: true, note: 'No matching escrow found' })
    }

    // Update webhook event with escrow ID
    await supabaseAdmin
      .from('payment_webhook_events')
      .update({ escrow_id: escrow.id, processed: true })
      .eq('payload->>reference', transaction.reference)

    // Process based on event type
    const status = transaction.status?.toLowerCase()

    if (status === 'complete' || status === 'successful') {
      if (escrow.status === 'pending') {
        const releaseDeadline = new Date()
        releaseDeadline.setHours(releaseDeadline.getHours() + DISPUTE_WINDOW_HOURS)

        await supabaseAdmin
          .from('escrow_transactions')
          .update({
            status: 'held',
            held_at: new Date().toISOString(),
            release_deadline: releaseDeadline.toISOString(),
          })
          .eq('id', escrow.id)

        // Update listing status
        const { data: escrowData } = await supabaseAdmin
          .from('escrow_transactions')
          .select('listing_id')
          .eq('id', escrow.id)
          .single()

        if (escrowData) {
          await supabaseAdmin
            .from('listings')
            .update({ status: 'under_offer' })
            .eq('id', escrowData.listing_id)

          // Notify seller that payment is held
          const fullEscrow = (await supabaseAdmin
            .from('escrow_transactions')
            .select('*, buyer:user_profiles!buyer_id(full_name), listing:listings!listing_id(title)')
            .eq('id', escrow.id)
            .single()).data
          if (fullEscrow) {
            notifyEscrowHeld({
              sellerId: fullEscrow.seller_id,
              buyerName: fullEscrow.buyer?.full_name || 'A buyer',
              listingTitle: fullEscrow.listing?.title || 'a property',
              escrowId: escrow.id,
              amount: fullEscrow.amount_fcfa,
            })
          }
        }
      }
    } else if (status === 'failed' || status === 'cancelled') {
      if (escrow.status === 'pending') {
        await supabaseAdmin
          .from('escrow_transactions')
          .update({ status: 'cancelled' })
          .eq('id', escrow.id)
      }
    }

    res.json({ received: true })
  } catch (err) {
    console.error('Webhook processing error:', err)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

// POST /api/escrow/:id/verify — buyer verifies payment after redirect
router.post('/:id/verify', authenticate, async (req, res) => {
  try {
    const { data: escrow } = await supabaseAdmin
      .from('escrow_transactions')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (!escrow) return res.status(404).json({ error: 'Escrow not found' })
    if (escrow.buyer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    // If already held, just return the status
    if (escrow.status === 'held') {
      return res.json(escrow)
    }

    // Verify with Notch Pay
    if (escrow.payment_reference) {
      const verification = await verifyPayment(escrow.payment_reference)
      const paymentStatus = verification.transaction?.status?.toLowerCase()

      if (paymentStatus === 'complete' || paymentStatus === 'successful') {
        const releaseDeadline = new Date()
        releaseDeadline.setHours(releaseDeadline.getHours() + DISPUTE_WINDOW_HOURS)

        const { data: updated } = await supabaseAdmin
          .from('escrow_transactions')
          .update({
            status: 'held',
            held_at: new Date().toISOString(),
            release_deadline: releaseDeadline.toISOString(),
          })
          .eq('id', escrow.id)
          .select()
          .single()

        // Update listing
        await supabaseAdmin
          .from('listings')
          .update({ status: 'under_offer' })
          .eq('id', escrow.listing_id)

        return res.json(updated)
      }
    }

    res.json(escrow)
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify payment' })
  }
})

// POST /api/escrow/:id/confirm — buyer confirms satisfaction
router.post('/:id/confirm', authenticate, async (req, res) => {
  try {
    const { data: escrow } = await supabaseAdmin
      .from('escrow_transactions')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (!escrow) return res.status(404).json({ error: 'Escrow not found' })
    if (escrow.buyer_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the buyer can confirm' })
    }
    if (escrow.status !== 'held') {
      return res.status(400).json({ error: 'Payment must be held to confirm' })
    }

    // Release payment
    const { data: updated } = await supabaseAdmin
      .from('escrow_transactions')
      .update({
        status: 'released',
        buyer_confirmed_at: new Date().toISOString(),
        released_at: new Date().toISOString(),
      })
      .eq('id', escrow.id)
      .select()
      .single()

    // Create payout log for seller
    await supabaseAdmin.from('payout_logs').insert({
      escrow_id: escrow.id,
      user_id: escrow.seller_id,
      amount: escrow.net_payout,
      type: 'payout',
      status: 'pending',
      notes: 'Escrow released by buyer confirmation',
    })

    // Create commission log
    await supabaseAdmin.from('payout_logs').insert({
      escrow_id: escrow.id,
      user_id: escrow.seller_id,
      amount: escrow.commission_amount,
      type: 'commission',
      status: 'completed',
      notes: '10% platform commission',
    })

    // Update listing status
    const { data: listingData } = await supabaseAdmin
      .from('listings')
      .select('transaction_type, title')
      .eq('id', escrow.listing_id)
      .single()

    await supabaseAdmin
      .from('listings')
      .update({
        status: listingData?.transaction_type === 'sale' ? 'sold' : 'rented',
      })
      .eq('id', escrow.listing_id)

    // Notify seller
    notifyEscrowReleased({
      sellerId: escrow.seller_id,
      listingTitle: listingData?.title || 'a property',
      escrowId: escrow.id,
      netPayout: escrow.net_payout,
    })

    res.json(updated)
  } catch (err) {
    console.error('Confirm error:', err)
    res.status(500).json({ error: 'Failed to confirm and release payment' })
  }
})

// POST /api/escrow/:id/dispute — raise a dispute
router.post('/:id/dispute', authenticate, async (req, res) => {
  const { reason } = req.body

  if (!reason?.trim()) {
    return res.status(400).json({ error: 'Dispute reason is required' })
  }

  try {
    const { data: escrow } = await supabaseAdmin
      .from('escrow_transactions')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (!escrow) return res.status(404).json({ error: 'Escrow not found' })

    if (escrow.buyer_id !== req.user.id && escrow.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    if (escrow.status !== 'held') {
      return res.status(400).json({ error: 'Can only dispute held payments' })
    }

    const { data: updated } = await supabaseAdmin
      .from('escrow_transactions')
      .update({
        status: 'disputed',
        dispute_raised_at: new Date().toISOString(),
        dispute_reason: reason.trim(),
        dispute_raised_by: req.user.id,
      })
      .eq('id', escrow.id)
      .select()
      .single()

    // Audit log
    await supabaseAdmin.from('admin_audit_logs').insert({
      admin_id: req.user.id,
      action: 'raise_dispute',
      target_type: 'escrow_transaction',
      target_id: escrow.id,
      details: { reason: reason.trim() },
    })

    // Notify the other party
    const { data: listingInfo } = await supabaseAdmin
      .from('listings')
      .select('title')
      .eq('id', escrow.listing_id)
      .single()

    notifyDisputeRaised({
      buyerId: escrow.buyer_id,
      sellerId: escrow.seller_id,
      raisedBy: req.user.id,
      listingTitle: listingInfo?.title || 'a property',
      escrowId: escrow.id,
      reason: reason.trim(),
    })

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Failed to raise dispute' })
  }
})

// GET /api/escrow/admin/all — admin: list all escrows (must be before /:id)
router.get('/admin/all', authenticate, requireAdmin, async (req, res) => {
  const status = req.query.status

  try {
    let query = supabaseAdmin
      .from('escrow_transactions')
      .select(`
        *,
        listing:listings!listing_id (id, title),
        buyer:user_profiles!buyer_id (id, full_name),
        seller:user_profiles!seller_id (id, full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch escrow transactions' })
  }
})

// GET /api/escrow/my — get user's escrow transactions
router.get('/my', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('escrow_transactions')
      .select(`
        *,
        listing:listings!listing_id (id, title, price, transaction_type),
        buyer:user_profiles!buyer_id (id, full_name),
        seller:user_profiles!seller_id (id, full_name)
      `)
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch escrow transactions' })
  }
})

// GET /api/escrow/:id — get single escrow detail
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('escrow_transactions')
      .select(`
        *,
        listing:listings!listing_id (id, title, price, transaction_type, price_period, location),
        buyer:user_profiles!buyer_id (id, full_name, email, phone),
        seller:user_profiles!seller_id (id, full_name, email, phone)
      `)
      .eq('id', req.params.id)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Escrow not found' })
    }

    // Check authorization
    const isParticipant =
      data.buyer_id === req.user.id || data.seller_id === req.user.id

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()

    if (!isParticipant && profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' })
    }

    // Get payout logs
    const { data: payouts } = await supabaseAdmin
      .from('payout_logs')
      .select('*')
      .eq('escrow_id', req.params.id)
      .order('created_at', { ascending: false })

    data.payouts = payouts || []
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch escrow details' })
  }
})

// === Admin escrow routes ===

// POST /api/escrow/:id/admin/resolve — admin resolves a dispute
router.post('/:id/admin/resolve', authenticate, requireAdmin, async (req, res) => {
  const { resolution_type, resolution } = req.body

  if (!resolution_type || !['release_to_seller', 'refund_to_buyer', 'split'].includes(resolution_type)) {
    return res.status(400).json({ error: 'Valid resolution_type is required' })
  }

  try {
    const { data: escrow } = await supabaseAdmin
      .from('escrow_transactions')
      .select('*')
      .eq('id', req.params.id)
      .single()

    if (!escrow) return res.status(404).json({ error: 'Escrow not found' })
    if (escrow.status !== 'disputed') {
      return res.status(400).json({ error: 'Can only resolve disputed escrows' })
    }

    let newStatus = 'released'
    if (resolution_type === 'refund_to_buyer') newStatus = 'refunded'

    const { data: updated } = await supabaseAdmin
      .from('escrow_transactions')
      .update({
        status: newStatus,
        resolution_type,
        resolution: resolution || '',
        dispute_resolved_at: new Date().toISOString(),
        resolved_by: req.user.id,
        released_at: new Date().toISOString(),
      })
      .eq('id', escrow.id)
      .select()
      .single()

    // Create payout logs based on resolution
    if (resolution_type === 'release_to_seller') {
      await supabaseAdmin.from('payout_logs').insert({
        escrow_id: escrow.id,
        user_id: escrow.seller_id,
        amount: escrow.net_payout,
        type: 'payout',
        status: 'pending',
        notes: `Dispute resolved: released to seller. ${resolution || ''}`,
      })
    } else if (resolution_type === 'refund_to_buyer') {
      await supabaseAdmin.from('payout_logs').insert({
        escrow_id: escrow.id,
        user_id: escrow.buyer_id,
        amount: escrow.amount_fcfa,
        type: 'refund',
        status: 'pending',
        notes: `Dispute resolved: refunded to buyer. ${resolution || ''}`,
      })
    } else if (resolution_type === 'split') {
      const halfAmount = Math.round(escrow.amount_fcfa / 2)
      await supabaseAdmin.from('payout_logs').insert([
        {
          escrow_id: escrow.id,
          user_id: escrow.seller_id,
          amount: halfAmount,
          type: 'payout',
          status: 'pending',
          notes: `Dispute resolved: split. ${resolution || ''}`,
        },
        {
          escrow_id: escrow.id,
          user_id: escrow.buyer_id,
          amount: halfAmount,
          type: 'refund',
          status: 'pending',
          notes: `Dispute resolved: split. ${resolution || ''}`,
        },
      ])
    }

    // Audit log
    await supabaseAdmin.from('admin_audit_logs').insert({
      admin_id: req.user.id,
      action: 'resolve_dispute',
      target_type: 'escrow_transaction',
      target_id: escrow.id,
      details: { resolution_type, resolution },
    })

    // Notify both parties
    const { data: listingInfo } = await supabaseAdmin
      .from('listings')
      .select('title')
      .eq('id', escrow.listing_id)
      .single()

    notifyDisputeResolved({
      buyerId: escrow.buyer_id,
      sellerId: escrow.seller_id,
      escrowId: escrow.id,
      listingTitle: listingInfo?.title || 'a property',
      resolution: resolution || resolution_type,
    })

    res.json(updated)
  } catch (err) {
    console.error('Resolve error:', err)
    res.status(500).json({ error: 'Failed to resolve dispute' })
  }
})

module.exports = router
