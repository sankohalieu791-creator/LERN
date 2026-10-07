import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Security audit, 7 Oct 2026: had no auth check at all, and unlike
// push/test this one accepts an arbitrary list of OTHER people's user
// ids plus free-text title/body -- anyone could push arbitrary
// (phishing-shaped) notifications to any user's device. Nothing in the
// app currently calls this route (confirmed: no client or server call
// site), so rather than guess at a "who's allowed to notify whom"
// policy, it's gated behind a server-only secret the same way the cron
// route is -- safe by default (refuses every request) until whatever
// backend feature is meant to trigger it sets PUSH_INTERNAL_SECRET and
// sends it as a bearer token.
export async function POST(req: NextRequest) {
  const subject    = process.env.VAPID_SUBJECT
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!subject || !publicKey || !privateKey || !supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'Push not configured' }, { status: 200 })
  }

  const auth = req.headers.get('authorization')
  if (!process.env.PUSH_INTERNAL_SECRET || auth !== `Bearer ${process.env.PUSH_INTERNAL_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  const service = createClient(supabaseUrl, serviceKey)

  const body = await req.json()
  // Support both single targetUserId and array targetUserIds
  const userIds: string[] = body.targetUserIds
    ?? (body.targetUserId ? [body.targetUserId] : [])

  if (!userIds.length) return NextResponse.json({ error: 'Missing targetUserId(s)' }, { status: 400 })

  const { data: subs } = await service
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)

  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 })

  const payload = JSON.stringify({
    title: body.title ?? 'LERN',
    body:  body.body  ?? '',
    url:   body.url   ?? '/feed',
  })

  const results = await Promise.allSettled(
    subs.map((sub: any) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload
        )
        .catch(async (err: any) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await service.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
          throw err
        })
    )
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ ok: true, sent })
}
