import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe, STRIPE_PRICE_ID, isPayableTier } from '@/lib/stripe'

// Starts real payment collection for an employer choosing (or
// switching to) a fixed-price tier -- previously set_employer_tier let
// an employer grant themselves any tier for free, self-declared, with
// nothing verifying it. Enterprise never reaches this route (no price,
// sales-led) -- EmployerSubscriptionPanel keeps its existing "contact
// us" path for that one.
const APP_URL = 'https://lernapp.uk'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Payments are not configured yet.' }, { status: 503 })

  const auth = req.headers.get('authorization') || ''
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(accessToken)
  if (callerError || !callerData?.user) return NextResponse.json({ error: 'Session expired — sign in again.' }, { status: 401 })

  const { tier } = await req.json().catch(() => ({}))
  if (!tier || !isPayableTier(tier)) return NextResponse.json({ error: 'Choose Micro, Growth, or Scale.' }, { status: 400 })

  const priceId = STRIPE_PRICE_ID[tier]
  if (!priceId) return NextResponse.json({ error: `The ${tier} price hasn't been set up yet — contact LERN.` }, { status: 503 })

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, email, role, employer_stripe_customer_id')
    .eq('id', callerData.user.id)
    .single()
  if (!profile || profile.role !== 'employer') return NextResponse.json({ error: 'This account is not an employer.' }, { status: 403 })

  let customerId = profile.employer_stripe_customer_id as string | null
  if (!customerId) {
    const customer = await stripe.customers.create({ email: profile.email, metadata: { employer_id: profile.id } })
    customerId = customer.id
    await supabaseAdmin.from('users').update({ employer_stripe_customer_id: customerId }).eq('id', profile.id)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/employer/settings?checkout=success`,
    cancel_url: `${APP_URL}/employer/settings?checkout=cancelled`,
    metadata: { employer_id: profile.id, tier },
    subscription_data: { metadata: { employer_id: profile.id, tier } },
  })

  return NextResponse.json({ url: session.url })
}
