import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

// Institution/provider equivalent of /api/stripe/cancel-subscription.
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
    .from('users').select('id, role, organisation_id').eq('id', callerData.user.id).single()
  if (!profile || !['institution_staff', 'provider_staff'].includes(profile.role) || !profile.organisation_id) {
    return NextResponse.json({ error: 'This account is not an institution or training provider.' }, { status: 403 })
  }

  const { data: org } = await supabaseAdmin
    .from('organisations').select('id, stripe_subscription_id').eq('id', profile.organisation_id).single()
  if (!org) return NextResponse.json({ error: 'Organisation not found.' }, { status: 404 })

  if (org.stripe_subscription_id && stripe) {
    const subscription = await stripe.subscriptions.update(org.stripe_subscription_id, { cancel_at_period_end: true })
    const periodEndUnix = subscription.items.data[0]?.current_period_end as number | undefined
    await supabaseAdmin.from('organisations').update({
      subscription_status: 'canceled',
      subscription_period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', org.id)
    return NextResponse.json({ ok: true })
  }

  await supabaseAdmin.from('organisations').update({
    subscription_status: 'canceled',
    subscription_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }).eq('id', org.id)
  return NextResponse.json({ ok: true })
}
