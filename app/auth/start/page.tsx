'use client'

import { useRouter } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import { Hammer } from 'lucide-react'

// Public signup is still closed while LERN is founder-tested (the real
// gate is the allowlist in handle_new_user()) — this stays a simple
// placeholder rather than a form nobody outside the allowlist can submit.
// Reviewers/testers use the single demo credential on the login page
// instead (Lern12@gmail.com), not a route from here.
export default function ChooseRolePage() {
  const router = useRouter()

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

      <p className="text-center text-[13px] text-[#8A8373] mt-8">
        Already have an account?{' '}
        <button onClick={() => router.push('/auth/login')} className="text-brand font-semibold hover:underline">
          Log in
        </button>
      </p>
    </AuthShell>
  )
}
