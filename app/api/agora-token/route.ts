import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const APP_ID          = process.env.NEXT_PUBLIC_AGORA_APP_ID!
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE ?? ''
const TOKEN_EXPIRY    = 3600 * 4 // 4 hours

// Security audit, 7 Oct 2026: this had no authorisation check at all --
// with AGORA_APP_CERTIFICATE set, anyone who could guess or observe a
// channel name got a valid PUBLISHER token for it, letting them join
// (and publish audio/video into) any live workshop, not just one they
// were actually part of. WorkshopSession's channel is always
// `workshop-${workItemId}` (see components/v2/WorkshopSession.tsx), so
// this now requires the caller's own session and checks -- via a
// client scoped to their access token, so the existing work_items RLS
// policies decide, not a hand-rolled copy of them -- that they can
// actually read that workshop's row before minting a token for it.
export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get('channel')
  const uid     = req.nextUrl.searchParams.get('uid') ?? '0'

  if (!channel) return NextResponse.json({ error: 'channel required' }, { status: 400 })

  const accessToken = (req.headers.get('authorization') || '').replace(/^Bearer /, '')
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const workItemId = channel.startsWith('workshop-') ? channel.slice('workshop-'.length) : null
  if (!workItemId) return NextResponse.json({ error: 'Unrecognised channel.' }, { status: 400 })

  const asCaller = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  )
  const { data: workItem } = await asCaller.from('work_items').select('id').eq('id', workItemId).maybeSingle()
  if (!workItem) return NextResponse.json({ error: 'Not authorised for this workshop.' }, { status: 403 })

  // Without a certificate the Agora project is in "test mode" — return null
  // so the SDK joins without authentication.  Add AGORA_APP_CERTIFICATE to
  // .env.local (from Agora Console → your project → Primary Certificate) to
  // switch to production token auth.
  if (!APP_CERTIFICATE) {
    return NextResponse.json({ token: null })
  }

  try {
    // Dynamically import so the module is only loaded on the server
    const { RtcTokenBuilder, RtcRole } = await import('agora-access-token')
    const expireTs = Math.floor(Date.now() / 1000) + TOKEN_EXPIRY
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channel,
      Number(uid),
      RtcRole.PUBLISHER,
      expireTs,
    )
    return NextResponse.json({ token })
  } catch (err: any) {
    console.error('agora-token error:', err)
    return NextResponse.json({ token: null })
  }
}
