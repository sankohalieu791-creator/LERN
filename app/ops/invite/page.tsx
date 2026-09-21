'use client'

import { useEffect, useState } from 'react'
import { createOpsInvite, getOpsInvites } from '@/lib/supabase'
import { UserPlus, Mail, Clock, Check } from 'lucide-react'

// Build Spec addition: rather than every new ops teammate needing a
// script run by hand, an existing ops admin can invite one directly --
// they type an email, an invite mail goes out (see
// on_ops_invite_created -> /api/ops-invite-notify), and clicking it
// takes the invitee to /auth/ops-invite to set a password. The account
// they end up with is only ever elevated to ops_admin by
// accept_ops_invite() re-validating the token and matching email
// server-side -- never by anything the client claims about itself.
export default function OpsInvitePage() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [invites, setInvites] = useState<any[] | null>(null)

  const load = () => { getOpsInvites().then(({ data }) => setInvites(data || [])) }
  useEffect(load, [])

  const send = async () => {
    setError(''); setSent(false)
    if (!email.trim()) return setError('Enter an email address.')
    setSending(true)
    const { error: err } = await createOpsInvite(email.trim())
    setSending(false)
    if (err) return setError(err.message)
    setSent(true)
    setEmail('')
    load()
  }

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-[22px] font-bold text-ink mb-1">Invite</p>
      <p className="text-[14px] text-ink-tertiary mb-5">Invite someone new onto the ops team by email. They set their own password and get ops access the moment they accept.</p>

      <div className="bg-surface border border-edge rounded-2xl p-5 mb-6">
        <label className="block text-[12.5px] font-semibold text-ink mb-1.5">Email address</label>
        <div className="flex gap-2">
          <input
            value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="name@example.com"
            onKeyDown={e => e.key === 'Enter' && send()}
            className="flex-1 bg-surface-subtle border border-edge rounded-lg px-3.5 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
          />
          <button
            onClick={send} disabled={sending}
            className="flex items-center gap-1.5 bg-brand text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 flex-shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" /> {sending ? 'Sending…' : 'Send invite'}
          </button>
        </div>
        {error && <p className="text-[12.5px] text-danger-text mt-2">{error}</p>}
        {sent && <p className="text-[12.5px] text-success-text mt-2">Invite sent.</p>}
      </div>

      <p className="text-[12.5px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2.5">Sent invites</p>
      {invites === null ? (
        <p className="text-[14px] text-ink-tertiary">Loading…</p>
      ) : invites.length === 0 ? (
        <div className="bg-surface border border-edge rounded-2xl px-5 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-accent-bg flex items-center justify-center mx-auto mb-3"><Mail className="w-5 h-5 text-brand" /></div>
          <p className="text-[14px] font-semibold text-ink mb-1">No invites sent yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invites.map(i => {
            const expired = !i.accepted_at && new Date(i.expires_at) <= new Date()
            return (
              <div key={i.id} className="flex items-center justify-between bg-surface border border-edge rounded-xl px-4 py-3">
                <p className="text-[13.5px] text-ink truncate">{i.email}</p>
                {i.accepted_at ? (
                  <span className="flex items-center gap-1 text-[11.5px] font-semibold text-success-text flex-shrink-0"><Check className="w-3.5 h-3.5" /> Accepted</span>
                ) : expired ? (
                  <span className="text-[11.5px] font-semibold text-ink-quaternary flex-shrink-0">Expired</span>
                ) : (
                  <span className="flex items-center gap-1 text-[11.5px] font-semibold text-ink-tertiary flex-shrink-0"><Clock className="w-3.5 h-3.5" /> Pending</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
