'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getEmployerBilling, setEmployerTier,
  createEmployerCheckoutSession, changeEmployerTierViaStripe, cancelEmployerSubscriptionViaStripe,
} from '@/lib/supabase'
import { EMPLOYER_TIERS, EMPLOYER_TIER_ORDER, employerTierForEmployeeCount, type EmployerTier } from '@/lib/billing'
import { ChevronLeft, Check } from 'lucide-react'

const money = (n: number) => `£${n.toLocaleString('en-GB')}`

// Billing and Subscription — Complete Build Spec, Part 1 (Employers).
// Limits/prices always come back from the server (set_employer_tier
// re-validates the downgrade-blocking rule itself); EMPLOYER_TIERS here
// is only used for display and for picking a sensible starting tier.
export default function EmployerSubscriptionPanel({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const [billing, setBilling] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'overview' | { compare: EmployerTier }>('overview')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [employeeCount, setEmployeeCount] = useState('')

  const load = () => {
    if (!user) return
    getEmployerBilling(user.id).then(({ data, error: err }) => {
      if (err) setError(err.message)
      setBilling(data)
      setLoading(false)
    })
  }
  useEffect(load, [user?.id])

  // Enterprise has no price (Complete Build Spec: "custom/on
  // application") -- sales-led, so it keeps the old free/manual grant
  // rather than going anywhere near Stripe. The three priced tiers
  // (micro/growth/scale) now actually collect payment: a brand-new
  // subscriber (or anyone without a real Stripe subscription yet, e.g.
  // a pre-Stripe self-declared account) gets sent to Checkout; someone
  // who already has a live subscription has its price changed in place.
  const pickTier = async (tier: EmployerTier) => {
    if (!user) return
    setError(''); setBusy(true)

    if (tier === 'enterprise') {
      const { error: err } = await setEmployerTier(user.id, tier)
      setBusy(false)
      if (err) { setError(err.message); return }
      setView('overview')
      load()
      return
    }

    if (billing?.has_stripe_subscription) {
      const { error: err } = await changeEmployerTierViaStripe(tier)
      setBusy(false)
      if (err) { setError(err.message); return }
      setView('overview')
      load()
      return
    }

    const { data, error: err } = await createEmployerCheckoutSession(tier)
    setBusy(false)
    if (err) { setError(err.message); return }
    if (data?.url) window.location.href = data.url
  }

  const cancel = async () => {
    if (!user) return
    if (!confirm('Cancel your subscription? You\'ll keep access until the end of your current billing period, then the account becomes restricted until you resubscribe.')) return
    setBusy(true)
    const { error: err } = await cancelEmployerSubscriptionViaStripe()
    setBusy(false)
    if (err) { setError(err.message); return }
    load()
  }

  if (loading || !billing) {
    return (
      <div className="max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-ink-secondary hover:text-ink transition mb-4">
          <ChevronLeft className="w-4 h-4" /> Back to Settings
        </button>
        <p className="text-[14px] text-ink-tertiary">Loading…</p>
      </div>
    )
  }

  // No tier chosen yet -- the spec's "choosing a tier at sign-up" step,
  // shown here instead for any account that never went through it.
  if (!billing.tier) {
    return (
      <div className="max-w-lg mx-auto">
        <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-ink-secondary hover:text-ink transition mb-4">
          <ChevronLeft className="w-4 h-4" /> Back to Settings
        </button>
        <p className="font-bold text-ink text-[16px] mb-1">Choose your plan</p>
        <p className="text-[13px] text-ink-tertiary mb-4">Company size is self-declared — pick the tier that fits, you can change it later.</p>
        <div className="mb-4">
          <label className="block text-[12.5px] font-semibold text-ink mb-1.5">How many employees does your company have?</label>
          <input
            type="number" min={1} value={employeeCount} onChange={e => setEmployeeCount(e.target.value)}
            placeholder="e.g. 40"
            className="w-full bg-surface-subtle border border-edge rounded-lg px-3.5 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
          />
          {employeeCount && Number(employeeCount) > 0 && (
            <p className="text-[12px] text-ink-tertiary mt-1.5">
              That's the <span className="font-semibold text-ink">{EMPLOYER_TIERS[employerTierForEmployeeCount(Number(employeeCount))].label}</span> tier.
            </p>
          )}
        </div>
        {error && <p className="text-[12.5px] text-danger-text mb-3">{error}</p>}
        <button
          onClick={() => employeeCount && pickTier(employerTierForEmployeeCount(Number(employeeCount)))}
          disabled={busy || !employeeCount || Number(employeeCount) <= 0}
          className="w-full bg-brand text-white font-semibold text-[14px] py-3 rounded-xl disabled:opacity-40 transition"
        >
          {busy ? 'Setting up…' : 'Confirm plan'}
        </button>
      </div>
    )
  }

  if (typeof view === 'object') {
    return <CompareView currentTier={billing.tier} targetTier={view.compare} onBack={() => setView('overview')} onConfirm={() => pickTier(view.compare)} busy={busy} error={error} />
  }

  const tier = EMPLOYER_TIERS[billing.tier as EmployerTier]
  const poolPct = tier.talentPools ? (billing.talent_pools_used / tier.talentPools) * 100 : 0
  const postingPct = tier.activeJobPostings ? (billing.active_job_postings_used / tier.activeJobPostings) * 100 : 0

  return (
    <div className="max-w-lg mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-ink-secondary hover:text-ink transition mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to Settings
      </button>

      {billing.subscription_status !== 'active' && (
        <div className={`rounded-xl px-4 py-3 mb-4 text-[13px] ${billing.subscription_status === 'restricted' ? 'bg-danger-bg text-danger-text' : 'bg-accent-bg text-ink'}`}>
          {billing.subscription_status === 'restricted'
            ? 'Your subscription was cancelled and your access period has ended. Pick a plan below to reactivate.'
            : billing.subscription_period_end
              ? `Cancelled — you'll keep access until ${new Date(billing.subscription_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
              : "Cancelled — your access ends at the close of your current billing period."}
        </div>
      )}

      <div className="bg-surface border border-edge rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-bold text-ink text-[16px]">{tier.label} plan</p>
            <p className="text-[13px] text-ink-tertiary">{tier.monthlyPrice !== null ? `${money(tier.monthlyPrice)} / month` : 'Custom pricing'}</p>
          </div>
          {billing.subscription_status === 'active' && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-accent-bg text-brand">Active</span>
          )}
        </div>

        <UsageBar label="Talent pools" used={billing.talent_pools_used} limit={tier.talentPools} />
        <UsageBar label="Active job postings" used={billing.active_job_postings_used} limit={tier.activeJobPostings} />
      </div>

      <p className="text-[12.5px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2.5 px-1">Plans</p>
      <div className="bg-surface border border-edge rounded-2xl divide-y divide-edge-subtle overflow-hidden mb-4">
        {EMPLOYER_TIER_ORDER.map(t => {
          const t2 = EMPLOYER_TIERS[t]
          const isCurrent = t === billing.tier
          const isHigher = EMPLOYER_TIER_ORDER.indexOf(t) > EMPLOYER_TIER_ORDER.indexOf(billing.tier)
          return (
            <div key={t} className="flex items-center justify-between px-4 py-3.5">
              <div className="min-w-0">
                <p className={`text-[14px] font-semibold ${isCurrent ? 'text-brand' : 'text-ink'}`}>{t2.label}</p>
                <p className="text-[12px] text-ink-tertiary">
                  {t2.talentPools ?? 'Unlimited'} talent pools · {t2.activeJobPostings ?? 'Unlimited'} postings · {t2.monthlyPrice !== null ? `${money(t2.monthlyPrice)}/mo` : 'Custom'}
                </p>
              </div>
              {isCurrent ? (
                <span className="flex items-center gap-1 text-[12px] font-bold text-brand flex-shrink-0"><Check className="w-3.5 h-3.5" /> Current</span>
              ) : (
                <button onClick={() => setView({ compare: t })} className="text-[12.5px] font-semibold text-brand hover:underline flex-shrink-0">
                  {isHigher ? 'Upgrade' : 'Switch'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {error && <p className="text-[12.5px] text-danger-text mb-3">{error}</p>}

      {billing.subscription_status === 'active' && (
        <button onClick={cancel} disabled={busy} className="w-full bg-surface border border-edge text-ink-secondary font-semibold text-[13px] py-2.5 rounded-lg hover:border-danger-text hover:text-danger-text transition disabled:opacity-50">
          Cancel subscription
        </button>
      )}
    </div>
  )
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <div className="mb-3 last:mb-0">
        <div className="flex items-center justify-between text-[13px] mb-1">
          <span className="text-ink-secondary">{label}</span>
          <span className="text-ink font-semibold">Unlimited</span>
        </div>
      </div>
    )
  }
  const pct = (used / limit) * 100
  const color = pct >= 100 ? 'bg-danger-solid' : pct >= 90 ? 'bg-[#DA8B16]' : 'bg-brand'
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-[13px] mb-1">
        <span className="text-ink-secondary">{label}</span>
        <span className="text-ink font-semibold">{used} of {limit} used</span>
      </div>
      <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden mb-1">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {pct >= 100 && <p className="text-[11.5px] text-danger-text font-semibold mt-1">⚠ At your {label.toLowerCase()} limit</p>}
      {pct >= 90 && pct < 100 && <p className="text-[11.5px] font-semibold mt-1" style={{ color: '#DA8B16' }}>Almost at your {label.toLowerCase()} limit</p>}
    </div>
  )
}

function CompareView({ currentTier, targetTier, onBack, onConfirm, busy, error }: {
  currentTier: EmployerTier; targetTier: EmployerTier; onBack: () => void; onConfirm: () => void; busy: boolean; error: string
}) {
  const cur = EMPLOYER_TIERS[currentTier]
  const next = EMPLOYER_TIERS[targetTier]
  const isUpgrade = EMPLOYER_TIER_ORDER.indexOf(targetTier) > EMPLOYER_TIER_ORDER.indexOf(currentTier)
  const rows: [string, string, string][] = [
    ['Talent pools', String(cur.talentPools ?? 'Unlimited'), String(next.talentPools ?? 'Unlimited')],
    ['Active job postings', String(cur.activeJobPostings ?? 'Unlimited'), String(next.activeJobPostings ?? 'Unlimited')],
    ['Warm cadence', cur.warmCadence === 'full' ? 'Full' : 'Full + customisable', next.warmCadence === 'full' ? 'Full' : 'Full + customisable'],
    ['Partners view', cur.partnersView === 'basic' ? 'Basic' : cur.partnersView === 'advanced' ? 'Advanced' : 'Advanced + dedicated', next.partnersView === 'basic' ? 'Basic' : next.partnersView === 'advanced' ? 'Advanced' : 'Advanced + dedicated'],
  ]

  return (
    <div className="max-w-lg mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-ink-secondary hover:text-ink transition mb-4">
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
      <p className="font-bold text-ink text-[16px] mb-1">{isUpgrade ? `Upgrade to ${next.label}` : `Switch to ${next.label}`}</p>
      <p className="text-[13px] text-ink-tertiary mb-4">
        {next.monthlyPrice !== null ? `${money(next.monthlyPrice)}/month from your next billing date.` : 'Custom pricing — contact LERN.'}
      </p>

      <div className="bg-surface border border-edge rounded-2xl overflow-hidden mb-4">
        <div className="grid grid-cols-3 text-[12px] font-semibold text-ink-tertiary px-4 py-2.5 border-b border-edge-subtle">
          <span></span>
          <span className="text-center">{cur.label} (now)</span>
          <span className="text-center text-brand">{next.label}</span>
        </div>
        {rows.map(([label, a, b]) => (
          <div key={label} className="grid grid-cols-3 text-[13px] px-4 py-3 border-b border-edge-subtle last:border-0">
            <span className="text-ink-secondary">{label}</span>
            <span className="text-center text-ink">{a}</span>
            <span className={`text-center font-semibold ${a === b ? 'text-ink' : 'text-brand'}`}>{b}</span>
          </div>
        ))}
      </div>

      {error && <p className="text-[12.5px] text-danger-text mb-3">{error}</p>}
      <button onClick={onConfirm} disabled={busy} className="w-full bg-brand text-white font-semibold text-[14px] py-3 rounded-xl disabled:opacity-40 transition">
        {busy ? 'Working…' : isUpgrade ? 'Confirm upgrade' : 'Confirm switch'}
      </button>
    </div>
  )
}
