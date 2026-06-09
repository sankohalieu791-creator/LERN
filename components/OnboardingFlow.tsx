'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { X } from 'lucide-react'

interface HintConfig {
  icon: string
  title: string
  desc: string
  cta: string
}

const PAGE_HINTS: Record<string, HintConfig> = {
  '/feed': {
    icon: '▶️',
    title: 'Discover Educational Videos',
    desc: 'Swipe through expert-led videos from top instructors. Like, save, and follow the creators you love.',
    cta: 'Got it',
  },
  '/courses': {
    icon: '📚',
    title: 'Find Your Perfect Course',
    desc: 'Discover courses that suit you — enroll to unlock your personal timetable and join live virtual sessions.',
    cta: "Let's explore",
  },
  '/discovery': {
    icon: '🤝',
    title: 'Find Your Mentor',
    desc: 'Browse verified instructors and coaches. Request 1-to-1 personalised training and message them directly.',
    cta: 'Got it',
  },
  '/profile/me': {
    icon: '✨',
    title: 'Your Learning Profile',
    desc: 'Your posts, courses, and achievements — all in one place. Build your reputation as a learner or instructor.',
    cta: 'Nice',
  },
  '/settings': {
    icon: '🎤',
    title: 'Are You an Expert?',
    desc: 'Share your knowledge with thousands of learners. Tap "Apply to Teach" below to become a verified LERN instructor.',
    cta: 'Got it',
  },
}

const STORAGE_PREFIX = 'lern_hint_v2_'

function hintKey(path: string) {
  return STORAGE_PREFIX + path.replace(/\//g, '_').replace(/^_/, '')
}

export default function OnboardingFlow() {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const [hint, setHint]       = useState<HintConfig | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (loading || !user) { setHint(null); return }
    if (!pathname || pathname === '/' || pathname.startsWith('/auth')) { setHint(null); return }

    const config = PAGE_HINTS[pathname]
    if (!config) { setHint(null); return }

    const seen = localStorage.getItem(hintKey(pathname))
    if (seen) { setHint(null); return }

    setHint(config)
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 700)
    return () => clearTimeout(t)
  }, [user, loading, pathname])

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(hintKey(pathname), '1')
    setTimeout(() => setHint(null), 350)
  }

  if (!hint) return null

  return (
    <div
      className="fixed left-4 right-4 z-[9998]"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(18px)',
        transition: 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="rounded-3xl overflow-hidden shadow-[0_8px_48px_rgba(0,0,0,0.7)]"
        style={{ border: '1px solid rgba(255,255,255,0.11)', background: '#1a1a1a' }}
      >
        {/* Gradient accent line */}
        <div className="h-[3px] bg-gradient-to-r from-[#FF6B2B] to-[#C026D3]" />

        <div className="p-4 relative">
          {/* Dismiss X */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#252525] flex items-center justify-center"
          >
            <X className="w-3 h-3 text-[#666]" />
          </button>

          {/* Icon + text */}
          <div className="flex items-start gap-3 mb-3.5 pr-8">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(255,107,43,0.18) 0%, rgba(192,38,211,0.18) 100%)' }}
            >
              {hint.icon}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-white font-bold text-sm leading-snug mb-1">{hint.title}</p>
              <p className="text-[#777] text-[12px] leading-relaxed">{hint.desc}</p>
            </div>
          </div>

          {/* CTA button */}
          <button
            onClick={dismiss}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold text-sm py-3 rounded-2xl"
          >
            {hint.cta} →
          </button>
        </div>
      </div>
    </div>
  )
}
