import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'Not configured' }, { status: 200 })
  }

  const service = createClient(supabaseUrl, serviceKey)

  const { userId, endpoint, p256dh, auth } = await req.json()
  if (!userId || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  await service
    .from('push_subscriptions')
    .upsert({ user_id: userId, endpoint, p256dh, auth_key: auth }, { onConflict: 'endpoint' })

  return NextResponse.json({ ok: true })
}
