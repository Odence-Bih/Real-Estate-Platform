const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { supabaseAdmin } = require('../config/supabase')
const { notifyNewMessage } = require('../services/notifications')

// All message routes require auth
router.use(authenticate)

// GET /api/messages/threads — list user's threads
router.get('/threads', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('message_threads')
      .select(`
        *,
        listing:listings!listing_id (id, title, price, transaction_type,
          images:listing_images (image_url, display_order)
        ),
        buyer:user_profiles!buyer_id (id, full_name, role),
        seller:user_profiles!seller_id (id, full_name, role)
      `)
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)
      .order('last_message_at', { ascending: false })

    if (error) throw error

    // Get unread count per thread
    const threadsWithUnread = await Promise.all(
      data.map(async (thread) => {
        const { count } = await supabaseAdmin
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('thread_id', thread.id)
          .eq('is_read', false)
          .neq('sender_id', req.user.id)

        return { ...thread, unread_count: count || 0 }
      })
    )

    res.json(threadsWithUnread)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch threads' })
  }
})

// POST /api/messages/threads — create or get existing thread
router.post('/threads', async (req, res) => {
  const { listing_id, seller_id } = req.body

  if (!listing_id || !seller_id) {
    return res.status(400).json({ error: 'listing_id and seller_id are required' })
  }

  if (seller_id === req.user.id) {
    return res.status(400).json({ error: 'Cannot message yourself' })
  }

  try {
    // Check if thread already exists
    const { data: existing } = await supabaseAdmin
      .from('message_threads')
      .select('id')
      .eq('listing_id', listing_id)
      .eq('buyer_id', req.user.id)
      .eq('seller_id', seller_id)
      .single()

    if (existing) {
      return res.json({ id: existing.id, existing: true })
    }

    // Create new thread
    const { data, error } = await supabaseAdmin
      .from('message_threads')
      .insert({
        listing_id,
        buyer_id: req.user.id,
        seller_id,
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json({ id: data.id, existing: false })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create thread' })
  }
})

// GET /api/messages/threads/:threadId — get messages in a thread
router.get('/threads/:threadId', async (req, res) => {
  try {
    // Verify user is participant
    const { data: thread, error: threadError } = await supabaseAdmin
      .from('message_threads')
      .select(`
        *,
        listing:listings!listing_id (id, title, price, transaction_type, price_period,
          images:listing_images (image_url, display_order)
        ),
        buyer:user_profiles!buyer_id (id, full_name, role),
        seller:user_profiles!seller_id (id, full_name, role)
      `)
      .eq('id', req.params.threadId)
      .single()

    if (threadError || !thread) {
      return res.status(404).json({ error: 'Thread not found' })
    }

    if (thread.buyer_id !== req.user.id && thread.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    // Get messages
    const { data: messages, error: msgError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('thread_id', req.params.threadId)
      .order('created_at', { ascending: true })

    if (msgError) throw msgError

    // Mark unread messages as read
    await supabaseAdmin
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('thread_id', req.params.threadId)
      .eq('is_read', false)
      .neq('sender_id', req.user.id)

    res.json({ thread, messages })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

// POST /api/messages/threads/:threadId — send a message
router.post('/threads/:threadId', async (req, res) => {
  const { content, attachment_url } = req.body

  if (!content?.trim()) {
    return res.status(400).json({ error: 'Message content is required' })
  }

  try {
    // Verify user is participant
    const { data: thread } = await supabaseAdmin
      .from('message_threads')
      .select('buyer_id, seller_id')
      .eq('id', req.params.threadId)
      .single()

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' })
    }

    if (thread.buyer_id !== req.user.id && thread.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    // Check for phone number pattern and prepare warning
    const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
    const hasPhone = phonePattern.test(content)

    // Insert message
    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .insert({
        thread_id: req.params.threadId,
        sender_id: req.user.id,
        content: content.trim(),
        attachment_url: attachment_url || null,
      })
      .select()
      .single()

    if (error) throw error

    // Update thread last_message_at
    await supabaseAdmin
      .from('message_threads')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', req.params.threadId)

    // Notify the other party
    const recipientId = thread.buyer_id === req.user.id ? thread.seller_id : thread.buyer_id
    const { data: senderProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('full_name')
      .eq('id', req.user.id)
      .single()
    const { data: threadListing } = await supabaseAdmin
      .from('message_threads')
      .select('listing:listings!listing_id(title)')
      .eq('id', req.params.threadId)
      .single()

    notifyNewMessage({
      recipientId,
      senderName: senderProfile?.full_name || 'Someone',
      listingTitle: threadListing?.listing?.title || 'a property',
      threadId: req.params.threadId,
    })

    res.status(201).json({
      message,
      phone_warning: hasPhone
        ? 'For your protection, we recommend keeping all communication on-platform.'
        : null,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' })
  }
})

// GET /api/messages/unread-count — total unread messages
router.get('/unread-count', async (req, res) => {
  try {
    // Get threads where user is participant
    const { data: threads } = await supabaseAdmin
      .from('message_threads')
      .select('id')
      .or(`buyer_id.eq.${req.user.id},seller_id.eq.${req.user.id}`)

    if (!threads || threads.length === 0) {
      return res.json({ count: 0 })
    }

    const threadIds = threads.map((t) => t.id)

    const { count } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('thread_id', threadIds)
      .eq('is_read', false)
      .neq('sender_id', req.user.id)

    res.json({ count: count || 0 })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unread count' })
  }
})

module.exports = router
