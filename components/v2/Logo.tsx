// The LERN wordmark: dark chip, white letters, the R in brand orange —
// matches public/icon-512.png. One shared component so every header
// (auth pages, org sidebar, mobile top bar) renders the same mark
// instead of plain dark-on-paper text.
export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5'
  const text = size === 'sm' ? 'text-[13px]' : 'text-[15px]'
  return (
    <span className={`inline-flex items-center rounded-md bg-[#141110] ${box} font-bold tracking-wide ${text}`}>
      <span className="text-white">LE</span>
      <span className="text-brand">R</span>
      <span className="text-white">N</span>
    </span>
  )
}
