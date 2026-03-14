import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const API = import.meta.env.VITE_API_URL || ''

export default function AdminFinance() {
  const [loading, setLoading] = useState(true)
  const [escrows, setEscrows] = useState([])
  const [period, setPeriod] = useState('all') // all, month, week

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API}/api/escrow/admin/all`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (res.ok) {
        setEscrows(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch finance data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter by period
  const now = new Date()
  const filteredEscrows = escrows.filter((tx) => {
    if (period === 'all') return true
    const created = new Date(tx.created_at)
    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return created >= weekAgo
    }
    if (period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return created >= monthAgo
    }
    return true
  })

  // Calculate stats
  const released = filteredEscrows.filter((tx) => tx.status === 'released')
  const held = filteredEscrows.filter((tx) => tx.status === 'held')
  const disputed = filteredEscrows.filter((tx) => tx.status === 'disputed')
  const refunded = filteredEscrows.filter((tx) => tx.status === 'refunded')
  const pending = filteredEscrows.filter((tx) => tx.status === 'pending')

  const totalRevenue = released.reduce((sum, tx) => sum + (tx.amount_fcfa || 0), 0)
  const totalCommission = released.reduce((sum, tx) => sum + (tx.commission_amount || 0), 0)
  const totalPayouts = released.reduce((sum, tx) => sum + (tx.net_payout || 0), 0)
  const totalHeld = held.reduce((sum, tx) => sum + (tx.amount_fcfa || 0), 0)
  const totalDisputed = disputed.reduce((sum, tx) => sum + (tx.amount_fcfa || 0), 0)

  // Registration fees (count of approved vendors × 2000 FCFA)
  // This is an approximation — in production you'd query a registration_payments table
  const registrationFeeEstimate = released.length > 0 ? 'See registration data' : '—'

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold text-gray-900">Financial Reports</h2>
        <div className="flex gap-2">
          {[
            { value: 'week', label: 'This Week' },
            { value: 'month', label: 'This Month' },
            { value: 'all', label: 'All Time' },
          ].map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                period === p.value
                  ? 'bg-green-600 text-white border-green-600'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-8">
        <div className="bg-white border border-green-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-gray-500 mb-1">Commission Earned</p>
          <p className="text-lg sm:text-2xl font-bold text-green-600">
            {totalCommission.toLocaleString()} FCFA
          </p>
          <p className="text-xs text-gray-400 mt-1">10% of {released.length} completed deals</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-gray-500 mb-1">Total Transaction Volume</p>
          <p className="text-lg sm:text-2xl font-bold text-blue-600">
            {totalRevenue.toLocaleString()} FCFA
          </p>
          <p className="text-xs text-gray-400 mt-1">{filteredEscrows.length} total transactions</p>
        </div>
        <div className="bg-white border border-purple-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-gray-500 mb-1">Paid Out to Sellers</p>
          <p className="text-lg sm:text-2xl font-bold text-purple-600">
            {totalPayouts.toLocaleString()} FCFA
          </p>
          <p className="text-xs text-gray-400 mt-1">90% of completed deals</p>
        </div>
        <div className="bg-white border border-yellow-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-gray-500 mb-1">Currently Held in Escrow</p>
          <p className="text-lg sm:text-2xl font-bold text-yellow-600">
            {totalHeld.toLocaleString()} FCFA
          </p>
          <p className="text-xs text-gray-400 mt-1">{held.length} active holds</p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-gray-500 mb-1">In Dispute</p>
          <p className="text-lg sm:text-2xl font-bold text-red-600">
            {totalDisputed.toLocaleString()} FCFA
          </p>
          <p className="text-xs text-gray-400 mt-1">{disputed.length} disputes</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-gray-500 mb-1">Refunded</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-600">
            {refunded.reduce((sum, tx) => sum + (tx.amount_fcfa || 0), 0).toLocaleString()} FCFA
          </p>
          <p className="text-xs text-gray-400 mt-1">{refunded.length} refunds</p>
        </div>
      </div>

      {/* Transaction Status Breakdown */}
      <h3 className="font-semibold text-gray-900 mb-4">Transaction Breakdown</h3>
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
        <div className="space-y-3">
          {[
            { label: 'Completed (Released)', count: released.length, color: 'bg-green-500', total: released.length },
            { label: 'Held in Escrow', count: held.length, color: 'bg-blue-500', total: held.length },
            { label: 'Pending Payment', count: pending.length, color: 'bg-yellow-500', total: pending.length },
            { label: 'Disputed', count: disputed.length, color: 'bg-red-500', total: disputed.length },
            { label: 'Refunded', count: refunded.length, color: 'bg-purple-500', total: refunded.length },
          ].map((row) => {
            const pct = filteredEscrows.length > 0 ? (row.count / filteredEscrows.length) * 100 : 0
            return (
              <div key={row.label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700">{row.label}</span>
                  <span className="font-medium text-gray-900">{row.count}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${row.color}`}
                    style={{ width: `${Math.max(pct, 0.5)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-4 text-center">
          {filteredEscrows.length} total transactions in selected period
        </p>
      </div>

      {/* Recent Completed Transactions */}
      <h3 className="font-semibold text-gray-900 mb-4">Recent Completed Deals</h3>
      {released.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No completed deals in the selected period
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-125">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Listing</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Seller</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Commission</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {released.slice(0, 20).map((tx) => (
                <tr key={tx.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {tx.listing?.title || 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {tx.seller?.full_name || '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {tx.amount_fcfa?.toLocaleString()} FCFA
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">
                    +{tx.commission_amount?.toLocaleString()} FCFA
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">
                    {new Date(tx.released_at || tx.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
