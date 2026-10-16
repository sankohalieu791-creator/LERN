import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

// Institution/provider equivalent of /api/stripe/cancel-subscription.
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
  const auth = req.headers.get('authorization') || ''
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: callerData, error: callerError } = await getSupabaseAdmin().auth.getUser(accessToken)
  if (callerError || !callerData?.user) return NextResponse.json({ error: 'Session expired — sign in again.' }, { status: 401 })

  const { data: profile } = await getSupabaseAdmin()
    .from('users').select('id, role, organisation_id').eq('id', callerData.user.id).single()
  if (!profile || !['institution_staff', 'provider_staff'].includes(profile.role) || !profile.organisation_id) {
    return NextResponse.json({ error: 'This account is not an institution or training provider.' }, { status: 403 })
  }

  const { data: org } = await getSupabaseAdmin()
    .from('organisations').select('id, stripe_subscription_id').eq('id', profile.organisation_id).single()
  if (!org) return NextResponse.json({ error: 'Organisation not found.' }, { status: 404 })

  if (org.stripe_subscription_id && stripe) {
    const subscription = await stripe.subscriptions.update(org.stripe_subscription_id, { cancel_at_period_end: true })
    const periodEndUnix = subscription.items.data[0]?.current_period_end as number | undefined
    await getSupabaseAdmin().from('organisations').update({
      subscription_status: 'canceled',
      subscription_period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', org.id)
    return NextResponse.json({ ok: true })
  }

  await getSupabaseAdmin().from('organisations').update({
    subscription_status: 'canceled',
    subscription_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }).eq('id', org.id)
  return NextResponse.json({ ok: true })
}
