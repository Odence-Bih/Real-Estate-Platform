import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const API = import.meta.env.VITE_API_URL || ''

const statusConfig = {
  pending: { color: 'bg-yellow-100 text-yellow-700' },
  held: { color: 'bg-blue-100 text-blue-700' },
  released: { color: 'bg-green-100 text-green-700' },
  disputed: { color: 'bg-red-100 text-red-700' },
  refunded: { color: 'bg-purple-100 text-purple-700' },
  cancelled: { color: 'bg-gray-100 text-gray-600' },
}

export default function AdminEscrow() {
  const [escrows, setEscrows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [resolving, setResolving] = useState(null) // escrow id being resolved
  const [resolutionType, setResolutionType] = useState('release_to_seller')
  const [resolutionNote, setResolutionNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchEscrows()
  }, [filter])

  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    }
  }

  async function fetchEscrows() {
    setLoading(true)
    try {
      const headers = await getAuthHeaders()
      const url = filter
        ? `${API}/api/escrow/admin/all?status=${filter}`
        : `${API}/api/escrow/admin/all`
      const res = await fetch(url, { headers })
      if (res.ok) setEscrows(await res.json())
    } catch (err) {
      console.error('Failed to fetch escrows:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleResolve(escrowId) {
    setActionLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API}/api/escrow/${escrowId}/admin/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          resolution_type: resolutionType,
          resolution: resolutionNote,
        }),
      })
      if (res.ok) {
        setResolving(null)
        setResolutionNote('')
        await fetchEscrows()
      } else {
        const data = await res.json()
        alert(data.error || 'Resolution failed')
      }
    } catch {
      alert('Resolution failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Stats
  const stats = {
    total: escrows.length,
    held: escrows.filter((e) => e.status === 'held').length,
    disputed: escrows.filter((e) => e.status === 'disputed').length,
    totalHeld: escrows
      .filter((e) => e.status === 'held' || e.status === 'disputed')
      .reduce((sum, e) => sum + (e.amount_fcfa || 0), 0),
    totalCommission: escrows
      .filter((e) => e.status === 'released')
      .reduce((sum, e) => sum + (e.commission_amount || 0), 0),
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Escrow Management</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Transactions</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-600">Currently Held</p>
          <p className="text-2xl font-bold text-blue-700">{stats.held}</p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-600">Disputed</p>
          <p className="text-2xl font-bold text-red-700">{stats.disputed}</p>
        </div>
        <div className="bg-white border border-green-200 rounded-xl p-4">
          <p className="text-xs text-green-600">Commission Earned</p>
          <p className="text-2xl font-bold text-green-700">
            {stats.totalCommission.toLocaleString()} FCFA
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {['', 'pending', 'held', 'disputed', 'released', 'refunded', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === s
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : escrows.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No escrow transactions found</div>
      ) : (
        <div className="space-y-3">
          {escrows.map((tx) => {
            const config = statusConfig[tx.status] || statusConfig.pending
            return (
              <div
                key={tx.id}
                className="bg-white border border-gray-200 rounded-xl p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {tx.listing?.title || 'Unknown Listing'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {tx.buyer?.full_name} &rarr; {tx.seller?.full_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(tx.created_at).toLocaleString()} &middot; ID: {tx.id.slice(0, 8)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">
                      {tx.amount_fcfa?.toLocaleString()} FCFA
                    </p>
                    <p className="text-xs text-gray-500">
                      Commission: {tx.commission_amount?.toLocaleString()} FCFA
                    </p>
                  </div>

                  <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${config.color}`}>
                    {tx.status}
                  </span>
                </div>

                {/* Dispute details */}
                {tx.status === 'disputed' && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-red-700 mb-2">
                      <strong>Dispute reason:</strong> {tx.dispute_reason}
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                      Raised: {new Date(tx.dispute_raised_at).toLocaleString()}
                    </p>

                    {resolving === tx.id ? (
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Resolution Type
                          </label>
                          <select
                            value={resolutionType}
                            onChange={(e) => setResolutionType(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="release_to_seller">Release to Seller (90%)</option>
                            <option value="refund_to_buyer">Refund to Buyer (100%)</option>
                            <option value="split">Split 50/50</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Resolution Notes
                          </label>
                          <textarea
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                            rows={2}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="Explain the resolution decision..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResolve(tx.id)}
                            disabled={actionLoading}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading ? 'Processing...' : 'Confirm Resolution'}
                          </button>
                          <button
                            onClick={() => setResolving(null)}
                            className="text-gray-600 px-4 py-2 text-sm hover:text-gray-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setResolving(tx.id)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                      >
                        Resolve Dispute
                      </button>
                    )}
                  </div>
                )}

                {/* Resolution info for resolved disputes */}
                {tx.resolution && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-700">
                      <strong>Resolution:</strong> {tx.resolution}
                    </p>
                    <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {tx.resolution_type?.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
