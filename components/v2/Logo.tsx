// The LERN wordmark: plain letters, no chip/box -- matches the real
// logo (white LE/N, the R in brand orange) sitting directly on the
// page background, not boxed. NOTE: the real mark has a custom-drawn
// diagonal R glyph that plain text genuinely can't replicate -- this
// approximates it with a coloured letter until a real SVG/image asset
// is provided to use instead.
export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const text = size === 'sm' ? 'text-[15px]' : 'text-xl'
  return (
    <span className={`inline-flex items-center font-bold tracking-tight ${text}`}>
      <span className="text-ink">LE</span>
      <span className="text-brand">R</span>
      <span className="text-ink">N</span>
    </span>
  )
}
