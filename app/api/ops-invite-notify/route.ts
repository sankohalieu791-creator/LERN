import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Called by a Postgres trigger (pg_net, on_ops_invite_created) the
// instant a row lands in public.ops_invites -- same shape as
// app/api/notify/route.ts's own trigger, same shared secret, just a
// separate route since an invite isn't a public.notifications row (the
// invitee doesn't have an account yet for one to belong to).
const RESEND_API_KEY = process.env.RESEND_API_KEY
const NOTIFY_SECRET = process.env.NOTIFY_WEBHOOK_SECRET
const FROM = 'LERN <notifications@lernapp.uk>'
const APP_URL = 'https://lernapp.uk'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  if (NOTIFY_SECRET && req.headers.get('x-notify-secret') !== NOTIFY_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { invite_id } = await req.json().catch(() => ({}))
  if (!invite_id) return NextResponse.json({ error: 'invite_id required' }, { status: 400 })

  if (!RESEND_API_KEY) {
    console.log('[ops-invite-notify] RESEND_API_KEY not set, skipping email for', invite_id)
    return NextResponse.json({ skipped: true })
  }

  const { data: invite, error } = await supabaseAdmin
    .from('ops_invites')
    .select('id, email, token')
    .eq('id', invite_id)
    .single()
  if (error || !invite) return NextResponse.json({ error: 'invite not found' }, { status: 404 })

  const acceptUrl = `${APP_URL}/auth/ops-invite?token=${invite.token}`
  const subject = "You've been invited to LERN Ops"
  const body = `Hi,\n\nYou've been invited to join the LERN internal ops tool.\n\nAccept your invite and set a password: ${acceptUrl}\n\nThis link expires in 7 days. If you weren't expecting this, you can ignore it.`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: invite.email, subject, text: body }),
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error('[ops-invite-notify] Resend error:', errText)
      return NextResponse.json({ error: 'send failed' }, { status: 502 })
    }
  } catch (err) {
    console.error('[ops-invite-notify] send exception:', err)
    return NextResponse.json({ error: 'send failed' }, { status: 502 })
  }

  return NextResponse.json({ sent: true })
}
