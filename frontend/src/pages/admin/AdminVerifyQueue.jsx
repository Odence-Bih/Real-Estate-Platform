import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import VerificationDetail from './VerificationDetail'

export default function AdminVerifyQueue() {
  const [verifications, setVerifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [selectedId, setSelectedId] = useState(null)

  const fetchVerifications = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('vendor_verifications')
      .select(`
        *,
        user:user_profiles!user_id (
          id, email, full_name, phone, role, created_at
        )
      `)
      .eq('status', filter)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setVerifications(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchVerifications()
  }, [filter])

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }

  if (selectedId) {
    return (
      <VerificationDetail
        verificationId={selectedId}
        onBack={() => {
          setSelectedId(null)
          fetchVerifications()
        }}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Verification Queue
        </h2>

        {/* Filter tabs */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {['pending', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                filter === s
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : verifications.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No {filter} verifications found
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">
                  Role
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                  Email
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                  Submitted
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {verifications.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {v.user?.full_name || 'Unknown'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell capitalize">
                    {v.user?.role}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {v.user?.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[v.status]}`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {new Date(v.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedId(v.id)}
                      className="text-green-600 hover:text-green-800 font-medium"
                    >
                      Review
                    </button>
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
