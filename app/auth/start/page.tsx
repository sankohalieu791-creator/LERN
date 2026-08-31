'use client'

import { useRouter } from 'next/navigation'
import AuthShell from '@/components/v2/AuthShell'
import { GraduationCap, School, Building2, Briefcase } from 'lucide-react'

// Real role chooser -- restored to what it was before the "Being built"
// placeholder covered it. Account creation is still gated by the
// founder allowlist in handle_new_user() during the testing phase, but
// that's a backend rule, not a reason to hide the navigation itself.
const CHOICES = [
  {
    key: 'student',
    icon: GraduationCap,
    label: "I'm a young person",
    hint: 'Join with a code from your school, college or training provider.',
    href: '/auth/signup/student',
  },
  {
    key: 'institution',
    icon: School,
    label: "I'm a school or college",
    hint: 'Set up your organisation and invite your students.',
    href: '/auth/signup/organisation?type=institution',
  },
  {
    key: 'provider',
    icon: Building2,
    label: "I'm a training provider",
    hint: 'Set up your organisation and invite your learners.',
    href: '/auth/signup/organisation?type=provider',
  },
  {
    key: 'employer',
    icon: Briefcase,
    label: "I'm an employer",
    hint: 'Discover verified young talent and post opportunities.',
    href: '/auth/signup/employer',
  },
] as const

export default function ChooseRolePage() {
  const router = useRouter()

  return (
    <AuthShell title="Who's signing up?" subtitle="Pick the option that describes you — each one leads somewhere different.">
      <div className="space-y-3">
        {CHOICES.map(c => (
          <button
            key={c.key}
            onClick={() => router.push(c.href)}
            className="w-full flex items-center gap-4 bg-white border border-[#E2DDD1] rounded-2xl px-5 py-4 text-left hover:border-brand hover:shadow-[0_2px_12px_rgba(242,107,33,0.08)] transition group"
          >
            <div className="w-11 h-11 rounded-xl bg-[#FCEEE4] flex items-center justify-center flex-shrink-0 group-hover:bg-brand transition-colors">
              <c.icon className="w-5 h-5 text-brand group-hover:text-white transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-ink text-[15px]">{c.label}</p>
              <p className="text-[13px] text-[#8A8373] mt-0.5">{c.hint}</p>
            </div>
          </button>
        ))}
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
