'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { createPortal } from 'react-dom'
import {
  getPublicStudentProfile, getVerifiedWorkForProfile, getExperienceEntries,
  getEmployerVisibleSkills, getEmployerSkillGoals, getSubmissionSkillTags,
  getMyInterest, expressInterest, getSignedFileUrl,
} from '@/lib/supabase'
import { useAvatarUrl } from '@/lib/useAvatarUrl'
import { LEVEL_INFO } from '@/lib/skillLevels'
import { EMPLOYMENT_TYPE_LABEL } from '@/components/v2/ProfilePanel'
import { OfferComposer } from '@/components/v2/EmployerDiscoverPanel'
import SkillGoalTimeline from '@/components/v2/SkillGoalTimeline'
import {
  ChevronLeft, BadgeCheck, Send, Clock, Check, FolderCheck, Briefcase, Award,
  Paperclip, X, FilePlus,
} from 'lucide-react'

type Tab = 'verified' | 'experience' | 'skills'
const TYPE_LABEL: Record<string, string> = { brief: 'Brief', course: 'Course', workshop: 'Workshop' }

function formatMonthYear(d?: string) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}
function formatDateRange(e: { start_date?: string; end_date?: string; is_current?: boolean }) {
  const start = formatMonthYear(e.start_date)
  if (!start) return ''
  const end = e.is_current ? 'Present' : formatMonthYear(e.end_date)
  return end ? `${start} – ${end}` : start
}

