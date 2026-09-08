'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getEndedWorkItems, getSignedFileUrl } from '@/lib/supabase'
import { History, Film } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = { workshop: 'Workshop', course: 'Course' }

// An ended workshop/course lives here, not in the live list — nothing
// left to start or join, just a record of what happened. This card
// existed before but never actually linked to the recording itself
// (only title/type/date), which is exactly the gap: "I record it, the
// session ends, and then the video just disappears" — it hadn't
// disappeared, this card just never gave you anywhere to watch it.
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
          {items.map(i => {
            const recordings = (i.work_item_recordings || []).filter((r: any) => r.status === 'available' && r.file_list?.[0]?.path)
            return (
              <div key={i.id} className="flex items-center justify-between gap-3 text-[13px] px-3.5 py-2.5 bg-surface-subtle rounded-lg">
                <span className="text-ink font-semibold truncate">{i.title}</span>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span className="text-ink-tertiary">
                    {TYPE_LABEL[i.type]} · Ended {new Date(i.ended_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {recordings.map((r: any) => <WatchRecordingButton key={r.id} recording={r} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WatchRecordingButton({ recording }: { recording: any }) {
  const [opening, setOpening] = useState(false)
  const watch = async () => {
    const path = recording.file_list?.[0]?.path
    if (!path || opening) return
    setOpening(true)
    const { url } = await getSignedFileUrl('session-recordings', path)
    setOpening(false)
    if (url) window.open(url, '_blank')
  }
  return (
    <button onClick={watch} disabled={opening} className="flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline disabled:opacity-50 flex-shrink-0">
      <Film className="w-3.5 h-3.5" /> {opening ? 'Opening…' : 'Watch recording'}
    </button>
  )
}
