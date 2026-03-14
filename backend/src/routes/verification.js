const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { supabaseAdmin } = require('../config/supabase')

// GET /api/verification/status — get current user's verification status
router.get('/status', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('vendor_verifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return res.json({ status: 'none', verification: null })
    }

    res.json({ status: data.status, verification: data })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch verification status' })
  }
})

// POST /api/verification/submit — submit verification (called from frontend after file upload)
router.post('/submit', authenticate, async (req, res) => {
  const { id_card_front_url, id_card_back_url, selfie_url } = req.body

  if (!id_card_front_url || !id_card_back_url || !selfie_url) {
    return res.status(400).json({ error: 'All document URLs are required' })
  }

  // Check user role — only vendor/agent/landlord need verification
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role, verification_status')
    .eq('id', req.user.id)
    .single()

  if (!profile || profile.role === 'buyer') {
    return res.status(400).json({ error: 'Buyers do not need verification' })
  }

  if (profile.verification_status === 'approved') {
    return res.status(400).json({ error: 'Account is already verified' })
  }

  try {
    // Create verification record
    const { data, error } = await supabaseAdmin
      .from('vendor_verifications')
      .insert({
        user_id: req.user.id,
        id_card_front_url,
        id_card_back_url,
        selfie_url,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    // Update profile verification status
    await supabaseAdmin
      .from('user_profiles')
      .update({ verification_status: 'pending' })
      .eq('id', req.user.id)

    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit verification' })
  }
})

module.exports = router
