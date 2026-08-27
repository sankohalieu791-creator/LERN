'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import { Hammer } from 'lucide-react'

// LERN is closed to everyone but the founder allowlist while it's being
// tested (real enforcement is server-side, in handle_new_user() — this
// is just the public-facing presentation of that: no role picker, no
// implied "sign up here" invitation to a stranger). Existing accounts
// still reach login via the small link at the bottom.
export default function ChooseRolePage() {
  const router = useRouter()
  const [revealed, setRevealed] = useState(false)

  return (
    <AuthShell title="Being built" subtitle="LERN isn't open yet — check back soon.">
      <div className="flex flex-col items-center text-center py-10">
        <div className="w-14 h-14 rounded-2xl bg-[#FCEEE4] flex items-center justify-center mb-5">
          <Hammer className="w-6 h-6 text-brand" />
        </div>
        <p className="text-[14px] text-[#6B6558] max-w-xs leading-relaxed">
          We're still putting LERN together. There's nothing to sign up for yet — come back once it's live.
        </p>
      </div>

      {revealed ? (
        <div className="space-y-3">
          <button
            onClick={() => router.push('/auth/signup/student')}
            className="w-full flex items-center justify-center bg-white border border-[#E2DDD1] rounded-2xl px-5 py-3.5 text-[14px] font-semibold text-ink hover:border-brand transition"
          >
            Young person sign up
          </button>
          <button
            onClick={() => router.push('/auth/signup/organisation?type=institution')}
            className="w-full flex items-center justify-center bg-white border border-[#E2DDD1] rounded-2xl px-5 py-3.5 text-[14px] font-semibold text-ink hover:border-brand transition"
          >
            School / college sign up
          </button>
          <button
            onClick={() => router.push('/auth/signup/organisation?type=provider')}
            className="w-full flex items-center justify-center bg-white border border-[#E2DDD1] rounded-2xl px-5 py-3.5 text-[14px] font-semibold text-ink hover:border-brand transition"
          >
            Training provider sign up
          </button>
        </div>
      ) : (
        <button onClick={() => setRevealed(true)} className="block mx-auto text-[12px] text-[#C9C2B2] hover:text-[#8A8373] transition">
          Founder access
        </button>
      )}

      <p className="text-center text-[13px] text-[#8A8373] mt-8">
        Already have an account?{' '}
        <button onClick={() => router.push('/auth/login')} className="text-brand font-semibold hover:underline">
          Log in
        </button>
      </p>
    </AuthShell>
  )
}
