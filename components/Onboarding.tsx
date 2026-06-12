'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  Heart, MessageCircle, Compass, BookOpen,
  Play, Plus, Users, Bell, User, Video,
  Calendar, Clock, Zap, Star, ChevronRight,
  X, Wifi, MessageSquare, ArrowRight,
} from 'lucide-react'

const STORAGE_KEY = 'lern_onboarded_v1'

interface Step {
  icon: React.ReactNode
  gradient: string
  title: string
  body: string
  tip: string
  where: string
}

const STUDENT_STEPS: Step[] = [
  {
    icon: <Play className="w-9 h-9 text-white fill-white" />,
    gradient: 'from-[#FF6B2B] to-[#C026D3]',
    title: 'Your Feed',
    body: 'Scroll through videos posted by instructors. Tap a video to watch it full screen.',
    tip: 'Tap ❤️ to like · tap 💬 to comment · double-tap the video to like fast',
    where: 'Home tab (bottom left)',
  },
  {
    icon: <Compass className="w-9 h-9 text-white" />,
    gradient: 'from-[#7C3AED] to-[#2563EB]',
    title: 'Find Instructors',
    body: 'Browse the Discover tab to find mentors, coaches, teachers and professors.',
    tip: 'Tap their card to view their full profile · tap Follow · tap Message to chat',
    where: 'Discover tab (bottom row)',
  },
  {
    icon: <BookOpen className="w-9 h-9 text-white" />,
    gradient: 'from-[#059669] to-[#0891B2]',
    title: 'Browse Courses',
    body: 'Tap a course to open it and see the full timetable — every session, date, time, and how long it runs.',
    tip: 'Check the schedule before you enroll so you know exactly what you\'re signing up for',
    where: 'Courses tab (bottom row)',
  },
  {
    icon: <Calendar className="w-9 h-9 text-white" />,
    gradient: 'from-[#FF6B2B] to-[#EAB308]',
    title: 'Enroll in a Course',
    body: 'Tap Enroll on any course. Your enrolled courses move to the Enrolled tab so you can track your schedule.',
    tip: 'Each session shows the date, start time and duration — you\'ll never miss a class',
    where: 'Courses tab → Enrolled tab',
  },
  {
    icon: <Wifi className="w-9 h-9 text-white" />,
    gradient: 'from-[#DC2626] to-[#9333EA]',
    title: 'Join Live Sessions',
    body: 'When your instructor starts a session your enrolled card turns red. Tap Join Live to enter.',
    tip: 'Inside the classroom you can see the instructor, raise your hand ✋, and use the chat',
    where: 'Enrolled tab → Join Live button',
  },
  {
    icon: <MessageCircle className="w-9 h-9 text-white" />,
    gradient: 'from-[#0891B2] to-[#7C3AED]',
    title: 'Message Anyone',
    body: 'Tap the message icon on any profile to start a direct conversation.',
    tip: 'You\'ll get a push notification 🔔 and a sound when they reply — even if the app is closed',
    where: 'Any profile → Message button',
  },
  {
    icon: <User className="w-9 h-9 text-white" />,
    gradient: 'from-[#C026D3] to-[#FF6B2B]',
    title: 'Your Profile',
    body: 'Show off your projects, certificates, and posts. Tap ✏️ to edit your profile at any time.',
    tip: 'Instructors can leave feedback on your profile — keep it complete!',
    where: 'Profile tab (bottom right)',
  },
]

const INSTRUCTOR_STEPS: Step[] = [
  {
    icon: <Video className="w-9 h-9 text-white" />,
    gradient: 'from-[#FF6B2B] to-[#C026D3]',
    title: 'Post Videos',
    body: 'Share short videos to build your audience. Students who follow you see every post in their feed.',
    tip: 'Tap + → Post Video to upload · add a good title and description so students find it',
    where: '+ button (bottom centre)',
  },
  {
    icon: <Plus className="w-9 h-9 text-white" />,
    gradient: 'from-[#7C3AED] to-[#059669]',
    title: 'Create a Course',
    body: 'Tap + → Create Course. Set a title, subject, level, start date and end date.',
    tip: 'Sessions are generated automatically — one per day from start to end. The last session becomes Projects Day.',
    where: '+ button → Create Course',
  },
  {
    icon: <Clock className="w-9 h-9 text-white" />,
    gradient: 'from-[#059669] to-[#0891B2]',
    title: 'Set Time & Duration',
    body: 'Pick the daily session time and how long each session runs. Students see this on the timetable before enrolling.',
    tip: 'Options: 30min · 45min · 1hr · 90min · 2hr — be realistic so students can plan',
    where: 'Course creation form',
  },
  {
    icon: <Zap className="w-9 h-9 text-white" />,
    gradient: 'from-[#DC2626] to-[#9333EA]',
    title: 'Go Live',
    body: 'When it\'s session time, go to your course and tap Start Session to open the virtual classroom.',
    tip: 'All enrolled students get a push notification and their card shows Join Live immediately',
    where: 'Courses tab → your course → Start Session',
  },
  {
    icon: <Star className="w-9 h-9 text-white" />,
    gradient: 'from-[#EAB308] to-[#FF6B2B]',
    title: 'Create Workshops',
    body: 'Workshops are one-off live events. Choose Online (virtual classroom) or In-Person (with a location).',
    tip: 'Online workshops get a virtual classroom link. In-person shows your venue address.',
    where: '+ button → Create Workshop',
  },
  {
    icon: <Compass className="w-9 h-9 text-white" />,
    gradient: 'from-[#2563EB] to-[#7C3AED]',
    title: 'You\'re on Discovery',
    body: 'Your profile is listed in the Discover tab. Students search and browse there to find instructors.',
    tip: 'Complete your profile — add a bio, your role, and experience — so students choose you',
    where: 'Discover tab (visible to all)',
  },
  {
    icon: <Bell className="w-9 h-9 text-white" />,
    gradient: 'from-[#C026D3] to-[#FF6B2B]',
    title: 'Requests & Notifications',
    body: 'Students can send you training or mentorship requests. You get a bell notification + push for every interaction.',
    tip: 'Check Profile → Requests tab to accept or decline · the bell 🔔 top-right shows all activity',
    where: 'Profile tab → Requests tab',
  },
]

