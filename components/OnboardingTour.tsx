'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { X, ArrowRight, ArrowLeft, Sparkles, Rocket } from 'lucide-react'

const DONE_KEY_STUDENT    = 'lern_tour_v4_student'
const DONE_KEY_INSTRUCTOR = 'lern_tour_v4_instructor'

interface Step {
  target: string | null   // data-tour selector on the real element, or null for a centered card
  shape: 'circle' | 'rect'
  route: string
  emoji: string
  title: string
  body: string
}

// ── Student / User tour ───────────────────────────────────────
const STUDENT_STEPS: Step[] = [
  {
    target: '[data-tour="nav-feed"]', shape: 'circle', route: '/feed',
    emoji: '📱',
    title: 'This is your Feed',
    body: 'Scroll through videos posted by instructors. Tap a video to watch it full screen. Tap the heart to like and the speech bubble to comment.',
  },
  {
    target: '[data-tour="nav-courses"]', shape: 'circle', route: '/courses',
    emoji: '📚',
    title: 'Courses & Workshops',
    body: 'Tap here to browse everything available. Open any course to see its full timetable — every session, date, start time, and duration — before you commit.',
  },
  {
    target: '[data-tour="nav-discover"]', shape: 'circle', route: '/discovery',
    emoji: '🔍',
    title: 'Discover Instructors',
    body: 'Browse mentors, coaches, teachers, and professors. Tap a card to see a full profile, follow them, or send a training or mentorship request.',
  },
  {
    target: '[data-tour="nav-profile"]', shape: 'circle', route: '/profile/me',
    emoji: '👤',
    title: 'Your Profile',
    body: 'This is your public profile. Add your projects, certificates, and a bio — the more complete it is, the more credible you look to instructors.',
  },
  {
    target: '[data-tour="apply-teach-btn"]', shape: 'rect', route: '/settings',
    emoji: '🎓',
    title: 'Want to teach on LERN?',
    body: 'Tap "Apply to teach" right here, fill in your details, and submit. Once approved you\'ll unlock instructor tools and your own instructor walkthrough.',
  },
]

// ── Instructor tour ───────────────────────────────────────────
const INSTRUCTOR_STEPS: Step[] = [
  {
    target: '[data-tour="nav-create"]', shape: 'circle', route: '/courses',
    emoji: '🚀',
    title: "You're an instructor",
    body: 'This is your Create button. Tap it any time to create a Course or a Workshop — that\'s where everything starts.',
  },
  {
    target: '[data-tour="nav-create"]', shape: 'circle', route: '/courses',
    emoji: '📅',
    title: 'Create a Course',
    body: 'Set a title, subject, level, start date and end date. Sessions are generated automatically, one per day — you pick the daily time and duration.',
  },
  {
    target: '[data-tour="nav-create"]', shape: 'circle', route: '/courses',
    emoji: '🗓️',
    title: 'Or run a Workshop',
    body: 'Workshops are one-off live events. Choose Online for a virtual classroom, or In-Person to display your venue. Followers get notified when you create one.',
  },
  {
    target: '[data-tour="nav-courses"]', shape: 'circle', route: '/courses',
    emoji: '🔴',
    title: 'Go live',
    body: 'When it\'s session time, open your course from here and tap Start Session. Every enrolled student is notified and can join instantly.',
  },
  {
    target: '[data-tour="nav-create"]', shape: 'circle', route: '/feed',
    emoji: '🎬',
    title: 'Post to your Feed',
    body: 'Tap Create → Post Video to share content with the community. Post before your course launches to build an audience and drive enrollments.',
  },
  {
    target: '[data-tour="nav-discover"]', shape: 'circle', route: '/discovery',
    emoji: '🌍',
    title: "You're on Discovery",
    body: 'Students browse this tab to find instructors. Keep your bio, role, and experience sharp so students choose you over others.',
  },
  {
    target: '[data-tour="nav-profile"]', shape: 'circle', route: '/profile/me',
    emoji: '📥',
    title: 'Manage requests',
    body: 'Students can send you training and mentorship requests. Go to Profile → Requests to accept or decline. Your courses and workshops live here too.',
  },
]

function useTargetRect(selector: string | null, gate: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!selector || !gate) { setRect(null); return }

    let raf = 0
    const deadline = Date.now() + 15000 // slow route compiles/navigations can take a while
    const measure = () => {
      const el = document.querySelector(selector) as HTMLElement | null
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'auto' })
        setRect(el.getBoundingClientRect())
      } else if (Date.now() < deadline) {
        raf = requestAnimationFrame(measure)
      }
    }
    measure()

    const onLayout = () => {
      const el = document.querySelector(selector) as HTMLElement | null
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [selector, gate])

  return rect
}

