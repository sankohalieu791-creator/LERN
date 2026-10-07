/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security audit, 7 Oct 2026: Next.js 14.2.29 (the version this app
  // runs) carries two CRITICAL, unauthenticated RCE advisories.
  // GHSA-p293-qw3h-jr36 is specific to Windows-hosted servers -- this
  // app deploys on Vercel, which doesn't run on Windows, so it isn't
  // reachable here. GHSA-2xp9-vwfh-vxw4 is in the built-in Image
  // Optimization API, which Next.js registers by default whether or
  // not the app's own code ever calls next/image -- and this app
  // doesn't (confirmed: zero uses, every image is a plain <img>).
  // Disabling it outright closes that attack surface completely, with
  // nothing to break. Neither CVE is actually fixed until Next.js
  // 15.5.24+ or 16.x, a major-version upgrade real enough to need its
  // own testing pass -- not something to do blind in a security sweep.
  images: { unoptimized: true },
  // Security audit, 7 Oct 2026: no security headers were set at all.
  // These five are the safe, low-risk ones that essentially never break
  // a working app, since none of them restrict what the page itself can
  // load or run -- they only restrict how OTHER sites can embed or read
  // this one.
  //
  // Deliberately NOT included: a Content-Security-Policy. This app loads
  // Stripe.js, Supabase (including realtime websockets), Google Sign-In,
  // Agora's video SDK, Vercel Analytics and Resend-sent email images --
  // a CSP strict enough to matter has to allow all of those by exact
  // origin, and getting even one wrong fails silently (a blocked script
  // or socket, not an error anyone notices immediately) in ways that
  // couldn't be reliably tested end-to-end here. Worth adding once each
  // of those origins can be checked against a real, running copy of the
  // app rather than guessed at.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Replaces the old X-Frame-Options: DENY -- stops any other
          // site embedding this one in an iframe (clickjacking).
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          // Stops the browser guessing a file's type from its content
          // instead of trusting the server's Content-Type.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Only sends the origin, not the full URL (which can carry
          // tokens or ids in the path), to other sites a link is followed to.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Blocks camera/mic/location/USB for every origin except this
          // one -- workshops use the camera and mic deliberately, so
          // those two stay allowed for self, everything else is denied.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), usb=()' },
          // Tells browsers to only ever reach this site over HTTPS for
          // the next year, including subdomains.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
