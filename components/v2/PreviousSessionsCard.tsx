'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getEndedWorkItems } from '@/lib/supabase'
import { History } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = { workshop: 'Workshop', course: 'Course' }

// An ended workshop/course lives here, not in the live list — nothing
// left to start or join, just a record of what happened.
export default function PreviousSessionsCard() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.organisation_id) return
    getEndedWorkItems(user.organisation_id).then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [user?.organisation_id])

  return (
    <div className="bg-surface border border-edge rounded-2xl p-6">
      <p className="font-bold text-ink text-[15px] mb-4 flex items-center gap-2">
        <History className="w-4 h-4 text-ink-tertiary" /> Previous courses & workshops
      </p>
      {loading ? (
        <p className="text-[13px] text-ink-tertiary">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-ink-tertiary">Nothing's ended yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map(i => (
            <div key={i.id} className="flex items-center justify-between text-[13px] px-3.5 py-2.5 bg-surface-subtle rounded-lg">
              <span className="text-ink font-semibold">{i.title}</span>
              <span className="text-ink-tertiary">
                {TYPE_LABEL[i.type]} · Ended {new Date(i.ended_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
