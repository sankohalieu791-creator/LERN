import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = {}
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach(line => {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m) env[m[1]] = m[2]
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// One-off: already run to create the ops login. Password isn't
// hardcoded here on purpose -- it's a real access-control credential,
// not a demo one -- pass it via env if this ever needs to run again
// (e.g. to reset it): OPS_ADMIN_PASSWORD=... node scripts/create-ops-admin.mjs
const EMAIL = 'isLern@opstool.co.uk'
const PASSWORD = process.env.OPS_ADMIN_PASSWORD
if (!PASSWORD) { console.error('Set OPS_ADMIN_PASSWORD in the environment before running this.'); process.exit(1) }

const { data: existing } = await supabase.from('users').select('id, role').ilike('email', EMAIL).maybeSingle()
if (existing) {
  console.log('Already exists:', existing)
  if (existing.role !== 'ops_admin') {
    const { error } = await supabase.from('users').update({ role: 'ops_admin', consented_at: new Date().toISOString() }).eq('id', existing.id)
    console.log('Updated role to ops_admin:', error || 'ok')
  }
  process.exit(0)
}

const { data, error } = await supabase.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { role: 'ops_admin', full_name: 'LERN Ops' },
})
if (error) { console.error('createUser error:', error); process.exit(1) }
console.log('Created auth user:', data.user.id)

// handle_new_user() already inserted the public.users row via the
// trigger -- just make sure consented_at is set so it never looks
// like an incomplete signup.
const { error: updateError } = await supabase.from('users')
  .update({ consented_at: new Date().toISOString() })
  .eq('id', data.user.id)
console.log('consented_at set:', updateError || 'ok')

const { data: row } = await supabase.from('users').select('*').eq('id', data.user.id).single()
console.log('Final row:', row)
