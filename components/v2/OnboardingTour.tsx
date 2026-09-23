'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/AuthContext'
import { useResolvedTheme } from '@/context/ThemeProvider'
import { markOnboardingSeen } from '@/lib/supabase'
import { ONBOARDING_STEPS, ONBOARDING_INTRO } from '@/lib/onboardingContent'
import { PrimaryButton } from '@/components/v2/Field'
import Logo from '@/components/v2/Logo'
import { ChevronLeft, X } from 'lucide-react'

export type OnboardingRole = 'institution' | 'provider' | 'employer'

// Onboarding tour, 24 Sep 2026 -- "welcome, take a tour or skip" the
// first time an org account lands on its real dashboard, tailored per
// role from the same nav items already on screen rather than a generic
// tour. Sits on top of the real dashboard (never blocks it from
// rendering underneath) so skipping is instant, no network round trip
// gating what's already loaded. Settings' own "Replay tutorial" reopens
// this any time via the DOM event below, independent of whether it's
// already been seen.
export default function OnboardingTour({ role }: { role: OnboardingRole }) {
  const { user, refreshUser } = useAuth()
  const theme = useResolvedTheme()
  const [phase, setPhase] = useState<'checking' | 'hidden' | 'intro' | 'tour'>('checking')
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!user) return
    setPhase(user.onboarding_completed_at ? 'hidden' : 'intro')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    const replay = () => { setStep(0); setPhase('intro') }
    window.addEventListener('lern:replay-onboarding', replay)
    return () => window.removeEventListener('lern:replay-onboarding', replay)
  }, [])

  const close = async (markSeen: boolean) => {
    setPhase('hidden')
    if (markSeen && user && !user.onboarding_completed_at) {
      await markOnboardingSeen(user.id)
      await refreshUser()
    }
  }

  if (phase === 'checking' || phase === 'hidden') return null

  const steps = ONBOARDING_STEPS[role]
  const intro = ONBOARDING_INTRO[role]
  const current = steps[step]
  const isLast = step === steps.length - 1

  return createPortal((
    <div data-theme={theme} className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <button
          onClick={() => close(true)} aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-tertiary transition z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {phase === 'intro' ? (
          <div className="p-8 pt-10 text-center">
            <div className="text-ink mb-6 flex justify-center"><Logo size="lg" /></div>
            <h1 className="text-[20px] font-bold text-ink mb-2">{intro.heading}</h1>
            <p className="text-[14px] text-ink-tertiary leading-relaxed mb-7">{intro.body}</p>
            <div className="space-y-2.5">
              <PrimaryButton onClick={() => { setStep(0); setPhase('tour') }}>Take the tour</PrimaryButton>
              <button
                onClick={() => close(true)}
                className="w-full text-[13.5px] font-semibold text-ink-secondary hover:text-ink transition py-2"
              >
                Skip for now
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 pt-10">
            <div className="flex items-center justify-center gap-1.5 mb-7">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: i === step ? 20 : 6, backgroundColor: i === step ? '#D4551A' : 'var(--border)' }}
                />
              ))}
            </div>

            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: '#FCEEE4' }}>
                <current.icon className="w-6 h-6" style={{ color: '#D4551A' }} />
              </div>
              <h2 className="text-[18px] font-bold text-ink mb-2">{current.heading}</h2>
              <p className="text-[14px] text-ink-tertiary leading-relaxed">{current.body}</p>
            </div>

            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="flex items-center justify-center gap-1 px-4 py-3.5 rounded-xl border border-edge text-ink-secondary font-semibold text-[14px] hover:border-edge-input transition flex-shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <div className="flex-1">
                <PrimaryButton onClick={() => isLast ? close(true) : setStep(s => s + 1)}>
                  {isLast ? 'Get started' : 'Next'}
                </PrimaryButton>
              </div>
            </div>
            {!isLast && (
              <button
                onClick={() => close(true)}
                className="w-full text-center text-[13px] font-semibold text-ink-tertiary hover:text-ink transition mt-3"
              >
                Skip tour
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  ), document.body)
}

// Settings' "Replay tutorial" row dispatches this -- no prop drilling
// or context needed to reach OnboardingTour, which is mounted several
// layout levels away in the org shell tree.
export function replayOnboarding() {
  window.dispatchEvent(new Event('lern:replay-onboarding'))
}
