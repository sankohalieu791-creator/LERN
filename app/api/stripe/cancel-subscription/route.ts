import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

// Real cancellation for an employer with an actual Stripe subscription
// -- cancel_employer_subscription() (the old RPC) just flipped a DB
// flag and made up a 30-day grace period; this actually tells Stripe,
// which keeps billing correct (no further charges) and the eventual
// customer.subscription.deleted webhook is what confirms the account
// is really done. Falls back to the old RPC's own behaviour for a
// pre-Stripe, self-declared account with no real subscription to cancel.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(accessToken)
  if (callerError || !callerData?.user) return NextResponse.json({ error: 'Session expired — sign in again.' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('users').select('id, role, employer_stripe_subscription_id').eq('id', callerData.user.id).single()
  if (!profile || profile.role !== 'employer') return NextResponse.json({ error: 'This account is not an employer.' }, { status: 403 })

  if (profile.employer_stripe_subscription_id && stripe) {
    const subscription = await stripe.subscriptions.update(profile.employer_stripe_subscription_id, { cancel_at_period_end: true })
    const periodEndUnix = (subscription as any).current_period_end as number | undefined
    await supabaseAdmin.from('users').update({
      employer_subscription_status: 'canceled',
      employer_subscription_period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', profile.id)
    return NextResponse.json({ ok: true })
  }

  // No real subscription on file -- same behaviour the old RPC had.
  await supabaseAdmin.from('users').update({
    employer_subscription_status: 'canceled',
    employer_subscription_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }).eq('id', profile.id)
  return NextResponse.json({ ok: true })
}