export default function Onboarding() {
  const { user } = useAuth() as any
  const [show,  setShow]  = useState(false)
  const [phase, setPhase] = useState<'ask' | 'tour'>('ask')
  const [step,  setStep]  = useState(0)

  useEffect(() => {
    if (!user) return
    if (!localStorage.getItem(STORAGE_KEY)) setShow(true)
  }, [user?.id])

  if (!show) return null

  const isInstructor = user?.account_type === 'instructor'
  const steps = isInstructor ? INSTRUCTOR_STEPS : STUDENT_STEPS
  const current = steps[step]
  const isLast = step === steps.length - 1

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setShow(false)
  }

  const skip = () => finish()

  const next = () => {
    if (isLast) { finish(); return }
    setStep(s => s + 1)
  }

  const prev = () => setStep(s => Math.max(0, s - 1))

  // ── Welcome / Ask screen ──────────────────────────────────────
  if (phase === 'ask') {
    return (
      <div className="fixed inset-0 z-[200] bg-[#0a0a0a] flex flex-col items-center justify-between px-6 py-safe"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 48px)', paddingBottom: 'max(env(safe-area-inset-bottom), 48px)' }}>

        {/* Logo */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center shadow-2xl shadow-[#FF6B2B]/30">
            <span className="text-white font-black text-3xl tracking-tighter">L</span>
          </div>

          <div>
            <h1 className="text-white font-black text-3xl tracking-tight mb-2">Welcome to LERN</h1>
            <p className="text-[#666] text-base leading-relaxed max-w-xs">
              {isInstructor
                ? 'The live learning platform for instructors who want to teach, grow, and connect.'
                : 'The live learning platform where you connect with world-class instructors.'}
            </p>
          </div>

          <div className="w-full max-w-xs space-y-3 mt-4">
            <div className="flex items-center gap-3 bg-[#111] rounded-2xl px-4 py-3">
              <span className="text-xl">🎓</span>
              <p className="text-[#888] text-sm">{isInstructor ? 'Create courses & go live' : 'Enroll in live courses'}</p>
            </div>
            <div className="flex items-center gap-3 bg-[#111] rounded-2xl px-4 py-3">
              <span className="text-xl">💬</span>
              <p className="text-[#888] text-sm">Message and connect</p>
            </div>
            <div className="flex items-center gap-3 bg-[#111] rounded-2xl px-4 py-3">
              <span className="text-xl">🔔</span>
              <p className="text-[#888] text-sm">Real-time notifications</p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={() => { setPhase('tour'); setStep(0) }}
            className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-lg"
          >
            Show me around <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={finish}
            className="w-full bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] text-[#888] font-semibold py-4 rounded-2xl text-base active:scale-[0.98] transition"
          >
            I'll explore myself
          </button>
        </div>
      </div>
    )
  }

  // ── Tour slides ───────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] bg-[#0a0a0a] flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
        <span className="text-[#444] text-sm font-semibold">
          {step + 1} / {steps.length}
        </span>
        <button onClick={skip} className="text-[#555] text-sm font-semibold py-1 px-3 rounded-full hover:text-white transition">
          Skip
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-5 mb-6 flex-shrink-0">
        <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">

        {/* Icon */}
        <div className={`w-24 h-24 rounded-[28px] bg-gradient-to-br ${current.gradient} flex items-center justify-center shadow-2xl`}
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          {current.icon}
        </div>

        {/* Text */}
        <div className="text-center max-w-xs">
          <h2 className="text-white font-black text-2xl leading-tight mb-3">{current.title}</h2>
          <p className="text-[#aaa] text-base leading-relaxed">{current.body}</p>
        </div>

        {/* Tip card */}
        <div className="w-full max-w-xs bg-[#111] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-lg flex-shrink-0 mt-0.5">💡</span>
            <p className="text-[#888] text-sm leading-relaxed">{current.tip}</p>
          </div>
          <div className="border-t border-[rgba(255,255,255,0.05)] pt-3 flex items-center gap-2">
            <span className="text-sm">📍</span>
            <p className="text-[#555] text-xs font-semibold">{current.where}</p>
          </div>
        </div>
      </div>

      {/* Footer nav */}
      <div className="flex-shrink-0 px-5 pb-6 pt-4 flex items-center gap-3">
        {step > 0 ? (
          <button
            onClick={prev}
            className="w-14 h-14 rounded-2xl bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] flex items-center justify-center text-[#666] active:scale-95 transition flex-shrink-0"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
        ) : (
          <div className="w-14 h-14 flex-shrink-0" />
        )}

        <button
          onClick={next}
          className={`flex-1 h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition ${
            isLast
              ? 'bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white shadow-lg'
              : 'bg-white text-black'
          }`}
        >
          {isLast ? (
            <>Let's go 🚀</>
          ) : (
            <>Next <ChevronRight className="w-5 h-5" /></>
          )}
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5 pb-4 flex-shrink-0">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`rounded-full transition-all duration-200 ${
              i === step ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-[#333]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
