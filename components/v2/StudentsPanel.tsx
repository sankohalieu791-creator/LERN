'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getOrgStudents, getMySubmissions, getGroups, createGroup, setStudentGroup,
  getAttendanceForSession, markAttendance, getStudentAttendanceSummary,
  createGuestInvite, getGuestInvites, revokeGuestInvite,
} from '@/lib/supabase'
import {
  ChevronRight, ArrowLeft, Clock, CheckCircle2, RotateCcw, Ban, Users2,
  ClipboardList, Link as LinkIcon, Shield, Copy, Check, Square, CheckSquare,
} from 'lucide-react'
import type { Group, AttendanceStatus } from '@/lib/types'

// Build Spec: Students area (roster, attendance, guest invite) v1.0,
// 2 September 2026. Card/border/structural colours stay this app's
// own theme tokens (bg-surface/text-ink/border-edge) rather than the
// spec's literal #FFFFFF/#E7E4DE -- the same call made for Review and
// every other org-side rebuild this session, since the values are
// numerically almost identical in light mode and this is what
// actually delivers real dark-mode support instead of a hardcoded
// copy of one theme. Every pinned SEMANTIC colour (status pills, the
// orange tab underline, the primary button, the blue safeguarding
// note, the green check) is the spec's exact hex regardless of theme.
// One area for both institutions and providers -- "no difference
// between them here."
function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

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
  const [detailStudent, setDetailStudent] = useState<any | null>(null)
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
    <div>
      <p className="text-[18px] font-semibold text-ink">Students</p>
      <p className="text-[13px] mt-0.5 mb-4" style={{ color: '#5A5A5A' }}>Your learners, attendance, and employer invites</p>

      <div className="flex gap-5 border-b border-edge-subtle mb-5">
        {([['students', 'Students'], ['attendance', 'Attendance'], ['guests', 'Guest invite']] as [Tab, string][]).map(([key, label]) => {
          const active = tab === key
          return (
            <button
              key={key} onClick={() => setTab(key)}
              className="pb-2.5 text-[14px] font-semibold border-b-2 -mb-px transition"
              style={{ borderColor: active ? '#D4551A' : 'transparent', color: active ? undefined : '#5A5A5A' }}
            >
              <span className={active ? 'text-ink' : ''}>{label}</span>
            </button>
          )
        })}
      </div>

      {tab === 'students' ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px]" style={{ color: '#5A5A5A' }}>{visible.length} student{visible.length === 1 ? '' : 's'}</p>
            {groups.length > 0 && (
              <div className="relative">
                <select
                  value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
                  className="appearance-none bg-transparent text-brand text-[13px] font-semibold outline-none cursor-pointer pr-4"
                >
                  <option value="all">Filter by group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <ChevronRight className="w-3 h-3 text-brand rotate-90 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>

          {loading ? (
            <p className="text-ink-tertiary text-[14px]">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-ink-tertiary text-[14px]">{students.length === 0 ? 'No students have joined yet — share a join code from Dashboard.' : 'No students in this group.'}</p>
          ) : (
            <div className="space-y-2">
              {visible.map(s => (
                <button
                  key={s.id} onClick={() => setDetailStudent(s)}
                  className="w-full flex items-center gap-3 bg-surface border border-edge rounded-xl px-[14px] py-3 text-left hover:border-edge-input transition"
                >
                  <span className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
                    {initials(s.full_name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{s.full_name}</p>
                    <p className="text-[12px] truncate" style={{ color: '#5A5A5A' }}>
                      {[s.groups?.name, `${s.verified} verified`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '#5A5A5A' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'attendance' ? (
        <AttendanceRegister groups={groups} students={students} onChanged={load} />
      ) : (
        <GuestInvitePanel students={students} />
      )}

      {detailStudent && (
        <StudentDetail
          student={detailStudent} groups={groups}
          onClose={() => setDetailStudent(null)}
          onGroupChanged={load}
        />
      )}
    </div>
  )
}

// "Tapping a row opens that student (their profile and history)" --
// a real full-screen detail, not an inline expand. Same overlay
// convention every other detail screen in this app uses (a sticky
// back-button header over one scrolling page).
function StudentDetail({ student, groups, onClose, onGroupChanged }: {
  student: any; groups: Group[]; onClose: () => void; onGroupChanged: () => void
}) {
  const [submissions, setSubmissions] = useState<any[] | null>(null)
  const [attendance, setAttendance] = useState<any>(null)
  const [savingGroup, setSavingGroup] = useState(false)

  useEffect(() => {
    getMySubmissions(student.id).then(({ data }) => setSubmissions(data || []))
    getStudentAttendanceSummary(student.id).then(({ data }) => setAttendance(data))
  }, [student.id])

  const changeGroup = async (groupId: string) => {
    if (!groupId) return
    setSavingGroup(true)
    await setStudentGroup(student.id, groupId)
    setSavingGroup(false)
    onGroupChanged()
  }

  return (
    <div className="fixed inset-0 z-50 bg-paper overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center h-14 px-3 bg-paper/95 backdrop-blur border-b border-edge-subtle">
        <button onClick={onClose} aria-label="Back" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-muted text-ink">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-5">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-semibold flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
            {initials(student.full_name)}
          </span>
          <div className="min-w-0">
            <p className="text-[17px] font-bold text-ink truncate">{student.full_name}</p>
            <p className="text-[13px] text-ink-tertiary truncate">{student.email}</p>
          </div>
        </div>

        <div className="bg-surface border border-edge rounded-2xl p-5 mb-4">
          <p className="text-[12px] font-medium uppercase tracking-wide mb-3" style={{ color: '#5A5A5A' }}>Group</p>
          <select
            value={student.group_id || ''} onChange={e => changeGroup(e.target.value)} disabled={savingGroup}
            className="bg-surface border border-edge rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-brand transition"
          >
            <option value="" disabled>No group</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div className="bg-surface border border-edge rounded-2xl p-5 mb-4">
          <p className="text-[12px] font-medium uppercase tracking-wide mb-3" style={{ color: '#5A5A5A' }}>Work</p>
          {submissions === null ? (
            <p className="text-[13px] text-ink-tertiary">Loading…</p>
          ) : submissions.length === 0 ? (
            <p className="text-[13px] text-ink-tertiary">No work submitted yet.</p>
          ) : (
            <div className="space-y-2.5">
              {submissions.map(s => {
                const status = STATUS_ICON[s.status] || STATUS_ICON.submitted
                const Icon = status.icon
                return (
                  <div key={s.id} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink">{s.work_items?.title}</span>
                    <span className={`flex items-center gap-1.5 font-semibold capitalize ${status.cls}`}>
                      <Icon className="w-3.5 h-3.5" /> {s.status}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-surface border border-edge rounded-2xl p-5 flex items-center gap-2.5">
          <ClipboardList className="w-4 h-4 flex-shrink-0" style={{ color: '#5A5A5A' }} />
          <p className="text-[13px] text-ink-secondary">
            {attendance === null ? 'Loading attendance…'
              : attendance.total === 0 ? 'No attendance recorded yet.'
              : `${attendance.percentPresent}% present (${attendance.present} present, ${attendance.late} late, ${attendance.absent} absent)`}
          </p>
        </div>
      </div>
    </div>
  )
}

// Group + date, tap a name to mark, saves the instant it's tapped --
// no submit button to forget. Present/Late/Absent, one status per
// student per date, stored against student+group+date from day one so
// attendance-over-time can read straight off this later.
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
        <button onClick={handleQuickStart} disabled={students.length === 0} className="px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold disabled:opacity-40 mb-4" style={{ backgroundColor: '#F26B21' }}>
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
            <button onClick={handleCreateGroup} disabled={!newGroupName.trim()} className="px-3.5 py-2 rounded-lg text-white text-[13px] font-semibold disabled:opacity-40" style={{ backgroundColor: '#F26B21' }}>Create</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-1.5">
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
      </div>
      <p className="text-[12px] mb-4" style={{ color: '#8A8A8A' }}>Tap a name to mark. Saved automatically.</p>

      {!groupId ? (
        <p className="text-[13px] text-ink-tertiary">Choose a group to take its register for {new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.</p>
      ) : members.length === 0 ? (
        <p className="text-[13px] text-ink-tertiary">No students assigned to this group yet — assign them from the Students tab.</p>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between gap-3 bg-surface border border-edge rounded-xl px-[13px] py-[11px]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
                  {initials(m.full_name)}
                </span>
                <span className="text-[13px] font-semibold text-ink truncate">{m.full_name}</span>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <AttendancePill label="Present" selected={marks[m.id] === 'present'} bg="#E1F5EE" text="#0F6E56" onClick={() => mark(m.id, 'present')} />
                <AttendancePill label="Late" selected={marks[m.id] === 'late'} bg="#FAEEDA" text="#854F0B" onClick={() => mark(m.id, 'late')} />
                <AttendancePill label="Absent" selected={marks[m.id] === 'absent'} bg="#F1EFE8" text="#5F5E5A" onClick={() => mark(m.id, 'absent')} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center mt-5">
        {!creatingGroup ? (
          <button onClick={() => setCreatingGroup(true)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:opacity-80 transition">
            <Users2 className="w-3.5 h-3.5" /> Create a new group
          </button>
        ) : (
          <div className="inline-flex gap-1.5">
            <input
              value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Group name" autoFocus
              className="bg-surface border border-edge rounded-lg px-2.5 py-1.5 text-[12px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition w-40"
            />
            <button onClick={handleCreateGroup} disabled={!newGroupName.trim()} className="px-2.5 py-1.5 rounded-lg text-white text-[12px] font-semibold disabled:opacity-40" style={{ backgroundColor: '#F26B21' }}>Add</button>
          </div>
        )}
      </div>
    </div>
  )
}

// Selected Present is green, Late is amber, Absent is a filled muted
// state -- unselected pills of any status are a plain outline. Exact
// pill colours from the spec's own table.
function AttendancePill({ label, selected, bg, text, onClick }: { label: string; selected: boolean; bg: string; text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition border"
      style={selected ? { backgroundColor: bg, color: text, borderColor: bg } : { backgroundColor: 'transparent', color: '#8A8A8A', borderColor: '#E7E4DE' }}
    >
      {label}
    </button>
  )
}

// One or more students, defaulting to one -- "the common case is one
// student; a role with several candidates can include a few, without
// creating separate links." The guest sees only the chosen students,
// only their verified work, whether it's one or several.
function GuestInvitePanel({ students }: { students: any[] }) {
  const { user } = useAuth()
  const [invites, setInvites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [newLink, setNewLink] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = () => {
    if (!user?.organisation_id) return
    getGuestInvites(user.organisation_id).then(({ data }) => { setInvites(data || []); setLoading(false) })
  }
  useEffect(load, [user?.organisation_id])

  // One student selected by default, per spec -- the first time the
  // roster arrives with nothing chosen yet.
  useEffect(() => {
    if (students.length > 0 && selected.size === 0) setSelected(new Set([students[0].id]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students])

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleCreate = async () => {
    if (selected.size === 0 || !user?.organisation_id) return
    setCreating(true)
    setNewLink(null)
    const { data, error } = await createGuestInvite(user.organisation_id, user.id, Array.from(selected), email)
    setCreating(false)
    if (!error && data) {
      setNewLink(`${window.location.origin}/guest/${(data as any).token}`)
      setEmail('')
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
    <div>
      <div className="bg-surface border border-edge rounded-2xl p-6 mb-5">
        <p className="text-[14px] font-semibold text-ink mb-1.5">Invite an employer</p>
        <p className="text-[12px] mb-5 leading-relaxed" style={{ color: '#5A5A5A' }}>
          Bring in one employer to see a student's verified work. No account, no browsing the rest of LERN. Any interest comes straight back to you.
        </p>

        <p className="text-[12px] font-medium mb-2" style={{ color: '#5A5A5A' }}>Who should they see?</p>
        {students.length === 0 ? (
          <p className="text-[13px] text-ink-tertiary mb-1">No students have joined yet.</p>
        ) : (
          <div className="space-y-1.5 mb-1.5">
            {students.map(s => {
              const checked = selected.has(s.id)
              return (
                <button
                  key={s.id} onClick={() => toggle(s.id)}
                  className="w-full flex items-center gap-3 border rounded-xl px-3.5 py-2.5 text-left transition"
                  style={{ borderColor: checked ? '#0F6E56' : '#E7E4DE' }}
                >
                  {checked
                    ? <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: '#0F6E56' }} />
                    : <Square className="w-4 h-4 flex-shrink-0" style={{ color: '#B9B4A8' }} />}
                  <span className="flex-1 min-w-0 text-[13px] font-semibold text-ink truncate">{s.full_name}</span>
                  <span className="text-[12px] flex-shrink-0" style={{ color: '#5A5A5A' }}>{s.verified} verified piece{s.verified === 1 ? '' : 's'}</span>
                </button>
              )
            })}
          </div>
        )}
        <p className="text-[11px] mb-5" style={{ color: '#8A8A8A' }}>You can add more than one student if this employer is hiring for a role.</p>

        <label className="block mb-5">
          <span className="block text-[12px] font-medium mb-1.5" style={{ color: '#5A5A5A' }}>Employer's email (optional)</span>
          <input
            value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" type="email"
            className="w-full bg-surface border border-edge rounded-lg px-3.5 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
          />
        </label>

        {newLink && (
          <div className="flex items-center gap-2 bg-success-bg border border-success-text/20 rounded-lg px-3.5 py-2.5 mb-4">
            <p className="text-[12.5px] text-ink flex-1 truncate font-mono">{newLink}</p>
            <button onClick={() => copy(newLink, 'new')} className="text-success-text hover:opacity-70 transition flex-shrink-0">
              {copiedId === 'new' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}

        <button
          onClick={handleCreate} disabled={selected.size === 0 || creating}
          className="w-full flex items-center justify-center gap-1.5 text-white text-[14px] font-semibold py-3 rounded-xl disabled:opacity-40 transition mb-4"
          style={{ backgroundColor: '#F26B21' }}
        >
          <LinkIcon className="w-4 h-4" /> {creating ? 'Creating…' : 'Create invite link'}
        </button>

        <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3" style={{ backgroundColor: '#E6F1FB' }}>
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#0C447C' }} />
          <p className="text-[12px] leading-relaxed" style={{ color: '#0C447C' }}>
            The guest sees only the students you pick, and only their verified work. You can revoke the link any time.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-ink-tertiary text-[14px]">Loading…</p>
      ) : invites.length > 0 && (
        <div className="space-y-2">
          {invites.map(inv => {
            const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/guest/${inv.token}`
            const shares = inv.guest_invite_shares || []
            const names = shares.map((s: any) => s.users?.full_name).filter(Boolean)
            const nameLabel = names.length === 0 ? 'Student' : names.length === 1 ? names[0] : `${names[0]} +${names.length - 1} more`
            const status = inv.revoked_at ? 'Revoked' : inv.claimed_by ? 'Claimed' : 'Pending'
            return (
              <div key={inv.id} className="flex items-center justify-between bg-surface border border-edge rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">{nameLabel}</p>
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
