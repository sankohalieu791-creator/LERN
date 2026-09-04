'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getEmployerInboxItems } from '@/lib/supabase'
import { Send, Check, X as XIcon, Inbox as InboxIcon } from 'lucide-react'

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}
function dayLabel(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (isSameDay(d, now)) return 'Today'
  if (isSameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

// A little more visual weight per item than a flat text row: a
// coloured icon badge per activity type (new application vs. an
// accepted/declined request), and the items grouped by day so a busy
// inbox doesn't read as one undifferentiated wall of rows. No unread
// dot -- there's no real read-tracking behind this yet (see
// getEmployerInboxItems), and a fake one would be worse than none.
const VARIANT_META: Record<string, { icon: any; bg: string; fg: string }> = {
  application: { icon: Send, bg: 'var(--accent-bg)', fg: 'var(--brand)' },
  accepted: { icon: Check, bg: '#E1F5EE', fg: '#0F6E56' },
  declined: { icon: XIcon, bg: 'var(--surface-muted)', fg: 'var(--text-tertiary)' },
}

export default function EmployerInboxPanel() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getEmployerInboxItems(user.id).then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [user?.id])

  // Group into day sections, preserving the already-newest-first order
  // getEmployerInboxItems returns.
  const groups: { label: string; items: any[] }[] = []
  for (const item of items) {
    const label = dayLabel(item.created_at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }

  return (
    <div>
      <p className="text-[22px] font-bold text-ink mb-1">Inbox</p>
      <p className="text-[14px] text-ink-tertiary mb-6">New applications and organisation responses to your interest requests.</p>

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-surface animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-surface border border-edge-subtle rounded-2xl">
          <InboxIcon className="w-8 h-8 text-ink-quaternary mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-ink mb-1">Nothing yet</p>
          <p className="text-[13px] text-ink-tertiary">Activity on your applications and requests will show up here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.label}>
              <p className="text-[12px] font-bold text-ink-tertiary uppercase tracking-wide mb-2.5 px-1">{group.label}</p>
              <div className="bg-surface border border-edge rounded-2xl divide-y divide-edge-subtle overflow-hidden">
                {group.items.map(item => {
                  const meta = VARIANT_META[item.variant] || VARIANT_META.application
                  const Icon = meta.icon
                  return (
                    <div key={item.id} className="flex items-center gap-3.5 px-4 py-4 hover:bg-surface-subtle transition">
                      <span className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--brand)' }}>
                        <span className="font-bold text-[13px]">{initials(item.name)}</span>
                      </span>
                      <p className="text-[14.5px] text-ink flex-1 leading-snug">{item.text}</p>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: meta.bg, color: meta.fg }}>
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-[11.5px] text-ink-quaternary whitespace-nowrap">{timeAgo(item.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
