'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getEmployerInboxItems } from '@/lib/supabase'
import { Send, MessageSquare, Inbox as InboxIcon } from 'lucide-react'

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function EmployerInboxPanel() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getEmployerInboxItems(user.id).then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [user?.id])

  return (
    <div>
      <p className="text-[18px] font-medium text-ink mb-1">Inbox</p>
      <p className="text-[13px] text-ink-tertiary mb-5">New applications and organisation responses to your interest requests.</p>

      {loading ? (
        <p className="text-[13px] text-ink-tertiary">Loading…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <InboxIcon className="w-7 h-7 text-ink-quaternary mx-auto mb-2.5" />
          <p className="text-[13px] text-ink-tertiary">Nothing yet — activity on your applications and requests will show up here.</p>
        </div>
      ) : (
        <div className="bg-surface border border-edge rounded-2xl divide-y divide-edge-subtle overflow-hidden">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
              {item.icon === 'application'
                ? <Send className="w-4 h-4 text-brand flex-shrink-0" />
                : <MessageSquare className="w-4 h-4 text-ink-tertiary flex-shrink-0" />}
              <p className="text-[13px] text-ink flex-1">{item.text}</p>
              <span className="text-[12px] text-ink-quaternary flex-shrink-0">{timeAgo(item.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
