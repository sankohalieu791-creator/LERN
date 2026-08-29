import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Testing-stage-only passwordless sign-in for the founder allowlist.
// Gated on TWO things, not just knowing an allowlisted email: a shared
// secret only you set (DEV_LOGIN_SECRET in Vercel), and the DB's own
// allowlist check (same one handle_new_user() already enforces) — an
// email that isn't allowlisted gets rejected even with the right
// secret. Delete this whole route (and the /auth/dev-login page) once
// LERN is no longer founder-only.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  const { email, secret } = await req.json().catch(() => ({}))
  if (!email || !secret) return NextResponse.json({ error: 'email and secret required' }, { status: 400 })

  const devSecret = process.env.DEV_LOGIN_SECRET
  if (!devSecret) return NextResponse.json({ error: 'not_configured', message: 'DEV_LOGIN_SECRET is not set in Vercel yet.' }, { status: 501 })
  if (secret !== devSecret) return NextResponse.json({ error: 'Wrong secret.' }, { status: 401 })

  const { data: allowlisted, error: allowlistError } = await supabaseAdmin.rpc('is_allowlisted_email', { p_email: email })
  if (allowlistError || !allowlisted) return NextResponse.json({ error: 'That email is not on the founder allowlist.' }, { status: 403 })

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message || 'Could not generate a sign-in link.' }, { status: 500 })
  }

  return NextResponse.json({ tokenHash: data.properties.hashed_token })
}
