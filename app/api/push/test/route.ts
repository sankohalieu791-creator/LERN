import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Security audit, 7 Oct 2026: had no auth check at all -- anyone could
// POST an arbitrary userId here and fire a push notification at that
// person's device. Now requires a real session, and only ever sends to
// the caller's own subscriptions (that's this endpoint's whole point --
// letting someone check their own push setup works -- so there's no
// legitimate case for targeting anyone else).
export async function POST(req: NextRequest) {
  const subject    = process.env.VAPID_SUBJECT
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!subject || !publicKey || !privateKey || !supabaseUrl || !serviceKey) {
    const missing = [
      !subject     && 'VAPID_SUBJECT',
      !privateKey  && 'VAPID_PRIVATE_KEY',
      !serviceKey  && 'SUPABASE_SERVICE_ROLE_KEY',
    ].filter(Boolean).join(', ')
    return NextResponse.json({ ok: false, error: `Missing Vercel env vars: ${missing}` }, { status: 200 })
  }

  const accessToken = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const service = createClient(supabaseUrl, serviceKey)
  const { data: callerData, error: callerError } = await service.auth.getUser(accessToken)
  if (callerError || !callerData?.user) return NextResponse.json({ error: 'Session expired — sign in again.' }, { status: 401 })
  const userId = callerData.user.id

  webpush.setVapidDetails(subject, publicKey, privateKey)

  const { data: subs, error: dbErr } = await service
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  if (dbErr) return NextResponse.json({ ok: false, error: dbErr.message }, { status: 500 })
  if (!subs?.length) return NextResponse.json({ ok: false, error: 'No subscription found for this user. Make sure you granted notification permission.' }, { status: 404 })

  const payload = JSON.stringify({
    title: '🔔 LERN Test',
    body: 'Push notifications are working!',
    url: '/feed',
  })

  const results = await Promise.allSettled(
    subs.map((sub: any) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payload
      )
    )
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  const errors = results.filter(r => r.status === 'rejected').map(r => (r as any).reason?.message)

  return NextResponse.json({ ok: sent > 0, sent, total: subs.length, errors })
}
