import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLogs() {
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select(`
          *,
          admin:user_profiles!admin_id (
            id, full_name, email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        setLogs(data)
      }
      setLoading(false)
    }
    fetchLogs()
  }, [])

  const actionLabels = {
    approve_verification: { label: 'Approved Verification', color: 'text-green-600' },
    reject_verification: { label: 'Rejected Verification', color: 'text-red-600' },
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Audit Log</h2>

      {logs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No audit logs yet</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {logs.map((log) => {
              const action = actionLabels[log.action] || {
                label: log.action,
                color: 'text-gray-600',
              }

              return (
                <div key={log.id} className="px-4 py-3 flex items-start gap-3">
                  <div
                    className={`w-2 h-2 mt-2 rounded-full shrink-0 ${
                      log.action.includes('approve')
                        ? 'bg-green-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium text-gray-900">
                        {log.admin?.full_name}
                      </span>{' '}
                      <span className={action.color}>{action.label}</span>
                    </p>
                    {log.details?.reason && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Reason: {log.details.reason}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
