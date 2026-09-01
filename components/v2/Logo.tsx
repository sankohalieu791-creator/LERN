// Plain "LERN" text. No chip, no box, no attempt at redrawing the
// custom glyph -- guessing at that kept missing without the real
// asset. Just the word, in the brand ink colour.
export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const text = size === 'sm' ? 'text-[15px]' : 'text-xl'
  return (
    <span className={`font-bold tracking-tight text-ink ${text}`}>LERN</span>
  )
}
