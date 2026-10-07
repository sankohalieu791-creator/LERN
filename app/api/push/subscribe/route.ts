import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Security audit, 7 Oct 2026: this trusted a client-supplied userId with
// no check that it matched whoever was actually calling -- anyone could
// register their own device against ANY user's id and start receiving
// that person's push notifications (new messages, interest requests,
// review decisions). The subscription is now always written against the
// caller's own verified id, never the body's.
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'Not configured' }, { status: 200 })
  }

  const accessToken = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const service = createClient(supabaseUrl, serviceKey)
  const { data: callerData, error: callerError } = await service.auth.getUser(accessToken)
  if (callerError || !callerData?.user) return NextResponse.json({ error: 'Session expired — sign in again.' }, { status: 401 })

  const { endpoint, p256dh, auth } = await req.json()
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { error } = await service
    .from('push_subscriptions')
    .upsert({ user_id: callerData.user.id, endpoint, p256dh, auth_key: auth }, { onConflict: 'endpoint' })

  if (error) {
    console.error('[push/subscribe] DB error:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
