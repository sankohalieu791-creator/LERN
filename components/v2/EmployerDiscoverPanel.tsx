'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/AuthContext'
import {
  getDiscoverWork, getMyInterest, expressInterest, getTalentPools, createTalentPool, addToTalentPool,
  getVerifiedWorkForProfile, getExperienceEntries, getSelfQualifications, getAvatarUrl,
} from '@/lib/supabase'
import { BadgeCheck, Search, Send, Check, Clock, Bookmark, Shield, X, Briefcase, FolderCheck } from 'lucide-react'

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
  const [viewingProfile, setViewingProfile] = useState<{ id: string; full_name: string; date_of_birth?: string } | null>(null)

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
                  <button
                    className="min-w-0 text-left hover:opacity-80 transition"
                    onClick={() => student && setViewingProfile(student)}
                    disabled={!student}
                  >
                    <p className="text-[13px] font-semibold text-ink truncate">{student?.full_name || 'Student'}</p>
                    <p className="text-[11px] text-ink-tertiary truncate">
                      Verified by {v.verifier?.full_name || 'a reviewer'} · {new Date(v.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </button>
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

      {viewingProfile && (
        <CandidateProfileModal
          student={viewingProfile}
          status={interestByStudent[viewingProfile.id]}
          onClose={() => setViewingProfile(null)}
          onExpressInterest={(label) => { setComposer({ studentId: viewingProfile.id, studentName: viewingProfile.full_name || 'this student', label }); setViewingProfile(null) }}
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (user) getTalentPools(user.id).then(({ data }) => { setPools(data || []); setLoading(false) }) }, [user?.id])

  // Same double-fire race as the earlier Discover save-button bug --
  // a fast double-tap fired addToTalentPool twice before either had
  // resolved, adding the same candidate to the pool twice (or hitting
  // a duplicate insert). The in-flight guard fixes it the same way.
  const save = async (poolId: string) => {
    if (saving) return
    setSaving(true); setError('')
    // Was discarding the error before -- a failed add still showed the
    // checkmark and closed the picker as if the candidate had actually
    // been saved to that pool.
    const { error: err } = await addToTalentPool(poolId, studentId)
    setSaving(false)
    if (err) { setError("Couldn't save — try again."); return }
    setSaved(poolId)
    setTimeout(onClose, 700)
  }
  const makeAndSave = async () => {
    if (!name.trim() || !user || saving) return
    setSaving(true); setError('')
    const { data, error: err } = await createTalentPool(user.id, name.trim())
    setSaving(false)
    // Was silently doing nothing on failure before -- the button just
    // stopped spinning with no indication the pool was never created.
    if (err || !data) { setError("Couldn't create that pool — try again."); return }
    save(data.id)
  }

  return (
    <div className="absolute right-0 top-9 z-20 w-52 bg-surface border border-edge rounded-xl shadow-lg p-2" onMouseLeave={onClose}>
      {loading ? (
        <p className="text-[12px] text-ink-tertiary px-2 py-1.5">Loading…</p>
      ) : (
        <>
          {pools.map(p => (
            <button
              key={p.id} onClick={() => save(p.id)} disabled={saving}
              className="w-full text-left px-2 py-1.5 rounded-lg text-[12.5px] text-ink hover:bg-surface-muted transition flex items-center justify-between disabled:opacity-50"
            >
              {p.name} {saved === p.id && <Check className="w-3.5 h-3.5 text-success-text" />}
            </button>
          ))}
          {creating ? (
            <div className="flex items-center gap-1 px-1 pt-1">
              <input
                value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Pool name" disabled={saving}
                onKeyDown={e => e.key === 'Enter' && makeAndSave()}
                className="flex-1 bg-surface-subtle border border-edge rounded-md px-2 py-1 text-[12px] text-ink outline-none focus:border-brand disabled:opacity-50"
              />
              <button onClick={makeAndSave} disabled={saving} className="text-[11px] font-semibold text-brand px-1.5 disabled:opacity-50">Add</button>
            </div>
          ) : (
            <button onClick={() => setCreating(true)} className="w-full text-left px-2 py-1.5 rounded-lg text-[12.5px] font-semibold text-brand hover:bg-surface-muted transition">
              + New pool
            </button>
          )}
          {error && <p className="text-[11.5px] text-danger-text px-2 pt-1.5">{error}</p>}
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

// The flat Discover card only ever showed the ONE piece of work that
// happened to match the current search/filter -- an employer deciding
// whether to express interest had no way to see the rest of what this
// person's actually made public, their bio, or their qualifications/
// experience. Every query here (getVerifiedWorkForProfile,
// getExperienceEntries, getSelfQualifications) already accepts any
// studentId and is already readable by an employer under RLS (an
// employer can read a verified candidate's full profile row, and
// these two tables are globally readable) -- this is genuinely just
// the same data ProfilePanel shows, filtered to what's public, with
// nothing new to open up.
function CandidateProfileModal({ student, status, onClose, onExpressInterest }: {
  student: { id: string; full_name: string; avatar_path?: string; bio?: string; interest_tags?: string[] }
  status?: string
  onClose: () => void
  onExpressInterest: (label?: string) => void
}) {
  const [work, setWork] = useState<any[] | null>(null)
  const [experience, setExperience] = useState<any[]>([])
  const [quals, setQuals] = useState<any[]>([])

  useEffect(() => {
    getVerifiedWorkForProfile(student.id).then(({ data }) => setWork((data || []).filter((v: any) => v.visibility === 'public')))
    getExperienceEntries(student.id).then(({ data }) => setExperience(data || []))
    getSelfQualifications(student.id).then(({ data }) => setQuals(data || []))
  }, [student.id])

  return createPortal((
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[85dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge-subtle sticky top-0 bg-surface">
          <p className="font-bold text-ink text-[15px]">Candidate profile</p>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-tertiary transition"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            {student.avatar_path ? (
              <img src={getAvatarUrl(student.avatar_path) || ''} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
            ) : (
              <span className="w-14 h-14 rounded-full flex items-center justify-center text-[16px] font-bold flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
                {(student.full_name || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="font-bold text-ink text-[16px] truncate">{student.full_name}</p>
              {work && work.length > 0 && (
                <p className="flex items-center gap-1 text-[12px] font-semibold text-success-text"><BadgeCheck className="w-3.5 h-3.5" /> {work.length} verified {work.length === 1 ? 'piece' : 'pieces'} of public work</p>
              )}
            </div>
          </div>

          {student.bio && <p className="text-[13px] text-ink-secondary leading-relaxed mb-3">{student.bio}</p>}
          {student.interest_tags && student.interest_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {student.interest_tags.map(t => (
                <span key={t} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent-bg text-brand">{t}</span>
              ))}
            </div>
          )}

          {(experience.length > 0 || quals.length > 0) && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {experience.length > 0 && (
                <div className="bg-surface-subtle rounded-xl p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2"><Briefcase className="w-3 h-3" /> Experience</p>
                  <div className="space-y-1.5">
                    {experience.slice(0, 4).map(e => (
                      <p key={e.id} className="text-[12.5px] text-ink truncate">{e.title}{e.organisation ? ` · ${e.organisation}` : ''}</p>
                    ))}
                  </div>
                </div>
              )}
              {quals.length > 0 && (
                <div className="bg-surface-subtle rounded-xl p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2"><FolderCheck className="w-3 h-3" /> Qualifications</p>
                  <div className="space-y-1.5">
                    {quals.slice(0, 4).map(q => (
                      <p key={q.id} className="text-[12.5px] text-ink truncate">{q.title}{q.issuer ? ` · ${q.issuer}` : ''}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-[12px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2">Public verified work</p>
          {work === null ? (
            <p className="text-[13px] text-ink-tertiary">Loading…</p>
          ) : work.length === 0 ? (
            <p className="text-[13px] text-ink-tertiary">Nothing public yet.</p>
          ) : (
            <div className="space-y-2.5 mb-2">
              {work.map(v => (
                <div key={v.id} className="bg-surface-subtle rounded-xl p-3">
                  <p className="text-[13px] font-semibold text-ink">{v.submissions?.work_items?.title}</p>
                  {v.submissions?.work_items?.organisations?.name && (
                    <p className="text-[11px] text-ink-tertiary mb-1">{v.submissions.work_items.organisations.name}</p>
                  )}
                  {v.submissions?.content && <p className="text-[12.5px] text-ink-secondary line-clamp-2">{v.submissions.content}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-edge-subtle sticky bottom-0 bg-surface">
          {status === 'pending' ? (
            <span className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-warning-text"><Clock className="w-4 h-4" /> Interest pending</span>
          ) : status === 'accepted' ? (
            <span className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-success-text"><Check className="w-4 h-4" /> Accepted</span>
          ) : status === 'declined' ? (
            <span className="flex items-center justify-center text-[13px] font-semibold text-ink-tertiary">Declined</span>
          ) : (
            <button
              onClick={() => onExpressInterest(work?.[0]?.submissions?.work_items?.title)}
              className="w-full flex items-center justify-center gap-1.5 bg-brand text-white text-[13px] font-semibold py-2.5 rounded-lg hover:opacity-90 transition"
            >
              <Send className="w-3.5 h-3.5" /> Express interest
            </button>
          )}
        </div>
      </div>
    </div>
  ), document.body)
}