// "It should open up a whole new page" -- a real route (/employer/
// discover/[id]), not a bigger modal. Built the same way Profile's own
// folder tabs are (Verified / Experience / Skills), per direct
// reference -- "you know how students has the profile, right... we
// don't need the post, we don't need the save": same three sections
// Profile shows, minus Posts (a feed-activity grid, not relevant to
// hiring) and Saved (own-view-only anyway, an employer never had it).
//
// "I can't even see the work... it's just written words... how is any
// employer going to take that serious?" -- direct feedback. Every claim
// on this page is now a click away from the real thing behind it:
// Verified cards open the actual attached file, not just the blurb;
// leveled skill pills filter the Verified grid down to the specific
// piece(s) of work that skill was earned from; self-reported skill
// pills open the evidence file that's always required to create one.
// Nothing here is a bare label with nothing behind it any more.
export default function CandidateDetailPanel({ studentId }: { studentId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [student, setStudent] = useState<any>(null)
  const [work, setWork] = useState<any[] | null>(null)
  const [experience, setExperience] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [goals, setGoals] = useState<any[]>([])
  const [tagsBySubmission, setTagsBySubmission] = useState<Record<string, string[]>>({})
  const [status, setStatus] = useState<string | undefined>()
  const [tab, setTab] = useState<Tab>('verified')
  const [skillFilter, setSkillFilter] = useState<{ id: string; name: string } | null>(null)
  const [openWork, setOpenWork] = useState<any | null>(null)
  const [openGoal, setOpenGoal] = useState<any | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [composerError, setComposerError] = useState('')
  const avatarUrl = useAvatarUrl(student?.avatar_path)

  useEffect(() => {
    getPublicStudentProfile(studentId).then(({ data }) => setStudent(data || null))
    getExperienceEntries(studentId).then(({ data }) => setExperience(data || []))
    getEmployerVisibleSkills(studentId).then(({ data }) => setSkills(data || []))
    getEmployerSkillGoals(studentId).then(({ data }) => setGoals(data || []))
    getVerifiedWorkForProfile(studentId).then(({ data }) => {
      const visible = (data || []).filter((v: any) => v.visibility === 'public' || v.employer_visible)
      setWork(visible)
      const ids = visible.map((v: any) => v.submissions?.id).filter(Boolean)
      getSubmissionSkillTags(ids).then(({ data: tags }) => {
        const map: Record<string, string[]> = {}
        for (const t of tags || []) {
          if (!map[t.submission_id]) map[t.submission_id] = []
          map[t.submission_id].push(t.skill_id)
        }
        setTagsBySubmission(map)
      })
    })
  }, [studentId])

  useEffect(() => {
    if (!user) return
    getMyInterest(user.id).then(({ data }) => {
      const row = (data || []).find((i: any) => i.student_id === studentId)
      setStatus(row?.status)
    })
  }, [user, studentId])

  const handleExpress = async (message: string) => {
    if (!user) return
    setSending(true); setComposerError('')
    const { error } = await expressInterest(user.id, studentId, { message, opportunity_label: work?.[0]?.submissions?.work_items?.title })
    setSending(false)
    if (error) { setComposerError(error.message || "Couldn't send — try again."); return }
    setStatus('pending'); setComposerOpen(false)
  }

  const visibleWork = (work || []).filter(v => !skillFilter || (tagsBySubmission[v.submissions?.id] || []).includes(skillFilter.id))

  return (
    // Centred and broad, not hugging the left edge -- "put it in the
    // middle, make it a bit broad" -- a max-w-4xl cap here (the first
    // attempt at this) still left a visible gap on a normal laptop
    // window, read as "stuck at the left" rather than broad. No cap at
    // all now, same as Discover's own list page right next to it in
    // the nav (EmployerDiscoverPanel has never had one) -- this page
    // fills the same width that one already does, nothing competing
    // with it for space.
    <div className="pb-10">
      <button
        onClick={() => router.push('/employer/discover')}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-tertiary hover:text-ink transition mb-5"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Discover
      </button>

      {!student ? (
        <p className="text-ink-tertiary text-[14px]">Loading…</p>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover flex-shrink-0" />
            ) : (
              <span className="w-20 h-20 rounded-full flex items-center justify-center text-[22px] font-bold flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
                {(student.full_name || '?').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="font-bold text-ink text-[26px] truncate">{student.full_name}</p>
              {work && work.length > 0 && (
                <p className="flex items-center gap-1.5 text-[14px] font-semibold text-success-text"><BadgeCheck className="w-4 h-4" /> {work.length} verified {work.length === 1 ? 'piece' : 'pieces'} of work</p>
              )}
            </div>
          </div>

          {student.bio && <p className="text-[14.5px] text-ink-secondary leading-relaxed mb-2.5 max-w-2xl">{student.bio}</p>}
          {student.interest_tags && student.interest_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-6">
              {student.interest_tags.map((t: string) => (
                <span key={t} className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-accent-bg text-brand">{t}</span>
              ))}
            </div>
          )}

          <div className="flex gap-1 bg-surface-muted rounded-xl p-1 mb-6 w-fit">
            <TabButton active={tab === 'verified'} label="Verified" icon={FolderCheck} onClick={() => setTab('verified')} />
            <TabButton active={tab === 'experience'} label="Experience" icon={Briefcase} onClick={() => setTab('experience')} />
            <TabButton active={tab === 'skills'} label="Skills" icon={Award} onClick={() => setTab('skills')} />
          </div>

          {tab === 'verified' && (
            <div>
              {skillFilter && (
                <div className="flex items-center justify-between gap-3 bg-accent-bg rounded-xl px-4 py-2.5 mb-4">
                  <p className="text-[13px] font-semibold text-brand">
                    Showing evidence for "{skillFilter.name}" — {visibleWork.length} piece{visibleWork.length === 1 ? '' : 's'}
                  </p>
                  <button onClick={() => setSkillFilter(null)} className="flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:underline flex-shrink-0">
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                </div>
              )}
              {work === null ? (
                <p className="text-[13px] text-ink-tertiary">Loading…</p>
              ) : visibleWork.length === 0 ? (
                <p className="text-[13px] text-ink-tertiary">
                  {skillFilter ? 'No verified work has been tagged with this skill yet.' : 'Nothing to show here.'}
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {visibleWork.map(v => (
                    <button
                      key={v.id} onClick={() => setOpenWork(v)}
                      className="text-left bg-surface border border-edge rounded-xl p-4 hover:border-edge-input transition"
                    >
                      <span className="inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}>
                        {TYPE_LABEL[v.submissions?.work_items?.type] || v.submissions?.work_items?.type}
                      </span>
                      <p className="text-[15px] font-semibold text-ink">{v.submissions?.work_items?.title}</p>
                      {v.submissions?.work_items?.organisations?.name && (
                        <p className="text-[12.5px] text-ink-tertiary mb-1.5">{v.submissions.work_items.organisations.name}</p>
                      )}
                      {v.submissions?.content && <p className="text-[13px] text-ink-secondary line-clamp-3">{v.submissions.content}</p>}
                      {/* The actual attached file -- a short written
                          explanation on its own was the complaint ("how
                          is any employer going to take that serious?").
                          This tells them up front there's a real file
                          behind the card; tapping it opens it properly. */}
                      {v.submissions?.file_path && (
                        <p className="flex items-center gap-1 text-[12px] font-semibold text-brand mt-2.5">
                          <Paperclip className="w-3 h-3" /> View attached work
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'experience' && (
            experience.length === 0 ? (
              <p className="text-[13px] text-ink-tertiary">Nothing to show here.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {experience.map((e: any) => (
                  <div key={e.id} className="bg-surface border border-edge rounded-xl p-4">
                    <p className="text-[15px] font-semibold text-ink">{e.title}</p>
                    {e.organisation && <p className="text-[13px] text-ink-secondary mt-0.5">{e.organisation}</p>}
                    {(e.employment_type || e.start_date || e.location) && (
                      <p className="text-[12px] text-ink-tertiary mt-1">
                        {[EMPLOYMENT_TYPE_LABEL[e.employment_type] || e.employment_type, formatDateRange(e), e.location].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {e.description && <p className="text-[13px] text-ink-secondary mt-2 whitespace-pre-wrap line-clamp-4">{e.description}</p>}
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'skills' && (
            <div className="space-y-5">
              {skills.length > 0 && (
                <div>
                  <p className="text-[11.5px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2.5">Skills — tap to see the verified work behind it</p>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s: any) => {
                      const info = LEVEL_INFO[s.level as keyof typeof LEVEL_INFO]
                      return (
                        <button
                          key={s.id}
                          onClick={() => { setSkillFilter({ id: s.skill_id, name: s.skills?.name || 'this skill' }); setTab('verified') }}
                          className="text-[13px] font-semibold px-3 py-1.5 rounded-full hover:opacity-80 transition"
                          style={{ backgroundColor: info.bg, color: info.text }}
                        >
                          {s.skills?.name} · {info.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {goals.length > 0 && (
                <div>
                  <p className="text-[11.5px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2.5">Self-reported — tap to see the check-in history</p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {goals.map((g: any) => {
                      const count = g.skill_checkins?.length || 0
                      return (
                        <button
                          key={g.id} onClick={() => setOpenGoal(g)}
                          className="text-left bg-surface border border-edge rounded-xl p-3.5 hover:border-edge-input transition"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[14px] font-semibold text-ink truncate">{g.name}</p>
                            <span className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}>
                              <Paperclip className="w-2.5 h-2.5" /> {count}
                            </span>
                          </div>
                          {g.target_date && (
                            <p className="text-[11.5px] text-ink-tertiary">Target: {new Date(g.target_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {skills.length === 0 && goals.length === 0 && (
                <p className="text-[13px] text-ink-tertiary">Nothing to show here.</p>
              )}
            </div>
          )}

          <div className="mt-9 pt-6 border-t border-edge-subtle">
            {status === 'pending' ? (
              <span className="flex items-center gap-1.5 text-[14px] font-semibold text-warning-text"><Clock className="w-4 h-4" /> Interest pending</span>
            ) : status === 'accepted' ? (
              <span className="flex items-center gap-1.5 text-[14px] font-semibold text-success-text"><Check className="w-4 h-4" /> Accepted</span>
            ) : status === 'declined' ? (
              <span className="text-[14px] font-semibold text-ink-tertiary">Declined</span>
            ) : (
              <button
                onClick={() => setComposerOpen(true)}
                className="flex items-center justify-center gap-1.5 bg-brand text-white text-[14px] font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition"
              >
                <Send className="w-4 h-4" /> Express interest
              </button>
            )}
          </div>
        </>
      )}

      {composerOpen && (
        <OfferComposer
          studentName={student?.full_name || 'this student'}
          sending={sending}
          error={composerError}
          onClose={() => setComposerOpen(false)}
          onSend={handleExpress}
        />
      )}

      {openWork && <WorkDetailOverlay work={openWork} onClose={() => setOpenWork(null)} />}
      {openGoal && <SkillGoalTimeline goal={openGoal} canCheckIn={false} variant="paper" onClose={() => setOpenGoal(null)} />}
    </div>
  )
}

function TabButton({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[14px] font-semibold transition ${
        active ? 'bg-surface text-ink shadow-sm' : 'text-ink-tertiary hover:text-ink'
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  )
}

// The actual point of all this -- a full-screen view of the real
// submitted work, not just the short paragraph the compact card has
// room for. Same pattern as ProfilePanel's own VerifiedWorkDetail (the
// student's own view of this exact data): an image previews inline,
// anything else is a real link that opens it.
function WorkDetailOverlay({ work, onClose }: { work: any; onClose: () => void }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const sub = work.submissions
  const wi = sub?.work_items
  const isImage = sub?.file_type && ['image/png', 'image/jpeg', 'image/webp'].includes(sub.file_type)

  useEffect(() => {
    if (sub?.file_path) getSignedFileUrl('submission-files', sub.file_path).then(({ url }) => setFileUrl(url))
  }, [sub?.file_path])

  return createPortal((
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[85dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge-subtle sticky top-0 bg-surface">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}>
            <BadgeCheck className="w-3.5 h-3.5" /> Verified
          </span>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-tertiary transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">
          <h2 className="text-[18px] font-bold text-ink leading-snug mb-1">{wi?.title}</h2>
          {wi?.organisations?.name && <p className="text-[13px] text-ink-tertiary mb-4">{wi.organisations.name}</p>}

          {sub?.content && (
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-1.5">What they said about it</p>
              <p className="text-[14px] text-ink whitespace-pre-wrap leading-relaxed">{sub.content}</p>
            </div>
          )}

          <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-1.5">The actual work</p>
          {!sub?.file_path ? (
            <p className="text-[13px] text-ink-tertiary">No file was attached to this submission.</p>
          ) : isImage && fileUrl ? (
            <img src={fileUrl} alt="" className="w-full rounded-lg border border-edge" />
          ) : (
            <a
              href={fileUrl || '#'} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 bg-surface-subtle border border-edge rounded-xl px-4 py-3 text-[13px] font-semibold text-ink hover:border-edge-input transition"
            >
              <FilePlus className="w-4 h-4 text-ink-tertiary flex-shrink-0" />
              <span className="truncate">{fileUrl ? (sub.file_path.split('/').pop()) : 'Loading…'}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  ), document.body)
}

