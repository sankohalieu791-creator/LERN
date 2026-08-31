/**
 * One-off: creates the single public demo login (Lern12@gmail.com /
 * Lerntesterapp) that replaces the old hidden "Founder access" quick-login.
 * Safe to re-run — no-ops if the account already exists.
 *
 * Run from the `lern` directory:  node scripts/create-demo-gateway.mjs
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL = 'Lern12@gmail.com'
const PASSWORD = 'Lerntesterapp'

const { data: created, error } = await sb.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { role: 'student', full_name: 'LERN Demo' },
})

let userId = created?.user?.id

if (error) {
  if (!error.message?.toLowerCase().includes('already been registered') && error.code !== 'email_exists') {
    console.error('createUser failed:', error)
    process.exit(1)
  }
  console.log('Auth user already exists, looking it up…')
  const { data: list, error: listErr } = await sb.auth.admin.listUsers()
  if (listErr) { console.error(listErr); process.exit(1) }
  const existing = list.users.find(u => u.email?.toLowerCase() === EMAIL.toLowerCase())
  if (!existing) { console.error('Could not find existing user by email.'); process.exit(1) }
  userId = existing.id
  // Make sure the password matches what we're documenting, in case it drifted.
  await sb.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true })
}

console.log('Auth user id:', userId)

const { error: updErr } = await sb.from('users').update({ is_demo_gateway: true }).eq('id', userId)
if (updErr) { console.error('Flagging is_demo_gateway failed:', updErr); process.exit(1) }

console.log('Done. Demo gateway ready:', EMAIL)
