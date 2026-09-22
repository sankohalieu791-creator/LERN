'use client'

import { useEffect, useState } from 'react'
import { getApprovedEmployers, reverseEmployerApproval } from '@/lib/supabase'
import { BadgeCheck, Undo2 } from 'lucide-react'

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function ApprovedCard({ r, onChanged }: { r: any; onChanged: () => void }) {
  const [reversing, setReversing] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reverse = async () => {
    setBusy(true); setError('')
    const { error: err } = await reverseEmployerApproval(r.id, reason.trim())
    setBusy(false)
    if (err) { setError(err.message || "Couldn't reverse — try again."); return }
    setReversing(false); setReason(''); onChanged()
  }

  return (
    <div className="bg-surface border border-edge rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-ink text-[15px] truncate">{r.employer_company_name || r.full_name}</p>
          <p className="text-[13px] text-ink-tertiary truncate">{r.email} · signed up by {r.full_name}</p>
          {r.employer_website && <p className="text-[12.5px] text-ink-tertiary truncate">{r.employer_website}</p>}
        </div>
        <p className="text-[11px] text-ink-quaternary flex-shrink-0">{r.employer_verification_requested_at ? timeAgo(r.employer_verification_requested_at) : ''}</p>
      </div>

      {error && <p className="text-[12.5px] text-danger-text mt-2">{error}</p>}

      {reversing ? (
        <div className="mt-3 pt-3 border-t border-edge-subtle">
          <p className="text-[12px] font-semibold text-ink-tertiary mb-1.5">Reason — shown to the employer</p>
          <textarea
            value={reason} onChange={e => setReason(e.target.value)} autoFocus rows={2}
            placeholder="Why is this approval being reversed?"
            className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none"
          />
          <div className="flex items-center gap-2 mt-2">
            <button onClick={reverse} disabled={busy} className="text-[12px] font-semibold bg-danger-solid text-white px-3 py-1.5 rounded-lg disabled:opacity-40">{busy ? 'Reversing…' : 'Confirm reverse'}</button>
            <button onClick={() => { setReversing(false); setReason('') }} className="text-[12px] font-semibold text-ink-tertiary px-2">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-edge-subtle">
          <button onClick={() => setReversing(true)} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-danger-text hover:underline">
            <Undo2 className="w-3.5 h-3.5" /> Reverse approval
          </button>
        </div>
      )}
    </div>
  )
}

// "Add a list of approved employers, with a route to reverse an
// approval." Approving was already possible from the employer-
// verification queue -- there was just never anywhere to see the
// result afterward or undo it without going back through raw SQL.
export default function OpsApprovedEmployersPage() {
  const [rows, setRows] = useState<any[] | null>(null)
  const load = () => { getApprovedEmployers().then(({ data }) => setRows(data || [])) }
  useEffect(load, [])

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-[22px] font-bold text-ink mb-1">Approved employers</p>
      <p className="text-[14px] text-ink-tertiary mb-5">Every employer currently verified and live on LERN.</p>

      {rows === null ? (
        <p className="text-[14px] text-ink-tertiary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl px-5 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-accent-bg flex items-center justify-center mx-auto mb-3"><BadgeCheck className="w-5 h-5 text-brand" /></div>
          <p className="text-[14px] font-semibold text-ink mb-1">No approved employers yet</p>
        </div>
      ) : (
        <div className="space-y-3">{rows.map(r => <ApprovedCard key={r.id} r={r} onChanged={load} />)}</div>
      )}
    </div>
  )
}
