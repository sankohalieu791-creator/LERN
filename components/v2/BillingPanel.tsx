'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrgBilling, setBootcampEvidence } from '@/lib/supabase'
import { providerBandFor, PROVIDER_BAND_LABEL, BOOTCAMP_EVIDENCE_MONTHLY, INSTITUTION_MAX_PRICE } from '@/lib/billing'
import { ChevronLeft, TrendingUp } from 'lucide-react'

// Billing and Subscription — Complete Build Spec, Part 2. Every number
// shown here comes straight from get_org_billing() (server-computed,
// never a client-side formula) -- this component only labels and lays
// out figures the database already settled on. See lib/billing.ts for
// the calculation rules themselves and tests/unit/billing*.test.mjs for
// the exhaustive boundary + live-integration tests behind them.
const money = (n: number) => `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function BillingPanel({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const [billing, setBilling] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [togglingBootcamp, setTogglingBootcamp] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    if (!user?.organisation_id) return
    getOrgBilling(user.organisation_id).then(({ data, error: err }) => {
      if (err) setError(err.message)
      setBilling(data)
      setLoading(false)
    })
  }
  useEffect(load, [user?.organisation_id])

  const toggleBootcamp = async (next: boolean) => {
    if (!user?.organisation_id) return
    setTogglingBootcamp(true)
    const { error: err } = await setBootcampEvidence(user.organisation_id, next)
    setTogglingBootcamp(false)
    if (err) { setError(err.message); return }
    load()
  }

  return (
    <div className="max-w-lg mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-ink-secondary hover:text-ink transition mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to Settings
      </button>

      {loading ? (
        <p className="text-[14px] text-ink-tertiary">Loading…</p>
      ) : !billing ? (
        <p className="text-[14px] text-danger-text">{error || 'Could not load billing.'}</p>
      ) : (
        <BillingContent billing={billing} onToggleBootcamp={toggleBootcamp} togglingBootcamp={togglingBootcamp} error={error} />
      )}
    </div>
  )
}

function BillingContent({ billing, onToggleBootcamp, togglingBootcamp, error }: {
  billing: any; onToggleBootcamp: (v: boolean) => void; togglingBootcamp: boolean; error: string
}) {
  const isProvider = billing.org_type === 'provider'
  const band = isProvider ? providerBandFor(billing.headcount) : null
  const hasAdjustments = billing.adjustments?.length > 0

  return (
    <div className="space-y-4">
      {/* ── Headcount card ── */}
      <div className="bg-surface border border-edge rounded-2xl p-5">
        <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-2">
          {isProvider ? 'Learners on platform' : 'Students on platform'}
        </p>
        <p className="text-[34px] font-extrabold text-ink leading-none mb-3">{billing.headcount.toLocaleString('en-GB')}</p>
        {isProvider ? (
          billing.is_custom_pricing ? (
            <p className="text-[13px] text-ink-tertiary">600+ learners — priced on application</p>
          ) : (
            <p className="text-[13px] text-ink-tertiary">Band: {PROVIDER_BAND_LABEL[band!]}</p>
          )
        ) : (
          <div>
            <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden mb-1.5">
              <div className="h-full bg-brand rounded-full" style={{ width: `${Math.min((billing.headcount / 4750) * 100, 100)}%` }} />
            </div>
            <p className="text-[12px] text-ink-tertiary">of 4,750 maximum (pricing is capped at {money(INSTITUTION_MAX_PRICE)}/year beyond this)</p>
          </div>
        )}
      </div>

      {/* ── Line items ── */}
      {billing.is_custom_pricing ? (
        <div className="bg-surface border border-edge rounded-2xl p-5">
          <p className="text-[14px] text-ink leading-relaxed">
            At 600 or more learners, pricing is arranged directly rather than calculated automatically. Contact LERN to set up your plan.
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-edge rounded-2xl p-5">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-ink-secondary">{isProvider ? 'Base plan' : 'Base subscription'}</span>
              <span className="text-ink font-semibold">{money(billing.base_annual_price)}</span>
            </div>
            {hasAdjustments && billing.adjustments.map((a: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-[14px]">
                <span className="text-ink-secondary">{a.description}</span>
                <span className="text-ink font-semibold">{money(a.amount)}</span>
              </div>
            ))}
            {isProvider && billing.bootcamp_evidence_enabled && (
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-ink-secondary">Bootcamp Evidence add-on</span>
                <span className="text-ink font-semibold">{money(billing.bootcamp_evidence_annual)}</span>
              </div>
            )}
          </div>
          <div className="border-t border-edge-subtle my-3.5" />
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold text-ink">This year, total</span>
            <span className="text-[19px] font-extrabold text-brand">{money(billing.total)}</span>
          </div>
        </div>
      )}

      {hasAdjustments && (
        <div className="flex items-start gap-2.5 bg-accent-bg rounded-xl px-4 py-3.5">
          <TrendingUp className="w-4 h-4 flex-shrink-0 mt-0.5 text-brand" />
          <p className="text-[12.5px] leading-relaxed text-ink-secondary">
            Your {isProvider ? 'learner' : 'student'} count moved you into a higher pricing band partway through this billing year. A prorated charge for the remaining months has been added above.
          </p>
        </div>
      )}

      <div className="bg-surface-subtle rounded-xl px-4 py-3.5">
        <p className="text-[12.5px] text-ink-tertiary leading-relaxed">
          There's nothing to switch here — price is set automatically by your {isProvider ? 'learner' : 'student'} count{isProvider ? ' and whether Bootcamp Evidence is on' : ''}. A band change bills immediately for the months remaining in your year; a drop in headcount is never refunded mid-year, the lower rate applies from your next renewal.
        </p>
      </div>

      {isProvider && (
        <div className="bg-surface border border-edge rounded-2xl px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-ink">Bootcamp Evidence</p>
            <p className="text-[12px] text-ink-tertiary mt-0.5">{money(BOOTCAMP_EVIDENCE_MONTHLY)} per month while active</p>
          </div>
          <button
            onClick={() => onToggleBootcamp(!billing.bootcamp_evidence_enabled)} disabled={togglingBootcamp}
            className={`w-11 h-6 rounded-full transition relative flex-shrink-0 disabled:opacity-50 border ${billing.bootcamp_evidence_enabled ? 'bg-brand border-brand' : 'bg-surface-muted border-edge'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${billing.bootcamp_evidence_enabled ? 'left-[21px]' : 'left-0.5'}`} />
          </button>
        </div>
      )}

      {error && <p className="text-[12.5px] text-danger-text">{error}</p>}
    </div>
  )
}
