'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { signOut, submitMoreEmployerInfo } from '@/lib/supabase'
import Logo from '@/components/v2/Logo'
import { ShieldCheck, Clock, LogOut, XCircle, MessageCircle } from 'lucide-react'

// The employer vetting gate (Build Spec: Employer Vetting Gate v1.0):
// an independent employer sees exactly this instead of full access
// until employer_verified is set true by an admin. Never shown to a
// guest/invited employer -- EmployerLayoutClient routes those to
// GuestEmployerShell before this component is ever reached. Three
// states: plain Pending ("Your account is under review. We will
// notify you once it is approved." -- spec's exact wording), Rejected
// (account closed, neutral message), and More info requested (the
// gate's other outcome alongside Reject -- stays open, asks for
// whatever is missing).
export default function PendingEmployerVerification() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const status = user?.employer_verification_status || 'pending'
  const rejected = status === 'rejected'
  const needsInfo = status === 'more_info_requested'

  const handleSignOut = async () => {
    await signOut()
    router.replace('/auth/login')
  }

  const handleReply = async () => {
    if (!reply.trim()) return
    setSending(true)
    const { error } = await submitMoreEmployerInfo(reply.trim())
    setSending(false)
    if (!error) { setSent(true); await refreshUser() }
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mb-6 text-ink"><Logo size="lg" /></div>

      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: rejected ? '#FDEEEA' : '#FCEEE4' }}>
        {rejected ? <XCircle className="w-6 h-6" style={{ color: '#B3401E' }} />
          : needsInfo ? <MessageCircle className="w-6 h-6" style={{ color: '#D4551A' }} />
          : <Clock className="w-6 h-6" style={{ color: '#D4551A' }} />}
      </div>

      <h1 className="text-2xl font-bold text-ink mb-2">
        {rejected ? "We couldn't verify your account" : needsInfo ? 'We need a bit more from you' : 'Your account is under review'}
      </h1>
      <p className="text-[14px] text-[#6B6558] max-w-sm leading-relaxed mb-6">
        {rejected
          ? "We weren't able to confirm your business with the details you gave us."
          : needsInfo
          ? 'See the note below for what we still need — reply and we\'ll take another look.'
          : 'We will notify you once it is approved.'}
      </p>

      {rejected && user?.employer_rejected_reason && (
        <div className="w-full max-w-sm bg-white border border-[#F3C9BC] rounded-2xl p-4 mb-6 text-left">
          <p className="text-[12px] font-semibold text-[#B3401E] uppercase tracking-wide mb-1">Note from LERN</p>
          <p className="text-[13px] text-[#4A453B] leading-relaxed">{user.employer_rejected_reason}</p>
        </div>
      )}

      {needsInfo && (
        <div className="w-full max-w-sm text-left mb-6">
          {user?.employer_more_info_message && (
            <div className="bg-white border border-[#E2DDD1] rounded-2xl p-4 mb-3">
              <p className="text-[12px] font-semibold text-[#854F0B] uppercase tracking-wide mb-1">Note from LERN</p>
              <p className="text-[13px] text-[#4A453B] leading-relaxed">{user.employer_more_info_message}</p>
            </div>
          )}
          {sent ? (
            <p className="text-[13px] text-success-text font-semibold text-center">Sent — we'll take another look.</p>
          ) : (
            <>
              <textarea
                value={reply} onChange={e => setReply(e.target.value)} rows={3}
                placeholder="Add whatever's missing…"
                className="w-full bg-white border border-[#E2DDD1] rounded-xl px-3.5 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none mb-2"
              />
              <button onClick={handleReply} disabled={!reply.trim() || sending} className="w-full bg-brand text-white text-[13px] font-semibold py-2.5 rounded-xl disabled:opacity-40">
                {sending ? 'Sending…' : 'Send'}
              </button>
            </>
          )}
        </div>
      )}

      {!needsInfo && (user?.employer_company_number || user?.employer_website) && (
        <div className="w-full max-w-sm bg-white border border-[#E2DDD1] rounded-2xl p-4 mb-6 text-left">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-brand flex-shrink-0" />
            <p className="font-bold text-ink text-[13px]">What you told us</p>
          </div>
          {user.employer_website && <p className="text-[13px] text-[#4A453B]">Website: {user.employer_website}</p>}
          {user.employer_company_number && <p className="text-[13px] text-[#4A453B] mt-1">Companies House: {user.employer_company_number}</p>}
        </div>
      )}

      <button onClick={handleSignOut} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary hover:text-brand transition">
        <LogOut className="w-3.5 h-3.5" /> Sign out
      </button>
    </div>
  )
}
