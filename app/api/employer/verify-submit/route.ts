import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Build Spec: Employer Vetting Gate v1.0 -- the two AUTOMATIC checks
// ("run immediately on sign-up... before any human sees it, so an
// obviously invalid sign-up is flagged instantly"). Needs a server
// route rather than a Postgres RPC because check 1 is a real HTTP call
// to the Companies House API, which a plain SQL function can't do
// synchronously. Uses the service role to write the results since this
// runs the instant the applicant submits, before an admin is involved.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const CH_API_KEY = process.env.COMPANIES_HOUSE_API_KEY

// Named in the spec, "or similar" -- the point is a genuine business
// signs up on its own domain, not a free consumer inbox.
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk',
  'live.com', 'live.co.uk', 'msn.com', 'yahoo.com', 'yahoo.co.uk', 'icloud.com',
  'me.com', 'aol.com', 'protonmail.com', 'proton.me', 'mail.com', 'gmx.com',
])

function domainFrom(value: string): string {
  return value.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#]/)[0]
    .split(':')[0]
}

function checkEmailDomain(email: string, website: string): { result: 'pass' | 'fail' } {
  const emailDomain = domainFrom(email.split('@')[1] || '')
  const siteDomain = domainFrom(website)
  if (!emailDomain || PERSONAL_EMAIL_DOMAINS.has(emailDomain)) return { result: 'fail' }
  if (!siteDomain) return { result: 'fail' }
  const matches = emailDomain === siteDomain || emailDomain.endsWith(`.${siteDomain}`) || siteDomain.endsWith(`.${emailDomain}`)
  return { result: matches ? 'pass' : 'fail' }
}

async function checkCompaniesHouse(companyNumber: string): Promise<{ result: 'pass' | 'fail' | 'not_configured'; detail: string; officers: string[] }> {
  if (!CH_API_KEY) return { result: 'not_configured', detail: 'Companies House API key not configured — check cannot run automatically.', officers: [] }
  if (!companyNumber) return { result: 'fail', detail: 'No Companies House number provided.', officers: [] }

  const auth = 'Basic ' + Buffer.from(`${CH_API_KEY}:`).toString('base64')
  try {
    const companyRes = await fetch(`https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}`, {
      headers: { Authorization: auth },
    })
    if (companyRes.status === 404) return { result: 'fail', detail: 'No company found with that number.', officers: [] }
    if (!companyRes.ok) return { result: 'fail', detail: `Companies House lookup failed (${companyRes.status}).`, officers: [] }
    const company = await companyRes.json()
    const status = company.company_status as string
    const active = status === 'active'

    let officers: string[] = []
    try {
      const officersRes = await fetch(`https://api.company-information.service.gov.uk/company/${encodeURIComponent(companyNumber)}/officers`, {
        headers: { Authorization: auth },
      })
      if (officersRes.ok) {
        const officersBody = await officersRes.json()
        officers = ((officersBody.items || []) as any[])
          .filter(o => !o.resigned_on)
          .map(o => o.name as string)
      }
    } catch {}

    return {
      result: active ? 'pass' : 'fail',
      detail: active ? `Active — ${company.company_name}` : `Company status is "${status}", not active — ${company.company_name}`,
      officers,
    }
  } catch (err) {
    return { result: 'fail', detail: 'Could not reach Companies House — try again.', officers: [] }
  }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(accessToken)
  if (callerError || !callerData?.user) return NextResponse.json({ error: 'Session expired — sign in again.' }, { status: 401 })

  const { companyNumber, website } = await req.json().catch(() => ({}))
  if (!website?.trim()) return NextResponse.json({ error: 'Company website is required.' }, { status: 400 })

  const { data: profile } = await supabaseAdmin
    .from('users').select('id, role, email').eq('id', callerData.user.id).single()
  if (!profile || profile.role !== 'employer') return NextResponse.json({ error: 'This account is not an employer.' }, { status: 403 })

  const emailCheck = checkEmailDomain(profile.email, website.trim())
  const chCheck = await checkCompaniesHouse((companyNumber || '').trim())

  const { error: updateError } = await supabaseAdmin.from('users').update({
    employer_company_number: companyNumber?.trim() || null,
    employer_website: website.trim(),
    employer_verification_requested_at: new Date().toISOString(),
    employer_verification_status: 'pending',
    employer_rejected_reason: null,
    employer_more_info_message: null,
    employer_check_email_domain: emailCheck.result,
    employer_check_ch: chCheck.result,
    employer_check_ch_detail: chCheck.detail,
    employer_ch_officers: chCheck.officers,
    employer_check_website_confirmed: false,
    employer_check_officer_confirmed: false,
  }).eq('id', profile.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
