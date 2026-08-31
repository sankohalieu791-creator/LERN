'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getDiscoverWork, getMyInterest, expressInterest } from '@/lib/supabase'
import { BadgeCheck, Search, Send, Check, Clock } from 'lucide-react'

type WorkType = 'all' | 'brief' | 'course' | 'workshop'

const TYPE_LABEL: Record<string, string> = { brief: 'Brief', course: 'Course', workshop: 'Workshop' }

// Every row this queries is, by construction, work an 18+ student
// chose to make public — a minor's verification can never carry
// visibility = 'public' (enforced in the database, not here), so
// there is no under-18 case to anonymise: they simply never appear.
// "Express interest" never gives an employer contact details — it
// only ever inserts a row that's routed to the student's organisation.
export default function EmployerDiscoverPanel() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<WorkType>('all')
  const [q, setQ] = useState('')
  const [interestByStudent, setInterestByStudent] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    getDiscoverWork({ type: type === 'all' ? undefined : type, q: q.trim() || undefined }).then(({ data }) => {
      setItems(data || [])
      setLoading(false)
    })
  }
  useEffect(load, [type])

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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink mb-1">Discover</h1>
        <p className="text-ink-tertiary text-[14px]">Verified work students have chosen to make public. Interest is always routed through their organisation.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ink-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} onBlur={load}
            placeholder="Search by title or description…"
            className="w-full bg-surface border border-edge rounded-xl pl-9 pr-3 py-2.5 text-[14px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
          />
        </div>
        <div className="flex gap-1 bg-surface-muted rounded-xl p-1 flex-shrink-0">
          {(['all', 'brief', 'course', 'workshop'] as WorkType[]).map(t => (
            <button
              key={t} onClick={() => setType(t)}
              className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold capitalize transition ${
                type === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-tertiary hover:text-ink'
              }`}
            >
              {t === 'all' ? 'All' : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-ink-tertiary text-[14px]">Loading…</p>
      ) : items.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl p-10 text-center">
          <p className="font-bold text-ink text-[15px] mb-1.5">Nothing here yet</p>
          <p className="text-ink-tertiary text-[14px]">No public verified work matches this search yet — check back soon.</p>
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
                  {student && (
                    status === 'pending' ? (
                      <span className="flex items-center gap-1 text-[12px] font-semibold text-warning-text flex-shrink-0"><Clock className="w-3.5 h-3.5" /> Pending</span>
                    ) : status === 'accepted' ? (
                      <span className="flex items-center gap-1 text-[12px] font-semibold text-success-text flex-shrink-0"><Check className="w-3.5 h-3.5" /> Accepted</span>
                    ) : status === 'declined' ? (
                      <span className="text-[12px] font-semibold text-ink-tertiary flex-shrink-0">Declined</span>
                    ) : (
                      <button
                        onClick={() => handleExpress(student.id)} disabled={sending === student.id}
                        className="flex items-center gap-1.5 bg-brand text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 flex-shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" /> {sending === student.id ? 'Sending…' : 'Place your offer'}
                      </button>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
