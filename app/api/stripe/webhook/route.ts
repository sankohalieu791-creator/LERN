import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { stripe, STRIPE_PRICE_ID, type PayableEmployerTier } from '@/lib/stripe'

// Keeps the existing employer_tier / employer_subscription_status /
// employer_subscription_period_end model (already read everywhere via
// current_user_employer_verified() and EmployerSubscriptionPanel) in
// sync with what actually happened in Stripe -- this is the one place
// that model stops being self-declared and starts being real.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function tierFromPriceId(priceId: string | undefined): PayableEmployerTier | null {
  if (!priceId) return null
  const entry = (Object.entries(STRIPE_PRICE_ID) as [PayableEmployerTier, string | undefined][])
    .find(([, id]) => id === priceId)
  return entry ? entry[0] : null
}

async function findEmployerId(customerId: string, metadataEmployerId?: string): Promise<string | null> {
  if (metadataEmployerId) return metadataEmployerId
  const { data } = await supabaseAdmin.from('users').select('id').eq('employer_stripe_customer_id', customerId).single()
  return data?.id || null
}

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Payments are not configured yet.' }, { status: 503 })
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 503 })

  const signature = req.headers.get('stripe-signature')
  const rawBody = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature || '', webhookSecret)
  } catch (err: any) {
    console.error('[stripe webhook] signature verification failed:', err?.message)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  try {
    switch (event.type) {
      // The moment a checkout actually completes -- the first time this
      // customer's tier and status become real rather than self-declared.
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const employerId = session.metadata?.employer_id
        const tier = session.metadata?.tier
        if (!employerId || !tier || !session.subscription) break
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        await supabaseAdmin.from('users').update({
          employer_tier: tier,
          employer_tier_set_at: new Date().toISOString(),
          employer_subscription_status: 'active',
          employer_subscription_period_end: null,
          employer_stripe_customer_id: session.customer as string,
          employer_stripe_subscription_id: subscription.id,
        }).eq('id', employerId)
        break
      }

      // Covers a tier change made through Stripe's own customer portal,
      // a scheduled cancellation being set or undone, and a payment
      // recovering after a retry -- anything short of the subscription
      // actually ending, which subscription.deleted covers instead.
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const employerId = await findEmployerId(subscription.customer as string, subscription.metadata?.employer_id)
        if (!employerId) break
        const priceId = subscription.items.data[0]?.price?.id
        const tier = tierFromPriceId(priceId)
        const cancelling = subscription.cancel_at_period_end
        const status = subscription.status === 'active' || subscription.status === 'trialing'
          ? (cancelling ? 'canceled' : 'active')
          : 'restricted'
        const periodEndUnix = (subscription as any).current_period_end as number | undefined
        await supabaseAdmin.from('users').update({
          ...(tier ? { employer_tier: tier } : {}),
          employer_subscription_status: status,
          employer_subscription_period_end: status === 'canceled' && periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
          employer_stripe_subscription_id: subscription.id,
        }).eq('id', employerId)
        break
      }

      // The subscription is actually gone (grace period, if any, has
      // already run out on Stripe's side) -- restricted immediately,
      // same state get_employer_billing() already lazily flips to once
      // a self-managed cancellation's period end has passed.
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const employerId = await findEmployerId(subscription.customer as string, subscription.metadata?.employer_id)
        if (!employerId) break
        await supabaseAdmin.from('users').update({
          employer_subscription_status: 'restricted',
        }).eq('id', employerId)
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('[stripe webhook] handler error:', err)
    return NextResponse.json({ error: 'handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
