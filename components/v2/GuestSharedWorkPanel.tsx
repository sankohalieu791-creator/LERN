'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getGuestSharedWork, getMyInterest, expressInterest, getStudentsAdultStatus } from '@/lib/supabase'
import { BadgeCheck, Send, Check, Clock, ShieldCheck, Building2 } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = { brief: 'Brief', course: 'Course', workshop: 'Workshop' }

// A guest sees exactly what the organisation shared — RLS enforces
// this, not this component; there's no filter/search here on purpose,
// because there's nothing to filter down from. Unlike the public
// Discover feed (where a minor's work can never appear at all — DB
// enforced), a guest CAN be shown an under-18 student's work here,
// since the organisation explicitly chose to share it. That's exactly
// why this is the one employer-facing screen that needs the age-aware
// CTA: same underlying expressInterest() call either way (it always
// routes through the organisation first, never straight to the
// student), just labelled honestly for what actually happens next.
export default function GuestSharedWorkPanel() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [interestByStudent, setInterestByStudent] = useState<Record<string, string>>({})
  const [adultByStudent, setAdultByStudent] = useState<Record<string, boolean>>({})
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => {
    getGuestSharedWork().then(({ data }) => {
      setItems(data || [])
      setLoading(false)
      const ids = Array.from(new Set((data || []).map((v: any) => v.submissions?.student?.id).filter(Boolean)))
      if (ids.length) getStudentsAdultStatus(ids).then(setAdultByStudent)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    getMyInterest(user.id).then(({ data }) => {
      const map: Record<string, string> = {}
      for (const i of data || []) map[i.student_id] = i.status
      setInterestByStudent(map)
    })
  }, [user])

  const handleExpress = async (studentId: string) => {
    if (!user) return
    setSending(studentId)
    const { error } = await expressInterest(user.id, studentId)
    setSending(null)
    if (!error) setInterestByStudent(prev => ({ ...prev, [studentId]: 'pending' }))
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">Shared with you</h1>
        <p className="text-ink-tertiary text-[14px]">Interest is always routed through the organisation — you're never given direct contact details.</p>
      </div>

      {loading ? (
        <p className="text-ink-tertiary text-[14px]">Loading…</p>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-accent-bg flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5 text-brand" />
          </div>
          <p className="font-bold text-ink text-[15px] mb-1.5">Nothing shared yet</p>
          <p className="text-ink-tertiary text-[14px]">Ask the organisation that invited you — they may not have finished sharing anything with this link yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map(v => {
            const sub = v.submissions
            const wi = sub?.work_items
            const student = sub?.student
            const status = student ? interestByStudent[student.id] : undefined
            return (
              <div key={v.id} className="bg-surface border border-edge rounded-2xl p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide">{TYPE_LABEL[wi?.type] || wi?.type}</span>
                  <span className="flex items-center gap-1 text-[12px] font-semibold text-success-text flex-shrink-0">
                    <BadgeCheck className="w-3.5 h-3.5" /> Verified
                  </span>
                </div>
                <p className="font-bold text-ink text-[15px] mb-1">{wi?.title}</p>
                {wi?.description && <p className="text-[13px] text-ink-tertiary mb-3 line-clamp-2">{wi.description}</p>}
                {sub?.content && <p className="text-[13px] text-ink-secondary mb-3 line-clamp-3 bg-surface-subtle rounded-lg p-2.5">{sub.content}</p>}

                <div className="mt-auto pt-3 border-t border-edge-subtle flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{student?.full_name || 'Student'}</p>
                    <p className="text-[11px] text-ink-tertiary truncate">
                      Verified by {v.verifier?.full_name || 'a reviewer'} · {new Date(v.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {student && (() => {
                    // Unknown age defaults to treated-as-under-18, same
                    // safety-first convention used everywhere else in
                    // this app that gates on age.
                    const adult = adultByStudent[student.id] === true
                    return status === 'pending' ? (
                      <span className="flex items-center gap-1 text-[12px] font-semibold text-warning-text flex-shrink-0">
                        <Clock className="w-3.5 h-3.5" /> {adult ? 'Pending' : 'Routed to their organisation'}
                      </span>
                    ) : status === 'accepted' ? (
                      <span className="flex items-center gap-1 text-[12px] font-semibold text-success-text flex-shrink-0"><Check className="w-3.5 h-3.5" /> Accepted</span>
                    ) : status === 'declined' ? (
                      <span className="text-[12px] font-semibold text-ink-tertiary flex-shrink-0">Declined</span>
                    ) : adult ? (
                      <button
                        onClick={() => handleExpress(student.id)} disabled={sending === student.id}
                        className="flex items-center gap-1.5 bg-brand text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 flex-shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" /> {sending === student.id ? 'Sending…' : 'Place your offer'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleExpress(student.id)} disabled={sending === student.id}
                        className="flex items-center gap-1.5 bg-surface border border-edge text-ink-secondary text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:border-brand hover:text-brand transition disabled:opacity-50 flex-shrink-0"
                      >
                        <Building2 className="w-3.5 h-3.5" /> {sending === student.id ? 'Sending…' : 'Contact their institution/provider'}
                      </button>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
