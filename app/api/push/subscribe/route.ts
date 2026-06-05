import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { userId, endpoint, p256dh, auth } = await req.json()
  if (!userId || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  await service
    .from('push_subscriptions')
    .upsert({ user_id: userId, endpoint, p256dh, auth_key: auth }, { onConflict: 'endpoint' })
  return NextResponse.json({ ok: true })
}
