import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Build Spec follow-up: "when a link or institution has been invited
// they only see the profile of the student... verified work and
// experience, not posts or saved jobs." A guest's RLS grants are
// intentionally narrow (see app/api/guest/context/route.ts) and don't
// extend to experience_entries/self_qualifications for an arbitrary
// student id, so this assembles the whole profile server-side with
// the service role, with the guest_invite_shares row list as the ONLY
// source of truth for which student ids are in scope -- the same
// scoping boundary getGuestSharedWork() relies on RLS for, just
// re-derived explicitly here since experience/quals have no such
// policy to lean on. guest_invite_shares itself remains the one place
// this scoping is defined — nothing here widens it.
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
  if (!profile?.is_guest && !profile?.guest_invite_id) {
    return NextResponse.json({ error: 'This account is not a guest invite.' }, { status: 403 })
  }
  if (!profile.guest_invite_id) return NextResponse.json({ students: [] })

  const { data: shares } = await supabaseAdmin
    .from('guest_invite_shares')
    .select('student_id, users:student_id(id, full_name, avatar_path, bio)')
    .eq('invite_id', profile.guest_invite_id)

  const studentIds = ((shares || []) as any[]).map(s => s.student_id).filter(Boolean)
  if (studentIds.length === 0) return NextResponse.json({ students: [] })

  const [{ data: verifications }, { data: experience }, { data: quals }] = await Promise.all([
    supabaseAdmin
      .from('verifications')
      .select(`
        id, verified_at, visibility,
        verifier:users!verifications_verified_by_fkey(full_name),
        submissions!inner(id, content, student_id, work_items(title, description, type, organisations(name)))
      `)
      .in('submissions.student_id', studentIds)
      .is('revoked_at', null)
      .order('verified_at', { ascending: false }),
    supabaseAdmin.from('experience_entries').select('*').in('student_id', studentIds).order('created_at', { ascending: false }),
    supabaseAdmin.from('self_qualifications').select('*').in('student_id', studentIds).order('created_at', { ascending: false }),
  ])

  const students = ((shares || []) as any[]).map(s => {
    const student = s.users
    return {
      student,
      verifications: (verifications || []).filter((v: any) => v.submissions?.student_id === s.student_id),
      experience: (experience || []).filter((e: any) => e.student_id === s.student_id),
      qualifications: (quals || []).filter((q: any) => q.student_id === s.student_id),
    }
  }).filter(entry => entry.student)

  return NextResponse.json({ students })
}
