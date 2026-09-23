'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/AuthContext'
import { useResolvedTheme } from '@/context/ThemeProvider'
import {
  getOrgStudents, getGroups, getPlacements, createPlacement, setPlacementStatus,
  getPlacementAttendance, markPlacementAttendance, getPlacementAttendanceForOrg,
} from '@/lib/supabase'
import { ArrowLeft, Briefcase, Download, ChevronRight, Shield, Check, X as XIcon } from 'lucide-react'
import type { Group } from '@/lib/types'

// Final Build Spec: Work Experience (schools and colleges), 23 Sep
// 2026. Institution-only -- providers have no equivalent section. A
// "year group" is just an existing group/class, the same one Students
// > Attendance already filters by; no new roster concept introduced.
// Attendance here is entirely separate from that classroom register --
// scoped to one placement (one employer, one date range), never a
// recurring weekly class.
function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}
function currentWeek(startsOn: string) {
  const days = Math.floor((Date.now() - new Date(startsOn).getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.floor(days / 7) + 1)
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export default function WorkExperiencePanel() {
  const { user } = useAuth()
  const [students, setStudents] = useState<any[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [placements, setPlacements] = useState<any[]>([])
  const [orgAttendance, setOrgAttendance] = useState<{ placement_id: string; status: string }[]>([])
  const [groupId, setGroupId] = useState('all')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<{ studentId: string; name: string } | null>(null)
  const [openPlacement, setOpenPlacement] = useState<any | null>(null)

  const load = () => {
    if (!user?.organisation_id) return
    setLoading(true)
    Promise.all([
      getOrgStudents(user.organisation_id),
      getGroups(user.organisation_id),
      getPlacements(user.organisation_id),
      getPlacementAttendanceForOrg(user.organisation_id),
    ]).then(([s, g, p, a]) => {
      setStudents(s.data || [])
      setGroups(g.data || [])
      setPlacements(p.data || [])
      setOrgAttendance(a.data || [])
      setLoading(false)
    })
  }
  useEffect(load, [user?.organisation_id])

  const visibleStudents = groupId === 'all' ? students : students.filter(s => s.group_id === groupId)
  const placementByStudent = new Map(placements.filter(p => p.status === 'active').map(p => [p.student_id, p]))
  const placedCount = visibleStudents.filter(s => placementByStudent.has(s.id)).length
  const needOneCount = visibleStudents.length - placedCount

  const visiblePlacementIds = new Set(visibleStudents.map(s => placementByStudent.get(s.id)?.id).filter(Boolean))
  const relevantAttendance = orgAttendance.filter(a => visiblePlacementIds.has(a.placement_id))
  const attendancePct = relevantAttendance.length
    ? Math.round((relevantAttendance.filter(a => a.status === 'present').length / relevantAttendance.length) * 100)
    : null

  const groupLabel = groupId === 'all' ? 'All students' : groups.find(g => g.id === groupId)?.name || ''

  const exportCsv = () => {
    const rows = [['Student', 'Employer', 'Start date', 'End date', 'Status', 'Days present', 'Days absent']]
    for (const s of visibleStudents) {
      const p = placementByStudent.get(s.id)
      if (!p) { rows.push([s.full_name, '', '', '', 'Unplaced', '', '']); continue }
      const att = orgAttendance.filter(a => a.placement_id === p.id)
      rows.push([
        s.full_name, p.employer_name, p.starts_on, p.ends_on, 'Placed',
        String(att.filter(a => a.status === 'present').length), String(att.filter(a => a.status === 'absent').length),
      ])
    }
    const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `placement-evidence-${groupLabel.replace(/\s+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (openPlacement) {
    return (
      <PlacementDetail
        placement={openPlacement}
        onBack={() => { setOpenPlacement(null); load() }}
      />
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="text-[18px] font-bold text-ink">Work Experience</p>
          <p className="text-[13px] text-ink-tertiary mt-0.5">{groupLabel}, placements</p>
        </div>
        {groups.length > 0 && (
          <select
            value={groupId} onChange={e => setGroupId(e.target.value)}
            className="bg-surface border border-edge rounded-lg px-3 py-2 text-[13px] text-ink outline-none focus:border-brand transition flex-shrink-0"
          >
            <option value="all">All students</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          {[0, 1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-surface animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 mb-5">
            <StatCard label="Placed" value={String(placedCount)} color="#0F6E56" />
            <StatCard label="Need one" value={String(needOneCount)} color="#D4551A" />
            <StatCard label="Placement attendance" value={attendancePct === null ? '—' : `${attendancePct}%`} color="#185FA5" />
          </div>

          {visibleStudents.length === 0 ? (
            <div className="text-center py-16 bg-surface border border-edge-subtle rounded-2xl">
              <Briefcase className="w-7 h-7 text-ink-quaternary mx-auto mb-2.5" />
              <p className="text-[13px] text-ink-tertiary">No students in this group yet.</p>
            </div>
          ) : (
            <div className="bg-surface border border-edge rounded-2xl divide-y divide-edge-subtle overflow-hidden mb-5">
              {visibleStudents.map(s => {
                const p = placementByStudent.get(s.id)
                const att = p ? orgAttendance.filter(a => a.placement_id === p.id) : []
                return (
                  <button
                    key={s.id}
                    onClick={() => p ? setOpenPlacement({ ...p, student: s }) : setAdding({ studentId: s.id, name: s.full_name })}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-muted transition"
                  >
                    <span className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
                      {initials(s.full_name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-ink truncate">{s.full_name}</p>
                      <p className="text-[12px] text-ink-tertiary truncate">
                        {p ? `${p.employer_name}, week ${currentWeek(p.starts_on)}` : 'No placement yet'}
                      </p>
                    </div>
                    {p ? (
                      <span className="flex-shrink-0 text-[11.5px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E1F5EE', color: '#0F6E56' }}>
                        {att.length > 0 ? `${att.filter(a => a.status === 'present').length}/${att.length} days` : 'Placed'}
                      </span>
                    ) : (
                      <span className="flex-shrink-0 text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-surface-muted text-ink-tertiary">Unplaced</span>
                    )}
                    <ChevronRight className="w-4 h-4 text-ink-quaternary flex-shrink-0" />
                  </button>
                )
              })}
            </div>
          )}

          <button
            onClick={exportCsv}
            className="w-full flex items-center justify-center gap-2 bg-ink text-white text-[14px] font-bold py-3.5 rounded-xl hover:opacity-90 transition mb-4"
          >
            <Download className="w-4 h-4" /> Export placement evidence
          </button>

          <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3" style={{ backgroundColor: '#E6F1FB' }}>
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#0C447C' }} />
            <p className="text-[12px] leading-relaxed" style={{ color: '#0C447C' }}>
              Verified attendance at real placements, exportable for your trust, Ofsted, or funders.
            </p>
          </div>
        </>
      )}

      {adding && (
        <AddPlacementDialog
          studentId={adding.studentId} studentName={adding.name}
          onClose={() => setAdding(null)}
          onCreated={() => { setAdding(null); load() }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface border border-edge rounded-2xl p-5">
      <p className="text-[24px] font-extrabold" style={{ color }}>{value}</p>
      <p className="text-[13px] text-ink-tertiary mt-1">{label}</p>
    </div>
  )
}

function AddPlacementDialog({ studentId, studentName, onClose, onCreated }: {
  studentId: string; studentName: string; onClose: () => void; onCreated: () => void
}) {
  const { user } = useAuth()
  const theme = useResolvedTheme()
  const [employerName, setEmployerName] = useState('')
  const [startsOn, setStartsOn] = useState(() => new Date().toISOString().split('T')[0])
  const [endsOn, setEndsOn] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setError('')
    if (!employerName.trim()) return setError('Add who they\'re placed with.')
    if (!endsOn) return setError('Add when the placement ends.')
    if (new Date(endsOn) < new Date(startsOn)) return setError('End date has to be after the start date.')
    if (!user?.organisation_id) return
    setSaving(true)
    const { error: err } = await createPlacement(user.organisation_id, user.id, {
      student_id: studentId, employer_name: employerName.trim(), starts_on: startsOn, ends_on: endsOn,
    })
    setSaving(false)
    if (err) { setError("Couldn't save that placement — try again."); return }
    onCreated()
  }

  return createPortal((
    <div data-theme={theme} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <p className="font-bold text-ink text-[15px] mb-1">Place {studentName}</p>
        <p className="text-[13px] text-ink-tertiary mb-4">Who they're with, and for how long.</p>

        <label className="block mb-3">
          <span className="block text-[12px] font-semibold text-ink-secondary mb-1.5">Employer</span>
          <input
            value={employerName} onChange={e => setEmployerName(e.target.value)} autoFocus placeholder="e.g. Bright Media Studio"
            className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition"
          />
        </label>
        <div className="flex gap-2 mb-3">
          <label className="flex-1">
            <span className="block text-[12px] font-semibold text-ink-secondary mb-1.5">Starts</span>
            <input type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition" />
          </label>
          <label className="flex-1">
            <span className="block text-[12px] font-semibold text-ink-secondary mb-1.5">Ends</span>
            <input type="date" value={endsOn} onChange={e => setEndsOn(e.target.value)} className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition" />
          </label>
        </div>
        {error && <p className="text-[12px] text-danger-text mb-2">{error}</p>}
        <div className="flex items-center justify-end gap-2 mt-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-ink-secondary hover:bg-surface-muted transition">Cancel</button>
          <button onClick={submit} disabled={saving} className="bg-brand text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg hover:bg-brand-hover transition disabled:opacity-40">
            {saving ? 'Saving…' : 'Save placement'}
          </button>
        </div>
      </div>
    </div>
  ), document.body)
}

function PlacementDetail({ placement, onBack }: { placement: any; onBack: () => void }) {
  const { user } = useAuth()
  const theme = useResolvedTheme()
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => { getPlacementAttendance(placement.id).then(({ data }) => { setRecords(data || []); setLoading(false) }) }
  useEffect(load, [placement.id])

  const days: string[] = []
  const cursor = new Date(placement.starts_on)
  const end = new Date(Math.min(new Date(placement.ends_on).getTime(), Date.now()))
  while (cursor <= end) {
    // Weekdays only -- a work experience placement doesn't run weekends.
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) days.push(cursor.toISOString().split('T')[0])
    cursor.setDate(cursor.getDate() + 1)
  }
  const byDate = new Map(records.map(r => [r.session_date, r.status]))

  const mark = async (date: string, status: 'present' | 'absent') => {
    if (!user) return
    setRecords(prev => {
      const next = prev.filter(r => r.session_date !== date)
      return [...next, { session_date: date, status }]
    })
    await markPlacementAttendance(placement.id, date, status, user.id)
  }

  const present = records.filter(r => r.status === 'present').length

  return (
    <div data-theme={theme}>
      <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-ink-tertiary hover:text-ink transition mb-4">
        <ArrowLeft className="w-4 h-4" /> Work Experience
      </button>
      <p className="text-[18px] font-bold text-ink">{placement.student?.full_name}</p>
      <p className="text-[13px] text-ink-tertiary mb-5">{placement.employer_name} · {fmtDate(placement.starts_on)}–{fmtDate(placement.ends_on)}</p>

      <div className="bg-surface border border-edge rounded-2xl p-5 mb-4">
        <p className="text-[13px] font-semibold text-ink mb-3">
          {loading ? 'Loading…' : `${present}/${records.length} days present`}
        </p>
        {loading ? (
          <p className="text-[13px] text-ink-tertiary">Loading…</p>
        ) : days.length === 0 ? (
          <p className="text-[13px] text-ink-tertiary">Placement hasn't started yet.</p>
        ) : (
          <div className="space-y-1.5">
            {days.map(d => {
              const status = byDate.get(d)
              return (
                <div key={d} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-ink-secondary">{fmtDate(d)}</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => mark(d, 'present')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition border"
                      style={status === 'present' ? { backgroundColor: '#E1F5EE', color: '#0F6E56', borderColor: '#E1F5EE' } : { backgroundColor: 'transparent', color: '#8A8A8A', borderColor: '#E7E4DE' }}
                    >
                      <Check className="w-3 h-3" /> Present
                    </button>
                    <button
                      onClick={() => mark(d, 'absent')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition border"
                      style={status === 'absent' ? { backgroundColor: '#F1EFE8', color: '#5F5E5A', borderColor: '#F1EFE8' } : { backgroundColor: 'transparent', color: '#8A8A8A', borderColor: '#E7E4DE' }}
                    >
                      <XIcon className="w-3 h-3" /> Absent
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <button
        onClick={async () => { await setPlacementStatus(placement.id, 'completed'); onBack() }}
        className="text-[12.5px] font-semibold text-ink-tertiary hover:text-danger-text transition"
      >
        Mark placement ended
      </button>
    </div>
  )
}
