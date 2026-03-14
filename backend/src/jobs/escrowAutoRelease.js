const cron = require('node-cron')
const { supabaseAdmin } = require('../config/supabase')
const { notifyAutoRelease } = require('../services/notifications')

/**
 * Escrow Auto-Release Job
 * Runs every hour. Releases escrow payments where:
 * - Status is 'held'
 * - Release deadline has passed (72 hours after held_at)
 * - No dispute was raised
 */
function startEscrowAutoRelease() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Checking for auto-release escrows...')

    try {
      const now = new Date().toISOString()

      // Find held escrows past their release deadline
      const { data: expiredEscrows, error } = await supabaseAdmin
        .from('escrow_transactions')
        .select('id, listing_id, seller_id, buyer_id, amount_fcfa, net_payout, commission_amount')
        .eq('status', 'held')
        .lt('release_deadline', now)

      if (error) {
        console.error('[CRON] Error fetching expired escrows:', error)
        return
      }

      if (!expiredEscrows || expiredEscrows.length === 0) {
        console.log('[CRON] No escrows to auto-release')
        return
      }

      console.log(`[CRON] Auto-releasing ${expiredEscrows.length} escrow(s)`)

      for (const escrow of expiredEscrows) {
        try {
          // Release the escrow
          await supabaseAdmin
            .from('escrow_transactions')
            .update({
              status: 'released',
              released_at: now,
            })
            .eq('id', escrow.id)

          // Create payout log for seller
          await supabaseAdmin.from('payout_logs').insert({
            escrow_id: escrow.id,
            user_id: escrow.seller_id,
            amount: escrow.net_payout,
            type: 'payout',
            status: 'pending',
            notes: 'Auto-released after 72-hour window (no dispute raised)',
          })

          // Create commission log
          await supabaseAdmin.from('payout_logs').insert({
            escrow_id: escrow.id,
            user_id: escrow.seller_id,
            amount: escrow.commission_amount,
            type: 'commission',
            status: 'completed',
            notes: '10% platform commission (auto-release)',
          })

          // Update listing status
          const { data: listing } = await supabaseAdmin
            .from('listings')
            .select('transaction_type, title')
            .eq('id', escrow.listing_id)
            .single()

          await supabaseAdmin
            .from('listings')
            .update({
              status: listing?.transaction_type === 'sale' ? 'sold' : 'rented',
            })
            .eq('id', escrow.listing_id)

          // Notify seller
          notifyAutoRelease({
            sellerId: escrow.seller_id,
            listingTitle: listing?.title || 'a property',
            escrowId: escrow.id,
            netPayout: escrow.net_payout,
          })

          console.log(`[CRON] Auto-released escrow ${escrow.id}`)
        } catch (err) {
          console.error(`[CRON] Failed to auto-release escrow ${escrow.id}:`, err)
        }
      }
    } catch (err) {
      console.error('[CRON] Escrow auto-release job failed:', err)
    }
  })

  console.log('Escrow auto-release cron job started (runs every hour)')
}

module.exports = { startEscrowAutoRelease }
