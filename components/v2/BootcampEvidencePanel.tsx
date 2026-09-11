'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getBootcampEvidence } from '@/lib/supabase'
import { GraduationCap, Download, Check, Clock, Info } from 'lucide-react'

const STAGE_LABEL: Record<string, string> = { interview: 'Interview', offer: 'Offer', hired: 'Hired' }

// Charles Booth-call selling feature, built entirely from data LERN
// already collects (attendance_records, verified courses,
// applications) -- no new schema, no external integration. One
// record per learner against the three funding milestones a bootcamp
// provider typically has to evidence for a funder.
export default function BootcampEvidencePanel() {
  const { user } = useAuth()
  const [rows, setRows] = useState<any[] | null>(null)

  useEffect(() => {
    if (!user?.organisation_id) return
    getBootcampEvidence(user.organisation_id).then(({ data }) => setRows(data))
  }, [user?.organisation_id])

  const exportCsv = () => {
    if (!rows) return
    const header = 'Learner,Attendance,Course completion,Interview stage\n'
    const line = (r: any) => [
      r.full_name,
      r.attendance_met ? `Met (${r.attendance_days}/${r.attendance_threshold} days)` : `Pending (${r.attendance_days}/${r.attendance_threshold} days)`,
      r.course_completed_at ? `Met (${new Date(r.course_completed_at).toLocaleDateString('en-GB')})` : 'Pending',
      r.interview_stage ? `Met — ${STAGE_LABEL[r.interview_stage] || r.interview_stage} (${new Date(r.interview_at).toLocaleDateString('en-GB')})` : 'Pending',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    const csv = header + rows.map(line).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `bootcamp-evidence-${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="flex items-center gap-2 text-[22px] font-bold text-ink"><GraduationCap className="w-5 h-5 text-brand" /> Bootcamp Evidence</p>
          <p className="text-[14px] text-ink-tertiary mt-1">Attendance, course completion, and interview stage — one record per learner.</p>
        </div>
        <button
          onClick={exportCsv} disabled={!rows || rows.length === 0}
          className="flex items-center gap-1.5 bg-brand text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition disabled:opacity-40 flex-shrink-0"
        >
          <Download className="w-4 h-4" /> Export cohort
        </button>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl px-4 py-3.5 my-5" style={{ backgroundColor: '#E6F1FB' }}>
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#185FA5' }} />
        <p className="text-[13px] leading-relaxed" style={{ color: '#0C447C' }}>
          This supports your own evidence process — it is not on any official DfE evidence list. Confirm what your funding authority actually accepts.
        </p>
      </div>

      {rows === null ? (
        <p className="text-[14px] text-ink-tertiary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl p-10 text-center">
          <p className="font-bold text-ink text-[15px] mb-1.5">No learners yet</p>
          <p className="text-ink-tertiary text-[14px]">This fills in as students join your organisation.</p>
        </div>
      ) : (
        <div className="bg-surface border border-edge rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-edge-subtle text-left">
                  <th className="px-4 py-2.5 font-semibold text-ink-tertiary">Learner</th>
                  <th className="px-4 py-2.5 font-semibold text-ink-tertiary">Attendance ({rows[0]?.attendance_threshold}-day threshold)</th>
                  <th className="px-4 py-2.5 font-semibold text-ink-tertiary">Course completion</th>
                  <th className="px-4 py-2.5 font-semibold text-ink-tertiary">Interview stage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.student_id} className="border-b border-edge-subtle last:border-0">
                    <td className="px-4 py-3 font-semibold text-ink">{r.full_name}</td>
                    <td className="px-4 py-3"><MilestonePill met={r.attendance_met} metLabel={`${r.attendance_days}/${r.attendance_threshold} days`} pendingLabel={`${r.attendance_days}/${r.attendance_threshold} days`} /></td>
                    <td className="px-4 py-3">
                      <MilestonePill
                        met={!!r.course_completed_at}
                        metLabel={r.course_completed_at ? new Date(r.course_completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                        pendingLabel="Not yet"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <MilestonePill
                        met={!!r.interview_stage}
                        metLabel={r.interview_stage ? `${STAGE_LABEL[r.interview_stage] || r.interview_stage}${r.interview_employer ? ` · ${r.interview_employer}` : ''}` : ''}
                        pendingLabel="Not yet"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function MilestonePill({ met, metLabel, pendingLabel }: { met: boolean; metLabel: string; pendingLabel: string }) {
  return met ? (
    <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: '#0F6E56' }}>
      <Check className="w-3.5 h-3.5 flex-shrink-0" /> Met{metLabel ? ` · ${metLabel}` : ''}
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-tertiary">
      <Clock className="w-3.5 h-3.5 flex-shrink-0" /> Pending{pendingLabel ? ` · ${pendingLabel}` : ''}
    </span>
  )
}
