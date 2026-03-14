import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../stores/authStore'
import { supabase } from '../lib/supabase'

const API = import.meta.env.VITE_API_URL || ''

const statusConfig = {
  pending: { color: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
  held: { color: 'bg-blue-100 text-blue-700', icon: '🔒' },
  released: { color: 'bg-green-100 text-green-700', icon: '✅' },
  disputed: { color: 'bg-red-100 text-red-700', icon: '⚠️' },
  refunded: { color: 'bg-purple-100 text-purple-700', icon: '↩️' },
  cancelled: { color: 'bg-gray-100 text-gray-600', icon: '✕' },
}

export default function EscrowDashboard() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [searchParams] = useSearchParams()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [verifyingEscrow, setVerifyingEscrow] = useState(null)

  // Check if redirected from payment
  const escrowFromPayment = searchParams.get('escrow')

  useEffect(() => {
    fetchTransactions()
    if (escrowFromPayment) {
      verifyPayment(escrowFromPayment)
    }
  }, [])

  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    }
  }

  async function fetchTransactions() {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API}/api/escrow/my`, { headers })
      if (res.ok) {
        const data = await res.json()
        setTransactions(data)
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err)
    } finally {
      setLoading(false)
    }
  }

  async function verifyPayment(escrowId) {
    setVerifyingEscrow(escrowId)
    try {
      const headers = await getAuthHeaders()
      await fetch(`${API}/api/escrow/${escrowId}/verify`, {
        method: 'POST',
        headers,
      })
      await fetchTransactions()
    } catch (err) {
      console.error('Verify error:', err)
    } finally {
      setVerifyingEscrow(null)
    }
  }

  const filtered = filter === 'all'
    ? transactions
    : transactions.filter((t) => t.status === filter)

  function getTimeRemaining(deadline) {
    if (!deadline) return null
    const remaining = new Date(deadline) - new Date()
    if (remaining <= 0) return null
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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('escrow.title')}</h1>
        <Link
          to="/dashboard"
          className="text-sm text-green-600 hover:underline"
        >
          {t('common.back')} to {t('common.dashboard')}
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
        {['all', 'pending', 'held', 'released', 'disputed', 'refunded'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === s
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'all' ? 'All' : t(`escrow.${s}`)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">📋</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {t('escrow.noTransactions')}
          </h2>
          <p className="text-gray-500 mb-6">{t('escrow.noTransactionsDesc')}</p>
          <Link
            to="/listings"
            className="inline-block bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700"
          >
            {t('common.listings')}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((tx) => {
            const isBuyer = tx.buyer_id === user?.id
            const config = statusConfig[tx.status] || statusConfig.pending
            const timeLeft = tx.status === 'held' ? getTimeRemaining(tx.release_deadline) : null

            return (
              <Link
                key={tx.id}
                to={`/dashboard/escrow/${tx.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-green-300 hover:shadow-sm transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Left: Listing info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {tx.listing?.title || 'Listing'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {isBuyer ? t('escrow.seller') : t('escrow.buyer')}:{' '}
                      {isBuyer ? tx.seller?.full_name : tx.buyer?.full_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Center: Amount */}
                  <div className="text-right sm:text-center">
                    <p className="text-lg font-bold text-gray-900">
                      {tx.amount_fcfa?.toLocaleString()} FCFA
                    </p>
                    {isBuyer && tx.status === 'held' && timeLeft && (
                      <p className="text-xs text-blue-600 mt-1">
                        {t('escrow.autoRelease')}: {timeLeft}
                      </p>
                    )}
                  </div>

                  {/* Right: Status badge */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${config.color}`}>
                      {config.icon} {t(`escrow.${tx.status}`)}
                    </span>
                    {verifyingEscrow === tx.id && (
                      <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