export default function OnboardingTour() {
  const { user } = useAuth() as any
  const router = useRouter()

  const [phase, setPhase] = useState<'idle' | 'prompt' | 'touring' | 'toast'>('idle')
  const [steps, setSteps] = useState<Step[]>([])
  const [index, setIndex] = useState(0)
  const [cardVisible, setCardVisible] = useState(false)
  const isInstructor = user?.account_type === 'instructor'
  const doneKeyRef = useRef(isInstructor ? DONE_KEY_INSTRUCTOR : DONE_KEY_STUDENT)

  useEffect(() => {
    if (!user) return
    doneKeyRef.current = isInstructor ? DONE_KEY_INSTRUCTOR : DONE_KEY_STUDENT
    if (localStorage.getItem(doneKeyRef.current)) return

    setSteps(isInstructor ? INSTRUCTOR_STEPS : STUDENT_STEPS)
    const t = setTimeout(() => setPhase('prompt'), 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.account_type])

  const step = steps[index]
  const rect = useTargetRect(phase === 'touring' ? (step?.target ?? null) : null, phase === 'touring')

  useEffect(() => {
    if (phase !== 'touring') return
    setCardVisible(false)
    const t = setTimeout(() => setCardVisible(true), rect ? 260 : 400)
    return () => clearTimeout(t)
  }, [index, phase, rect])

  const finish = useCallback(() => {
    localStorage.setItem(doneKeyRef.current, '1')
    setCardVisible(false)
    setPhase('toast')
    setTimeout(() => setPhase('idle'), 1900)
  }, [])

  const skip = useCallback(() => {
    localStorage.setItem(doneKeyRef.current, '1')
    setCardVisible(false)
    setTimeout(() => setPhase('idle'), 200)
  }, [])

  const startTour = () => {
    setPhase('touring')
    setIndex(0)
    const first = steps[0]
    if (first && first.route) router.push(first.route)
  }

  const goTo = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= steps.length) return
    const target = steps[nextIndex]
    setCardVisible(false)
    setTimeout(() => {
      setIndex(nextIndex)
      if (target.route) router.push(target.route)
    }, 180)
  }

  const next = () => {
    if (index === steps.length - 1) { finish(); return }
    goTo(index + 1)
  }
  const back = () => goTo(index - 1)

  if (phase === 'idle' || steps.length === 0) return null

  // ── Toast on completion ──────────────────────────────────────
  if (phase === 'toast') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[300] flex justify-center pt-[calc(env(safe-area-inset-top,0px)+14px)] pointer-events-none">
        <div className="flex items-center gap-2.5 bg-[#141414] border border-[rgba(255,255,255,0.1)] text-white text-sm font-semibold px-4 py-3 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
          <Sparkles className="w-4 h-4 text-[#FF6B2B]" />
          You're all set — enjoy LERN!
        </div>
      </div>
    )
  }

  // ── Welcome prompt ────────────────────────────────────────────
  if (phase === 'prompt') {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center px-5" style={{ background: 'rgba(5,5,8,0.86)', backdropFilter: 'blur(6px)' }}>
        <div className="w-full max-w-sm rounded-[28px] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.8)] border border-[rgba(255,255,255,0.1)] bg-[#141414]">
          <div className="h-1 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3]" />
          <div className="px-7 pt-8 pb-7 text-center">
            <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center shadow-[0_8px_30px_rgba(192,38,211,0.35)]">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-white text-xl font-extrabold mb-2">
              Welcome to LERN{user?.username ? `, ${user.username}` : ''}!
            </h2>
            <p className="text-[#999] text-sm leading-[1.6] mb-7">
              {isInstructor
                ? 'Want a quick tour of how to create courses, go live, and grow your following?'
                : 'Want a 60-second tour so you know exactly how to find courses, instructors, and get the most out of the app?'}
            </p>
            <button
              onClick={startTour}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold text-[15px] py-3.5 rounded-2xl active:scale-[0.98] transition mb-3"
            >
              Take the tour <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={skip}
              className="w-full text-[#666] text-sm font-semibold py-2"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Spotlight walkthrough ─────────────────────────────────────
  const total = steps.length
  const isLast = index === total - 1
  const PAD = step.shape === 'circle' ? 14 : 6
  const radius = step.shape === 'circle' ? 999 : 18

  let cardStyle: React.CSSProperties = {}
  let arrowStyle: React.CSSProperties | null = null

  if (rect) {
    const vh = window.innerHeight
    const vw = window.innerWidth
    const spaceBelow = vh - rect.bottom
    const spaceAbove = rect.top
    const placeBelow = spaceBelow > 240 && spaceBelow >= spaceAbove

    if (placeBelow) {
      cardStyle = { top: rect.bottom + PAD + 22 }
    } else {
      cardStyle = { bottom: vh - rect.top + PAD + 22 }
    }

    const cx = Math.min(Math.max(rect.left + rect.width / 2, 40), vw - 40)
    arrowStyle = {
      left: cx,
      transform: 'translateX(-50%) rotate(45deg)',
      ...(placeBelow ? { top: rect.bottom + PAD + 8 } : { bottom: vh - rect.top + PAD + 8 }),
    }
  } else {
    cardStyle = { top: '50%', transform: 'translateY(-50%)' }
  }

  return (
    <>
      {/* Dimmed backdrop with cutout */}
      <div
        className="fixed inset-0 z-[290] transition-opacity duration-300"
        style={{ opacity: cardVisible ? 1 : 0, background: rect ? undefined : 'rgba(5,5,8,0.88)' }}
      >
        {rect && (
          <div
            className="absolute transition-all duration-300 ease-out"
            style={{
              left: rect.left - PAD,
              top: rect.top - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              borderRadius: radius,
              boxShadow: '0 0 0 9999px rgba(5,5,8,0.88)',
            }}
          />
        )}
      </div>

      {/* Glow ring around the spotlighted element */}
      {rect && (
        <div
          className="fixed z-[291] pointer-events-none transition-all duration-300 ease-out animate-pulse"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: radius,
            boxShadow: '0 0 0 3px #FF6B2B, 0 0 28px 6px rgba(192,38,211,0.55)',
            opacity: cardVisible ? 1 : 0,
          }}
        />
      )}

      {/* Pointer triangle */}
      {arrowStyle && (
        <div
          className="fixed z-[292] w-3.5 h-3.5 bg-[#141414] border-t border-l border-[rgba(255,255,255,0.1)] transition-opacity duration-300"
          style={{ ...arrowStyle, opacity: cardVisible ? 1 : 0 }}
        />
      )}

      {/* Tour card */}
      <div
        className="fixed left-4 right-4 z-[293] transition-all duration-300 ease-out"
        style={{
          ...cardStyle,
          opacity: cardVisible ? 1 : 0,
          pointerEvents: cardVisible ? 'auto' : 'none',
        }}
      >
        <div className="mx-auto max-w-sm rounded-[26px] overflow-hidden shadow-[0_20px_70px_rgba(0,0,0,0.75)] border border-[rgba(255,255,255,0.1)] bg-[#141414]">
          <div className="h-1 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3]" />
          <div className="px-6 pt-5 pb-6">

            <div className="flex items-start justify-between mb-3.5">
              <div className="flex items-center gap-3">
                <span className="text-[28px] leading-none">{step.emoji}</span>
                <div>
                  <p className="text-white font-extrabold text-[17px] leading-tight">{step.title}</p>
                  <p className="text-[#666] text-[11px] mt-1 font-bold tracking-wide uppercase">Step {index + 1} of {total}</p>
                </div>
              </div>
              <button
                onClick={skip}
                aria-label="Skip tour"
                className="w-8 h-8 rounded-full bg-[#252525] border border-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0"
              >
                <X className="w-4 h-4 text-[#777]" />
              </button>
            </div>

            <p className="text-[#aaa] text-[14px] leading-[1.65] mb-5">{step.body}</p>

            {/* Progress bar */}
            <div className="h-1 rounded-full bg-[rgba(255,255,255,0.08)] mb-5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] transition-all duration-300"
                style={{ width: `${((index + 1) / total) * 100}%` }}
              />
            </div>

            <div className="flex items-center gap-2.5">
              {index > 0 && (
                <button
                  onClick={back}
                  className="flex items-center justify-center gap-1 bg-[#1f1f1f] border border-[rgba(255,255,255,0.08)] text-[#ccc] font-bold text-sm px-4 py-3 rounded-2xl active:scale-95 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={next}
                className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold text-sm px-5 py-3 rounded-2xl active:scale-[0.98] transition"
              >
                {isLast ? "Let's go! 🎉" : 'Next'}
                {!isLast && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
