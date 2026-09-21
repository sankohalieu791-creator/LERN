// Billing and Subscription — Complete Build Spec. Every number and
// rule here is copied verbatim from that spec. This file holds ONLY
// pure calculation logic (no I/O, no Supabase) so every rule can be
// unit-tested in isolation from the database and the UI — the one
// place a rounding or boundary mistake would actually cost real money.

// ── Part 1: Employers ──────────────────────────────────────────────

export type EmployerTier = 'micro' | 'growth' | 'scale' | 'enterprise'

export const EMPLOYER_TIERS: Record<EmployerTier, {
  label: string
  employeeRange: string
  minEmployees: number
  maxEmployees: number | null // null = no upper bound
  talentPools: number | null // null = unlimited
  activeJobPostings: number | null
  monthlyPrice: number | null // null = custom/on application
  warmCadence: 'full' | 'full_customisable'
  partnersView: 'basic' | 'advanced' | 'advanced_dedicated'
}> = {
  micro: { label: 'Micro', employeeRange: '1 to 15 employees', minEmployees: 1, maxEmployees: 15, talentPools: 5, activeJobPostings: 5, monthlyPrice: 79, warmCadence: 'full', partnersView: 'basic' },
  growth: { label: 'Growth', employeeRange: '16 to 99 employees', minEmployees: 16, maxEmployees: 99, talentPools: 20, activeJobPostings: 20, monthlyPrice: 249, warmCadence: 'full', partnersView: 'basic' },
  scale: { label: 'Scale', employeeRange: '100 to 499 employees', minEmployees: 100, maxEmployees: 499, talentPools: 35, activeJobPostings: 35, monthlyPrice: 499, warmCadence: 'full_customisable', partnersView: 'advanced' },
  enterprise: { label: 'Enterprise', employeeRange: '500+ employees', minEmployees: 500, maxEmployees: null, talentPools: null, activeJobPostings: null, monthlyPrice: null, warmCadence: 'full_customisable', partnersView: 'advanced_dedicated' },
}

export const EMPLOYER_TIER_ORDER: EmployerTier[] = ['micro', 'growth', 'scale', 'enterprise']

export function employerTierForEmployeeCount(employees: number): EmployerTier {
  if (employees <= 15) return 'micro'
  if (employees <= 99) return 'growth'
  if (employees <= 499) return 'scale'
  return 'enterprise'
}

export function isDowngradeBlocked(
  targetTier: EmployerTier,
  currentTalentPoolsUsed: number,
  currentActiveJobPostings: number,
): { blocked: boolean; reason?: string } {
  const limits = EMPLOYER_TIERS[targetTier]
  if (limits.talentPools !== null && currentTalentPoolsUsed > limits.talentPools) {
    return { blocked: true, reason: `You have ${currentTalentPoolsUsed} talent pools, but ${limits.label} only allows ${limits.talentPools}. Remove some pools first.` }
  }
  if (limits.activeJobPostings !== null && currentActiveJobPostings > limits.activeJobPostings) {
    return { blocked: true, reason: `You have ${currentActiveJobPostings} active job postings, but ${limits.label} only allows ${limits.activeJobPostings}. Close some postings first.` }
  }
  return { blocked: false }
}

// ── Part 2: Training providers ─────────────────────────────────────
// 1–99: £70/learner, capped at £6,500. 100–299: £6,500 flat.
// 300–599: £8,500 flat. 600+: priced on application (not automatic).

export type ProviderBand = '1-99' | '100-299' | '300-599' | '600+'

export function providerBandFor(learners: number): ProviderBand {
  if (learners <= 99) return '1-99'
  if (learners <= 299) return '100-299'
  if (learners <= 599) return '300-599'
  return '600+'
}

export function providerAnnualPrice(learners: number): number | null {
  const band = providerBandFor(learners)
  if (band === '1-99') return Math.min(learners * 70, 6500)
  if (band === '100-299') return 6500
  if (band === '300-599') return 8500
  return null // 600+ is priced on application
}

export const PROVIDER_BAND_LABEL: Record<ProviderBand, string> = {
  '1-99': '1 to 99 learners',
  '100-299': '100 to 299 learners',
  '300-599': '300 to 599 learners',
  '600+': '600+ learners (priced on application)',
}

export const BOOTCAMP_EVIDENCE_MONTHLY = 150

// ── Institutions ────────────────────────────────────────────────────
// Base £2,000/yr covers up to and including 750 students. Above that,
// +£2.50 per additional student. Capped at £12,000/yr regardless of count.

export const INSTITUTION_BASE_PRICE = 2000
export const INSTITUTION_BASE_INCLUDED = 750
export const INSTITUTION_PER_EXTRA_STUDENT = 2.5
export const INSTITUTION_MAX_PRICE = 12000

export function institutionAnnualPrice(students: number): number {
  if (students <= INSTITUTION_BASE_INCLUDED) return INSTITUTION_BASE_PRICE
  const extra = students - INSTITUTION_BASE_INCLUDED
  return Math.min(INSTITUTION_BASE_PRICE + extra * INSTITUTION_PER_EXTRA_STUDENT, INSTITUTION_MAX_PRICE)
}

// ── Shared: mid-cycle proration (whole months, rounded to the nearest
// pound) — applies to training providers and institutions alike. ──

// Whole months remaining until the next annual anniversary of `anchor`,
// as of `now`. Whole months, not days, per spec. The anniversary that
// has most recently passed (or is today) defines "months elapsed";
// what's left of the 12-month cycle is what's returned.
export function monthsRemainingInCycle(anchor: Date, now: Date): number {
  const anchorDay = anchor.getUTCDate()
  let monthsElapsed =
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - anchor.getUTCMonth())
  // Hasn't reached this month's anniversary DAY yet -- that whole month
  // doesn't count as elapsed yet.
  if (now.getUTCDate() < anchorDay) monthsElapsed -= 1
  const monthsIntoCurrentCycle = ((monthsElapsed % 12) + 12) % 12
  return 12 - monthsIntoCurrentCycle
}

// (newAnnual - oldAnnual) / 12 * monthsRemaining, rounded to the
// nearest pound -- the spec's own worked example: (8500-6500)/12*4 = 667.
export function prorateBandChange(oldAnnual: number, newAnnual: number, monthsRemaining: number): number {
  return Math.round(((newAnnual - oldAnnual) / 12) * monthsRemaining)
}
