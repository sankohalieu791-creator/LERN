'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { X, ArrowRight } from 'lucide-react'

const S_KEY = 'lern_tour_s3'   // student tour done
const I_KEY = 'lern_tour_i3'   // instructor tour done

// Bottom nav has 5 items. Centers at 10%, 30%, 50%, 70%, 90% of screen width.
const NAV_CENTERS = ['10%', '30%', '50%', '70%', '90%']

interface Step {
  route: string
  emoji: string
  title: string
  body: string
  cta: string
  navPulse?: number   // index 0-4 — which nav item to pulse
}

// ── Student / User tour ───────────────────────────────────────
const STUDENT_STEPS: Step[] = [
  {
    route: '/feed',
    emoji: '📱',
    title: 'Your Feed',
    body: 'This is your feed. Scroll through videos posted by instructors. Tap a video to watch it full screen. Tap ❤️ to like and 💬 to leave a comment.',
    cta: 'Next',
    navPulse: 0,
  },
  {
    route: '/courses',
    emoji: '📚',
    title: 'Courses & Workshops',
    body: 'Tap the Courses tab to browse everything available. Tap any course to see the full timetable — every session with its date, start time, and how long it runs — before you commit to enrolling.',
    cta: 'Next',
    navPulse: 1,
  },
  {
    route: '/discovery',
    emoji: '🔍',
    title: 'Discover Instructors',
    body: 'Browse mentors, coaches, teachers, and professors on the Discover tab. Tap any card to view their full profile. Follow them to see their posts, or send them a training or mentorship request.',
    cta: 'Next',
    navPulse: 3,
  },
  {
    route: '/profile/me',
    emoji: '👤',
    title: 'Your Profile',
    body: 'This is your public profile. Add your projects, certificates, and a bio. The more complete your profile, the more credible you look to instructors and the community.',
    cta: 'Next',
    navPulse: 4,
  },
  {
    route: '/settings',
    emoji: '🎓',
    title: 'Want to Teach on LERN?',
    body: 'From your profile, go to Settings and scroll down to "Apply to Teach". Fill in your details and submit — once approved you\'ll unlock instructor tools and get your own onboarding walkthrough.',
    cta: 'Done — let\'s go!',
    navPulse: 4,
  },
]

// ── Instructor tour ───────────────────────────────────────────
const INSTRUCTOR_STEPS: Step[] = [
  {
    route: '/courses',
    emoji: '🚀',
    title: 'You\'re an Instructor',
    body: 'Welcome to the instructor side of LERN. Your first move: tap the + button in the centre of the bottom nav to create a course or workshop.',
    cta: 'Next',
    navPulse: 2,
  },
  {
    route: '/courses',
    emoji: '📅',
    title: 'Create a Course',
    body: 'Set a title, subject, level, start date and end date. Sessions are generated automatically — one per day. You pick the daily session time and duration so students know exactly what they\'re committing to.',
    cta: 'Next',
    navPulse: 2,
  },
  {
    route: '/courses',
    emoji: '🗓️',
    title: 'Or Run a Workshop',
    body: 'Workshops are one-off live events. Choose Online to get a virtual classroom, or In-Person to display your venue. Followers get a push notification when you create one.',
    cta: 'Next',
    navPulse: 2,
  },
  {
    route: '/courses',
    emoji: '🔴',
    title: 'Go Live',
    body: 'When it\'s session time, open your course from the Courses tab and tap Start Session. Every enrolled student gets a push notification and their card turns to "Join Live" instantly.',
    cta: 'Next',
    navPulse: 1,
  },
  {
    route: '/feed',
    emoji: '🎬',
    title: 'Post to Your Feed',
    body: 'Tap + → Post Video to share content with the community. Your followers see every video in their feed. Post before your course launches to build an audience and get enrollments.',
    cta: 'Next',
    navPulse: 2,
  },
  {
    route: '/discovery',
    emoji: '🌍',
    title: 'You\'re on Discovery',
    body: 'Students browse the Discover tab to find instructors. Make sure your profile has a clear bio, your role, and your experience so students find and choose you over others.',
    cta: 'Next',
    navPulse: 3,
  },
  {
    route: '/profile/me',
    emoji: '📥',
    title: 'Manage Requests',
    body: 'Students can send you training and mentorship requests. Go to your Profile → Requests tab to accept or decline. Your courses and workshops are all listed on your profile too.',
    cta: 'Let\'s go! 🎉',
    navPulse: 4,
  },
]

