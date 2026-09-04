'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/AuthContext'
import { getDiscoverWork, getMyInterest, expressInterest, getTalentPools, createTalentPool, addToTalentPool } from '@/lib/supabase'
import { BadgeCheck, Search, Send, Check, Clock, Bookmark, Shield } from 'lucide-react'

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
  const [composer, setComposer] = useState<{ studentId: string; studentName: string; label?: string } | null>(null)
  const [poolPickerFor, setPoolPickerFor] = useState<string | null>(null)

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

  const handleExpress = async (message: string) => {
    if (!user || !composer) return
    setSending(composer.studentId)
    const { error } = await expressInterest(user.id, composer.studentId, { message, opportunity_label: composer.label })
    setSending(null)
    if (!error) { setInterestByStudent(prev => ({ ...prev, [composer.studentId]: 'pending' })); setComposer(null) }
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
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="relative">
                          <button
                            onClick={() => setPoolPickerFor(v => v === student.id ? null : student.id)}
                            aria-label="Save to a talent pool"
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-edge text-ink-tertiary hover:border-edge-input transition"
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                          </button>
                          {poolPickerFor === student.id && (
                            <PoolPicker studentId={student.id} onClose={() => setPoolPickerFor(null)} />
                          )}
                        </div>
                        <button
                          onClick={() => setComposer({ studentId: student.id, studentName: student.full_name || 'this student', label: wi?.title })}
                          disabled={sending === student.id}
                          className="flex items-center gap-1.5 bg-brand text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" /> {sending === student.id ? 'Sending…' : 'Express interest'}
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-lg px-[13px] py-[10px] flex items-start gap-2" style={{ backgroundColor: '#E1F5EE' }}>
          <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#0F6E56' }} />
          <p className="text-[12px]" style={{ color: '#0F6E56' }}>
            Under-18s are not publicly searchable as people. You express interest, and it routes through their school.
          </p>
        </div>
      )}

      {composer && (
        <OfferComposer
          studentName={composer.studentName}
          sending={sending === composer.studentId}
          onClose={() => setComposer(null)}
          onSend={handleExpress}
        />
      )}
    </div>
  )
}

// Small anchored dropdown -- pick an existing pool or make a new one
// on the spot, per spec: "Candidates are added from Discover via the
// bookmark button."
function PoolPicker({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { user } = useAuth()
  const [pools, setPools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => { if (user) getTalentPools(user.id).then(({ data }) => { setPools(data || []); setLoading(false) }) }, [user?.id])

  const save = async (poolId: string) => {
    await addToTalentPool(poolId, studentId)
    setSaved(poolId)
    setTimeout(onClose, 700)
  }
  const makeAndSave = async () => {
    if (!name.trim() || !user) return
    const { data } = await createTalentPool(user.id, name.trim())
    if (data) save(data.id)
  }

  return (
    <div className="absolute right-0 top-9 z-20 w-52 bg-surface border border-edge rounded-xl shadow-lg p-2" onMouseLeave={onClose}>
      {loading ? (
        <p className="text-[12px] text-ink-tertiary px-2 py-1.5">Loading…</p>
      ) : (
        <>
          {pools.map(p => (
            <button key={p.id} onClick={() => save(p.id)} className="w-full text-left px-2 py-1.5 rounded-lg text-[12.5px] text-ink hover:bg-surface-muted transition flex items-center justify-between">
              {p.name} {saved === p.id && <Check className="w-3.5 h-3.5 text-success-text" />}
            </button>
          ))}
          {creating ? (
            <div className="flex items-center gap-1 px-1 pt-1">
              <input
                value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Pool name"
                onKeyDown={e => e.key === 'Enter' && makeAndSave()}
                className="flex-1 bg-surface-subtle border border-edge rounded-md px-2 py-1 text-[12px] text-ink outline-none focus:border-brand"
              />
              <button onClick={makeAndSave} className="text-[11px] font-semibold text-brand px-1.5">Add</button>
            </div>
          ) : (
            <button onClick={() => setCreating(true)} className="w-full text-left px-2 py-1.5 rounded-lg text-[12.5px] font-semibold text-brand hover:bg-surface-muted transition">
              + New pool
            </button>
          )}
        </>
      )}
    </div>
  )
}

// The org sees this message verbatim on their side (Interest received)
// -- a few sentences saying what the employer's actually after, not
// just a bare "interested" flag with nothing to respond to.
function OfferComposer({ studentName, sending, onClose, onSend }: { studentName: string; sending: boolean; onClose: () => void; onSend: (message: string) => void }) {
  const [message, setMessage] = useState('')
  return createPortal((
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-5">
        <p className="font-bold text-ink text-[15px] mb-1">Place your offer</p>
        <p className="text-[13px] text-ink-tertiary mb-4">
          A few sentences to {studentName}'s organisation about what you're after — they'll see this on their side.
        </p>
        <textarea
          value={message} onChange={e => setMessage(e.target.value)} autoFocus
          placeholder="e.g. We saw their verified poster work and we'd love to offer a week's work experience this term."
          rows={4}
          className="w-full bg-surface-subtle border border-edge rounded-lg px-3.5 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none mb-4"
        />
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-ink-secondary hover:bg-surface-muted transition">Cancel</button>
          <button
            onClick={() => onSend(message.trim())} disabled={sending || !message.trim()}
            className="bg-brand text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg hover:bg-brand-hover transition disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  ), document.body)
}
