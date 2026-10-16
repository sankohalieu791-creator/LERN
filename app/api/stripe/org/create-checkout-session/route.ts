import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

// Institution/provider equivalent of /api/stripe/create-checkout-session
// -- the price here is never a fixed Stripe Price ID (there isn't one:
// the annual total is computed live from headcount, per lib/billing.ts /
// institution_annual_price() / provider_annual_price(), already proven
// correct by the existing get_org_billing() display). So this builds
// the Checkout Session's price inline (price_data) for the organisation's
// current computed total instead of referencing a catalog price.
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

  const { data: profile } = await getSupabaseAdmin()
    .from('users')
    .select('id, email, role, organisation_id')
    .eq('id', callerData.user.id)
    .single()
  if (!profile || !['institution_staff', 'provider_staff'].includes(profile.role) || !profile.organisation_id) {
    return NextResponse.json({ error: 'This account is not an institution or training provider.' }, { status: 403 })
  }

  const { data: org } = await getSupabaseAdmin()
    .from('organisations')
    .select('id, name, type, stripe_customer_id, subscription_status')
    .eq('id', profile.organisation_id)
    .single()
  if (!org) return NextResponse.json({ error: 'Organisation not found.' }, { status: 404 })
  if (org.subscription_status === 'active') return NextResponse.json({ error: 'Already subscribed.' }, { status: 400 })

  const { data: computed, error: computeError } = await getSupabaseAdmin().rpc('get_org_billing_for_checkout', { p_org_id: org.id })
  if (computeError || !computed) return NextResponse.json({ error: 'Could not compute your plan price — try again.' }, { status: 500 })
  if (computed.is_custom_pricing || !computed.annual_price) {
    return NextResponse.json({ error: 'At 600+ learners, pricing is arranged directly — contact LERN.' }, { status: 400 })
  }

  let customerId = org.stripe_customer_id as string | null
  if (!customerId) {
    const customer = await stripe.customers.create({ email: profile.email, name: org.name, metadata: { organisation_id: org.id } })
    customerId = customer.id
    await getSupabaseAdmin().from('organisations').update({ stripe_customer_id: customerId }).eq('id', org.id)
  }

  const orgTypeLabel = org.type === 'provider' ? 'Training provider' : 'Institution'
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{
      price_data: {
        currency: 'gbp',
        product_data: { name: `LERN — ${orgTypeLabel} plan (${computed.headcount} ${org.type === 'provider' ? 'learners' : 'students'})` },
        unit_amount: Math.round(computed.annual_price * 100),
        recurring: { interval: 'year' },
      },
      quantity: 1,
    }],
    // OrgBillingGate (mounted around the whole institution/provider
    // layout, not this one page) is what actually reads ?checkout= --
    // lands on the dashboard now that Settings is a modal, not a route.
    success_url: `${APP_URL}/${org.type === 'provider' ? 'provider' : 'institution'}/dashboard?checkout=success`,
    cancel_url: `${APP_URL}/${org.type === 'provider' ? 'provider' : 'institution'}/dashboard?checkout=cancelled`,
    metadata: { organisation_id: org.id, annual_price: String(computed.annual_price) },
    subscription_data: { metadata: { organisation_id: org.id } },
    managed_payments: { enabled: false },
  })

  return NextResponse.json({ url: session.url })
}
