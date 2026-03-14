import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const API = import.meta.env.VITE_API_URL || ''

const NOTIFICATION_ICONS = {
  verification_approved: '✅',
  verification_rejected: '❌',
  escrow_held: '💰',
  escrow_released: '🎉',
  escrow_disputed: '⚠️',
  dispute_resolved: '⚖️',
  new_message: '💬',
  listing_flagged: '🚩',
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)

  const getToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token
  }

  const fetchUnreadCount = async () => {
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch(`${API}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count)
      }
    } catch {
      // silent
    }
  }

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch(`${API}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id) => {
    try {
      const token = await getToken()
      await fetch(`${API}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // silent
    }
  }

  const markAllRead = async () => {
    try {
      const token = await getToken()
      await fetch(`${API}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {
      // silent
    }
  }

  const handleClick = (notification) => {
    if (!notification.is_read) markAsRead(notification.id)
    if (notification.link) navigate(notification.link)
    setOpen(false)
  }

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (open) fetchNotifications()
  }, [open])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'now'
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-600 hover:text-green-600 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-green-600 hover:text-green-700"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    !n.is_read ? 'bg-green-50/50' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="text-lg shrink-0">
                      {NOTIFICATION_ICONS[n.type] || '🔔'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm truncate ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="w-2 h-2 bg-green-500 rounded-full shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
