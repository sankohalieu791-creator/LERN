'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getPublicStudentProfile, getVerifiedWorkForProfile, getExperienceEntries,
  getEmployerVisibleSkills, getEmployerSelfReportedSkills, getMyInterest, expressInterest,
} from '@/lib/supabase'
import { useAvatarUrl } from '@/lib/useAvatarUrl'
import { LEVEL_INFO } from '@/lib/skillLevels'
import { EMPLOYMENT_TYPE_LABEL } from '@/components/v2/ProfilePanel'
import { OfferComposer } from '@/components/v2/EmployerDiscoverPanel'
import { ChevronLeft, BadgeCheck, Send, Clock, Check, FolderCheck, Briefcase, Award } from 'lucide-react'

type Tab = 'verified' | 'experience' | 'skills'
type WorkType = 'all' | 'brief' | 'course' | 'workshop'
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
// Self-sufficient -- fetches everything fresh from the studentId in
// the URL rather than relying on anything passed in memory from the
// list, so a direct link/refresh/back-forward all work.
export default function CandidateDetailPanel({ studentId }: { studentId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [student, setStudent] = useState<any>(null)
  const [work, setWork] = useState<any[] | null>(null)
  const [experience, setExperience] = useState<any[]>([])
  const [skills, setSkills] = useState<any[]>([])
  const [selfReportedSkills, setSelfReportedSkills] = useState<any[]>([])
  const [status, setStatus] = useState<string | undefined>()
  const [tab, setTab] = useState<Tab>('verified')
  const [workType, setWorkType] = useState<WorkType>('all')
  const [composerOpen, setComposerOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [composerError, setComposerError] = useState('')
  const avatarUrl = useAvatarUrl(student?.avatar_path)

  useEffect(() => {
    getPublicStudentProfile(studentId).then(({ data }) => setStudent(data || null))
    getVerifiedWorkForProfile(studentId).then(({ data }) => setWork((data || []).filter((v: any) => v.visibility === 'public' || v.employer_visible)))
    getExperienceEntries(studentId).then(({ data }) => setExperience(data || []))
    getEmployerVisibleSkills(studentId).then(({ data }) => setSkills(data || []))
    getEmployerSelfReportedSkills(studentId).then(({ data }) => setSelfReportedSkills(data || []))
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

  const workFiltered = (work || []).filter(v => workType === 'all' || v.submissions?.work_items?.type === workType)

  return (
    <div className="pb-10">
      <button
        onClick={() => router.push('/employer/discover')}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-tertiary hover:text-ink transition mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Discover
      </button>

      {!student ? (
        <p className="text-ink-tertiary text-[14px]">Loading…</p>
      ) : (
        <>
          <div className="flex items-center gap-3.5 mb-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
            ) : (
              <span className="w-16 h-16 rounded-full flex items-center justify-center text-[18px] font-bold flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
                {(student.full_name || '?').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="font-bold text-ink text-[20px] truncate">{student.full_name}</p>
              {work && work.length > 0 && (
                <p className="flex items-center gap-1 text-[13px] font-semibold text-success-text"><BadgeCheck className="w-3.5 h-3.5" /> {work.length} verified {work.length === 1 ? 'piece' : 'pieces'} of work</p>
              )}
            </div>
          </div>

          {student.bio && <p className="text-[13.5px] text-ink-secondary leading-relaxed mb-2 max-w-xl">{student.bio}</p>}
          {student.interest_tags && student.interest_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {student.interest_tags.map((t: string) => (
                <span key={t} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-accent-bg text-brand">{t}</span>
              ))}
            </div>
          )}

          <div className="flex gap-1 bg-surface-muted rounded-xl p-1 mb-5 w-fit">
            <TabButton active={tab === 'verified'} label="Verified" icon={FolderCheck} onClick={() => setTab('verified')} />
            <TabButton active={tab === 'experience'} label="Experience" icon={Briefcase} onClick={() => setTab('experience')} />
            <TabButton active={tab === 'skills'} label="Skills" icon={Award} onClick={() => setTab('skills')} />
          </div>

          {tab === 'verified' && (
            <div>
              <div className="flex gap-1 bg-surface-muted rounded-xl p-1 mb-4 w-fit">
                {(['all', 'brief', 'course', 'workshop'] as WorkType[]).map(t => (
                  <button
                    key={t} onClick={() => setWorkType(t)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold capitalize transition ${
                      workType === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-tertiary hover:text-ink'
                    }`}
                  >
                    {t === 'all' ? 'All' : TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
              {work === null ? (
                <p className="text-[13px] text-ink-tertiary">Loading…</p>
              ) : workFiltered.length === 0 ? (
                <p className="text-[13px] text-ink-tertiary">Nothing to show here.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {workFiltered.map(v => (
                    <div key={v.id} className="bg-surface border border-edge rounded-xl p-4">
                      <span className="inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full mb-2 uppercase tracking-wide" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}>
                        {TYPE_LABEL[v.submissions?.work_items?.type] || v.submissions?.work_items?.type}
                      </span>
                      <p className="text-[14px] font-semibold text-ink">{v.submissions?.work_items?.title}</p>
                      {v.submissions?.work_items?.organisations?.name && (
                        <p className="text-[12px] text-ink-tertiary mb-1.5">{v.submissions.work_items.organisations.name}</p>
                      )}
                      {v.submissions?.content && <p className="text-[12.5px] text-ink-secondary line-clamp-3">{v.submissions.content}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'experience' && (
            experience.length === 0 ? (
              <p className="text-[13px] text-ink-tertiary">Nothing to show here.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {experience.map((e: any) => (
                  <div key={e.id} className="bg-surface border border-edge rounded-xl p-4">
                    <p className="text-[14px] font-semibold text-ink">{e.title}</p>
                    {e.organisation && <p className="text-[12.5px] text-ink-secondary mt-0.5">{e.organisation}</p>}
                    {(e.employment_type || e.start_date || e.location) && (
                      <p className="text-[11.5px] text-ink-tertiary mt-1">
                        {[EMPLOYMENT_TYPE_LABEL[e.employment_type] || e.employment_type, formatDateRange(e), e.location].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {e.description && <p className="text-[12.5px] text-ink-secondary mt-2 whitespace-pre-wrap line-clamp-4">{e.description}</p>}
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'skills' && (
            <div className="space-y-4">
              {skills.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s: any) => {
                      const info = LEVEL_INFO[s.level as keyof typeof LEVEL_INFO]
                      return (
                        <span key={s.id} className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: info.bg, color: info.text }}>
                          {s.skills?.name} · {info.label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              {selfReportedSkills.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2">Self-reported skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selfReportedSkills.map((s: any) => (
                      <span key={s.id} className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success-text)' }}>
                        {s.name} · Verified
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {skills.length === 0 && selfReportedSkills.length === 0 && (
                <p className="text-[13px] text-ink-tertiary">Nothing to show here.</p>
              )}
            </div>
          )}

          <div className="mt-8 pt-5 border-t border-edge-subtle">
            {status === 'pending' ? (
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-warning-text"><Clock className="w-4 h-4" /> Interest pending</span>
            ) : status === 'accepted' ? (
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-success-text"><Check className="w-4 h-4" /> Accepted</span>
            ) : status === 'declined' ? (
              <span className="text-[13px] font-semibold text-ink-tertiary">Declined</span>
            ) : (
              <button
                onClick={() => setComposerOpen(true)}
                className="flex items-center justify-center gap-1.5 bg-brand text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition"
              >
                <Send className="w-3.5 h-3.5" /> Express interest
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
    </div>
  )
}

function TabButton({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition ${
        active ? 'bg-surface text-ink shadow-sm' : 'text-ink-tertiary hover:text-ink'
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  )
}
