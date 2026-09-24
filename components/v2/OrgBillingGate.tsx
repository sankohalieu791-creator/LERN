'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { signOut, getOrgBilling, createOrgCheckoutSession } from '@/lib/supabase'
import Logo from '@/components/v2/Logo'
import { CreditCard, LogOut, Loader2, CheckCircle2 } from 'lucide-react'

// Institution/provider equivalent of EmployerBillingGate -- same real
// fix (access decided from the database's own subscription_status, never
// the Checkout redirect alone), same poll-until-webhook-lands pattern.
// The one real difference: there's no tier to pick. The annual price is
// already computed server-side from the org's live headcount (the
// existing get_org_billing() display, now extended with the same
// subscription_status/period_end fields get_employer_billing() has) --
// so "picking" here just means "look at the number and subscribe."
const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 25_000

type GateState = 'loading' | 'confirming' | 'confirmed-flash' | 'picking' | 'confirming-timeout'

export default function OrgBillingGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <OrgBillingGateInner>{children}</OrgBillingGateInner>
    </Suspense>
  )
}

function OrgBillingGateInner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [billing, setBilling] = useState<any>(null)
  const [state, setState] = useState<GateState>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState(false)
  const pollStart = useRef<number | null>(null)

  const checkoutParam = searchParams.get('checkout')

  const fetchBilling = async () => {
    if (!user?.organisation_id) { setLoadError(true); return null }
    const { data, error: err } = await getOrgBilling(user.organisation_id)
    if (err || !data) { setLoadError(true); return null }
    setLoadError(false)
    setBilling(data)
    return data as any
  }

  const passes = (b: any) => !!b?.subscription_status && b.subscription_status !== 'restricted'

  useEffect(() => {
    if (!user) return
    fetchBilling().then(b => {
      if (passes(b)) { setState('picking'); return }
      if (checkoutParam === 'success') {
        pollStart.current = Date.now()
        setState('confirming')
      } else {
        setState('picking')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (state !== 'confirming') return
    const interval = setInterval(async () => {
      const b = await fetchBilling()
      if (passes(b)) {
        clearInterval(interval)
        setState('confirmed-flash')
        router.replace(window.location.pathname)
        setTimeout(() => setState('picking'), 1800)
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

  const subscribe = async () => {
    setError(''); setBusy(true)
    const { data, error: err } = await createOrgCheckoutSession()
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

  if (passes(billing) && state === 'picking') {
    return <>{children}</>
  }

  const isProvider = billing.org_type === 'provider'
  const money = (n: number) => `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

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
          <h1 className="text-2xl font-bold text-ink mb-2">Plan confirmed</h1>
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
              ? 'Your subscription ended — subscribe again to get back in.'
              : "You need an active plan before you can use LERN. Your price is calculated automatically from your headcount below."}
          </p>

          <div className="w-full max-w-sm text-left">
            <div className="bg-surface border border-edge rounded-2xl p-5 mb-4">
              <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-1.5">
                {isProvider ? 'Learners on platform' : 'Students on platform'}
              </p>
              <p className="text-[30px] font-extrabold text-ink leading-none mb-3">{billing.headcount.toLocaleString('en-GB')}</p>
              {billing.is_custom_pricing ? (
                <p className="text-[13px] text-ink-tertiary">600+ learners — priced on application</p>
              ) : (
                <p className="text-[20px] font-bold text-brand">{money(billing.base_annual_price)}<span className="text-[13px] font-semibold text-ink-tertiary">/year</span></p>
              )}
            </div>

            {error && <p className="text-[12.5px] text-danger-text mb-3">{error}</p>}

            {billing.is_custom_pricing ? (
              <p className="text-[13px] text-ink-tertiary leading-relaxed text-center">
                Email <span className="font-semibold text-ink">hello@lernapp.uk</span> to set up your plan.
              </p>
            ) : (
              <button
                onClick={subscribe}
                disabled={busy}
                className="w-full text-white font-semibold text-[14px] py-3 rounded-xl disabled:opacity-40 transition"
                style={{ backgroundColor: '#D4551A' }}
              >
                {busy ? 'Setting up…' : 'Continue to payment'}
              </button>
            )}
          </div>
        </>
      )}

      <button onClick={handleSignOut} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-tertiary hover:text-ink transition mt-8">
        <LogOut className="w-3.5 h-3.5" /> Log out
      </button>
    </div>
  )
}
