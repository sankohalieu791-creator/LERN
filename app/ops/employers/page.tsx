'use client'

import { useEffect, useState } from 'react'
import {
  getPendingEmployerVerifications, approveEmployerVerification, rejectEmployerVerification,
  requestMoreEmployerInfo, setEmployerManualCheck, setEmployerCheck5Notes,
} from '@/lib/supabase'
import { Check, X, HelpCircle, Building2, Mail, Globe, UserCheck, MessageCircle } from 'lucide-react'

// Build Spec: Internal Ops Tool v1.0, Part 1. One card per pending or
// flagged employer application, the five checks each shown as pass/
// fail/unconfirmed, a single green-or-red decision-rule summary, and
// exactly three actions (Approve, Reject, Request more info) --
// mirrors the same zero-tolerance rule approve_employer_verification()
// enforces server-side (see that function for why Approve being
// disabled here is belt-and-braces, not the only guard).
function CheckIcon({ state }: { state: 'pass' | 'fail' | 'unconfirmed' }) {
  if (state === 'pass') return <Check className="w-4 h-4 text-success-text flex-shrink-0" />
  if (state === 'fail') return <X className="w-4 h-4 text-danger-text flex-shrink-0" />
  return <HelpCircle className="w-4 h-4 text-warning-text flex-shrink-0" />
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function EmployerCard({ r, onChanged }: { r: any; onChanged: () => void }) {
  const [rejecting, setRejecting] = useState(false)
  const [askingInfo, setAskingInfo] = useState(false)
  const [reason, setReason] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [notes, setNotes] = useState(r.employer_check5_notes || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const check1: 'pass' | 'fail' | 'unconfirmed' = r.employer_check_ch === 'pass' ? 'pass' : r.employer_check_ch === 'fail' ? 'fail' : 'unconfirmed'
  const check2: 'pass' | 'fail' | 'unconfirmed' = r.employer_check_email_domain === 'pass' ? 'pass' : r.employer_check_email_domain === 'fail' ? 'fail' : 'unconfirmed'
  const check3: 'pass' | 'fail' | 'unconfirmed' = r.employer_check_website_confirmed ? 'pass' : 'unconfirmed'
  const check4: 'pass' | 'fail' | 'unconfirmed' = r.employer_check_officer_confirmed ? 'pass' : 'unconfirmed'
  const anyFailed = check1 === 'fail' || check2 === 'fail'
  const allPass = check1 === 'pass' && check2 === 'pass' && check3 === 'pass' && check4 === 'pass'
  const failedNames = [
    check1 !== 'pass' && '1. Companies House',
    check2 !== 'pass' && '2. Email domain',
    check3 !== 'pass' && '3. Website',
    check4 !== 'pass' && '4. Officer match',
  ].filter(Boolean) as string[]

  const toggleCheck = async (check: 'website' | 'officer', value: boolean) => { await setEmployerManualCheck(r.id, check, value); onChanged() }
  const saveNotes = async () => { await setEmployerCheck5Notes(r.id, notes); onChanged() }

  const approve = async () => {
    setBusy(true); setError('')
    const { error: err } = await approveEmployerVerification(r.id)
    setBusy(false)
    if (err) { setError(err.message || "Couldn't approve — try again."); return }
    onChanged()
  }
  const reject = async () => {
    if (!reason.trim()) { setError("Give a reason — it's shown to the employer."); return }
    setBusy(true); setError('')
    const { error: err } = await rejectEmployerVerification(r.id, reason.trim())
    setBusy(false)
    if (err) { setError("Couldn't reject — try again."); return }
    setRejecting(false); setReason(''); onChanged()
  }
  const requestInfo = async () => {
    if (!infoMessage.trim()) { setError('Say what you still need.'); return }
    setBusy(true); setError('')
    const { error: err } = await requestMoreEmployerInfo(r.id, infoMessage.trim())
    setBusy(false)
    if (err) { setError("Couldn't send — try again."); return }
    setAskingInfo(false); setInfoMessage(''); onChanged()
  }

  return (
    <div className="bg-surface border border-edge rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-ink text-[15px] truncate">{r.employer_company_name || r.full_name}</p>
            <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${anyFailed ? 'bg-[#FDEEEA] text-[#B3401E]' : 'bg-[#FAEEDA] text-[#854F0B]'}`}>
              {anyFailed ? 'Flagged' : 'Pending'}
            </span>
          </div>
          <p className="text-[13px] text-ink-tertiary truncate">{r.email} · signed up by {r.full_name}</p>
        </div>
        <p className="text-[11px] text-ink-quaternary flex-shrink-0">
          {r.employer_verification_requested_at ? `Applied ${timeAgo(r.employer_verification_requested_at)}` : `Signed up ${timeAgo(r.created_at)}`}
        </p>
      </div>

      {r.employer_more_info_response && (
        <p className="text-[13px] text-ink-secondary bg-surface-subtle rounded-lg px-3 py-2 mt-2">Employer replied: {r.employer_more_info_response}</p>
      )}

      <div className="mt-3 pt-3 border-t border-edge-subtle space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[13px] text-ink-secondary min-w-0"><Building2 className="w-3.5 h-3.5 flex-shrink-0 text-ink-tertiary" /><span className="truncate">1. Companies House {r.employer_company_number ? `(${r.employer_company_number})` : ''}</span></span>
          <CheckIcon state={check1} />
        </div>
        {r.employer_check_ch_detail && <p className="text-[11.5px] text-ink-tertiary pl-5">{r.employer_check_ch_detail}</p>}
        {r.employer_ch_officers?.length > 0 && <p className="text-[11.5px] text-ink-tertiary pl-5">Officers on file: {r.employer_ch_officers.join(', ')}</p>}

        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[13px] text-ink-secondary min-w-0"><Mail className="w-3.5 h-3.5 flex-shrink-0 text-ink-tertiary" /><span className="truncate">2. Email domain matches {r.employer_website || 'website'}</span></span>
          <CheckIcon state={check2} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[13px] text-ink-secondary min-w-0">
            <Globe className="w-3.5 h-3.5 flex-shrink-0 text-ink-tertiary" />
            {r.employer_website ? <a href={r.employer_website.startsWith('http') ? r.employer_website : `https://${r.employer_website}`} target="_blank" rel="noreferrer" className="truncate hover:underline">3. {r.employer_website}</a> : <span className="truncate text-ink-quaternary italic">3. No website given</span>}
          </span>
          <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-secondary cursor-pointer flex-shrink-0">
            <input type="checkbox" checked={!!r.employer_check_website_confirmed} onChange={e => toggleCheck('website', e.target.checked)} /> <CheckIcon state={check3} />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[13px] text-ink-secondary min-w-0"><UserCheck className="w-3.5 h-3.5 flex-shrink-0 text-ink-tertiary" /><span className="truncate">4. Signer is a named officer</span></span>
          <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-secondary cursor-pointer flex-shrink-0">
            <input type="checkbox" checked={!!r.employer_check_officer_confirmed} onChange={e => toggleCheck('officer', e.target.checked)} /> <CheckIcon state={check4} />
          </label>
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-[13px] text-ink-secondary mb-1"><HelpCircle className="w-3.5 h-3.5 text-ink-tertiary" /> 5. Judgement call</p>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} rows={2}
            placeholder="Anything the first four checks didn't resolve cleanly…"
            className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2 text-[12.5px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none"
          />
        </div>
      </div>

      <div className={`mt-3 rounded-lg px-3 py-2 text-[12.5px] font-semibold ${allPass ? 'bg-[#E1F5EE] text-[#0F6E56]' : 'bg-[#FDEEEA] text-[#B3401E]'}`}>
        {allPass ? 'All checks passed. Safe to approve.' : `Not safe to approve — ${failedNames.join(', ')} not confirmed. Reject or request more info.`}
      </div>

      {error && <p className="text-[12.5px] text-danger-text mt-2">{error}</p>}

      {rejecting ? (
        <div className="mt-3 pt-3 border-t border-edge-subtle">
          <textarea value={reason} onChange={e => setReason(e.target.value)} autoFocus rows={2} placeholder="Why isn't this approved? Shown to the employer." className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none" />
          <div className="flex items-center gap-2 mt-2">
            <button onClick={reject} disabled={busy} className="text-[12px] font-semibold bg-danger-solid text-white px-3 py-1.5 rounded-lg disabled:opacity-40">{busy ? 'Rejecting…' : 'Confirm reject'}</button>
            <button onClick={() => { setRejecting(false); setReason('') }} className="text-[12px] font-semibold text-ink-tertiary px-2">Cancel</button>
          </div>
        </div>
      ) : askingInfo ? (
        <div className="mt-3 pt-3 border-t border-edge-subtle">
          <textarea value={infoMessage} onChange={e => setInfoMessage(e.target.value)} autoFocus rows={2} placeholder="What's missing? e.g. proof of their role at the company." className="w-full bg-surface-subtle border border-edge rounded-lg px-3 py-2 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none" />
          <div className="flex items-center gap-2 mt-2">
            <button onClick={requestInfo} disabled={busy} className="text-[12px] font-semibold bg-brand text-white px-3 py-1.5 rounded-lg disabled:opacity-40">{busy ? 'Sending…' : 'Send request'}</button>
            <button onClick={() => { setAskingInfo(false); setInfoMessage('') }} className="text-[12px] font-semibold text-ink-tertiary px-2">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-edge-subtle">
          <button onClick={approve} disabled={busy || !allPass} title={!allPass ? 'All five checks must pass first' : undefined} className="flex items-center gap-1.5 bg-brand text-white text-[12.5px] font-semibold px-3.5 py-2 rounded-lg disabled:opacity-40">
            <Check className="w-3.5 h-3.5" /> {busy ? 'Approving…' : 'Approve'}
          </button>
          <button onClick={() => setAskingInfo(true)} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-secondary hover:text-brand transition"><MessageCircle className="w-3.5 h-3.5" /> Request more info</button>
          <button onClick={() => setRejecting(true)} className="text-[12.5px] font-semibold text-danger-text hover:underline">Reject</button>
        </div>
      )}
    </div>
  )
}

export default function OpsEmployersPage() {
  const [rows, setRows] = useState<any[] | null>(null)
  const load = () => { getPendingEmployerVerifications().then(({ data }) => setRows(data || [])) }
  useEffect(load, [])

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-[22px] font-bold text-ink mb-1">Employer verification</p>
      <p className="text-[14px] text-ink-tertiary mb-5">Zero tolerance — every application sits here until all five checks pass. No partial-pass approval, ever.</p>

      {rows === null ? (
        <p className="text-[14px] text-ink-tertiary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl px-5 py-10 text-center">
          <p className="text-[14px] font-semibold text-ink mb-1">Nothing pending</p>
          <p className="text-[13px] text-ink-tertiary">New independent employer sign-ups show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">{rows.map(r => <EmployerCard key={r.id} r={r} onChanged={load} />)}</div>
      )}
    </div>
  )
}
