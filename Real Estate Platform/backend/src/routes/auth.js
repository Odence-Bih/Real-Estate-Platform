const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { supabaseAdmin } = require('../config/supabase')

// GET /api/auth/profile — get current user's profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', req.user.id)
      .single()

    if (error) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

// PATCH /api/auth/profile — update current user's profile
router.patch('/profile', authenticate, async (req, res) => {
  const allowedFields = ['full_name', 'phone', 'bio', 'address', 'preferred_language']
  const updates = {}

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single()

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

module.exports = router
