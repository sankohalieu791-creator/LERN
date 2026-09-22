// Shared branded wrapper for every transactional email this app sends
// via Resend (see app/api/notify/route.ts and app/api/ops-invite-notify
// /route.ts). Table-based layout with everything inlined -- the only
// markup that survives Gmail/Outlook's own HTML stripping reliably.
// Not used for Supabase Auth's own emails (signup confirmation, magic
// link, password reset) -- those are templated separately in the
// Supabase dashboard, outside this codebase.
const LOGO_URL = 'https://lernapp.uk/logo-email.png'

export function renderEmailHtml({
  heading, paragraphs, ctaLabel, ctaUrl,
}: {
  heading: string
  paragraphs: string[]
  ctaLabel?: string
  ctaUrl?: string
}): string {
  const paragraphHtml = paragraphs.map(p => `<p style="margin:0 0 16px 0; font-size:15px; line-height:1.6; color:#4A453B;">${p}</p>`).join('')
  const ctaHtml = ctaUrl ? `
    <tr>
      <td style="padding: 8px 32px 32px 32px;">
        <a href="${ctaUrl}" style="display:inline-block; background-color:#F26B21; color:#ffffff; text-decoration:none; font-weight:600; font-size:15px; padding:12px 26px; border-radius:10px;">${ctaLabel}</a>
        <p style="margin:18px 0 0 0; font-size:12.5px; color:#8A8373; line-height:1.5;">
          Or copy and paste this link into your browser:<br>
          <a href="${ctaUrl}" style="color:#F26B21; word-break:break-all;">${ctaUrl}</a>
        </p>
      </td>
    </tr>` : ''

  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#FBF3E9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FBF3E9; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px; background-color:#ffffff; border-radius:16px; border:1px solid #E2DDD1;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:32px 32px 4px 32px;">
                <img src="${LOGO_URL}" alt="LERN" height="26" style="display:block;">
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 4px 32px;">
                <h1 style="margin:0 0 16px 0; font-size:20px; line-height:1.35; color:#1A1613;">${heading}</h1>
                ${paragraphHtml}
              </td>
            </tr>
            ${ctaHtml}
          </table>
          <table role="presentation" width="100%" style="max-width:480px;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:24px 8px; text-align:center;">
                <p style="margin:0; font-size:12px; color:#8A8373; line-height:1.7;">
                  LERN &middot; Greater London, Brent<br>
                  <a href="https://lernapp.uk/legal/privacy" style="color:#8A8373;">Privacy</a>
                  &nbsp;&middot;&nbsp;
                  <a href="https://lernapp.uk/legal/terms" style="color:#8A8373;">Terms</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