export default function OnboardingTour() {
  const { user } = useAuth() as any
  const router = useRouter()

  const [steps, setSteps] = useState<Step[]>([])
  const [index, setIndex]   = useState(0)
  const [visible, setVisible] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!user) return

    const isInstructor = user.account_type === 'instructor'

    if (isInstructor && !localStorage.getItem(I_KEY)) {
      setSteps(INSTRUCTOR_STEPS)
      setIndex(0)
      setActive(true)
      setTimeout(() => setVisible(true), 600)
      return
    }
    if (!isInstructor && !localStorage.getItem(S_KEY)) {
      setSteps(STUDENT_STEPS)
      setIndex(0)
      setActive(true)
      setTimeout(() => setVisible(true), 600)
    }
  }, [user?.id, user?.account_type])

  if (!active || steps.length === 0) return null

  const step = steps[index]
  const total = steps.length
  const isLast = index === total - 1
  const isInstructor = user?.account_type === 'instructor'

  const dismiss = () => {
    setVisible(false)
    setTimeout(() => {
      localStorage.setItem(isInstructor ? I_KEY : S_KEY, '1')
      setActive(false)
    }, 300)
  }

  const next = () => {
    if (isLast) { dismiss(); return }
    const nextStep = steps[index + 1]
    setVisible(false)
    setTimeout(() => {
      setIndex(i => i + 1)
      if (nextStep.route !== step.route) router.push(nextStep.route)
      setTimeout(() => setVisible(true), 120)
    }, 200)
  }

  const navX = step.navPulse !== undefined ? NAV_CENTERS[step.navPulse] : null

  return (
    <>
      {/* Nav pulse ring */}
      {navX && visible && (
        <div
          className="fixed z-[190] pointer-events-none"
          style={{
            left: navX,
            transform: 'translateX(-50%)',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
          }}
        >
          <span className="relative flex h-8 w-8">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] opacity-60" />
            <span className="relative inline-flex rounded-full h-8 w-8 bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] opacity-40" />
          </span>
        </div>
      )}

      {/* Tour card */}
      <div
        className="fixed left-3 right-3 z-[199]"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 78px)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)',
          pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        <div className="rounded-3xl overflow-hidden shadow-[0_12px_60px_rgba(0,0,0,0.75)] border border-[rgba(255,255,255,0.09)] bg-[#141414]">

          {/* Gradient accent bar */}
          <div className="h-[3px] bg-gradient-to-r from-[#FF6B2B] to-[#C026D3]" />

          <div className="px-5 pt-4 pb-5">

            {/* Header row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl leading-none">{step.emoji}</span>
                <div>
                  <p className="text-white font-bold text-base leading-tight">{step.title}</p>
                  <p className="text-[#555] text-[11px] mt-0.5 font-medium">{index + 1} of {total}</p>
                </div>
              </div>
              <button
                onClick={dismiss}
                className="w-7 h-7 rounded-full bg-[#252525] border border-[rgba(255,255,255,0.07)] flex items-center justify-center flex-shrink-0 mt-0.5"
              >
                <X className="w-3.5 h-3.5 text-[#666]" />
              </button>
            </div>

            {/* Body */}
            <p className="text-[#999] text-[13px] leading-[1.6] mb-4">{step.body}</p>

            {/* Progress dots */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all duration-200"
                    style={{
                      width:  i === index ? 20 : 6,
                      height: 6,
                      background: i === index
                        ? 'linear-gradient(90deg, #FF6B2B, #C026D3)'
                        : i < index
                          ? 'rgba(255,255,255,0.25)'
                          : 'rgba(255,255,255,0.08)',
                    }}
                  />
                ))}
              </div>

              <button
                onClick={next}
                className="flex items-center gap-1.5 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold text-sm px-5 py-2.5 rounded-2xl active:scale-95 transition"
              >
                {step.cta}
                {!isLast && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
