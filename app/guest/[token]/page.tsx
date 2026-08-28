'use client'

import { useEffect, useState } from 'react'
import AuthShell from '@/components/v2/AuthShell'
import { TextField, PrimaryButton, ErrorBanner } from '@/components/v2/Field'
import { getGuestInviteInfo, claimGuestInvite } from '@/lib/supabase'
import { ShieldCheck, MailCheck } from 'lucide-react'

// The whole point of a guest pass: no full sign-up, no password, no
// browsing the platform. Confirm a name + email, accept one basic
// line of terms, get a magic link. That link is what actually creates
// the (heavily scoped) account — see handle_new_user() in the
// 2026-08-29 migration.
export default function GuestClaimPage({ params }: { params: { token: string } }) {
  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState<{ inviteId: string; organisationName: string; sharedCount: number } | null>(null)
  const [notFoundMessage, setNotFoundMessage] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    getGuestInviteInfo(params.token).then(({ data, error: err }) => {
      setLoading(false)
      if (err || !data) { setNotFoundMessage(err?.message || 'This invite link is not valid.'); return }
      setInvite(data)
    })
  }, [params.token])

  const handleSubmit = async () => {
    setError('')
    if (!fullName.trim()) return setError('Enter your name.')
    if (!email.trim()) return setError('Enter your email.')
    if (!accepted) return setError('You need to accept to continue.')
    if (!invite) return
    setSubmitting(true)
    const { error: err } = await claimGuestInvite(invite.inviteId, fullName.trim(), email.trim())
    setSubmitting(false)
    if (err) return setError(err.message)
    setSent(true)
  }

  if (loading) {
    return (
      <AuthShell title="One moment…">
        <div className="flex justify-center py-10">
          <span className="w-6 h-6 border-2 border-[#E2DDD1] border-t-brand rounded-full animate-spin" />
        </div>
      </AuthShell>
    )
  }

  if (notFoundMessage) {
    return (
      <AuthShell title="This link isn't valid" subtitle={notFoundMessage}>
        <p className="text-[13px] text-[#8A8373]">Ask the organisation that shared it with you for a new link.</p>
      </AuthShell>
    )
  }

  if (sent) {
    return (
      <AuthShell title="Check your email">
        <div className="flex flex-col items-center text-center py-6">
          <div className="w-12 h-12 rounded-full bg-[#FCEEE4] flex items-center justify-center mb-4">
            <MailCheck className="w-5 h-5 text-brand" />
          </div>
          <p className="text-[14px] text-[#6B6558] max-w-xs leading-relaxed">
            We sent a link to <span className="font-semibold text-ink">{email}</span>. Click it to view what {invite?.organisationName} shared with you.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={`${invite?.organisationName} invited you`}
      subtitle={`They've shared ${invite?.sharedCount === 1 ? 'a piece of verified work' : `${invite?.sharedCount} pieces of verified work`} with you. No account needed — just confirm who you are.`}
    >
      <ErrorBanner message={error} />
      <TextField label="Full name" value={fullName} onChange={setFullName} placeholder="Your name" autoFocus />
      <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" />

      <div className="bg-white border border-[#E2DDD1] rounded-2xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-brand flex-shrink-0" />
          <p className="font-bold text-ink text-[13px]">Before you continue</p>
        </div>
        <ul className="space-y-1.5 text-[12.5px] text-[#4A453B] leading-relaxed">
          <li>• You'll only ever see what {invite?.organisationName} chose to share — nothing else on LERN.</li>
          <li>• You never get direct contact details. Any interest you raise routes through the organisation.</li>
        </ul>
      </div>

      <label className="flex items-start gap-2.5 mb-5 cursor-pointer">
        <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5" />
        <span className="text-[13px] text-[#4A453B]">I accept these terms.</span>
      </label>

      <PrimaryButton onClick={handleSubmit} loading={submitting}>Continue</PrimaryButton>
    </AuthShell>
  )
}
