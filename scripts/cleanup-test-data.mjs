import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

// Rina M. -- demo/test data on the real safeguarding session-delivery
// page. Per Michael's review: every document states LERN is a
// single-founder company, so a second "LERN adult" entry contradicts
// that on a page listing real safeguarding-relevant personnel.
const { error: rinaErr } = await sb.from('lern_delivery_adults').delete().eq('full_name', 'Rina M.')
console.log('Removed Rina M.:', rinaErr ? `FAILED: ${rinaErr.message}` : 'OK')

// Test work_items entries cluttering course/workshop lists.
const { data: deleted, error: itemsErr } = await sb.from('work_items').delete().in('title', ['lid', 'sdr', 'zxc']).select('id, title')
console.log('Removed test work_items:', itemsErr ? `FAILED: ${itemsErr.message}` : JSON.stringify(deleted))
