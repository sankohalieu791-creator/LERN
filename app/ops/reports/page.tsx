'use client'

import { useEffect, useState } from 'react'
import { getOpsContentReports, opsRestoreReport, opsRemoveReport, opsEscalateReport } from '@/lib/supabase'
import { Flag, Check, X, AlertTriangle } from 'lucide-react'

// Build Spec: Internal Ops Tool v1.0, Part 2. One card per reported,
// auto-hidden post -- Restore/Remove resolve it here; Escalate creates
// a Part 3 safeguarding concern instead, "rather than resolving it
// here" per spec, so it drops out of this list without a content
// decision either way.
function ReportCard({ r, onChanged }: { r: any; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [studentName, setStudentName] = useState(r.author_name || '')
  const [description, setDescription] = useState('')

  const restore = async () => { setBusy(true); await opsRestoreReport(r.post_id); setBusy(false); onChanged() }
  const remove = async () => { setBusy(true); await opsRemoveReport(r.post_id); setBusy(false); onChanged() }
  const escalate = async () => {
    if (!studentName.trim() || !description.trim()) return
    setBusy(true)
    await opsEscalateReport(r.post_id, studentName.trim(), description.trim(), r.author_id)
    setBusy(false); setEscalating(false); onChanged()
  }

  return (
    <div className="bg-surface border border-edge rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-bold text-ink text-[15px] truncate">{r.author_name || 'Unknown author'}</p>
          <p className="text-[12.5px] text-ink-tertiary">Reported {r.report_count} time{r.report_count === 1 ? '' : 's'} · {r.reporter_names.join(', ')}</p>
        </div>
        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-[#FAEEDA] text-[#854F0B] flex-shrink-0">Hidden</span>
      </div>

      <p className="text-[13px] text-ink-tertiary mb-1"><span className="font-semibold">Reported for:</span> {r.latest_reason}</p>
      {r.post_content && <p className="text-[13px] text-ink-body bg-surface-subtle rounded-lg p-3 mb-3 whitespace-pre-wrap">{r.post_content}</p>}

      <div className="flex items-start gap-2 bg-[#FDEEEA] rounded-lg px-3 py-2.5 mb-3">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#B3401E]" />
        <p className="text-[12px] text-[#B3401E] leading-relaxed">Serious concern? Escalate to the safeguarding concern log instead of a content decision.</p>
      </div>

      {escalating ? (
        <div className="space-y-2">
          <input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Young person's name" className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What's the concern?" className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none" />
          <div className="flex items-center gap-2">
            <button onClick={escalate} disabled={busy || !studentName.trim() || !description.trim()} className="text-[12px] font-semibold bg-[#B3401E] text-white px-3 py-1.5 rounded-lg disabled:opacity-40">{busy ? 'Escalating…' : 'Confirm escalate'}</button>
            <button onClick={() => setEscalating(false)} className="text-[12px] font-semibold text-ink-tertiary px-2">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={restore} disabled={busy} className="flex items-center gap-1.5 text-[12.5px] font-semibold bg-success-solid text-white px-3.5 py-2 rounded-lg disabled:opacity-40"><Check className="w-3.5 h-3.5" /> Restore</button>
          <button onClick={remove} disabled={busy} className="flex items-center gap-1.5 text-[12.5px] font-semibold bg-danger-solid text-white px-3.5 py-2 rounded-lg disabled:opacity-40"><X className="w-3.5 h-3.5" /> Remove</button>
          <button onClick={() => setEscalating(true)} className="text-[12.5px] font-semibold text-[#B3401E] hover:underline ml-auto">Escalate</button>
        </div>
      )}
    </div>
  )
}

export default function OpsReportsPage() {
  const [rows, setRows] = useState<any[] | null>(null)
  const load = () => { getOpsContentReports().then(({ data }) => setRows(data || [])) }
  useEffect(load, [])

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-[22px] font-bold text-ink mb-1">Content reports</p>
      <p className="text-[14px] text-ink-tertiary mb-5">Auto-hidden the moment they're reported. A person always makes the decision.</p>

      {rows === null ? (
        <p className="text-[14px] text-ink-tertiary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl px-5 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-accent-bg flex items-center justify-center mx-auto mb-3"><Flag className="w-5 h-5 text-brand" /></div>
          <p className="text-[14px] font-semibold text-ink mb-1">Nothing awaiting review</p>
        </div>
      ) : (
        <div className="space-y-3">{rows.map(r => <ReportCard key={r.post_id} r={r} onChanged={load} />)}</div>
      )}
    </div>
  )
}
