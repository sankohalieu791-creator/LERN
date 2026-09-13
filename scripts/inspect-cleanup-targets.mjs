import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: adults, error: adultsErr } = await sb.from('lern_delivery_adults').select('id, full_name, user_id')
console.log('lern_delivery_adults:', JSON.stringify(adults), adultsErr?.message || '')

const { data: items, error: itemsErr } = await sb.from('work_items').select('id, type, title, organisation_id').in('title', ['lid', 'sdr', 'zxc'])
console.log('test work_items:', JSON.stringify(items), itemsErr?.message || '')
