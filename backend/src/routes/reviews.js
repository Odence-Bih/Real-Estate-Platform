const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { supabaseAdmin } = require('../config/supabase')

// POST /api/reviews — create a review after a completed deal
router.post('/', authenticate, async (req, res) => {
  const { escrow_id, rating, comment } = req.body

  if (!escrow_id || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'escrow_id and rating (1-5) are required' })
  }

  try {
    // Get the escrow transaction
    const { data: escrow } = await supabaseAdmin
      .from('escrow_transactions')
      .select('id, listing_id, buyer_id, seller_id, status')
      .eq('id', escrow_id)
      .single()

    if (!escrow) return res.status(404).json({ error: 'Transaction not found' })
    if (escrow.status !== 'released') {
      return res.status(400).json({ error: 'Can only review completed transactions' })
    }

    // Determine who is being reviewed
    const isBuyer = escrow.buyer_id === req.user.id
    const isSeller = escrow.seller_id === req.user.id

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ error: 'Only transaction participants can leave reviews' })
    }

    const revieweeId = isBuyer ? escrow.seller_id : escrow.buyer_id

    // Check for existing review
    const { data: existing } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('escrow_id', escrow_id)
      .eq('reviewer_id', req.user.id)
      .single()

    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed this transaction' })
    }

    const { data: review, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        escrow_id,
        listing_id: escrow.listing_id,
        reviewer_id: req.user.id,
        reviewee_id: revieweeId,
        rating: parseInt(rating),
        comment: comment?.trim() || null,
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(review)
  } catch (err) {
    console.error('Review creation error:', err)
    res.status(500).json({ error: 'Failed to create review' })
  }
})

// GET /api/reviews/user/:userId — get reviews for a user (agent/vendor profile)
router.get('/user/:userId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select(`
        *,
        reviewer:user_profiles!reviewer_id (id, full_name, role),
        listing:listings!listing_id (id, title)
      `)
      .eq('reviewee_id', req.params.userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Calculate average rating
    const ratings = data.map((r) => r.rating)
    const avgRating = ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
      : null

    res.json({
      reviews: data,
      average_rating: avgRating ? parseFloat(avgRating) : null,
      total_reviews: data.length,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' })
  }
})

// GET /api/reviews/escrow/:escrowId — get reviews for a specific transaction (participants only)
router.get('/escrow/:escrowId', authenticate, async (req, res) => {
  try {
    // Verify user is a participant in this escrow
    const { data: escrow } = await supabaseAdmin
      .from('escrow_transactions')
      .select('buyer_id, seller_id')
      .eq('id', req.params.escrowId)
      .single()

    if (!escrow) return res.status(404).json({ error: 'Transaction not found' })

    const isParticipant = escrow.buyer_id === req.user.id || escrow.seller_id === req.user.id
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select(`
        *,
        reviewer:user_profiles!reviewer_id (id, full_name, role)
      `)
      .eq('escrow_id', req.params.escrowId)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' })
  }
})

module.exports = router
