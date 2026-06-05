import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const subject   = process.env.VAPID_SUBJECT
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!subject || !publicKey || !privateKey || !supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'Push not configured' }, { status: 200 })
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)

  const service = createClient(supabaseUrl, serviceKey)

  const { targetUserId, title, body, url } = await req.json()
  if (!targetUserId) return NextResponse.json({ error: 'Missing targetUserId' }, { status: 400 })

  const { data: subs } = await service
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', targetUserId)

  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 })

  const payload = JSON.stringify({ title, body, url: url ?? '/feed' })

  const results = await Promise.allSettled(
    subs.map(sub =>
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
