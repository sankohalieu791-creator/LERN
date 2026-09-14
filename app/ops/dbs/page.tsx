'use client'

import { useEffect, useState } from 'react'
import {
  getLernDeliveryAdults, getLernAdultFrequency, addLernDeliveryAdult, updateLernDeliveryAdult,
  getLernSessionLog, recordLernSessionCancellation,
} from '@/lib/supabase'
import type { LernDeliveryAdult, LernAdultFrequency, LernSessionLogEntry } from '@/lib/types'
import { TextField } from '@/components/v2/Field'
import { Lock, Plus, Download, AlertTriangle, Ban } from 'lucide-react'

// Build Spec: Internal Ops Tool v1.0, Part 4 -- moved here from
// Settings (was gated purely by email there) now that a dedicated,
// genuinely separate ops area exists. Deliberately narrow: LERN's own
// adults who deliver live sessions, never institution staff
// (DBS-checked by their institution). The frequency count and
// threshold flags are computed server-side by lern_adult_frequency()
// from the session log itself, never entered by hand.
export default function OpsDbsPage() {
  const [adults, setAdults] = useState<LernDeliveryAdult[]>([])
  const [freq, setFreq] = useState<Record<string, LernAdultFrequency>>({})
  const [log, setLog] = useState<LernSessionLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const load = async () => {
    const [{ data: adultRows }, { data: logRows }] = await Promise.all([
      getLernDeliveryAdults(), getLernSessionLog(),
    ])
    setAdults(adultRows || [])
    setLog(logRows || [])
    const entries = await Promise.all(
      (adultRows || []).map(async a => [a.id, (await getLernAdultFrequency(a.id)).data] as const)
    )
    setFreq(Object.fromEntries(entries.filter(([, f]) => f)))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const exportLog = () => {
    const header = 'Session,Mode,Delivered by,Delivered to under-18s,Date,Cancellation\n'
    const rows = log.map(l => [
      l.session_title, l.mode === 'online' ? 'Online' : 'In-person', l.adult?.full_name || '',
      l.delivered_to_minors ? 'Yes' : 'No', l.session_date, l.is_cancellation ? 'Yes' : 'No',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `lern-session-log-${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-[22px] font-bold text-ink mb-4">DBS & session tracking</p>

      <div className="flex items-start gap-2.5 rounded-xl px-4 py-3.5 mb-5" style={{ backgroundColor: '#E6F1FB' }}>
        <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#185FA5' }} />
        <p className="text-[13px] leading-relaxed" style={{ color: '#0C447C' }}>
          This covers LERN adults who deliver live sessions to under-18s. Institution staff are DBS-checked by their institution and do not appear here.
        </p>
      </div>

      {loading ? (
        <p className="text-[14px] text-ink-tertiary">Loading…</p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[16px] font-bold text-ink">LERN adults delivering live sessions</p>
            <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {adding && <AddAdultForm onDone={() => { setAdding(false); load() }} onCancel={() => setAdding(false)} />}

          <div className="space-y-3 mb-8">
            {adults.map(a => (
              <AdultCard key={a.id} adult={a} frequency={freq[a.id]} onChanged={load} />
            ))}
            {adults.length === 0 && !adding && (
              <p className="text-[14px] text-ink-tertiary bg-surface border border-edge rounded-2xl px-5 py-8 text-center">
                No LERN adults on the roster yet — add whoever delivers live sessions.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-[16px] font-bold text-ink">Session log</p>
            <button onClick={exportLog} disabled={log.length === 0} className="flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline disabled:opacity-40">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
          <div className="bg-surface border border-edge rounded-2xl overflow-hidden">
            {log.length === 0 ? (
              <p className="text-[14px] text-ink-tertiary px-5 py-8 text-center">No sessions logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-edge-subtle text-left">
                      <th className="px-4 py-2.5 font-semibold text-ink-tertiary">Session</th>
                      <th className="px-4 py-2.5 font-semibold text-ink-tertiary">Delivered by</th>
                      <th className="px-4 py-2.5 font-semibold text-ink-tertiary">Date</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const alreadyCancelled = new Set(log.map(l => l.cancelled_log_id).filter(Boolean))
                      return log.map(l => (
                        <tr key={l.id} className="border-b border-edge-subtle last:border-0">
                          <td className="px-4 py-2.5 text-ink">
                            {l.session_title} <span className="text-ink-tertiary">({l.mode === 'online' ? 'online' : 'in-person'})</span>
                            {l.is_cancellation && <span className="ml-1.5 text-[11px] font-semibold text-danger-text">Cancelled</span>}
                          </td>
                          <td className="px-4 py-2.5 text-ink-secondary">{l.adult?.full_name || '—'}</td>
                          <td className="px-4 py-2.5 text-ink-secondary">{new Date(l.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                          <td className="px-4 py-2.5 text-right">
                            {!l.is_cancellation && !alreadyCancelled.has(l.id) && (
                              <CancelLogButton entry={l} onCancelled={() => load()} />
                            )}
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-[12px] text-ink-quaternary mt-3 leading-relaxed">
            The log records who delivered each live session and when, so the frequency count is accurate and evidenced. No DBS certificates are stored here, only the checked status and date.
          </p>
        </>
      )}
    </div>
  )
}

function AdultCard({ adult, frequency, onChanged }: { adult: LernDeliveryAdult; frequency?: LernAdultFrequency; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [settingDate, setSettingDate] = useState(false)
  const [dateInput, setDateInput] = useState(new Date().toISOString().split('T')[0])

  const approaching = !adult.dbs_checked && (frequency?.days_in_30 || 0) >= 2 && !frequency?.is_regulated
  const crossed = !adult.dbs_checked && !!frequency?.is_regulated

  const toggleDbs = async (checked: boolean) => {
    if (checked) { setSettingDate(true); return }
    setBusy(true); setError('')
    const { error: err } = await updateLernDeliveryAdult(adult.id, { dbs_checked: false, dbs_checked_at: null })
    setBusy(false)
    if (err) { setError("Couldn't update — try again."); return }
    onChanged()
  }
  const confirmDbsDate = async () => {
    setBusy(true); setError('')
    const { error: err } = await updateLernDeliveryAdult(adult.id, { dbs_checked: true, dbs_checked_at: dateInput })
    setBusy(false)
    setSettingDate(false)
    if (err) { setError("Couldn't update — try again."); return }
    onChanged()
  }

  return (
    <div className="bg-surface border border-edge rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold" style={{ backgroundColor: '#E6F1FB', color: '#185FA5' }}>
            {adult.full_name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-ink truncate">{adult.full_name}</p>
            <p className="text-[12.5px] text-ink-tertiary truncate">{adult.role_label}</p>
          </div>
        </div>
        <button
          onClick={() => toggleDbs(!adult.dbs_checked)} disabled={busy}
          className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full transition disabled:opacity-50"
          style={adult.dbs_checked ? { backgroundColor: '#E1F5EE', color: '#0F6E56' } : { backgroundColor: '#FAEEDA', color: '#854F0B' }}
        >
          {adult.dbs_checked ? 'DBS checked' : 'DBS not yet checked'}
        </button>
      </div>

      {settingDate && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-edge-subtle">
          <input
            type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
            className="bg-surface-subtle border border-edge rounded-lg px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand"
          />
          <button onClick={confirmDbsDate} disabled={busy} className="text-[12.5px] font-semibold text-brand disabled:opacity-50">Confirm checked</button>
          <button onClick={() => setSettingDate(false)} className="text-[12.5px] font-semibold text-ink-tertiary">Cancel</button>
        </div>
      )}

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-edge-subtle text-[13px]">
        <p className="text-ink-secondary">Delivers to under-18s: <span className="font-semibold text-ink">{adult.delivers_to_minors ? 'Yes' : 'No'}</span></p>
        <p className="text-ink-secondary">Frequency: <span className="font-semibold" style={{ color: crossed ? '#B3401E' : approaching ? '#854F0B' : undefined }}>{frequency ? `${frequency.days_in_30} days / 30` : '—'}</span></p>
        {adult.dbs_checked && adult.dbs_checked_at && (
          <p className="text-ink-secondary">Checked: <span className="font-semibold text-ink">{new Date(adult.dbs_checked_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span></p>
        )}
      </div>

      {(approaching || crossed || frequency?.is_weekly || frequency?.has_overnight) && (
        <div className="flex items-start gap-1.5 mt-2.5 pt-2.5 border-t border-edge-subtle" style={{ color: crossed || frequency?.is_weekly || frequency?.has_overnight ? '#B3401E' : '#854F0B' }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <p className="text-[12.5px] leading-relaxed">
            {crossed || frequency?.is_weekly || frequency?.has_overnight
              ? `This meets the regulated-activity threshold${frequency?.is_weekly ? ' (weekly pattern)' : frequency?.has_overnight ? ' (overnight session)' : ''} — Enhanced DBS is required now.`
              : 'Approaching the regulated-activity threshold (3 days / 30). Enhanced DBS needed before it is crossed.'}
          </p>
        </div>
      )}
      {error && <p className="text-[12px] text-danger-text mt-2">{error}</p>}
    </div>
  )
}

// The log itself is append-only (the DB trigger enforces it regardless
// of what this button does) -- this never edits or removes the
// original row, it writes a NEW one recording that the session was
// cancelled, exactly as the spec requires.
function CancelLogButton({ entry, onCancelled }: { entry: LernSessionLogEntry; onCancelled: () => void }) {
  const [busy, setBusy] = useState(false)
  const cancel = async () => {
    if (!confirm(`Record "${entry.session_title}" as cancelled? The original entry stays in the log.`)) return
    setBusy(true)
    const { error } = await recordLernSessionCancellation(entry.id, entry.adult_id, entry.session_title, entry.mode)
    setBusy(false)
    if (error) { alert("Couldn't record that — try again."); return }
    onCancelled()
  }
  return (
    <button onClick={cancel} disabled={busy} aria-label="Record as cancelled" className="text-ink-tertiary hover:text-danger-text transition disabled:opacity-40">
      <Ban className="w-3.5 h-3.5" />
    </button>
  )
}

function AddAdultForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [fullName, setFullName] = useState('')
  const [roleLabel, setRoleLabel] = useState('')
  const [deliversToMinors, setDeliversToMinors] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!fullName.trim() || !roleLabel.trim()) return setError('Enter a name and their role.')
    setSaving(true); setError('')
    const { error: err } = await addLernDeliveryAdult({ full_name: fullName.trim(), role_label: roleLabel.trim(), delivers_to_minors: deliversToMinors })
    setSaving(false)
    if (err) { setError("Couldn't add them — try again."); return }
    onDone()
  }

  return (
    <div className="bg-surface border border-edge rounded-2xl p-4 mb-3">
      <TextField label="Full name" value={fullName} onChange={setFullName} placeholder="e.g. Rina Mehta" />
      <TextField label="Role at LERN" value={roleLabel} onChange={setRoleLabel} placeholder="e.g. Workshop host" />
      <label className="flex items-center gap-2 text-[13px] text-ink-secondary mb-3 -mt-1">
        <input type="checkbox" checked={deliversToMinors} onChange={e => setDeliversToMinors(e.target.checked)} />
        Delivers live sessions to under-18s
      </label>
      {error && <p className="text-[12px] text-danger-text mb-2">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving} className="bg-brand text-white text-[13px] font-semibold px-4 py-2 rounded-lg disabled:opacity-40">
          {saving ? 'Adding…' : 'Add to roster'}
        </button>
        <button onClick={onCancel} className="text-[13px] font-semibold text-ink-tertiary px-2">Cancel</button>
      </div>
    </div>
  )
}
