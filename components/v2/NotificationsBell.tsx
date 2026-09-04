'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getMyNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } from '@/lib/supabase'
import { Bell, CheckCircle2, RotateCcw, ClipboardCheck, Briefcase, Flag, Video } from 'lucide-react'

const TYPE_META: Record<string, { label: string; icon: any }> = {
  submission_received: { label: 'New work submitted for review', icon: ClipboardCheck },
  work_verified: { label: 'Your work was verified', icon: CheckCircle2 },
  work_returned: { label: 'Your work was returned for revision', icon: RotateCcw },
  employer_interest: { label: 'An employer showed interest', icon: Briefcase },
  report: { label: 'A concern was reported', icon: Flag },
  session_started: { label: 'The session has started — join now', icon: Video },
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export default function NotificationsBell({ size = 'md', iconColor }: { size?: 'md' | 'lg'; iconColor?: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [unread, setUnread] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const refreshCount = () => {
    if (!user) return
    getUnreadNotificationCount(user.id).then(({ count }) => setUnread(count))
  }
  useEffect(refreshCount, [user?.id])
  useEffect(() => {
    if (!user) return
    const interval = setInterval(refreshCount, 60000)
    return () => clearInterval(interval)
  }, [user?.id])

  useEffect(() => {
    if (!open || loaded || !user) return
    getMyNotifications(user.id).then(({ data }) => { setItems(data || []); setLoaded(true) })
  }, [open])

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const openOne = async (id: string, isRead: boolean) => {
    if (isRead) return
    await markNotificationRead(id)
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnread(n => Math.max(0, n - 1))
  }

  const markAll = async () => {
    if (!user) return
    await markAllNotificationsRead(user.id)
    setItems(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Notifications" onClick={() => setOpen(v => !v)}
        className={`relative flex items-center justify-center text-ink-secondary transition hover:bg-surface-muted ${
          size === 'lg' ? 'w-11 h-11 rounded-full' : 'w-9 h-9 rounded-lg'
        }`}
        style={iconColor ? { color: iconColor } : undefined}
      >
        <Bell className={size === 'lg' ? 'w-6 h-6' : 'w-[18px] h-[18px]'} />
        {unread > 0 && (
          <span className={`absolute rounded-full bg-danger-solid ${size === 'lg' ? 'top-2 right-2 w-2.5 h-2.5' : 'top-1 right-1 w-2 h-2'}`} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 bg-surface border border-edge rounded-xl shadow-lg w-80 max-h-96 overflow-y-auto z-20" style={{ maxWidth: 'calc(100vw - 32px)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-edge-subtle sticky top-0 bg-surface">
            <p className="font-bold text-ink text-[14px]">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-[12px] font-semibold text-brand hover:underline">Mark all read</button>
            )}
          </div>
          {!loaded ? (
            <p className="text-ink-tertiary text-[13px] px-4 py-6 text-center">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-ink-tertiary text-[13px] px-4 py-6 text-center">Nothing yet.</p>
          ) : (
            <div className="divide-y divide-edge-subtle">
              {items.map(n => {
                const meta = TYPE_META[n.type] || { label: 'Notification', icon: Bell }
                const Icon = meta.icon
                const title = n.submissions?.work_items?.title || n.work_items?.title
                return (
                  <button
                    key={n.id} onClick={() => openOne(n.id, n.read)}
                    className={`w-full flex items-start gap-2.5 text-left px-4 py-3 hover:bg-surface-subtle transition ${!n.read ? 'bg-accent-bg/40' : ''}`}
                  >
                    <Icon className="w-4 h-4 text-ink-tertiary flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[13px] text-ink leading-snug">{meta.label}{title ? ` — ${title}` : ''}</p>
                      <p className="text-[11px] text-ink-tertiary mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0 mt-1.5 ml-auto" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
