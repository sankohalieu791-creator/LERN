import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe, STRIPE_PRICE_ID, isPayableTier } from '@/lib/stripe'
import { isDowngradeBlocked } from '@/lib/billing'

// Switching tier for someone who ALREADY has a real Stripe subscription
// -- updates the existing subscription's price with proration, rather
// than sending them through Checkout again as if they were new. An
// employer with no Stripe subscription yet (never checked out, or a
// pre-Stripe self-declared account) gets routed to
// create-checkout-session instead -- see EmployerSubscriptionPanel.
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
    .from('users').select('id, role, employer_stripe_subscription_id').eq('id', callerData.user.id).single()
  if (!profile || profile.role !== 'employer') return NextResponse.json({ error: 'This account is not an employer.' }, { status: 403 })
  if (!profile.employer_stripe_subscription_id) return NextResponse.json({ error: 'No active subscription to change — use create-checkout-session instead.' }, { status: 409 })

  // Same safety rule set_employer_tier() always enforced: never let a
  // downgrade silently strand talent pools/postings over the new
  // tier's limit.
  const [{ count: pools }, { count: postings }] = await Promise.all([
    supabaseAdmin.from('talent_pools').select('id', { count: 'exact', head: true }).eq('employer_id', profile.id),
    supabaseAdmin.from('opportunities').select('id', { count: 'exact', head: true }).eq('employer_id', profile.id).is('closed_at', null),
  ])
  const blocked = isDowngradeBlocked(tier, pools || 0, postings || 0)
  if (blocked.blocked) return NextResponse.json({ error: blocked.reason }, { status: 400 })

  const subscription = await stripe.subscriptions.retrieve(profile.employer_stripe_subscription_id)
  const itemId = subscription.items.data[0]?.id
  if (!itemId) return NextResponse.json({ error: "Couldn't find the subscription item to update." }, { status: 500 })

  await stripe.subscriptions.update(profile.employer_stripe_subscription_id, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: 'create_prorations',
    metadata: { employer_id: profile.id, tier },
  })

  // Reflect immediately rather than waiting on the webhook round trip
  // -- customer.subscription.updated will confirm the same values.
  await supabaseAdmin.from('users').update({
    employer_tier: tier, employer_tier_set_at: new Date().toISOString(), employer_subscription_status: 'active', employer_subscription_period_end: null,
  }).eq('id', profile.id)

  return NextResponse.json({ ok: true })
}
