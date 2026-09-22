'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOpsAdmins, revokeOpsAccess } from '@/lib/supabase'
import { ShieldCheck, ShieldOff, UserX } from 'lucide-react'

// "Build a page that lists everyone holding ops access, with revoke."
// Straight from public.users where role = 'ops_admin' -- the same
// table the login gate itself checks, so this can never drift from
// who can actually get in. Revoke demotes to 'student' with no org
// rather than deleting the account outright; deleting a specific
// person's account entirely is a separate, more deliberate action.
export default function OpsAccessPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<any[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const load = () => { getOpsAdmins().then(({ data }) => setRows(data || [])) }
  useEffect(load, [])

  const revoke = async (id: string) => {
    setBusyId(id); setError('')
    const { error: err } = await revokeOpsAccess(id)
    setBusyId(null)
    if (err) { setError(err.message || "Couldn't revoke — try again."); return }
    setConfirmId(null)
    load()
  }

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-[22px] font-bold text-ink mb-1">Ops access</p>
      <p className="text-[14px] text-ink-tertiary mb-5">Everyone who currently holds ops access. Revoking demotes the account — it doesn't delete it.</p>

      {error && <p className="text-[12.5px] text-danger-text mb-3">{error}</p>}

      {rows === null ? (
        <p className="text-[14px] text-ink-tertiary">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl px-5 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-accent-bg flex items-center justify-center mx-auto mb-3"><ShieldCheck className="w-5 h-5 text-brand" /></div>
          <p className="text-[14px] font-semibold text-ink mb-1">Nobody holds ops access</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const isSelf = r.id === user?.id
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 bg-surface border border-edge rounded-xl px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-ink truncate">{r.full_name || 'Unnamed'} {isSelf && <span className="text-ink-quaternary font-normal">(you)</span>}</p>
                  <p className="text-[12.5px] text-ink-tertiary truncate">{r.email}</p>
                </div>
                {confirmId === r.id ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => revoke(r.id)} disabled={busyId === r.id}
                      className="flex items-center gap-1.5 bg-danger-solid text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40"
                    >
                      <UserX className="w-3.5 h-3.5" /> {busyId === r.id ? 'Revoking…' : 'Confirm revoke'}
                    </button>
                    <button onClick={() => setConfirmId(null)} className="text-[12px] font-semibold text-ink-tertiary px-2">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(r.id)} disabled={isSelf}
                    title={isSelf ? "You can't revoke your own ops access" : undefined}
                    className="flex items-center gap-1.5 text-[12.5px] font-semibold text-danger-text hover:underline flex-shrink-0 disabled:opacity-30 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    <ShieldOff className="w-3.5 h-3.5" /> Revoke
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
