'use client'

import { useState } from 'react'
import { ShieldCheck, Flag } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { acceptTerms } from '@/lib/supabase'

// PLACEHOLDER COPY — drafted to be functional end-to-end, but this covers
// safeguarding of minors and must be reviewed by someone qualified (legal /
// safeguarding officer) before being relied on for real compliance.
const SECTIONS = [
  {
    title: 'Who this app is for',
    body: 'LERN connects students, instructors, and employers for live classes, courses, and career opportunities. Some members are under 18 — every account on this platform is expected to behave accordingly.',
  },
  {
    title: 'Keep contact on-platform',
    body: "Don't share personal contact details (phone number, home address, personal social media) with someone you've only met through LERN, and don't move a conversation with a minor off-platform. Instructors and employers must only contact students through the channels LERN provides.",
  },
  {
    title: 'Verified organisations protect students',
    body: 'When a student belongs to a school, bootcamp, or training organisation, employer interest is routed to that organisation\'s admin first — never sent to the student directly — so a trusted adult is always in the loop before any contact happens.',
  },
  {
    title: 'Report a concern immediately',
    body: 'If anyone behaves inappropriately, asks to move off-platform, or makes you uncomfortable, report it right away from their profile or message a moderator. Reports are reviewed urgently and can result in an account being suspended while we investigate.',
  },
]

export default function SafetyGate() {
  const { user, refreshUser } = useAuth() as any
  const [busy, setBusy] = useState(false)

  if (!user || user.terms_accepted_at) return null

  const handleAccept = async () => {
    setBusy(true)
    await acceptTerms(user.id)
    await refreshUser()
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex flex-col z-[10000]">
      <div className="flex-1 overflow-y-auto px-6 pt-10 pb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center mb-5">
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-white text-2xl font-black mb-2">Safety first</h1>
        <p className="text-[#888] text-sm mb-8 leading-relaxed">
          Before you continue, please read how we keep everyone on LERN safe — especially members under 18.
        </p>

        <div className="space-y-6">
          {SECTIONS.map(s => (
            <div key={s.title}>
              <h2 className="text-white text-[15px] font-bold mb-1.5">{s.title}</h2>
              <p className="text-[#888] text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-start gap-2.5 bg-[#1a1a1a] rounded-2xl p-4">
          <Flag className="w-4 h-4 text-[#FF6B2B] flex-shrink-0 mt-0.5" />
          <p className="text-[#888] text-xs leading-relaxed">
            You can report any user or message at any time from their profile. Safeguarding reports are always reviewed as a priority.
          </p>
        </div>
      </div>

      <div className="flex-shrink-0 px-6 pb-8 pt-4 border-t border-[rgba(255,255,255,0.07)]">
        <button
          onClick={handleAccept}
          disabled={busy}
          className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl disabled:opacity-40 active:scale-[0.98] transition"
        >
          {busy ? 'Please wait…' : 'I understand and agree'}
        </button>
      </div>
    </div>
  )
}
