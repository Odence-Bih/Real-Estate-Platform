// Vercel Cron endpoint for escrow auto-release
// Configured in vercel.json to run hourly
// Vercel Cron sends a GET request to this endpoint

require('dotenv').config({ path: require('path').resolve(__dirname, '../../backend/.env') })

const { supabaseAdmin } = require('../../backend/src/config/supabase')
const { notifyAutoRelease } = require('../../backend/src/services/notifications')

module.exports = async function handler(req, res) {
  // Verify this is called by Vercel Cron (not external)
  const authHeader = req.headers.authorization
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const now = new Date().toISOString()

    const { data: expiredEscrows, error } = await supabaseAdmin
      .from('escrow_transactions')
      .select('id, listing_id, seller_id, buyer_id, amount_fcfa, net_payout, commission_amount')
      .eq('status', 'held')
      .lt('release_deadline', now)

    if (error) {
      console.error('[CRON] Error fetching expired escrows:', error)
      return res.status(500).json({ error: 'Failed to fetch escrows' })
    }

    if (!expiredEscrows || expiredEscrows.length === 0) {
      return res.json({ message: 'No escrows to auto-release', released: 0 })
    }

    let released = 0

    for (const escrow of expiredEscrows) {
      try {
        await supabaseAdmin
          .from('escrow_transactions')
          .update({ status: 'released', released_at: now })
          .eq('id', escrow.id)

        await supabaseAdmin.from('payout_logs').insert({
          escrow_id: escrow.id,
          user_id: escrow.seller_id,
          amount: escrow.net_payout,
          type: 'payout',
          status: 'pending',
          notes: 'Auto-released after 72-hour window (no dispute raised)',
        })

        await supabaseAdmin.from('payout_logs').insert({
          escrow_id: escrow.id,
          user_id: escrow.seller_id,
          amount: escrow.commission_amount,
          type: 'commission',
          status: 'completed',
          notes: '10% platform commission (auto-release)',
        })

        const { data: listing } = await supabaseAdmin
          .from('listings')
          .select('transaction_type, title')
          .eq('id', escrow.listing_id)
          .single()

        await supabaseAdmin
          .from('listings')
          .update({ status: listing?.transaction_type === 'sale' ? 'sold' : 'rented' })
          .eq('id', escrow.listing_id)

        notifyAutoRelease({
          sellerId: escrow.seller_id,
          listingTitle: listing?.title || 'a property',
          escrowId: escrow.id,
          netPayout: escrow.net_payout,
        })

        released++
      } catch (err) {
        console.error(`[CRON] Failed to auto-release escrow ${escrow.id}:`, err)
      }
    }

    res.json({ message: `Auto-released ${released} escrow(s)`, released })
  } catch (err) {
    console.error('[CRON] Escrow auto-release failed:', err)
    res.status(500).json({ error: 'Cron job failed' })
  }
}
