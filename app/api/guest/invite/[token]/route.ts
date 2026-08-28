import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Public, unauthenticated lookup for the guest claim page -- there's
// no session yet, so this can't go through a normal RLS-scoped client
// read. Returns only what's safe to show before identity is
// confirmed: the inviting organisation's name and a plain count of
// what's shared, never the student's own details.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const { data: invite, error } = await supabaseAdmin
    .from('guest_invites')
    .select('id, revoked_at, claimed_by, organisations(name)')
    .eq('token', params.token)
    .single()

  if (error || !invite) return NextResponse.json({ error: 'not_found', message: 'This invite link is not valid.' }, { status: 404 })
  if ((invite as any).revoked_at) return NextResponse.json({ error: 'revoked', message: 'This invite has been revoked.' }, { status: 410 })
  if ((invite as any).claimed_by) return NextResponse.json({ error: 'claimed', message: 'This invite has already been used.' }, { status: 410 })

  const { count } = await supabaseAdmin
    .from('guest_invite_shares')
    .select('id', { count: 'exact', head: true })
    .eq('invite_id', (invite as any).id)

  return NextResponse.json({
    inviteId: (invite as any).id,
    organisationName: (invite as any).organisations?.name || 'An organisation',
    sharedCount: count || 0,
  })
}
