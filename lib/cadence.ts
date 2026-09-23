// Talent Pools' automatic warm cadence -- Final Build Spec, 23 Sep
// 2026. Pure, I/O-free logic shared by the UI (rendering the sent/
// upcoming log on each candidate's card) and the Vercel Cron route that
// actually sends -- one definition of what's due, so what the employer
// sees can never quietly disagree with what actually goes out.

export interface CadenceStep { day: number; label: string; message: string }

export const DEFAULT_CADENCE: CadenceStep[] = [
  { day: 7, label: 'Profile prompt', message: "We saved your profile to one of our talent pools — worth keeping it up to date with your latest verified work, we check back regularly." },
  { day: 14, label: 'Workshop invite', message: "We run workshops other candidates like you have found useful — keep an eye on your school/provider for upcoming sessions worth joining." },
  { day: 21, label: 'Check-in', message: "Just checking in — still keen to hear from you if anything's changed on your end. No pressure either way." },
]

export function cadenceForPool(customCadence: CadenceStep[] | null | undefined): CadenceStep[] {
  return customCadence && customCadence.length > 0 ? customCadence : DEFAULT_CADENCE
}

// "Repeating or continuing until a role opens or the employer removes
// them" -- past the last defined step, that step's own label/message
// keeps recurring every 7 days rather than the cadence just stopping.
function stepForStage(cadence: CadenceStep[], stage: number): { label: string; message: string; day: number } {
  if (stage <= cadence.length) return cadence[stage - 1]
  const last = cadence[cadence.length - 1]
  const extraSteps = stage - cadence.length
  return { label: last.label, message: last.message, day: last.day + extraSteps * 7 }
}

// Every stage that should have gone out by now, given how many days
// it's been and what's already sent -- the cron job sends all of these
// in order (each one insert-guarded so it can never double-send).
export function dueStages(cadence: CadenceStep[], daysSinceAdded: number, sentStages: number[]): { stage: number; label: string; message: string }[] {
  const maxSent = sentStages.length ? Math.max(...sentStages) : 0
  const due: { stage: number; label: string; message: string }[] = []
  let stage = maxSent + 1
  while (true) {
    const step = stepForStage(cadence, stage)
    if (daysSinceAdded < step.day) break
    due.push({ stage, label: step.label, message: step.message })
    stage += 1
    if (due.length > 52) break // a year's worth -- a hard stop against a runaway loop, never expected to bind
  }
  return due
}

// The next stage after whatever's already gone out for this candidate
// -- what the read-only log shows as "scheduled for {date}, sends
// itself" so there's always something upcoming to point at, even
// before its day threshold actually arrives.
export function nextStage(cadence: CadenceStep[], sentStages: number[], addedAt: string): { stage: number; label: string; message: string; dueDate: Date } {
  const maxSent = sentStages.length ? Math.max(...sentStages) : 0
  const stage = maxSent + 1
  const step = stepForStage(cadence, stage)
  const dueDate = new Date(new Date(addedAt).getTime() + step.day * 24 * 60 * 60 * 1000)
  return { stage, label: step.label, message: step.message, dueDate }
}
