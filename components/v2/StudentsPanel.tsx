'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getOrgStudents, getMySubmissions, getGroups, createGroup, setStudentGroup,
  getAttendanceForSession, markAttendance, getStudentAttendanceSummary,
  createGuestInviteForStudent, getGuestInvites, revokeGuestInvite,
} from '@/lib/supabase'
import { Clock, ChevronDown, ChevronUp, CheckCircle2, RotateCcw, Ban, Users2, ClipboardList, RefreshCw, UserPlus, Copy, Check } from 'lucide-react'
import type { Group, AttendanceStatus } from '@/lib/types'

const STATUS_ICON: Record<string, { icon: any; cls: string }> = {
  submitted: { icon: Clock, cls: 'text-warning-text' },
  returned: { icon: RotateCcw, cls: 'text-ink-tertiary' },
  verified: { icon: CheckCircle2, cls: 'text-success-text' },
  revoked: { icon: Ban, cls: 'text-danger-text' },
}

type Tab = 'students' | 'attendance' | 'guests'

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

  // A student can join mid-session in a different tab/device — refetch
  // when staff come back to this tab instead of leaving them staring at
  // a stale list until they think to hit Refresh themselves.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.organisation_id])

  const visible = filterGroup === 'all' ? students : students.filter(s => s.group_id === filterGroup)

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-edge-subtle">
        {([['students', 'Students'], ['attendance', 'Attendance register'], ['guests', 'Guest invites']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-[14px] font-semibold border-b-2 -mb-px transition ${
              tab === key ? 'text-ink border-brand' : 'text-ink-tertiary border-transparent hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'students' ? (
        <div className="bg-surface border border-edge rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <p className="font-bold text-ink text-[15px]">Students ({visible.length})</p>
            <div className="flex items-center gap-2">
              {groups.length > 0 && (
                <select
                  value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
                  className="bg-surface border border-edge rounded-lg px-3 py-1.5 text-[13px] text-ink outline-none focus:border-brand transition"
                >
                  <option value="all">All groups</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}
              <button
                onClick={load}
                className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary hover:text-brand transition px-2 py-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>
          {loading ? (
            <p className="text-ink-tertiary text-[14px]">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-ink-tertiary text-[14px]">{students.length === 0 ? 'No students have joined yet — share a join code from Dashboard.' : 'No students in this group.'}</p>
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
      ) : tab === 'attendance' ? (
        <AttendanceRegister groups={groups} students={students} onChanged={load} />
      ) : (
        <GuestInvitesPanel students={students} />
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
    <div className="border border-edge-subtle rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-subtle transition">
        <div>
          <p className="font-semibold text-ink text-[14px]">{student.full_name}</p>
          <p className="text-[12px] text-ink-tertiary">{student.email} {student.groups?.name && `· ${student.groups.name}`}</p>
        </div>
        <div className="flex items-center gap-4 text-[12px] text-ink-secondary">
          <span>{student.submitted} submitted</span>
          <span className="text-success-text font-semibold">{student.verified} verified</span>
          {open ? <ChevronUp className="w-4 h-4 text-ink-tertiary" /> : <ChevronDown className="w-4 h-4 text-ink-tertiary" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-edge-subtle pt-3.5">
          {submissions === null ? (
            <p className="text-[13px] text-ink-tertiary">Loading…</p>
          ) : submissions.length === 0 ? (
            <p className="text-[13px] text-ink-tertiary">No work submitted yet.</p>
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

          <div className="flex items-center justify-between mt-3.5 pt-3.5 border-t border-edge-subtle">
            <div className="flex items-center gap-2 text-[12px] text-ink-tertiary">
              <ClipboardList className="w-3.5 h-3.5" />
              {attendance === null ? 'Loading attendance…'
                : attendance.total === 0 ? 'No attendance recorded yet.'
                : `${attendance.percentPresent}% present (${attendance.present} present, ${attendance.late} late, ${attendance.absent} absent)`}
            </div>
            <select
              value={student.group_id || ''} onChange={e => changeGroup(e.target.value)} disabled={savingGroup}
              className="bg-surface border border-edge rounded-lg px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-brand transition"
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
function AttendanceRegister({ groups, students, onChanged }: { groups: Group[]; students: any[]; onChanged: () => void }) {
  const { user } = useAuth()
  const [groupId, setGroupId] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})

  const members = students.filter(s => s.group_id === groupId)

  // One group, or none yet — skip making staff pick from a dropdown of
  // one, or type a group name just to get started. Attendance is
  // group-scoped under the hood, but for the common case (one class)
  // that should be invisible.
  useEffect(() => {
    if (!groupId && groups.length === 1) setGroupId(groups[0].id)
  }, [groups, groupId])

  // Only offered when there are zero groups yet, so every student is
  // still ungrouped — safe to drop all of them straight into it rather
  // than making staff assign each one by hand before they can take a
  // single register.
  const handleQuickStart = async () => {
    if (!user?.organisation_id) return
    const { data } = await createGroup(user.organisation_id, user.id, 'All students')
    if (!data) return
    const newGroup = data as Group
    await Promise.all(students.map(s => setStudentGroup(s.id, newGroup.id)))
    setGroupId(newGroup.id)
    onChanged()
  }

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
    const previous = marks[studentId]
    setMarks(prev => ({ ...prev, [studentId]: status })) // instant — don't wait on the round trip
    const { error } = await markAttendance(groupId, studentId, date, status, user.id)
    if (error) setMarks(prev => ({ ...prev, [studentId]: previous })) // roll back only on real failure
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !user?.organisation_id) return
    const { data } = await createGroup(user.organisation_id, user.id, newGroupName.trim())
    if (data) { setGroupId((data as Group).id); setNewGroupName(''); setCreatingGroup(false) }
  }

  if (groups.length === 0) {
    return (
      <div className="bg-surface border border-edge rounded-2xl p-6">
        <p className="font-bold text-ink text-[15px] mb-2">Take attendance</p>
        <p className="text-[13px] text-ink-tertiary mb-4">First time here — start with everyone in one register, or split into classes if you'd rather.</p>
        <button onClick={handleQuickStart} disabled={students.length === 0} className="px-4 py-2.5 rounded-lg bg-brand text-white text-[13px] font-semibold disabled:opacity-40 mb-4">
          {students.length === 0 ? 'No students yet' : 'Start with all students'}
        </button>
        {!creatingGroup ? (
          <button onClick={() => setCreatingGroup(true)} className="block text-[12px] font-semibold text-ink-secondary hover:text-brand transition">
            Or split into named classes instead
          </button>
        ) : (
          <div className="flex gap-2 max-w-sm">
            <input
              value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. Year 12 Media Studies" autoFocus
              className="flex-1 bg-surface border border-edge rounded-lg px-3 py-2 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
            />
            <button onClick={handleCreateGroup} disabled={!newGroupName.trim()} className="px-3.5 py-2 rounded-lg bg-brand text-white text-[13px] font-semibold disabled:opacity-40">Create</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-surface border border-edge rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <select
          value={groupId} onChange={e => setGroupId(e.target.value)}
          className="bg-surface border border-edge rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-brand transition"
        >
          <option value="">Choose a group…</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input
          type="date" value={date} onChange={e => setDate(e.target.value)}
          className="bg-surface border border-edge rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-brand transition"
        />
        {!creatingGroup ? (
          <button onClick={() => setCreatingGroup(true)} className="text-[12px] font-semibold text-ink-secondary hover:text-brand transition flex items-center gap-1">
            <Users2 className="w-3.5 h-3.5" /> New group
          </button>
        ) : (
          <div className="flex gap-1.5">
            <input
              value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Group name" autoFocus
              className="bg-surface border border-edge rounded-lg px-2.5 py-1.5 text-[12px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition w-40"
            />
            <button onClick={handleCreateGroup} disabled={!newGroupName.trim()} className="px-2.5 py-1.5 rounded-lg bg-brand text-white text-[12px] font-semibold disabled:opacity-40">Add</button>
          </div>
        )}
      </div>

      {!groupId ? (
        <p className="text-[13px] text-ink-tertiary">Choose a group to take its register for {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.</p>
      ) : members.length === 0 ? (
        <p className="text-[13px] text-ink-tertiary">No students assigned to this group yet — assign them from the Students tab.</p>
      ) : (
        <div className="space-y-1.5">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between px-3.5 py-2.5 border border-edge-subtle rounded-lg">
              <div className="min-w-0">
                <span className="text-[13px] font-semibold text-ink">{m.full_name}</span>
                <span className="ml-2 text-[11px] text-success-text font-semibold">{m.verified || 0} verified</span>
              </div>
              <div className="flex gap-1.5">
                {(['present', 'absent'] as AttendanceStatus[]).map(status => (
                  <button
                    key={status} onClick={() => mark(m.id, status)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold capitalize transition ${
                      marks[m.id] === status
                        ? status === 'present' ? 'bg-success-solid text-white' : 'bg-danger-solid text-white'
                        : 'bg-surface-muted text-ink-tertiary hover:bg-edge-subtle'
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

// Org-wide list of guest invites, plus generating a new one scoped to
// a chosen student — the org-side half of the guest employer flow.
// A guest sees only what's shared here; nothing about this panel
// exposes more than a name + a shareable link.
function GuestInvitesPanel({ students }: { students: any[] }) {
  const { user } = useAuth()
  const [invites, setInvites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState('')
  const [creating, setCreating] = useState(false)
  const [newLink, setNewLink] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = () => {
    if (!user?.organisation_id) return
    getGuestInvites(user.organisation_id).then(({ data }) => { setInvites(data || []); setLoading(false) })
  }
  useEffect(load, [user?.organisation_id])

  const handleCreate = async () => {
    if (!studentId || !user?.organisation_id) return
    setCreating(true)
    setNewLink(null)
    const { data, error } = await createGuestInviteForStudent(user.organisation_id, user.id, studentId)
    setCreating(false)
    if (!error && data) {
      setNewLink(`${window.location.origin}/guest/${(data as any).token}`)
      setStudentId('')
      load()
    }
  }

  const handleRevoke = async (id: string) => {
    await revokeGuestInvite(id)
    setInvites(prev => prev.map(i => i.id === id ? { ...i, revoked_at: new Date().toISOString() } : i))
  }

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div className="bg-surface border border-edge rounded-2xl p-6">
      <p className="font-bold text-ink text-[15px] mb-1.5 flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> Invite an employer</p>
      <p className="text-[13px] text-ink-tertiary mb-4">Bring in one employer to see one student's verified work — no account, no browsing the rest of LERN. Interest they raise routes straight back to you.</p>

      <div className="flex gap-2 mb-5">
        <select
          value={studentId} onChange={e => setStudentId(e.target.value)}
          className="flex-1 bg-surface border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition"
        >
          <option value="">Choose a student…</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <button onClick={handleCreate} disabled={!studentId || creating} className="px-4 py-2.5 rounded-lg bg-brand text-white text-[13px] font-semibold disabled:opacity-40 flex-shrink-0">
          {creating ? 'Creating…' : 'Create invite link'}
        </button>
      </div>

      {newLink && (
        <div className="flex items-center gap-2 bg-success-bg border border-success-text/20 rounded-lg px-3.5 py-2.5 mb-5">
          <p className="text-[12.5px] text-ink flex-1 truncate font-mono">{newLink}</p>
          <button onClick={() => copy(newLink, 'new')} className="text-success-text hover:opacity-70 transition flex-shrink-0">
            {copiedId === 'new' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-ink-tertiary text-[14px]">Loading…</p>
      ) : invites.length === 0 ? (
        <p className="text-ink-tertiary text-[14px]">No guest invites yet.</p>
      ) : (
        <div className="space-y-2">
          {invites.map(inv => {
            const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/guest/${inv.token}`
            const share = inv.guest_invite_shares?.[0]
            const status = inv.revoked_at ? 'Revoked' : inv.claimed_by ? 'Claimed' : 'Pending'
            return (
              <div key={inv.id} className="flex items-center justify-between border border-edge-subtle rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">{share?.users?.full_name || 'Student'}</p>
                  <p className="text-[11px] text-ink-tertiary">{status} · {new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {!inv.revoked_at && !inv.claimed_by && (
                    <button onClick={() => copy(link, inv.id)} className="text-ink-secondary hover:text-brand transition">
                      {copiedId === inv.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                  {!inv.revoked_at && (
                    <button onClick={() => handleRevoke(inv.id)} className="text-ink-secondary hover:text-danger-text transition">
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
