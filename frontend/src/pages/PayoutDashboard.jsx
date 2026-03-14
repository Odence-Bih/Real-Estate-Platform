import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../stores/authStore'
import { supabase } from '../lib/supabase'

const API = import.meta.env.VITE_API_URL || ''

export default function PayoutDashboard() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTransactions()
  }, [])

  async function fetchTransactions() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API}/api/escrow/my`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      })
      if (res.ok) {
        const data = await res.json()
        // Only show transactions where user is the seller
        setTransactions(data.filter((tx) => tx.seller_id === user?.id))
      }
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calculate earnings
  const released = transactions.filter((tx) => tx.status === 'released')
  const held = transactions.filter((tx) => tx.status === 'held')
  const disputed = transactions.filter((tx) => tx.status === 'disputed')

  const totalEarned = released.reduce((sum, tx) => sum + (tx.net_payout || 0), 0)
  const totalHeld = held.reduce((sum, tx) => sum + (tx.net_payout || 0), 0)
  const totalDisputed = disputed.reduce((sum, tx) => sum + (tx.amount_fcfa || 0), 0)
  const totalCommission = released.reduce((sum, tx) => sum + (tx.commission_amount || 0), 0)

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
        <h1 className="text-2xl font-bold text-gray-900">Earnings & Payouts</h1>
        <Link
          to="/dashboard"
          className="text-sm text-green-600 hover:underline"
        >
          {t('common.back')} to {t('common.dashboard')}
        </Link>
      </div>

      {/* Earnings summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <div className="bg-white border border-green-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-gray-500 mb-1">Total Earned</p>
          <p className="text-lg sm:text-2xl font-bold text-green-600">
            {totalEarned.toLocaleString()} FCFA
          </p>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-gray-500 mb-1">Pending Release</p>
          <p className="text-lg sm:text-2xl font-bold text-blue-600">
            {totalHeld.toLocaleString()} FCFA
          </p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-gray-500 mb-1">In Dispute</p>
          <p className="text-lg sm:text-2xl font-bold text-red-600">
            {totalDisputed.toLocaleString()} FCFA
          </p>
        </div>
        <div className="bg-white border border-orange-200 rounded-xl p-4 sm:p-5">
          <p className="text-xs text-gray-500 mb-1">Platform Fees Paid</p>
          <p className="text-lg sm:text-2xl font-bold text-orange-600">
            {totalCommission.toLocaleString()} FCFA
          </p>
        </div>
      </div>

      {/* Transaction list */}
      <h2 className="font-semibold text-gray-900 mb-4">Transaction History</h2>

      {transactions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">No transactions yet</p>
          <p className="text-sm">When buyers pay for your listings, transactions will appear here.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-125">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Listing</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Buyer</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Payout</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const statusColors = {
                  pending: 'bg-yellow-100 text-yellow-700',
                  held: 'bg-blue-100 text-blue-700',
                  released: 'bg-green-100 text-green-700',
                  disputed: 'bg-red-100 text-red-700',
                  refunded: 'bg-purple-100 text-purple-700',
                  cancelled: 'bg-gray-100 text-gray-600',
                }
                return (
                  <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/dashboard/escrow/${tx.id}`}
                        className="text-green-600 hover:underline font-medium"
                      >
                        {tx.listing?.title || 'Unknown'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {tx.buyer?.full_name}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">
                      {tx.net_payout?.toLocaleString()} FCFA
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[tx.status]}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-medium text-blue-800 mb-1">How payouts work</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>- When a buyer pays, funds are held securely in escrow</li>
          <li>- After the buyer confirms satisfaction (or 72 hours pass), 90% is released to you</li>
          <li>- 10% is retained as platform commission</li>
          <li>- You can withdraw released earnings to your MTN/Orange Mobile Money account</li>
        </ul>
      </div>
    </div>
  )
}
