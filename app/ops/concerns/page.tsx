'use client'

import { useEffect, useState } from 'react'
import {
  getSafeguardingConcerns, getSafeguardingConcernActions, createSafeguardingConcern, updateSafeguardingConcernStatus,
} from '@/lib/supabase'
import { Plus, ShieldAlert, X } from 'lucide-react'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-[#FDEEEA] text-[#B3401E]' },
  under_review: { label: 'Under review', cls: 'bg-[#FAEEDA] text-[#854F0B]' },
  escalated: { label: 'Escalated', cls: 'bg-[#F3E8FD] text-[#7C3AED]' },
  closed: { label: 'Closed', cls: 'bg-surface-muted text-ink-tertiary' },
}
const STATUSES = ['open', 'under_review', 'escalated', 'closed']

// Build Spec: Internal Ops Tool v1.0, Part 3. Deliberately separate
// from content reports -- genuine welfare concerns about a specific
// young person, not moderation. Every status change writes to
// safeguarding_concern_actions (append-only) so there's a record of
// what was done and by whom if this is ever needed as evidence later.
function ConcernDetail({ concern, onClose, onChanged }: { concern: any; onClose: () => void; onChanged: () => void }) {
  const [actions, setActions] = useState<any[] | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => { getSafeguardingConcernActions(concern.id).then(({ data }) => setActions(data || [])) }
  useEffect(load, [concern.id])

  const changeStatus = async (status: string) => {
    setBusy(true)
    await updateSafeguardingConcernStatus(concern.id, status, note.trim() || undefined)
    setBusy(false); setNote('')
    load(); onChanged()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge-subtle sticky top-0 bg-surface">
          <p className="font-bold text-ink text-[15px]">Concern about {concern.student_name}</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-tertiary"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-[13px] text-ink-tertiary">Raised by {concern.raised_by_name} · {new Date(concern.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          <p className="text-[13px] text-ink-body bg-surface-subtle rounded-lg p-3 whitespace-pre-wrap">{concern.description}</p>

          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map(s => (
              <button
                key={s} onClick={() => changeStatus(s)} disabled={busy || concern.status === s}
                className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full transition ${concern.status === s ? STATUS_LABEL[s].cls : 'bg-surface border border-edge text-ink-secondary hover:border-brand'}`}
              >
                {STATUS_LABEL[s].label}
              </button>
            ))}
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Note for the record (optional, shown against whichever status you pick above)…" className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2 text-[12.5px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none" />

          <div>
            <p className="text-[12px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2">Record</p>
            {actions === null ? <p className="text-[13px] text-ink-tertiary">Loading…</p> : (
              <div className="space-y-2">
                {actions.map(a => (
                  <div key={a.id} className="text-[12.5px] text-ink-secondary border-l-2 border-edge pl-3">
                    <p><span className="font-semibold text-ink">{a.actor_name}</span> — {a.action}{a.note ? `: ${a.note}` : ''}</p>
                    <p className="text-[11px] text-ink-quaternary">{new Date(a.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function NewConcernForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [raisedByName, setRaisedByName] = useState('')
  const [studentName, setStudentName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!raisedByName.trim() || !studentName.trim() || !description.trim()) return
    setBusy(true)
    await createSafeguardingConcern({ raisedByName: raisedByName.trim(), studentName: studentName.trim(), description: description.trim() })
    setBusy(false); onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <p className="font-bold text-ink text-[15px] mb-4">Log a safeguarding concern</p>
        <div className="space-y-2.5">
          <input value={raisedByName} onChange={e => setRaisedByName(e.target.value)} placeholder="Who raised it?" className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition" />
          <input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Which young person?" className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="What's the concern?" className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none" />
        </div>
        <div className="flex items-center gap-2 mt-4">
          <button onClick={submit} disabled={busy || !raisedByName.trim() || !studentName.trim() || !description.trim()} className="bg-brand text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40">{busy ? 'Logging…' : 'Log concern'}</button>
          <button onClick={onClose} className="text-[13px] font-semibold text-ink-tertiary px-2">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function OpsConcernsPage() {
  const [rows, setRows] = useState<any[] | null>(null)
  const [open, setOpen] = useState<any | null>(null)
  const [creating, setCreating] = useState(false)

  const load = () => { getSafeguardingConcerns().then(({ data }) => setRows(data || [])) }
  useEffect(load, [])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[22px] font-bold text-ink">Safeguarding concerns</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 bg-brand text-white text-[13px] font-semibold px-3.5 py-2 rounded-xl"><Plus className="w-4 h-4" /> Log concern</button>
      </div>
      <p className="text-[14px] text-ink-tertiary mb-5">Separate from content reports — genuine welfare concerns about a specific young person.</p>

      {rows === null ? (
        <p className="text-[14px] text-ink-tertiary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl px-5 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-accent-bg flex items-center justify-center mx-auto mb-3"><ShieldAlert className="w-5 h-5 text-brand" /></div>
          <p className="text-[14px] font-semibold text-ink mb-1">Nothing logged</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(c => (
            <button key={c.id} onClick={() => setOpen(c)} className="w-full text-left bg-surface border border-edge rounded-2xl px-5 py-4 hover:border-brand transition">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-ink text-[14.5px]">{c.student_name}</p>
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_LABEL[c.status].cls}`}>{STATUS_LABEL[c.status].label}</span>
              </div>
              <p className="text-[12.5px] text-ink-tertiary mt-0.5">Raised by {c.raised_by_name} · {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
              <p className="text-[13px] text-ink-secondary mt-1.5 line-clamp-2">{c.description}</p>
            </button>
          ))}
        </div>
      )}

      {open && <ConcernDetail concern={open} onClose={() => setOpen(null)} onChanged={load} />}
      {creating && <NewConcernForm onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load() }} />}
    </div>
  )
}
