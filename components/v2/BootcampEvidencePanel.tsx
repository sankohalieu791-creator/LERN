'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { getOrgBilling, getBootcampEvidence } from '@/lib/supabase'
import { BOOTCAMP_EVIDENCE_MONTHLY } from '@/lib/billing'
import { Award, CheckCircle2, Circle, Clock, Download, Info, ClipboardList, BookOpen, Briefcase as BriefcaseIcon } from 'lucide-react'

// Final Build Spec: Bootcamp Evidence (training providers), 23 Sep
// 2026. A summary over data already entered elsewhere (Workshops/
// Students attendance, Review, Job tracking) -- never a separate
// data-entry burden. Gated on organisations.bootcamp_evidence_enabled,
// the add-on toggle Settings > Billing already has.
const ATTENDANCE_THRESHOLD = 10

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}
function interviewLabel(stage: string | null, date: string | null) {
  if (!stage) return { text: 'Not yet', met: false }
  if (stage === 'interview' || stage === 'offer' || stage === 'hired') {
    return { text: `Interview booked${date ? `, ${fmtDate(date)}` : ''}`, met: true }
  }
  if (stage === 'not_progressing') return { text: 'Not progressing', met: false }
  return { text: 'Application in progress', met: false }
}

export default function BootcampEvidencePanel() {
  const { user } = useAuth()
  const router = useRouter()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [cohorts, setCohorts] = useState<any[]>([])
  const [cohortId, setCohortId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.organisation_id) return
    getOrgBilling(user.organisation_id).then(({ data }) => {
      setEnabled(!!(data as any)?.bootcamp_evidence_enabled)
      if (!(data as any)?.bootcamp_evidence_enabled) { setLoading(false); return }
      getBootcampEvidence(user.organisation_id!).then(({ data: ev }) => {
        const rows = (ev as any[]) || []
        setCohorts(rows)
        if (rows.length > 0) setCohortId(rows[0].work_item_id)
        setLoading(false)
      })
    })
  }, [user?.organisation_id])

  if (loading || enabled === null) {
    return <div className="h-40 rounded-2xl bg-surface animate-pulse" />
  }

  if (!enabled) {
    return (
      <div className="text-center py-16 bg-surface border border-edge-subtle rounded-2xl">
        <Award className="w-8 h-8 text-ink-quaternary mx-auto mb-3" />
        <p className="text-[15px] font-bold text-ink mb-1.5">Bootcamp Evidence isn't switched on</p>
        <p className="text-[13px] text-ink-tertiary max-w-sm mx-auto mb-4">
          Attendance, completion, and interview outcome pulled into one exportable record per learner, per cohort — £{BOOTCAMP_EVIDENCE_MONTHLY} a month while active.
        </p>
        <button
          onClick={() => router.push('/provider/settings')}
          className="bg-brand text-white text-[13px] font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-hover transition"
        >
          Turn it on in Settings
        </button>
      </div>
    )
  }

  const cohort = cohorts.find(c => c.work_item_id === cohortId)

  const exportCsv = () => {
    if (!cohort) return
    const rows = [['Learner', `Attendance (${ATTENDANCE_THRESHOLD}-day threshold)`, 'Course completion', 'Job interview outcome']]
    for (const l of cohort.learners) {
      const iv = interviewLabel(l.interview_stage, l.interview_date)
      rows.push([
        l.full_name,
        `${l.attendance_days}/${ATTENDANCE_THRESHOLD} days${l.attendance_days >= ATTENDANCE_THRESHOLD ? ' (met)' : ''}`,
        l.completed ? 'Complete' : 'Not yet',
        iv.text,
      ])
    }
    const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `funding-evidence-${(cohort.title || 'cohort').replace(/\s+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="text-[18px] font-bold text-ink">Bootcamp Evidence</p>
          <p className="text-[13px] text-ink-tertiary mt-0.5">{cohort?.group_name ? `${cohort.title}, ${cohort.group_name}` : cohort?.title || 'No cohort yet'}</p>
        </div>
        {cohorts.length > 1 && (
          <select
            value={cohortId} onChange={e => setCohortId(e.target.value)}
            className="bg-surface border border-edge rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-brand transition flex-shrink-0"
          >
            {cohorts.map(c => <option key={c.work_item_id} value={c.work_item_id}>{c.title}</option>)}
          </select>
        )}
      </div>

      {cohorts.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-edge-subtle rounded-2xl mt-5">
          <BookOpen className="w-7 h-7 text-ink-quaternary mx-auto mb-2.5" />
          <p className="text-[14px] font-semibold text-ink mb-1">No cohorts yet</p>
          <p className="text-[13px] text-ink-tertiary max-w-sm mx-auto">Assign a group to a course from Courses to turn it into a trackable cohort here.</p>
        </div>
      ) : !cohort || cohort.learners.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-edge-subtle rounded-2xl mt-5">
          <p className="text-[13px] text-ink-tertiary">No learners in this cohort's group yet.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 mt-5 mb-5">
            {cohort.learners.map((l: any) => {
              const iv = interviewLabel(l.interview_stage, l.interview_date)
              const attendanceMet = l.attendance_days >= ATTENDANCE_THRESHOLD
              return (
                <div key={l.student_id} className="bg-surface border border-edge rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3.5">
                    <span className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
                      {initials(l.full_name)}
                    </span>
                    <p className="text-[14px] font-semibold text-ink">{l.full_name}</p>
                  </div>
                  <div className="space-y-2">
                    <EvidenceRow label={`Attendance (${ATTENDANCE_THRESHOLD}-day threshold)`} met={attendanceMet} text={`${l.attendance_days}/${ATTENDANCE_THRESHOLD} days`} />
                    <EvidenceRow label="Course completion" met={l.completed} text={l.completed ? 'Complete' : 'Not yet'} />
                    <EvidenceRow label="Job interview outcome" met={iv.met} text={iv.text} amber={!iv.met && iv.text === 'Application in progress'} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-surface border border-edge rounded-2xl p-5 mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary mb-3">How this gets recorded</p>
            <div className="space-y-2.5">
              <HowRow icon={ClipboardList} text="Attendance: marked the same way as any other class register, in Students > Attendance." />
              <HowRow icon={CheckCircle2} text="Completion: marked complete in Review, the same flow used for verifying every other piece of work." />
              <HowRow icon={BriefcaseIcon} text="Interview outcome: pulled automatically from Job tracking the moment an employer books an interview." />
            </div>
          </div>

          <button
            onClick={exportCsv}
            className="w-full flex items-center justify-center gap-2 bg-ink text-white text-[14px] font-bold py-3.5 rounded-xl hover:opacity-90 transition mb-4"
          >
            <Download className="w-4 h-4" /> Export funding evidence
          </button>

          <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3" style={{ backgroundColor: '#E6F1FB' }}>
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#0C447C' }} />
            <p className="text-[12px] leading-relaxed" style={{ color: '#0C447C' }}>
              Supports your own funding evidence process to your commissioning body. Not on the DfE's accepted evidence list — this doesn't certify funding compliance on its own.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function EvidenceRow({ label, met, text, amber }: { label: string; met: boolean; text: string; amber?: boolean }) {
  const color = met ? '#0F6E56' : amber ? '#854F0B' : '#8A8A8A'
  const Icon = met ? CheckCircle2 : amber ? Clock : Circle
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-ink-secondary">{label}</span>
      <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color }}>
        <Icon className="w-3.5 h-3.5 flex-shrink-0" /> {text}
      </span>
    </div>
  )
}

function HowRow({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5 text-ink-tertiary" />
      <p className="text-[12.5px] text-ink-secondary leading-relaxed">{text}</p>
    </div>
  )
}
