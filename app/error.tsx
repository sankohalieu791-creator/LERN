'use client'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body style={{ background: '#0f0f0f', color: 'white', fontFamily: 'monospace', padding: '2rem' }}>
        <h2 style={{ color: '#FF6B2B' }}>Something went wrong</h2>
        <pre style={{ color: '#aaa', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{error.message}</pre>
        <button onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#FF6B2B', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  )
}
