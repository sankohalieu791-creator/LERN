import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe, STRIPE_PRICE_ID, isPayableTier } from '@/lib/stripe'

// Starts real payment collection for an employer choosing (or
// switching to) a fixed-price tier -- previously set_employer_tier let
// an employer grant themselves any tier for free, self-declared, with
// nothing verifying it. Enterprise never reaches this route (no price,
// sales-led) -- EmployerSubscriptionPanel keeps its existing "contact
// us" path for that one.
const APP_URL = 'https://www.getlern.com'

// Lazy, not eager -- a module-scope createClient() with a non-null-
// asserted env var throws the instant this file is imported, which
// crashes Next.js's build-time page-data collection for the WHOLE
// deployment if that var is missing in ANY environment (e.g. Preview),
// not just a runtime error for this one route. Same fix as
// app/api/employer/verify-submit/route.ts.
// Lazy, not eager -- a module-scope createClient() with a non-null-
// asserted env var throws the instant this file is imported, which
// crashes Next.js's build-time page-data collection for the WHOLE
// deployment if that var is missing in ANY environment (e.g. Preview),
// not just a runtime error for this one route. Same fix as
// app/api/employer/verify-submit/route.ts.
//
// createSupabaseAdmin() is a plain (non-generic) function wrapping the
// actual createClient(url, key) call -- ReturnType<typeof createClient>
// directly on the generic createClient would resolve its Database type
// parameter with no call-site context, which silently widened every
// .update()/.insert() argument below to `never`. Wrapping it in an
// ordinary function first gives TypeScript a concrete call to infer
// from, exactly like the original eager `const getSupabaseAdmin() =
// createClient(...)` did.
function createSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Not configured yet.')
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}
let _supabaseAdmin: ReturnType<typeof createSupabaseAdmin> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdmin()
  return _supabaseAdmin
}

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Payments are not configured yet.' }, { status: 503 })

  const auth = req.headers.get('authorization') || ''
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: callerData, error: callerError } = await getSupabaseAdmin().auth.getUser(accessToken)
  if (callerError || !callerData?.user) return NextResponse.json({ error: 'Session expired — sign in again.' }, { status: 401 })

  const { tier } = await req.json().catch(() => ({}))
  if (!tier || !isPayableTier(tier)) return NextResponse.json({ error: 'Choose Micro, Growth, or Scale.' }, { status: 400 })

  const priceId = STRIPE_PRICE_ID[tier]
  if (!priceId) return NextResponse.json({ error: `The ${tier} price hasn't been set up yet — contact LERN.` }, { status: 503 })

  const { data: profile } = await getSupabaseAdmin()
    .from('users')
    .select('id, email, role, employer_stripe_customer_id')
    .eq('id', callerData.user.id)
    .single()
  if (!profile || profile.role !== 'employer') return NextResponse.json({ error: 'This account is not an employer.' }, { status: 403 })

  let customerId = profile.employer_stripe_customer_id as string | null
  if (!customerId) {
    const customer = await stripe.customers.create({ email: profile.email, metadata: { employer_id: profile.id } })
    customerId = customer.id
    await getSupabaseAdmin().from('users').update({ employer_stripe_customer_id: customerId }).eq('id', profile.id)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // EmployerBillingGate (mounted around the whole /employer layout,
    // not this one page) is what actually reads ?checkout= -- lands on
    // the dashboard now that Settings is a modal, not a route.
    success_url: `${APP_URL}/employer/dashboard?checkout=success`,
    cancel_url: `${APP_URL}/employer/dashboard?checkout=cancelled`,
    metadata: { employer_id: profile.id, tier },
    subscription_data: { metadata: { employer_id: profile.id, tier } },
    // This Stripe account has Managed Payments on by default, which
    // requires a tax_code on every product before it'll let a session
    // through -- the three tier products don't have one set. Turning
    // it off per-session is Stripe's own documented way to proceed
    // without that; if LERN wants Stripe to handle tax/VAT later, the
    // real fix is setting a proper tax_code on each product instead of
    // leaving this off indefinitely.
    managed_payments: { enabled: false },
  })

  return NextResponse.json({ url: session.url })
}
