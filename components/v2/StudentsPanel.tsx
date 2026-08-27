'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrgStudents, getMySubmissions } from '@/lib/supabase'
import { Clock, ChevronDown, ChevronUp, CheckCircle2, RotateCcw, Ban } from 'lucide-react'

const STATUS_ICON: Record<string, { icon: any; cls: string }> = {
  submitted: { icon: Clock, cls: 'text-[#B3651E]' },
  returned: { icon: RotateCcw, cls: 'text-[#8A8373]' },
  verified: { icon: CheckCircle2, cls: 'text-[#1E7A34]' },
  revoked: { icon: Ban, cls: 'text-[#B3401E]' },
}

export default function StudentsPanel() {
  const { user } = useAuth()
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.organisation_id) return
    getOrgStudents(user.organisation_id).then(({ data }) => { setStudents(data || []); setLoading(false) })
  }, [user?.organisation_id])

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6">
        <p className="font-bold text-ink text-[15px] mb-5">Students ({students.length})</p>
        {loading ? (
          <p className="text-[#8A8373] text-[14px]">Loading…</p>
        ) : students.length === 0 ? (
          <p className="text-[#8A8373] text-[14px]">No students have joined yet — share a join code from Dashboard.</p>
        ) : (
          <div className="space-y-2">
            {students.map(s => (
              <StudentRow key={s.id} student={s} open={openId === s.id} onToggle={() => setOpenId(o => o === s.id ? null : s.id)} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#F5F1E8] flex items-center justify-center flex-shrink-0">
          <Clock className="w-4 h-4 text-[#8A8373]" />
        </div>
        <div>
          <p className="font-semibold text-ink text-[14px]">Attendance &amp; tracking</p>
          <p className="text-[13px] text-[#8A8373]">Coming soon.</p>
        </div>
      </div>
    </div>
  )
}

function StudentRow({ student, open, onToggle }: { student: any; open: boolean; onToggle: () => void }) {
  const [submissions, setSubmissions] = useState<any[] | null>(null)

  useEffect(() => {
    if (!open || submissions !== null) return
    getMySubmissions(student.id).then(({ data }) => setSubmissions(data || []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div className="border border-[#EDE9E1] rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#FBF9F4] transition">
        <div>
          <p className="font-semibold text-ink text-[14px]">{student.full_name}</p>
          <p className="text-[12px] text-[#8A8373]">{student.email}</p>
        </div>
        <div className="flex items-center gap-4 text-[12px] text-[#6B6558]">
          <span>{student.submitted} submitted</span>
          <span className="text-[#1E7A34] font-semibold">{student.verified} verified</span>
          {open ? <ChevronUp className="w-4 h-4 text-[#8A8373]" /> : <ChevronDown className="w-4 h-4 text-[#8A8373]" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[#EDE9E1] pt-3.5">
          {submissions === null ? (
            <p className="text-[13px] text-[#8A8373]">Loading…</p>
          ) : submissions.length === 0 ? (
            <p className="text-[13px] text-[#8A8373]">No work submitted yet.</p>
          ) : (
            <div className="space-y-2">
              {submissions.map(s => {
                const status = STATUS_ICON[s.status] || STATUS_ICON.submitted
                const Icon = status.icon
                return (
                  <div key={s.id} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink">{s.work_items?.title}</span>
                    <span className={`flex items-center gap-1.5 font-semibold ${status.cls}`}>
                      <Icon className="w-3.5 h-3.5" /> {s.status}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="flex items-center gap-2.5 mt-3.5 pt-3.5 border-t border-[#EDE9E1] text-[12px] text-[#8A8373]">
            <Clock className="w-3.5 h-3.5" /> Attendance &amp; tracking — coming soon.
          </div>
        </div>
      )}
    </div>
  )
}
