'use client'

import { useEffect } from 'react'
import Logo from '@/components/v2/Logo'

// "A warm moment before landing them in their view" — shown for a beat
// on login (and right after signup completes) before routing into the
// real dashboard. Time-of-day aware; auto-advances, nothing to click.
export default function LoginGreeting({ name, onDone }: { name?: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500)
    return () => clearTimeout(t)
  }, [onDone])

  const hour = new Date().getHours()
  const timeWord = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const subline = hour < 12 ? "Let's get cracking today." : hour < 18 ? 'Good to see you back.' : "Let's wrap the day up well."
  const first = name?.split(' ')[0] || 'there'

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="text-center animate-fadeIn">
        <Logo />
        <p className="mt-6 text-[26px] font-bold text-ink">Good {timeWord}, {first}.</p>
        <p className="mt-1.5 text-[14px] text-[#8A8373]">{subline}</p>
      </div>
    </div>
  )
}
