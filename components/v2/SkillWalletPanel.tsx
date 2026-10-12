'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/AuthContext'
import { getOrgSkillsForStudent, getStudentSkills, getSkillEvidence } from '@/lib/supabase'
import type { Skill, StudentSkill, SkillLevel } from '@/lib/types'
import { ArrowLeft, CheckCircle2, Sparkles, FileText, Award } from 'lucide-react'

// LERN Skill Wallet (Phase 1) -- the student's own evidence-backed
// skill levels, built from work they already submit through My Work.
// Proof only in this phase (levels + evidence); goals/direction are a
// later phase per the agreed build plan.

const LEVEL_INFO: Record<SkillLevel, { label: string; bg: string; text: string }> = {
  not_started: { label: 'Not started', bg: 'var(--app-overlay-2)', text: 'var(--app-text-tertiary)' },
  beginner: { label: 'Beginner', bg: 'var(--status-info-bg)', text: 'var(--status-info-text)' },
  developing: { label: 'Developing', bg: 'var(--status-warn-bg)', text: 'var(--status-warn-text)' },
  secure: { label: 'Secure', bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
  advanced: { label: 'Advanced', bg: '#F3E8FF', text: '#7C3AED' },
}

type CourseWithSkills = { id: string; name: string; skills: Skill[] }

export default function SkillWalletPanel() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<CourseWithSkills[]>([])
  const [studentSkills, setStudentSkills] = useState<StudentSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [openSkill, setOpenSkill] = useState<Skill | null>(null)

  useEffect(() => {
    if (!user?.organisation_id) return
    Promise.all([
      getOrgSkillsForStudent(user.organisation_id),
      getStudentSkills(user.id),
    ]).then(([c, ss]) => {
      setCourses((c.data as any) || [])
      setStudentSkills(ss.data || [])
      setLoading(false)
    })
  }, [user?.organisation_id, user?.id])

  if (!user?.organisation_id) return null
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[0, 1].map(i => <div key={i} className="h-24 rounded-2xl bg-[var(--app-surface)] animate-pulse" />)}
      </div>
    )
  }

  const levelFor = (skillId: string) => studentSkills.find(ss => ss.skill_id === skillId)
  const coursesWithSkills = courses.filter(c => (c.skills || []).length > 0)
  const totalVerified = studentSkills.reduce((n, ss) => n + (ss.verified_count || 0), 0)
  const totalInProgress = studentSkills.filter(ss => ss.level !== 'not_started').length

  return (
    <div>
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-[var(--app-text)] text-[20px] font-semibold">My Skill Wallet</h1>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--app-text-secondary)' }}>Real skills, built and verified from your own work</p>
      </div>

      {coursesWithSkills.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 px-6">
          <div className="w-11 h-11 rounded-full bg-[var(--app-overlay-2)] flex items-center justify-center mb-3">
            <Award className="w-5 h-5 text-[var(--app-text)]" />
          </div>
          <p className="font-bold text-[var(--app-text)] text-[15px] mb-1">No skills set up yet</p>
          <p className="text-sm text-[var(--app-text-tertiary)]">Your tutor adds skills to a course — they'll show up here once they have.</p>
        </div>
      ) : (
        <>
          {totalInProgress > 0 && (
            <div className="px-4 pb-1">
              <p className="text-[13px] font-semibold text-[var(--app-text-tertiary)]">
                {totalInProgress} skill{totalInProgress === 1 ? '' : 's'} started · {totalVerified} verified piece{totalVerified === 1 ? '' : 's'}
              </p>
            </div>
          )}
          <div className="px-4 py-3 space-y-5">
            {coursesWithSkills.map(course => (
              <div key={course.id}>
                <p className="text-[12px] font-semibold text-[var(--app-text-tertiary)] uppercase tracking-wide mb-2">{course.name}</p>
                <div className="space-y-2.5">
                  {course.skills.map(skill => (
                    <SkillRow key={skill.id} skill={skill} studentSkill={levelFor(skill.id)} onOpen={() => setOpenSkill(skill)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {openSkill && user && (
        <SkillDetail skill={openSkill} studentSkill={levelFor(openSkill.id)} studentId={user.id} onClose={() => setOpenSkill(null)} />
      )}
    </div>
  )
}

function SkillRow({ skill, studentSkill, onOpen }: { skill: Skill; studentSkill?: StudentSkill; onOpen: () => void }) {
  const level = studentSkill?.level || 'not_started'
  const info = LEVEL_INFO[level]
  return (
    <button onClick={onOpen} className="block w-full text-left bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl px-4 py-[14px]">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[var(--app-text)] truncate">{skill.name}</p>
          {skill.unit_label && <p className="text-[12px] text-[var(--app-text-tertiary)] mt-0.5 truncate">{skill.unit_label}</p>}
        </div>
        <span className="text-[11px] font-semibold px-[10px] py-[3px] rounded-full flex-shrink-0" style={{ backgroundColor: info.bg, color: info.text }}>
          {info.label}
        </span>
      </div>
      {studentSkill && studentSkill.verified_count > 0 && (
        <p className="text-[12px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--app-text-tertiary)' }}>
          <CheckCircle2 className="w-3.5 h-3.5" /> {studentSkill.verified_count} verified piece{studentSkill.verified_count === 1 ? '' : 's'}
        </p>
      )}
    </button>
  )
}

function SkillDetail({ skill, studentSkill, studentId, onClose }: {
  skill: Skill; studentSkill?: StudentSkill; studentId: string; onClose: () => void
}) {
  const [evidence, setEvidence] = useState<any[] | null>(null)

  useEffect(() => {
    getSkillEvidence(studentId, skill.id).then(({ data }) => setEvidence(data || []))
  }, [studentId, skill.id])

  const level = studentSkill?.level || 'not_started'
  const info = LEVEL_INFO[level]

  return createPortal((
    <div className="fixed inset-0 z-50 bg-paper overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center h-14 px-3 bg-paper/95 backdrop-blur border-b border-edge-subtle">
        <button onClick={onClose} aria-label="Back" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-muted text-ink">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="py-4">
        <div className="bg-surface border-y border-edge p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-semibold px-[10px] py-[3px] rounded-full" style={{ backgroundColor: info.bg, color: info.text }}>{info.label}</span>
            {studentSkill && studentSkill.verified_count > 0 && (
              <span className="text-[12px] text-ink-tertiary">{studentSkill.verified_count} verified piece{studentSkill.verified_count === 1 ? '' : 's'}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-ink leading-snug mb-1">{skill.name}</h1>
          {skill.unit_label && <p className="text-ink-tertiary text-xs mb-4">{skill.unit_label}</p>}

          {(skill.skill_criteria || []).length > 0 && (
            <div className="mb-5">
              <p className="text-[12px] font-semibold text-ink-tertiary uppercase tracking-wide mb-1.5">What this skill covers</p>
              <div className="bg-surface-subtle border border-edge rounded-xl px-4 py-3 space-y-1.5">
                {(skill.skill_criteria || []).map(c => (
                  <p key={c.id} className="text-sm text-ink-body leading-relaxed">{c.text}</p>
                ))}
              </div>
            </div>
          )}

          <p className="text-[12px] font-semibold text-ink-tertiary uppercase tracking-wide mb-1.5">Your evidence</p>
          {evidence === null ? (
            <div className="h-16 rounded-xl bg-surface-muted animate-pulse" />
          ) : evidence.length === 0 ? (
            <p className="text-sm text-ink-tertiary">Tick this skill next time you submit work in My Work that demonstrates it.</p>
          ) : (
            <div className="space-y-2">
              {evidence.map((row: any) => {
                const sub = row.submissions
                const reviews = (sub?.reviews || []) as any[]
                const verifiedReview = reviews.find(r => r.decision === 'verified')
                return (
                  <div key={sub?.id || Math.random()} className="bg-surface-subtle border border-edge-subtle rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-ink truncate">{sub?.work_items?.title || 'Submitted work'}</p>
                      {verifiedReview && (
                        <span className="flex items-center gap-1 text-[11px] font-bold flex-shrink-0" style={{ color: '#0F6E56' }}>
                          <Sparkles className="w-3 h-3" /> Verified
                        </span>
                      )}
                    </div>
                    {sub?.submitted_at && (
                      <p className="text-[11px] text-ink-tertiary mb-1">
                        {new Date(sub.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                    {sub?.content && <p className="text-[13px] text-ink-body leading-snug line-clamp-3">{sub.content}</p>}
                    {sub?.file_path && (
                      <p className="flex items-center gap-1.5 text-[12px] text-ink-tertiary mt-1.5">
                        <FileText className="w-3 h-3" /> {sub.file_path.split('/').pop()}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  ), document.body)
}
