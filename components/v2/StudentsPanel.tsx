'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getOrgStudents, getMySubmissions, getGroups, createGroup, setStudentGroup,
  getAttendanceForSession, markAttendance, getStudentAttendanceSummary,
} from '@/lib/supabase'
import { Clock, ChevronDown, ChevronUp, CheckCircle2, RotateCcw, Ban, Users2, ClipboardList } from 'lucide-react'
import type { Group, AttendanceStatus } from '@/lib/types'

const STATUS_ICON: Record<string, { icon: any; cls: string }> = {
  submitted: { icon: Clock, cls: 'text-[#B3651E]' },
  returned: { icon: RotateCcw, cls: 'text-[#8A8373]' },
  verified: { icon: CheckCircle2, cls: 'text-[#1E7A34]' },
  revoked: { icon: Ban, cls: 'text-[#B3401E]' },
}

type Tab = 'students' | 'attendance'

export default function StudentsPanel() {
  const { user } = useAuth()
  const [students, setStudents] = useState<any[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [filterGroup, setFilterGroup] = useState<string>('all')
  const [tab, setTab] = useState<Tab>('students')

  const load = () => {
    if (!user?.organisation_id) return
    getOrgStudents(user.organisation_id).then(({ data }) => { setStudents(data || []); setLoading(false) })
    getGroups(user.organisation_id).then(({ data }) => setGroups(data || []))
  }
  useEffect(load, [user?.organisation_id])

  const visible = filterGroup === 'all' ? students : students.filter(s => s.group_id === filterGroup)

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-[#EDE9E1]">
        {([['students', 'Students'], ['attendance', 'Attendance register']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-[14px] font-semibold border-b-2 -mb-px transition ${
              tab === key ? 'text-ink border-brand' : 'text-[#8A8373] border-transparent hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'students' ? (
        <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <p className="font-bold text-ink text-[15px]">Students ({visible.length})</p>
            {groups.length > 0 && (
              <select
                value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
                className="bg-white border border-[#E2DDD1] rounded-lg px-3 py-1.5 text-[13px] text-ink outline-none focus:border-brand transition"
              >
                <option value="all">All groups</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
          </div>
          {loading ? (
            <p className="text-[#8A8373] text-[14px]">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-[#8A8373] text-[14px]">{students.length === 0 ? 'No students have joined yet — share a join code from Dashboard.' : 'No students in this group.'}</p>
          ) : (
            <div className="space-y-2">
              {visible.map(s => (
                <StudentRow
                  key={s.id} student={s} groups={groups}
                  open={openId === s.id} onToggle={() => setOpenId(o => o === s.id ? null : s.id)}
                  onGroupChanged={load}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <AttendanceRegister groups={groups} students={students} />
      )}
    </div>
  )
}

function StudentRow({
  student, groups, open, onToggle, onGroupChanged,
}: { student: any; groups: Group[]; open: boolean; onToggle: () => void; onGroupChanged: () => void }) {
  const { user } = useAuth()
  const [submissions, setSubmissions] = useState<any[] | null>(null)
  const [attendance, setAttendance] = useState<any>(null)
  const [savingGroup, setSavingGroup] = useState(false)

  useEffect(() => {
    if (!open) return
    if (submissions === null) getMySubmissions(student.id).then(({ data }) => setSubmissions(data || []))
    if (attendance === null) getStudentAttendanceSummary(student.id).then(({ data }) => setAttendance(data))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const changeGroup = async (groupId: string) => {
    if (!groupId) return
    setSavingGroup(true)
    await setStudentGroup(student.id, groupId)
    setSavingGroup(false)
    onGroupChanged()
  }

  return (
    <div className="border border-[#EDE9E1] rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#FBF9F4] transition">
        <div>
          <p className="font-semibold text-ink text-[14px]">{student.full_name}</p>
          <p className="text-[12px] text-[#8A8373]">{student.email} {student.groups?.name && `· ${student.groups.name}`}</p>
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

          <div className="flex items-center justify-between mt-3.5 pt-3.5 border-t border-[#EDE9E1]">
            <div className="flex items-center gap-2 text-[12px] text-[#8A8373]">
              <ClipboardList className="w-3.5 h-3.5" />
              {attendance === null ? 'Loading attendance…'
                : attendance.total === 0 ? 'No attendance recorded yet.'
                : `${attendance.percentPresent}% present (${attendance.present} present, ${attendance.late} late, ${attendance.absent} absent)`}
            </div>
            <select
              value={student.group_id || ''} onChange={e => changeGroup(e.target.value)} disabled={savingGroup}
              className="bg-white border border-[#E2DDD1] rounded-lg px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-brand transition"
            >
              <option value="" disabled>No group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

// Staff-marked, per session date -- pick a group and a date, mark each
// student present/absent/late, save. Not automatic, no fabricated data:
// a session with nothing marked just shows blank until staff mark it.
function AttendanceRegister({ groups, students }: { groups: Group[]; students: any[] }) {
  const { user } = useAuth()
  const [groupId, setGroupId] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const members = students.filter(s => s.group_id === groupId)

  useEffect(() => {
    if (!groupId || !date) { setMarks({}); return }
    getAttendanceForSession(groupId, date).then(({ data }) => {
      const next: Record<string, AttendanceStatus> = {}
      for (const r of data || []) next[r.student_id] = r.status
      setMarks(next)
    })
  }, [groupId, date])

  const mark = async (studentId: string, status: AttendanceStatus) => {
    if (!user) return
    setSaving(studentId)
    const { error } = await markAttendance(groupId, studentId, date, status, user.id)
    setSaving(null)
    if (!error) setMarks(prev => ({ ...prev, [studentId]: status }))
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !user?.organisation_id) return
    const { data } = await createGroup(user.organisation_id, user.id, newGroupName.trim())
    if (data) { setGroupId((data as Group).id); setNewGroupName(''); setCreatingGroup(false) }
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6">
        <p className="font-bold text-ink text-[15px] mb-2">No groups yet</p>
        <p className="text-[13px] text-[#8A8373] mb-4">Create a group to start taking a register — assign students to it from the Students tab.</p>
        <div className="flex gap-2 max-w-sm">
          <input
            value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. Year 12 Media Studies"
            className="flex-1 bg-white border border-[#E2DDD1] rounded-lg px-3 py-2 text-[13px] text-ink placeholder-[#A39C8A] outline-none focus:border-brand transition"
          />
          <button onClick={handleCreateGroup} disabled={!newGroupName.trim()} className="px-3.5 py-2 rounded-lg bg-brand text-white text-[13px] font-semibold disabled:opacity-40">Create</button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E2DDD1] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <select
          value={groupId} onChange={e => setGroupId(e.target.value)}
          className="bg-white border border-[#E2DDD1] rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-brand transition"
        >
          <option value="">Choose a group…</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input
          type="date" value={date} onChange={e => setDate(e.target.value)}
          className="bg-white border border-[#E2DDD1] rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-brand transition"
        />
        {!creatingGroup ? (
          <button onClick={() => setCreatingGroup(true)} className="text-[12px] font-semibold text-[#6B6558] hover:text-brand transition flex items-center gap-1">
            <Users2 className="w-3.5 h-3.5" /> New group
          </button>
        ) : (
          <div className="flex gap-1.5">
            <input
              value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Group name" autoFocus
              className="bg-white border border-[#E2DDD1] rounded-lg px-2.5 py-1.5 text-[12px] text-ink placeholder-[#A39C8A] outline-none focus:border-brand transition w-40"
            />
            <button onClick={handleCreateGroup} disabled={!newGroupName.trim()} className="px-2.5 py-1.5 rounded-lg bg-brand text-white text-[12px] font-semibold disabled:opacity-40">Add</button>
          </div>
        )}
      </div>

      {!groupId ? (
        <p className="text-[13px] text-[#8A8373]">Choose a group to take its register for {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.</p>
      ) : members.length === 0 ? (
        <p className="text-[13px] text-[#8A8373]">No students assigned to this group yet — assign them from the Students tab.</p>
      ) : (
        <div className="space-y-1.5">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between px-3.5 py-2.5 border border-[#EDE9E1] rounded-lg">
              <span className="text-[13px] font-semibold text-ink">{m.full_name}</span>
              <div className="flex gap-1.5">
                {(['present', 'late', 'absent'] as AttendanceStatus[]).map(status => (
                  <button
                    key={status} onClick={() => mark(m.id, status)} disabled={saving === m.id}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold capitalize transition ${
                      marks[m.id] === status
                        ? status === 'present' ? 'bg-[#1E7A34] text-white'
                        : status === 'late' ? 'bg-[#B3651E] text-white'
                        : 'bg-[#B3401E] text-white'
                        : 'bg-[#F5F1E8] text-[#8A8373] hover:bg-[#EDE9E1]'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
