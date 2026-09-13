import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: rina } = await sb.from('lern_delivery_adults').select('id').eq('full_name', 'Rina M.').single()
if (!rina) { console.log('Rina M. already gone.'); process.exit(0) }

// She's demo data end to end -- her session log rows are part of the
// same fabricated scenario, not real safeguarding evidence, so they
// come out with her rather than being reassigned to someone real.
const { data: logRows, error: logErr } = await sb.from('lern_session_log').delete().eq('adult_id', rina.id).select('id, session_title')
console.log('Removed her session_log rows:', logErr ? `FAILED: ${logErr.message}` : JSON.stringify(logRows))

const { error: adultErr } = await sb.from('lern_delivery_adults').delete().eq('id', rina.id)
console.log('Removed Rina M.:', adultErr ? `FAILED: ${adultErr.message}` : 'OK')
