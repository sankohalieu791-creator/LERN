'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrgStudents } from '@/lib/supabase'
import { Clock } from 'lucide-react'

export default function StudentsPanel() {
  const { user } = useAuth()
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
              <div key={s.id} className="flex items-center justify-between border border-[#EDE9E1] rounded-xl px-4 py-3">
                <div>
                  <p className="font-semibold text-ink text-[14px]">{s.full_name}</p>
                  <p className="text-[12px] text-[#8A8373]">{s.email}</p>
                </div>
                <div className="flex items-center gap-4 text-[12px] text-[#6B6558]">
                  <span>{s.submitted} submitted</span>
                  <span className="text-[#1E7A34] font-semibold">{s.verified} verified</span>
                </div>
              </div>
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
