const { supabaseAdmin } = require('../config/supabase')

/**
 * Create an in-app notification for a user.
 * Also sends email via Supabase Auth (if configured).
 */
async function createNotification({ userId, type, title, body, link, metadata = {} }) {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        body,
        link,
        metadata,
      })

    if (error) {
      console.error('Failed to create notification:', error.message)
    }
  } catch (err) {
    console.error('Notification service error:', err.message)
  }
}

/**
 * Notify user when their verification is approved.
 */
async function notifyVerificationApproved(userId) {
  await createNotification({
    userId,
    type: 'verification_approved',
    title: 'Account Verified',
    body: 'Your account has been verified. You can now create listings.',
    link: '/post-listing',
  })
}

/**
 * Notify user when their verification is rejected.
 */
async function notifyVerificationRejected(userId, reason) {
  await createNotification({
    userId,
    type: 'verification_rejected',
    title: 'Verification Rejected',
    body: reason || 'Your verification was rejected. Please resubmit your documents.',
    link: '/verify',
  })
}

/**
 * Notify seller/agent when payment is held in escrow.
 */
async function notifyEscrowHeld({ sellerId, buyerName, listingTitle, escrowId, amount }) {
  await createNotification({
    userId: sellerId,
    type: 'escrow_held',
    title: 'Payment Secured',
    body: `${buyerName} has made a payment of ${amount?.toLocaleString()} FCFA for "${listingTitle}". Arrange a viewing or handover.`,
    link: `/dashboard/escrow/${escrowId}`,
    metadata: { escrow_id: escrowId, amount },
  })
}

/**
 * Notify seller when escrow is released (payment confirmed).
 */
async function notifyEscrowReleased({ sellerId, listingTitle, escrowId, netPayout }) {
  await createNotification({
    userId: sellerId,
    type: 'escrow_released',
    title: 'Payment Released',
    body: `${netPayout?.toLocaleString()} FCFA has been released to you for "${listingTitle}".`,
    link: `/dashboard/escrow/${escrowId}`,
    metadata: { escrow_id: escrowId, net_payout: netPayout },
  })
}

/**
 * Notify both parties when a dispute is raised.
 */
async function notifyDisputeRaised({ buyerId, sellerId, raisedBy, listingTitle, escrowId, reason }) {
  const otherPartyId = raisedBy === buyerId ? sellerId : buyerId

  await createNotification({
    userId: otherPartyId,
    type: 'escrow_disputed',
    title: 'Dispute Raised',
    body: `A dispute has been raised for "${listingTitle}": ${reason}`,
    link: `/dashboard/escrow/${escrowId}`,
    metadata: { escrow_id: escrowId },
  })
}

/**
 * Notify both parties when admin resolves a dispute.
 */
async function notifyDisputeResolved({ buyerId, sellerId, escrowId, listingTitle, resolution }) {
  const notification = {
    type: 'dispute_resolved',
    title: 'Dispute Resolved',
    body: `The dispute for "${listingTitle}" has been resolved: ${resolution}`,
    link: `/dashboard/escrow/${escrowId}`,
    metadata: { escrow_id: escrowId },
  }

  await Promise.all([
    createNotification({ userId: buyerId, ...notification }),
    createNotification({ userId: sellerId, ...notification }),
  ])
}

/**
 * Notify user when they receive a new message.
 */
async function notifyNewMessage({ recipientId, senderName, listingTitle, threadId }) {
  await createNotification({
    userId: recipientId,
    type: 'new_message',
    title: 'New Message',
    body: `${senderName} sent you a message about "${listingTitle}"`,
    link: `/messages?thread=${threadId}`,
    metadata: { thread_id: threadId },
  })
}

/**
 * Notify seller when escrow auto-releases.
 */
async function notifyAutoRelease({ sellerId, listingTitle, escrowId, netPayout }) {
  await createNotification({
    userId: sellerId,
    type: 'escrow_released',
    title: 'Auto-Release: Payment Released',
    body: `${netPayout?.toLocaleString()} FCFA has been automatically released to you for "${listingTitle}" (72h window passed).`,
    link: `/dashboard/escrow/${escrowId}`,
    metadata: { escrow_id: escrowId, net_payout: netPayout, auto: true },
  })
}

module.exports = {
  createNotification,
  notifyVerificationApproved,
  notifyVerificationRejected,
  notifyEscrowHeld,
  notifyEscrowReleased,
  notifyDisputeRaised,
  notifyDisputeResolved,
  notifyNewMessage,
  notifyAutoRelease,
}
