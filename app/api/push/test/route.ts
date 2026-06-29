import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

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

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  webpush.setVapidDetails(subject, publicKey, privateKey)
  const service = createClient(supabaseUrl, serviceKey)

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
