import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminOverview() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [pending, approved, rejected, totalUsers] = await Promise.all([
          supabase
            .from('vendor_verifications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('vendor_verifications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'approved'),
          supabase
            .from('vendor_verifications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'rejected'),
          supabase
            .from('user_profiles')
            .select('id', { count: 'exact', head: true }),
        ])

        setStats({
          pending: pending.count || 0,
          approved: approved.count || 0,
          rejected: rejected.count || 0,
          totalUsers: totalUsers.count || 0,
        })
      } catch {
        // Stats will remain null
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const cards = [
    {
      label: 'Pending Verifications',
      value: stats?.pending ?? '-',
      color: 'yellow',
      link: '/admin/verify',
    },
    {
      label: 'Approved Vendors/Agents',
      value: stats?.approved ?? '-',
      color: 'green',
    },
    {
      label: 'Rejected',
      value: stats?.rejected ?? '-',
      color: 'red',
    },
    {
      label: 'Total Users',
      value: stats?.totalUsers ?? '-',
      color: 'blue',
    },
  ]

  const colorMap = {
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const inner = (
            <div
              className={`rounded-xl border p-5 ${colorMap[card.color]}`}
            >
              <p className="text-sm font-medium opacity-75">{card.label}</p>
              <p className="text-3xl font-bold mt-1">{card.value}</p>
            </div>
          )

          return card.link ? (
            <Link key={card.label} to={card.link}>
              {inner}
            </Link>
          ) : (
            <div key={card.label}>{inner}</div>
          )
        })}
      </div>
    </div>
  )
}
