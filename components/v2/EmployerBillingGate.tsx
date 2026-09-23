'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { signOut, getEmployerBilling, createEmployerCheckoutSession, setEmployerTier } from '@/lib/supabase'
import { EMPLOYER_TIERS, employerTierForEmployeeCount } from '@/lib/billing'
import Logo from '@/components/v2/Logo'
import { CreditCard, LogOut, Loader2, CheckCircle2 } from 'lucide-react'

// Payment verification fix, 23 Sep 2026 -- until today NOTHING actually
// gated employer access on payment: EmployerLayoutClient unlocked full
// access (Discover, Jobs, Candidates, Inbox) the moment employer_verified
// was true, regardless of whether a tier had ever been chosen or paid
// for. This is the real fix, not a cosmetic one -- access is now decided
// here, from the database's own billing.tier/subscription_status (via
// get_employer_billing), never from the Checkout redirect URL alone.
// Landing back on ?checkout=success only starts a poll of that same real
// state; the "success" UI only ever appears once the webhook has
// actually written it, which can lag the redirect by a few seconds.
const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 25_000

type GateState = 'loading' | 'confirming' | 'confirmed-flash' | 'picking' | 'confirming-timeout'

export default function EmployerBillingGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <EmployerBillingGateInner>{children}</EmployerBillingGateInner>
    </Suspense>
  )
}

