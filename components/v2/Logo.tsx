// The LERN wordmark: plain letters, no chip/box, thicker weight. The R
// itself stays the same colour as the rest of the word (per the real
// mark) -- only its tail is brand orange, which plain text can't do on
// its own (one glyph, one colour), so the tail is a small separate
// diagonal mark laid over the R's lower-right corner. NOTE: this is an
// approximation of a custom-drawn glyph, not a pixel match -- send the
// real SVG/PNG export if exact fidelity matters.
export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const text = size === 'sm' ? 'text-[15px]' : 'text-xl'
  return (
    <span className={`inline-flex items-center font-black tracking-tight ${text}`}>
      <span className="text-ink">LE</span>
      <span className="relative inline-block text-ink">
        R
        <svg
          className="absolute text-brand pointer-events-none"
          style={{ left: '52%', top: '48%', width: '0.42em', height: '0.62em' }}
          viewBox="0 0 10 14" fill="currentColor" aria-hidden
        >
          <polygon points="1,0 10,0 7,14 0,14" />
        </svg>
      </span>
      <span className="text-ink">N</span>
    </span>
  )
}
