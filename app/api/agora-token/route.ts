import { NextRequest, NextResponse } from 'next/server'

const APP_ID          = process.env.NEXT_PUBLIC_AGORA_APP_ID!
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE ?? ''
const TOKEN_EXPIRY    = 3600 * 4 // 4 hours

export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get('channel')
  const uid     = req.nextUrl.searchParams.get('uid') ?? '0'

  if (!channel) return NextResponse.json({ error: 'channel required' }, { status: 400 })

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