// useSearchParams needs a Suspense boundary above it (same pattern as
// app/auth/callback/page.tsx) -- split out so the outer export can
// provide one without every caller having to know that.
function EmployerBillingGateInner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [billing, setBilling] = useState<any>(null)
  const [state, setState] = useState<GateState>('loading')
  const [employeeCount, setEmployeeCount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState(false)
  const pollStart = useRef<number | null>(null)

  const checkoutParam = searchParams.get('checkout')

  // A transient failure here (network blip, a cold serverless function)
  // used to leave `billing` at null forever with nothing checking for
  // that being an error rather than "still loading" -- the gate's own
  // "not loaded yet" guard below then never clears, stranding a real,
  // already-paying employer behind a permanent blank white screen.
  // Surfaced explicitly now, with a retry, instead of silently hanging.
  const fetchBilling = async () => {
    if (!user) return null
    const { data, error: err } = await getEmployerBilling(user.id)
    if (err || !data) { setLoadError(true); return null }
    setLoadError(false)
    setBilling(data)
    return data as any
  }

  // Real access decision -- tier chosen, and status either genuinely
  // active or still in a cancelled-but-not-yet-restricted grace period
  // (EmployerSubscriptionPanel already promises that grace period
  // elsewhere; this gate has to honour the same promise, not just check
  // for the literal string 'active').
  const passes = (b: any) => !!b?.tier && b.subscription_status !== 'restricted'

  useEffect(() => {
    if (!user) return
    fetchBilling().then(b => {
      if (passes(b)) { setState('picking'); return } // 'picking' is overwritten below if it actually passes
      if (checkoutParam === 'success') {
        pollStart.current = Date.now()
        setState('confirming')
      } else {
        setState('picking')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Polls the DB (never trusts the redirect itself) until the webhook
  // has actually landed, or gives up honestly after 25s rather than
  // hanging forever or silently flipping to a false success.
  useEffect(() => {
    if (state !== 'confirming') return
    const interval = setInterval(async () => {
      const b = await fetchBilling()
      if (passes(b)) {
        clearInterval(interval)
        setState('confirmed-flash')
        router.replace(window.location.pathname) // strips ?checkout=success so a refresh/back nav can't re-trigger polling
        setTimeout(() => setState('picking'), 1800) // brief calm confirmation, then unlock
        return
      }
      if (pollStart.current && Date.now() - pollStart.current > POLL_TIMEOUT_MS) {
        clearInterval(interval)
        setState('confirming-timeout')
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/auth/login')
  }

  const submitPlan = async () => {
    if (!employeeCount || Number(employeeCount) <= 0 || !user) return
    setError(''); setBusy(true)
    const tier = employerTierForEmployeeCount(Number(employeeCount))

    // Enterprise has no price -- "custom/on application", sales-led --
    // so it never goes near Stripe, same as EmployerSubscriptionPanel's
    // own pickTier(). Everything else is a real, payable Checkout.
    if (tier === 'enterprise') {
      const { error: err } = await setEmployerTier(user.id, tier)
      setBusy(false)
      if (err) { setError(err.message); return }
      await fetchBilling()
      return
    }

    const { data, error: err } = await createEmployerCheckoutSession(tier)
    setBusy(false)
    if (err) { setError(err.message); return }
    if (data?.url) window.location.href = data.url
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 text-ink"><Logo size="lg" /></div>
        <h1 className="text-2xl font-bold text-ink mb-2">Couldn't load your account</h1>
        <p className="text-[14px] text-[#6B6558] max-w-sm leading-relaxed mb-6">Check your connection and try again.</p>
        <button
          onClick={() => fetchBilling()}
          className="text-white font-semibold text-[14px] px-6 py-3 rounded-xl transition mb-4"
          style={{ backgroundColor: '#D4551A' }}
        >
          Try again
        </button>
        <button onClick={handleSignOut} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-tertiary hover:text-ink transition">
          <LogOut className="w-3.5 h-3.5" /> Log out
        </button>
      </div>
    )
  }

  if (state === 'loading' || !billing) {
    return <div className="min-h-screen bg-paper" />
  }

  // Real, DB-confirmed unlock -- the only path into `children`.
  if (passes(billing) && state === 'picking') {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mb-6 text-ink"><Logo size="lg" /></div>

      {state === 'confirming' && (
        <>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: '#FCEEE4' }}>
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#D4551A' }} />
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">Confirming your payment…</h1>
          <p className="text-[14px] text-[#6B6558] max-w-sm leading-relaxed">
            Stripe is finishing up on their end — this is usually just a few seconds. Don't close this tab.
          </p>
        </>
      )}

      {state === 'confirmed-flash' && (
        <>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: '#E1F5EE' }}>
            <CheckCircle2 className="w-6 h-6" style={{ color: '#0F6E56' }} />
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">
            {EMPLOYER_TIERS[billing.tier as keyof typeof EMPLOYER_TIERS]?.label} plan confirmed
          </h1>
          <p className="text-[14px] text-[#6B6558] max-w-sm leading-relaxed">Taking you in…</p>
        </>
      )}

      {state === 'confirming-timeout' && (
        <>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: '#FCEEE4' }}>
            <Loader2 className="w-6 h-6" style={{ color: '#D4551A' }} />
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">Still confirming</h1>
          <p className="text-[14px] text-[#6B6558] max-w-sm leading-relaxed mb-5">
            This is taking longer than usual. If your card was charged, this will resolve on its own shortly — you won't be charged twice either way.
          </p>
          <button
            onClick={() => { pollStart.current = Date.now(); setState('confirming') }}
            className="text-white font-semibold text-[14px] px-6 py-3 rounded-xl transition"
            style={{ backgroundColor: '#D4551A' }}
          >
            Check again
          </button>
        </>
      )}

      {state === 'picking' && (
        <>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: '#FCEEE4' }}>
            <CreditCard className="w-6 h-6" style={{ color: '#D4551A' }} />
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">
            {billing.subscription_status === 'restricted' ? 'Your plan needs reactivating' : 'Choose your plan to continue'}
          </h1>
          <p className="text-[14px] text-[#6B6558] max-w-sm leading-relaxed mb-6">
            {billing.subscription_status === 'restricted'
              ? "Your subscription ended — pick a plan to get back into Discover, Jobs, Candidates and Inbox."
              : "You need an active plan before you can use LERN. Discover, Jobs, Candidates and Inbox unlock once payment succeeds."}
          </p>

          <div className="w-full max-w-sm text-left">
            <label className="block text-[12.5px] font-semibold text-ink mb-1.5">How many employees does your company have?</label>
            <input
              type="number" min={1} value={employeeCount} onChange={e => setEmployeeCount(e.target.value)}
              placeholder="e.g. 40"
              className="w-full bg-surface border border-edge rounded-lg px-3.5 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition mb-1.5"
            />
            {employeeCount && Number(employeeCount) > 0 && (
              <p className="text-[12px] text-ink-tertiary mb-4">
                That's the <span className="font-semibold text-ink">{EMPLOYER_TIERS[employerTierForEmployeeCount(Number(employeeCount))].label}</span> tier,{' '}
                {EMPLOYER_TIERS[employerTierForEmployeeCount(Number(employeeCount))].monthlyPrice !== null
                  ? `£${EMPLOYER_TIERS[employerTierForEmployeeCount(Number(employeeCount))].monthlyPrice}/month.`
                  : 'custom pricing — LERN will be in touch.'}
              </p>
            )}
            {error && <p className="text-[12.5px] text-danger-text mb-3">{error}</p>}
            <button
              onClick={submitPlan}
              disabled={busy || !employeeCount || Number(employeeCount) <= 0}
              className="w-full text-white font-semibold text-[14px] py-3 rounded-xl disabled:opacity-40 transition"
              style={{ backgroundColor: '#D4551A' }}
            >
              {busy ? 'Setting up…' : 'Continue to payment'}
            </button>
          </div>
        </>
      )}

      <button onClick={handleSignOut} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-tertiary hover:text-ink transition mt-8">
        <LogOut className="w-3.5 h-3.5" /> Log out
      </button>
    </div>
  )
}
