const express = require('express')
const router = express.Router()
const { authenticate, requireAdmin } = require('../middleware/auth')
const { supabaseAdmin } = require('../config/supabase')
const { notifyVerificationApproved, notifyVerificationRejected } = require('../services/notifications')

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin)

// GET /api/admin/verifications — list all pending verifications
router.get('/verifications', async (req, res) => {
  const status = req.query.status || 'pending'

  try {
    const { data, error } = await supabaseAdmin
      .from('vendor_verifications')
      .select(`
        *,
        user:user_profiles!user_id (
          id, email, full_name, phone, role, created_at
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch verifications' })
  }
})

// GET /api/admin/verifications/:id — get single verification with details
router.get('/verifications/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('vendor_verifications')
      .select(`
        *,
        user:user_profiles!user_id (
          id, email, full_name, phone, role, bio, address, created_at
        ),
        reviewer:user_profiles!reviewed_by (
          id, full_name, email
        )
      `)
      .eq('id', req.params.id)
      .single()

    if (error) throw error

    // Generate signed URLs for the documents (private buckets)
    const [frontUrl, backUrl, selfieUrl] = await Promise.all([
      supabaseAdmin.storage
        .from('id-documents')
        .createSignedUrl(data.id_card_front_url, 3600),
      supabaseAdmin.storage
        .from('id-documents')
        .createSignedUrl(data.id_card_back_url, 3600),
      supabaseAdmin.storage
        .from('selfies')
        .createSignedUrl(data.selfie_url, 3600),
    ])

    data.id_card_front_signed = frontUrl.data?.signedUrl
    data.id_card_back_signed = backUrl.data?.signedUrl
    data.selfie_signed = selfieUrl.data?.signedUrl

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch verification details' })
  }
})

// POST /api/admin/verifications/:id/approve
router.post('/verifications/:id/approve', async (req, res) => {
  try {
    // Get the verification record
    const { data: verification, error: fetchError } = await supabaseAdmin
      .from('vendor_verifications')
      .select('user_id, status')
      .eq('id', req.params.id)
      .single()

    if (fetchError || !verification) {
      return res.status(404).json({ error: 'Verification not found' })
    }

    if (verification.status !== 'pending') {
      return res.status(400).json({ error: 'Verification already processed' })
    }

    // Update verification status
    const { error: updateError } = await supabaseAdmin
      .from('vendor_verifications')
      .update({
        status: 'approved',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)

    if (updateError) throw updateError

    // Update user profile verification status
    await supabaseAdmin
      .from('user_profiles')
      .update({ verification_status: 'approved' })
      .eq('id', verification.user_id)

    // Create audit log
    await supabaseAdmin.from('admin_audit_logs').insert({
      admin_id: req.user.id,
      action: 'approve_verification',
      target_type: 'vendor_verification',
      target_id: req.params.id,
      details: { user_id: verification.user_id },
    })

    // Notify user
    notifyVerificationApproved(verification.user_id)

    res.json({ message: 'Verification approved' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve verification' })
  }
})

// POST /api/admin/verifications/:id/reject
router.post('/verifications/:id/reject', async (req, res) => {
  const { reason } = req.body

  try {
    const { data: verification, error: fetchError } = await supabaseAdmin
      .from('vendor_verifications')
      .select('user_id, status')
      .eq('id', req.params.id)
      .single()

    if (fetchError || !verification) {
      return res.status(404).json({ error: 'Verification not found' })
    }

    if (verification.status !== 'pending') {
      return res.status(400).json({ error: 'Verification already processed' })
    }

    // Update verification status
    const { error: updateError } = await supabaseAdmin
      .from('vendor_verifications')
      .update({
        status: 'rejected',
        rejection_reason: reason || 'No reason provided',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)

    if (updateError) throw updateError

    // Update user profile verification status
    await supabaseAdmin
      .from('user_profiles')
      .update({ verification_status: 'rejected' })
      .eq('id', verification.user_id)

    // Create audit log
    await supabaseAdmin.from('admin_audit_logs').insert({
      admin_id: req.user.id,
      action: 'reject_verification',
      target_type: 'vendor_verification',
      target_id: req.params.id,
      details: { user_id: verification.user_id, reason },
    })

    // Notify user
    notifyVerificationRejected(verification.user_id, reason)

    res.json({ message: 'Verification rejected' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject verification' })
  }
})

// GET /api/admin/audit-logs — view audit trail
router.get('/audit-logs', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_audit_logs')
      .select(`
        *,
        admin:user_profiles!admin_id (
          id, full_name, email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' })
  }
})

// GET /api/admin/stats — basic dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [pending, approved, rejected, totalUsers] = await Promise.all([
      supabaseAdmin
        .from('vendor_verifications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabaseAdmin
        .from('vendor_verifications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved'),
      supabaseAdmin
        .from('vendor_verifications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'rejected'),
      supabaseAdmin
        .from('user_profiles')
        .select('id', { count: 'exact', head: true }),
    ])

    res.json({
      pendingVerifications: pending.count || 0,
      approvedVerifications: approved.count || 0,
      rejectedVerifications: rejected.count || 0,
      totalUsers: totalUsers.count || 0,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

module.exports = router
