import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../stores/authStore'
import { supabase } from '../lib/supabase'

const API = import.meta.env.VITE_API_URL || ''

const statusConfig = {
  pending: { color: 'bg-yellow-100 text-yellow-700', label: 'pending' },
  held: { color: 'bg-blue-100 text-blue-700', label: 'held' },
  released: { color: 'bg-green-100 text-green-700', label: 'released' },
  disputed: { color: 'bg-red-100 text-red-700', label: 'disputed' },
  refunded: { color: 'bg-purple-100 text-purple-700', label: 'refunded' },
  cancelled: { color: 'bg-gray-100 text-gray-600', label: 'cancelled' },
}

export default function EscrowDetail() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const [escrow, setEscrow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showDispute, setShowDispute] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [reviews, setReviews] = useState([])
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)

  useEffect(() => {
    fetchEscrow()
  }, [id])

  // Fetch reviews when escrow is loaded and released
  useEffect(() => {
    if (!escrow || escrow.status !== 'released') return
    async function fetchReviews() {
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(`${API}/api/reviews/escrow/${escrow.id}`, { headers })
        if (res.ok) {
          const data = await res.json()
          setReviews(data)
          // Check if current user already reviewed
          if (data.some((r) => r.reviewer_id === user?.id)) {
            setReviewSubmitted(true)
          }
        }
      } catch (err) {
        console.error('Failed to fetch reviews:', err)
      }
    }
    fetchReviews()
  }, [escrow?.id, escrow?.status])

  async function handleSubmitReview() {
    if (!reviewRating || reviewLoading) return
    setReviewLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API}/api/reviews`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          escrow_id: escrow.id,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
        }),
      })
      if (res.ok) {
        const review = await res.json()
        setReviews((prev) => [review, ...prev])
        setReviewSubmitted(true)
        setReviewRating(0)
        setReviewComment('')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to submit review')
      }
    } catch (err) {
      setError('Failed to submit review')
    } finally {
      setReviewLoading(false)
    }
  }

  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    }
  }

  async function fetchEscrow() {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API}/api/escrow/${id}`, { headers })
      if (res.ok) {
        setEscrow(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch escrow:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    setActionLoading(true)
    setError('')
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API}/api/escrow/${id}/confirm`, {
        method: 'POST',
        headers,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      await fetchEscrow()
      setShowConfirm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDispute() {
    if (!disputeReason.trim()) return
    setActionLoading(true)
    setError('')
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API}/api/escrow/${id}/dispute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: disputeReason }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      await fetchEscrow()
      setShowDispute(false)
      setDisputeReason('')
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  function getTimeRemaining(deadline) {
    if (!deadline) return null
    const remaining = new Date(deadline) - new Date()
    if (remaining <= 0) return 'Expired'
    const hours = Math.floor(remaining / (1000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!escrow) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Transaction Not Found</h1>
        <Link to="/dashboard/escrow" className="text-green-600 hover:underline">
          {t('common.back')}
        </Link>
      </div>
    )
  }

  const isBuyer = escrow.buyer_id === user?.id
  const config = statusConfig[escrow.status] || statusConfig.pending
  const timeLeft = escrow.status === 'held' ? getTimeRemaining(escrow.release_deadline) : null

  // Build timeline events
  const timeline = []
  if (escrow.created_at) {
    timeline.push({ label: t('escrow.created'), date: escrow.created_at, done: true })
  }
  if (escrow.held_at) {
    timeline.push({ label: t('escrow.paymentReceived'), date: escrow.held_at, done: true })
  }
  if (escrow.dispute_raised_at) {
    timeline.push({ label: t('escrow.disputeRaised'), date: escrow.dispute_raised_at, done: true, alert: true })
  }
  if (escrow.dispute_resolved_at) {
    timeline.push({ label: t('escrow.disputeResolved'), date: escrow.dispute_resolved_at, done: true })
  }
  if (escrow.released_at) {
    timeline.push({ label: t('escrow.paymentReleased'), date: escrow.released_at, done: true })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link
        to="/dashboard/escrow"
        className="text-sm text-green-600 hover:underline mb-4 inline-block"
      >
        &larr; {t('common.back')} to {t('escrow.title')}
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {escrow.listing?.title || 'Transaction'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {escrow.listing?.location}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              ID: {escrow.id.slice(0, 8)}...
            </p>
          </div>
          <span className={`text-sm px-4 py-2 rounded-full font-medium ${config.color}`}>
            {t(`escrow.${config.label}`)}
          </span>
        </div>

        {/* Amount breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">{t('escrow.amount')}</p>
            <p className="text-lg font-bold text-gray-900">
              {escrow.amount_fcfa?.toLocaleString()} FCFA
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('escrow.commission')}</p>
            <p className="text-lg font-semibold text-orange-600">
              -{escrow.commission_amount?.toLocaleString()} FCFA
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">{t('escrow.netPayout')}</p>
            <p className="text-lg font-bold text-green-600">
              {escrow.net_payout?.toLocaleString()} FCFA
            </p>
          </div>
        </div>

        {/* Auto-release countdown */}
        {escrow.status === 'held' && timeLeft && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            {t('escrow.autoRelease')}: <strong>{timeLeft}</strong>
          </div>
        )}
      </div>

      {/* Parties */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">{t('escrow.buyer')}</p>
          <p className="font-medium text-gray-900">{escrow.buyer?.full_name}</p>
          {(escrow.status === 'released' || escrow.status === 'refunded') && (
            <p className="text-xs text-gray-500 mt-1">{escrow.buyer?.phone}</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">{t('escrow.seller')}</p>
          <p className="font-medium text-gray-900">{escrow.seller?.full_name}</p>
          {(escrow.status === 'released' || escrow.status === 'refunded') && (
            <p className="text-xs text-gray-500 mt-1">{escrow.seller?.phone}</p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">{t('escrow.timeline')}</h2>
        <div className="space-y-4">
          {timeline.map((event, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${
                event.alert ? 'bg-red-500' : 'bg-green-500'
              }`} />
              <div>
                <p className={`text-sm font-medium ${event.alert ? 'text-red-700' : 'text-gray-900'}`}>
                  {event.label}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(event.date).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Dispute details */}
        {escrow.dispute_reason && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Dispute Reason</p>
            <p className="text-sm text-gray-700">{escrow.dispute_reason}</p>
          </div>
        )}
        {escrow.resolution && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">Resolution</p>
            <p className="text-sm text-gray-700">{escrow.resolution}</p>
            {escrow.resolution_type && (
              <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {escrow.resolution_type.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Payout logs */}
      {escrow.payouts?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Payouts</h2>
          <div className="space-y-3">
            {escrow.payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    p.type === 'payout' ? 'bg-green-100 text-green-700' :
                    p.type === 'refund' ? 'bg-purple-100 text-purple-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {p.type}
                  </span>
                  <span className="text-gray-500 ml-2">{p.notes}</span>
                </div>
                <span className="font-medium text-gray-900">
                  {p.amount?.toLocaleString()} FCFA
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons (buyer only, when held) */}
      {isBuyer && escrow.status === 'held' && (
        <div className="space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!showConfirm && !showDispute && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(true)}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                {t('escrow.confirmSatisfaction')}
              </button>
              <button
                onClick={() => setShowDispute(true)}
                className="flex-1 bg-white border border-red-300 text-red-600 py-3 rounded-lg font-medium hover:bg-red-50 transition-colors"
              >
                {t('escrow.raiseDispute')}
              </button>
            </div>
          )}

          {/* Confirm dialog */}
          {showConfirm && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <p className="text-sm text-green-800 mb-4">{t('escrow.confirmMessage')}</p>
              <div className="flex gap-3">
                <button
                  onClick={handleConfirm}
                  disabled={actionLoading}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading ? t('common.loading') : t('escrow.confirmSatisfaction')}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2.5 text-gray-600 hover:text-gray-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Dispute dialog */}
          {showDispute && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <p className="text-sm text-red-700 mb-3">{t('escrow.disputeWarning')}</p>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder={t('escrow.disputeReason')}
                rows={3}
                className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleDispute}
                  disabled={actionLoading || !disputeReason.trim()}
                  className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? t('common.loading') : t('escrow.raiseDispute')}
                </button>
                <button
                  onClick={() => { setShowDispute(false); setDisputeReason('') }}
                  className="px-4 py-2.5 text-gray-600 hover:text-gray-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Seller: dispute button when held */}
      {!isBuyer && escrow.status === 'held' && (
        <div className="space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!showDispute ? (
            <button
              onClick={() => setShowDispute(true)}
              className="w-full bg-white border border-red-300 text-red-600 py-3 rounded-lg font-medium hover:bg-red-50 transition-colors"
            >
              {t('escrow.raiseDispute')}
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <p className="text-sm text-red-700 mb-3">{t('escrow.disputeWarning')}</p>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder={t('escrow.disputeReason')}
                rows={3}
                className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleDispute}
                  disabled={actionLoading || !disputeReason.trim()}
                  className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? t('common.loading') : t('escrow.raiseDispute')}
                </button>
                <button
                  onClick={() => { setShowDispute(false); setDisputeReason('') }}
                  className="px-4 py-2.5 text-gray-600 hover:text-gray-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reviews section — only for released transactions */}
      {escrow.status === 'released' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mt-6">
          <h2 className="font-semibold text-gray-900 mb-4">{t('reviews.title')}</h2>

          {/* Review form (if user hasn't reviewed yet) */}
          {!reviewSubmitted && (
            <div className="mb-6 pb-6 border-b border-gray-100">
              <p className="text-sm text-gray-600 mb-3">{t('reviews.leaveReview')}</p>

              {/* Star rating picker */}
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="text-2xl transition-colors"
                  >
                    <span className={star <= reviewRating ? 'text-yellow-400' : 'text-gray-300'}>
                      &#9733;
                    </span>
                  </button>
                ))}
                {reviewRating > 0 && (
                  <span className="text-sm text-gray-500 ml-2">
                    {reviewRating}/5
                  </span>
                )}
              </div>

              {/* Comment */}
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={t('reviews.commentPlaceholder')}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
              />

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-sm text-red-700 mb-3">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmitReview}
                disabled={!reviewRating || reviewLoading}
                className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {reviewLoading ? t('common.loading') : t('reviews.submit')}
              </button>
            </div>
          )}

          {/* Existing reviews */}
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="flex gap-3">
                  <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="font-bold text-green-600 text-sm">
                      {review.reviewer?.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {review.reviewer?.full_name}
                      </p>
                      <span className="text-xs text-gray-400">
                        {review.reviewer?.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-sm ${star <= review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                        >
                          &#9733;
                        </span>
                      ))}
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-700 mt-1">{review.comment}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('reviews.noReviews')}</p>
          )}
        </div>
      )}
    </div>
  )
}
