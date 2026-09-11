import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// The guest's own header needs the inviting organisation's name and
// the shared student's name(s) ("Shared by St Mary's") -- guest_invites
// has no RLS policy letting a guest read the organisation row directly
// (only staff/members/safeguarding lead can), so this goes through a
// service-role route instead, the same shape as the pre-claim lookup
// in app/api/guest/invite/[token]/route.ts, just authenticated this
// time rather than public.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(accessToken)
  if (callerError || !callerData?.user) return NextResponse.json({ error: 'Session expired — sign in again.' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('users').select('is_guest, guest_invite_id').eq('id', callerData.user.id).single()
  // guest_invite_id is the trustworthy signal even if is_guest went
  // stale (an invite claimed twice during testing) -- same allowance
  // used everywhere else a guest is identified in this app.
  if (!profile?.is_guest && !profile?.guest_invite_id) {
    return NextResponse.json({ error: 'This account is not a guest invite.' }, { status: 403 })
  }
  if (!profile.guest_invite_id) return NextResponse.json({ organisationName: null, studentNames: [] })

  const { data: invite } = await supabaseAdmin
    .from('guest_invites')
    .select('organisations(name), guest_invite_shares(users:student_id(full_name))')
    .eq('id', profile.guest_invite_id)
    .single()

  const studentNames = ((invite as any)?.guest_invite_shares || [])
    .map((s: any) => s.users?.full_name)
    .filter(Boolean)

  return NextResponse.json({
    organisationName: (invite as any)?.organisations?.name || null,
    studentNames,
  })
}
