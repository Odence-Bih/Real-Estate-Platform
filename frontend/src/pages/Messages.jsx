import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import useAuthStore from '../stores/authStore'

const PHONE_PATTERN = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/

export default function Messages() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [searchParams] = useSearchParams()
  const messagesEndRef = useRef(null)

  const [threads, setThreads] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [threadDetails, setThreadDetails] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sendLoading, setSendLoading] = useState(false)
  const [phoneWarning, setPhoneWarning] = useState(false)
  const [showThreadList, setShowThreadList] = useState(true)

  // Fetch threads
  const fetchThreads = async () => {
    const { data } = await supabase
      .from('message_threads')
      .select(`
        *,
        listing:listings!listing_id (id, title, price, transaction_type,
          images:listing_images (image_url, display_order)
        ),
        buyer:user_profiles!buyer_id (id, full_name, role),
        seller:user_profiles!seller_id (id, full_name, role)
      `)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false })

    if (data) {
      // Get unread counts
      const withUnread = await Promise.all(
        data.map(async (thread) => {
          const { count } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('thread_id', thread.id)
            .eq('is_read', false)
            .neq('sender_id', user.id)
          return { ...thread, unread_count: count || 0 }
        })
      )
      setThreads(withUnread)
    }
    setLoading(false)
  }

  // On mount: fetch threads, auto-create thread if URL has listing+seller params
  useEffect(() => {
    if (!user) return

    const initMessaging = async () => {
      await fetchThreads()

      const listingId = searchParams.get('listing')
      const sellerId = searchParams.get('seller')

      if (listingId && sellerId && sellerId !== user.id) {
        // Find existing or create new thread
        const { data: existing } = await supabase
          .from('message_threads')
          .select('id')
          .eq('listing_id', listingId)
          .eq('buyer_id', user.id)
          .eq('seller_id', sellerId)
          .maybeSingle()

        if (existing) {
          setActiveThread(existing.id)
          setShowThreadList(false)
        } else {
          const { data: newThread, error: threadError } = await supabase
            .from('message_threads')
            .insert({
              listing_id: listingId,
              buyer_id: user.id,
              seller_id: sellerId,
            })
            .select()
            .single()

          if (threadError) {
            console.error('Thread creation error:', threadError)
          }

          if (newThread) {
            setActiveThread(newThread.id)
            setShowThreadList(false)
            await fetchThreads()
          }
        }
      }
    }

    initMessaging()
  }, [user])

  // Fetch messages when active thread changes
  useEffect(() => {
    if (!activeThread) return

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', activeThread)
        .order('created_at', { ascending: true })

      if (data) setMessages(data)

      // Get thread details
      const { data: thread } = await supabase
        .from('message_threads')
        .select(`
          *,
          listing:listings!listing_id (id, title, price, transaction_type, price_period),
          buyer:user_profiles!buyer_id (id, full_name, role),
          seller:user_profiles!seller_id (id, full_name, role)
        `)
        .eq('id', activeThread)
        .single()

      if (thread) setThreadDetails(thread)

      // Mark as read
      await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('thread_id', activeThread)
        .eq('is_read', false)
        .neq('sender_id', user.id)

      // Update unread in thread list
      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeThread ? { ...t, unread_count: 0 } : t
        )
      )
    }

    fetchMessages()

    // Subscribe to new messages in real-time
    const channel = supabase
      .channel(`messages:${activeThread}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${activeThread}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
          // Mark as read if it's from the other person
          if (payload.new.sender_id !== user.id) {
            supabase
              .from('messages')
              .update({ is_read: true, read_at: new Date().toISOString() })
              .eq('id', payload.new.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeThread])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sendLoading) return

    const content = newMessage.trim()
    setSendLoading(true)
    setPhoneWarning(false)

    // Check for phone number
    if (PHONE_PATTERN.test(content)) {
      setPhoneWarning(true)
    }

    const { error } = await supabase.from('messages').insert({
      thread_id: activeThread,
      sender_id: user.id,
      content,
    })

    if (!error) {
      setNewMessage('')
      // Update thread's last_message_at
      await supabase
        .from('message_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', activeThread)
    }
    setSendLoading(false)
  }

  const getOtherUser = (thread) => {
    return thread.buyer_id === user.id ? thread.seller : thread.buyer
  }

  const getCoverImage = (thread) => {
    const images = thread.listing?.images?.sort(
      (a, b) => a.display_order - b.display_order
    )
    return images?.[0]?.image_url
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex h-[calc(100vh-160px)]">
        {/* Thread list */}
        <div
          className={`w-full md:w-80 border-r border-gray-200 shrink-0 flex flex-col ${
            !showThreadList && activeThread ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">
              {t('common.messages')}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="text-center py-12 px-4 text-gray-500 text-sm">
                No conversations yet. Contact an agent from a listing page to
                start chatting.
              </div>
            ) : (
              threads.map((thread) => {
                const other = getOtherUser(thread)
                const cover = getCoverImage(thread)
                const isActive = activeThread === thread.id

                return (
                  <button
                    key={thread.id}
                    onClick={() => {
                      setActiveThread(thread.id)
                      setShowThreadList(false)
                    }}
                    className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 ${
                      isActive ? 'bg-green-50' : ''
                    }`}
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                        <span className="text-gray-400 text-xs">No img</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {other?.full_name}
                        </p>
                        {thread.unread_count > 0 && (
                          <span className="bg-green-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                            {thread.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {thread.listing?.title}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(thread.last_message_at).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Conversation */}
        <div
          className={`flex-1 flex flex-col ${
            showThreadList && !activeThread ? 'hidden md:flex' : 'flex'
          }`}
        >
          {!activeThread ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Select a conversation
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="p-4 border-b border-gray-200 flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowThreadList(true)
                    setActiveThread(null)
                  }}
                  className="md:hidden text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {threadDetails && (
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">
                      {getOtherUser(threadDetails)?.full_name}
                      <span className="text-gray-400 font-normal">
                        {' '}&middot;{' '}
                        {getOtherUser(threadDetails)?.role}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {threadDetails.listing?.title}
                      {threadDetails.listing?.price &&
                        ` — ${threadDetails.listing.price.toLocaleString()} FCFA`}
                    </p>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => {
                  const isMine = msg.sender_id === user.id
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                          isMine
                            ? 'bg-green-600 text-white rounded-br-md'
                            : 'bg-gray-100 text-gray-900 rounded-bl-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap wrap-break-word">
                          {msg.content}
                        </p>
                        <div
                          className={`flex items-center gap-1 mt-1 text-xs ${
                            isMine ? 'text-green-200' : 'text-gray-400'
                          }`}
                        >
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isMine && (
                            <span>{msg.is_read ? '✓✓' : '✓'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Phone warning */}
              {phoneWarning && (
                <div className="mx-4 mb-2 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs px-3 py-2 rounded-lg">
                  For your protection, we recommend keeping all communication
                  on-platform.
                  <button
                    onClick={() => setPhoneWarning(false)}
                    className="ml-2 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Message input */}
              <form
                onSubmit={handleSend}
                className="p-4 border-t border-gray-200 flex gap-2"
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sendLoading}
                  className="bg-green-600 text-white px-4 py-2.5 rounded-full hover:bg-green-700 transition-colors disabled:opacity-50 shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
