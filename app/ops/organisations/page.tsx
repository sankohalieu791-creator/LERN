'use client'

import { useEffect, useState } from 'react'
import { getPendingOrganisations, approveOrganisation } from '@/lib/supabase'
import { Check, ShieldCheck } from 'lucide-react'

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function OrgCard({ r, onChanged }: { r: any; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const approve = async () => {
    setBusy(true); setError('')
    const { error: err } = await approveOrganisation(r.id)
    setBusy(false)
    if (err) { setError(err.message || "Couldn't approve — try again."); return }
    onChanged()
  }

  return (
    <div className="bg-surface border border-edge rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-ink text-[15px] truncate">{r.name}</p>
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-[#FAEEDA] text-[#854F0B] capitalize">{r.type}</span>
          </div>
          <p className="text-[13px] text-ink-tertiary truncate">
            Safeguarding lead: {r.pending_safeguarding_lead_name || r.creator_full_name || 'unnamed'}
            {(r.pending_safeguarding_lead_email || r.creator_email) && ` · ${r.pending_safeguarding_lead_email || r.creator_email}`}
          </p>
        </div>
        <p className="text-[11px] text-ink-quaternary flex-shrink-0">{timeAgo(r.created_at)}</p>
      </div>

      {error && <p className="text-[12.5px] text-danger-text mt-2">{error}</p>}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-edge-subtle">
        <button onClick={approve} disabled={busy} className="flex items-center gap-1.5 bg-brand text-white text-[12.5px] font-semibold px-3.5 py-2 rounded-lg disabled:opacity-40">
          <Check className="w-3.5 h-3.5" /> {busy ? 'Approving…' : 'Approve'}
        </button>
      </div>
    </div>
  )
}

// Manual approval queue for institutions/providers -- no automated
// check behind it yet (a real DfE URN / UKPRN lookup is a separate,
// larger piece of work), so this is a plain human decision: is this a
// real school or training provider. organisations.verified flips true
// on approve, which is what OrgVerificationGate is actually reading.
export default function OpsOrganisationsPage() {
  const [rows, setRows] = useState<any[] | null>(null)
  const load = () => { getPendingOrganisations().then(({ data }) => setRows(data || [])) }
  useEffect(load, [])

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-[22px] font-bold text-ink mb-1">Institution & provider verification</p>
      <p className="text-[14px] text-ink-tertiary mb-5">New schools and training providers sit here until approved — they can't reach any student data until then.</p>

      {rows === null ? (
        <p className="text-[14px] text-ink-tertiary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl px-5 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-accent-bg flex items-center justify-center mx-auto mb-3"><ShieldCheck className="w-5 h-5 text-brand" /></div>
          <p className="text-[14px] font-semibold text-ink mb-1">Nothing pending</p>
          <p className="text-[13px] text-ink-tertiary">New school or provider sign-ups show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">{rows.map(r => <OrgCard key={r.id} r={r} onChanged={load} />)}</div>
      )}
    </div>
  )
}
