import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// Can't actually delete her: lern_session_log's append-only trigger
// (built deliberately, to make the log trustworthy as evidence) blocks
// removing her session_log rows, which blocks the FK on deleting her
// from lern_delivery_adults in turn. Deactivating instead -- the
// roster query is being updated to only show active=true, so she
// drops off the real safeguarding page today; full removal needs
// direct DB access to lift the trigger temporarily.
const { data, error } = await sb.from('lern_delivery_adults').update({ active: false }).eq('full_name', 'Rina M.').select()
console.log(error ? `FAILED: ${error.message}` : `Deactivated: ${JSON.stringify(data)}`)
