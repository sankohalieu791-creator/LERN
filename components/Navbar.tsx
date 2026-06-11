'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getNotifications, markNotificationsRead, supabase } from '@/lib/supabase'
import Link from 'next/link'

function playNotifSound() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.type = 'sine'
    o.frequency.setValueAtTime(880, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12)
    g.gain.setValueAtTime(0.18, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28)
    o.start(ctx.currentTime)
    o.stop(ctx.currentTime + 0.28)
  } catch {}
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const TYPE_ICON: Record<string, string> = {
  like:        '❤️',
  comment:     '💬',
  follow:      '👤',
  new_course:  '📚',
  new_workshop:'🗓️',
  feedback:    '⭐',
  default:     '🔔',
}

export default function Navbar() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const initialised = useRef(false)

  // Initial load
  useEffect(() => {
    if (!user) return
    getNotifications(user.id).then(({ data }) => {
      setNotifications((data || []).filter((n: any) => !n.read))
      initialised.current = true
    })
  }, [user])

  // Realtime — new notifications
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const n = payload.new
          setNotifications(prev => [n, ...prev])
          if (initialised.current) playNotifSound()
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  // Close panel when clicking outside
  useEffect(() => {
    if (!showNotifications) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showNotifications])

  const handleOpen = () => {
    setShowNotifications(v => !v)
  }

  const handleMarkRead = async () => {
    if (!user || notifications.length === 0) return
    await markNotificationsRead(user.id)
    setNotifications([])
  }

  const unread = notifications.length

  return (
    <nav className="sticky top-0 z-40 bg-[#111] border-b border-[rgba(255,255,255,0.07)]">
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-white font-bold text-xl tracking-tight">LERN</span>

        <div className="relative" ref={panelRef}>
          <button
            onClick={handleOpen}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] transition relative"
          >
            <Bell className={`w-4 h-4 ${unread > 0 ? 'text-white' : 'text-[#666]'}`} />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-11 w-80 bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.07)]">
                <h3 className="text-white font-bold text-sm">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button onClick={handleMarkRead} className="text-[#555] text-xs hover:text-white transition">
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowNotifications(false)}>
                    <X className="w-4 h-4 text-[#666]" />
                  </button>
                </div>
              </div>

              <div className="max-h-[340px] overflow-y-auto divide-y divide-[rgba(255,255,255,0.04)]">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[#444] text-sm">You're all caught up</div>
                ) : (
                  notifications.map((n: any) => {
                    const icon = TYPE_ICON[n.type] ?? TYPE_ICON.default
                    const content = (
                      <div className="flex gap-3 px-4 py-3 hover:bg-[rgba(255,255,255,0.03)] transition">
                        <div className="w-9 h-9 rounded-full bg-[#252525] flex items-center justify-center flex-shrink-0 text-base overflow-hidden">
                          {n.sender_avatar_url
                            ? <img src={n.sender_avatar_url} className="w-full h-full object-cover" />
                            : icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-semibold leading-snug">{n.title}</p>
                          {n.body && <p className="text-[#666] text-[11px] mt-0.5 line-clamp-2 leading-snug">{n.body}</p>}
                          <p className="text-[#444] text-[10px] mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    )
                    return n.link ? (
                      <Link key={n.id} href={n.link} onClick={() => setShowNotifications(false)}>
                        {content}
                      </Link>
                    ) : (
                      <div key={n.id}>{content}</div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
