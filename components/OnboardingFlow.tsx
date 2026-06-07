'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

const SLIDES = [
  {
    bg: 'linear-gradient(160deg, #FF6B2B 0%, #C026D3 60%, #7C3AED 100%)',
    emoji: '🎓',
    title: 'Welcome to LERN',
    sub: 'The social learning platform',
    body: 'Watch short educational videos, join live courses, and connect with world-class instructors — all in one place.',
  },
  {
    bg: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    emoji: '▶️',
    title: 'Discover & Watch',
    sub: 'Bite-sized education',
    body: 'Swipe through expert-led videos on maths, science, business, coding, and more. Learning that fits in your pocket.',
  },
  {
    bg: 'linear-gradient(160deg, #064e3b 0%, #065f46 50%, #059669 100%)',
    emoji: '📅',
    title: 'Join Live Courses',
    sub: 'Structured, scheduled learning',
    body: 'Enrol in courses with weekly live sessions. See your personal timetable and join the classroom with one tap.',
  },
  {
    bg: 'linear-gradient(160deg, #1e1b4b 0%, #3730a3 60%, #4f46e5 100%)',
    emoji: '🤝',
    title: 'Find Your Mentor',
    sub: 'Personalised guidance',
    body: 'Browse instructors, professors, and coaches. Request 1-to-1 training and message them directly when accepted.',
  },
  {
    bg: 'linear-gradient(160deg, #0c1445 0%, #1a237e 50%, #283593 100%)',
    emoji: '🚀',
    title: "You're all set!",
    sub: 'Start your journey',
    body: 'Your learning community is waiting. Explore the feed, discover mentors, and enrol in your first course today.',
  },
]

const STORAGE_KEY = 'lern_onboarded_v1'

export default function OnboardingFlow() {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const [slide, setSlide] = useState(0)
  const [animDir, setAnimDir] = useState<'left' | 'right' | null>(null)
  const [visible, setVisible] = useState(true)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  // Decide whether to show onboarding
  useEffect(() => {
    if (loading) return
    if (!user) return
    if (pathname === '/' || pathname.startsWith('/auth')) return
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) setShow(true)
  }, [user, loading, pathname])

  const done = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
    setTimeout(() => setShow(false), 400)
  }

  const goTo = (next: number, dir: 'left' | 'right') => {
    setAnimDir(dir)
    setTimeout(() => {
      setSlide(next)
      setAnimDir(null)
    }, 180)
  }

  const next = () => {
    if (slide < SLIDES.length - 1) goTo(slide + 1, 'left')
    else done()
  }

  const prev = () => {
    if (slide > 0) goTo(slide - 1, 'right')
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY)
    if (Math.abs(dx) > 50 && dy < 80) {
      if (dx > 0) next()
      else prev()
    }
  }

  if (!show) return null

  const s = SLIDES[slide]
  const isLast = slide === SLIDES.length - 1

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        zIndex: 99999,
        opacity: visible ? 1 : 0,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: s.bg,
        transition: 'background 0.5s ease, opacity 0.4s ease',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip */}
      <div className="flex justify-end px-6 pt-4 flex-shrink-0">
        {slide < SLIDES.length - 1 && (
          <button
            onClick={done}
            className="text-white/60 text-sm font-semibold px-3 py-1.5"
          >
            Skip
          </button>
        )}
      </div>

      {/* Main content */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8 text-center"
        style={{
          opacity: animDir ? 0 : 1,
          transform: animDir === 'left' ? 'translateX(-24px)' : animDir === 'right' ? 'translateX(24px)' : 'translateX(0)',
          transition: 'opacity 0.18s ease, transform 0.18s ease',
        }}
      >
        {/* Emoji icon */}
        <div
          className="mb-8 flex items-center justify-center"
          style={{
            width: 100,
            height: 100,
            borderRadius: 28,
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            fontSize: 48,
          }}
        >
          {s.emoji}
        </div>

        <h1 className="text-white font-black text-[32px] leading-tight mb-2 tracking-tight">
          {s.title}
        </h1>
        <p className="text-white/80 font-bold text-base mb-4 tracking-wide uppercase text-[11px]">
          {s.sub}
        </p>
        <p className="text-white/70 text-[15px] leading-relaxed max-w-xs">
          {s.body}
        </p>
      </div>

      {/* Bottom controls */}
      <div className="flex-shrink-0 px-6 pb-8">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > slide ? 'left' : 'right')}
              style={{
                width: i === slide ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === slide ? '#fff' : 'rgba(255,255,255,0.35)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={next}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,1)',
            color: '#000',
            fontWeight: 800,
            fontSize: 16,
            borderRadius: 100,
            padding: '16px 0',
            letterSpacing: '-0.2px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            transition: 'transform 0.1s ease, box-shadow 0.1s ease',
          }}
          onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.97)')}
          onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {isLast ? 'Start learning →' : 'Continue'}
        </button>

        {slide > 0 && (
          <button
            onClick={prev}
            className="w-full text-center text-white/50 text-sm font-semibold mt-3 py-2"
          >
            Back
          </button>
        )}
      </div>
    </div>
  )
}
