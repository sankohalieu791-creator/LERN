'use client'

import { Check, Minus, Clock } from 'lucide-react'

// Teams-style status badge -- a plain flat-coloured dot doesn't
// actually communicate status on its own (colour alone isn't a
// status, same reasoning as the "say Active, not just green" text-
// label fix), Teams solves this with a distinct icon per state, not
// just a distinct colour: a checkmark for Available, a clock for Away,
// a dash for Do not disturb, plain solid for Busy, and a hollow ring
// for Offline. Shared by every place a presence indicator shows up
// (the sidebar's own avatar, and any other account's avatar elsewhere)
// so they can't visually drift apart from each other.
const PRESENCE_CONFIG: Record<string, { bg: string; Icon?: typeof Check }> = {
  active: { bg: '#1E7A34', Icon: Check },
  busy: { bg: '#C4314B' },
  do_not_disturb: { bg: '#C4314B', Icon: Minus },
  away: { bg: '#DA8B16', Icon: Clock },
}

export default function PresenceBadge({
  status, size = 14, ringColor = 'var(--surface)', className,
}: {
  status?: string
  size?: number
  ringColor?: string
  className?: string
}) {
  const key = status || 'active'

  if (key === 'offline') {
    return (
      <span
        className={`rounded-full inline-block box-border flex-shrink-0 ${className || ''}`}
        style={{ width: size, height: size, border: `${Math.max(1.5, size * 0.14)}px solid #9CA3AF`, backgroundColor: ringColor }}
      />
    )
  }

  const cfg = PRESENCE_CONFIG[key] || PRESENCE_CONFIG.active
  const Icon = cfg.Icon
  return (
    <span
      className={`rounded-full flex items-center justify-center flex-shrink-0 ${className || ''}`}
      style={{ width: size, height: size, backgroundColor: cfg.bg }}
    >
      {Icon && <Icon size={Math.round(size * 0.6)} color="white" strokeWidth={3.5} />}
    </span>
  )
}
