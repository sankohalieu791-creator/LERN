'use client'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body style={{ background: '#FFFDF9', color: '#1A1A1A', fontFamily: 'monospace', padding: '2rem' }}>
        <h2 style={{ color: '#F26B21' }}>Something went wrong</h2>
        <pre style={{ color: '#6B6558', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{error.message}</pre>
        <button onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#F26B21', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  )
}
