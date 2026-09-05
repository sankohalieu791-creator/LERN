// The real LERN wordmark, traced from the actual logo file (a
// flattened vector PDF) -- exact coordinates, not a redrawn
// approximation. The four letters use currentColor, so they pick up
// whatever text colour the parent sets (theme-aware ink, a fixed
// brand hex, white on a dark surface, etc.) -- only the diagonal
// accent in the R stays the fixed brand orange everywhere, same as
// any logo's signature accent colour never following surrounding text.
export default function Logo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg' | number; className?: string }) {
  const height = typeof size === 'number' ? size : size === 'sm' ? 15 : size === 'lg' ? 28 : 20
  // Natural aspect ratio of the traced artwork (460 x 180 viewBox).
  const width = height * (460 / 180)
  return (
    <svg
      viewBox="0 0 460 180"
      width={width}
      height={height}
      className={className}
      aria-label="LERN"
      role="img"
    >
      <path fill="currentColor" d="M82.82,137.15 L3.88,136.96 L3.49,40.59 L4.08,40.00 L19.36,40.00 L19.94,40.59 L19.94,120.89 L82.82,121.09 L82.82,137.15 Z" />
      <path fill="currentColor" d="M193.68,137.15 L110.83,136.96 L110.83,40.59 L111.42,40.00 L193.29,40.00 L193.88,40.59 L193.68,56.06 L127.08,56.06 L126.50,56.65 L126.50,79.37 L127.08,79.96 L183.10,79.96 L183.69,80.55 L183.10,96.02 L127.08,96.02 L126.50,96.61 L126.50,120.50 L127.08,121.09 L193.68,121.09 L193.68,137.15 Z" />
      <path fill="currentColor" d="M293.97,102.68 L291.23,102.68 L276.53,87.99 L293.58,87.40 L299.06,85.05 L302.00,82.50 L305.13,77.02 L305.92,70.75 L304.35,64.48 L300.63,59.59 L296.71,57.24 L291.62,56.06 L232.07,56.06 L217.77,40.20 L292.79,40.00 L301.80,41.96 L310.03,46.66 L315.71,52.73 L320.02,61.35 L321.19,67.23 L321.19,76.24 L320.41,80.55 L316.88,88.77 L311.20,95.63 L303.76,100.33 L293.97,102.68 Z" />
      <path fill="currentColor" d="M448.31,137.15 L433.82,137.15 L368.40,65.46 L367.42,66.05 L367.42,136.96 L352.53,136.96 L352.73,40.00 L367.22,40.00 L432.25,111.30 L433.23,111.10 L433.23,40.20 L447.92,40.00 L448.51,40.59 L448.31,137.15 Z" />
      <path fill="#F26B21" d="M319.43,137.15 L294.36,137.15 L243.63,87.99 L247.35,87.40 L266.94,87.79 L317.86,134.80 L319.63,136.56 L319.43,137.15 Z" />
    </svg>
  )
}
