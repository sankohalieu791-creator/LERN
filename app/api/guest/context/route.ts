import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// The guest's own header needs the inviting organisation's name and
// the shared student's name(s) ("Shared by St Mary's") -- guest_invites
// has no RLS policy letting a guest read the organisation row directly
// (only staff/members/safeguarding lead can), so this goes through a
// service-role route instead, the same shape as the pre-claim lookup
// in app/api/guest/invite/[token]/route.ts, just authenticated this
// time rather than public.
// Lazy, not eager -- a module-scope createClient() with a non-null-
// asserted env var throws the instant this file is imported, which
// crashes Next.js's build-time page-data collection for the WHOLE
// deployment if that var is missing in ANY environment (e.g. Preview),
// not just a runtime error for this one route. Same fix as
// app/api/employer/verify-submit/route.ts.
// Lazy, not eager -- a module-scope createClient() with a non-null-
// asserted env var throws the instant this file is imported, which
// crashes Next.js's build-time page-data collection for the WHOLE
// deployment if that var is missing in ANY environment (e.g. Preview),
// not just a runtime error for this one route. Same fix as
// app/api/employer/verify-submit/route.ts.
//
// createSupabaseAdmin() is a plain (non-generic) function wrapping the
// actual createClient(url, key) call -- ReturnType<typeof createClient>
// directly on the generic createClient would resolve its Database type
// parameter with no call-site context, which silently widened every
// .update()/.insert() argument below to `never`. Wrapping it in an
// ordinary function first gives TypeScript a concrete call to infer
// from, exactly like the original eager `const getSupabaseAdmin() =
// createClient(...)` did.
function createSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Not configured yet.')
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}
let _supabaseAdmin: ReturnType<typeof createSupabaseAdmin> | null = null
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdmin()
  return _supabaseAdmin
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: callerData, error: callerError } = await getSupabaseAdmin().auth.getUser(accessToken)
  if (callerError || !callerData?.user) return NextResponse.json({ error: 'Session expired — sign in again.' }, { status: 401 })

  const { data: profile } = await getSupabaseAdmin()
    .from('users').select('is_guest, guest_invite_id').eq('id', callerData.user.id).single()
  // guest_invite_id is the trustworthy signal even if is_guest went
  // stale (an invite claimed twice during testing) -- same allowance
  // used everywhere else a guest is identified in this app.
  if (!profile?.is_guest && !profile?.guest_invite_id) {
    return NextResponse.json({ error: 'This account is not a guest invite.' }, { status: 403 })
  }
  if (!profile.guest_invite_id) return NextResponse.json({ organisationName: null, studentNames: [] })

  const { data: invite } = await getSupabaseAdmin()
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
