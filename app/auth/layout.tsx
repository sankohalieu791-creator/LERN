import type { Viewport } from 'next'

// Safari paints the status bar and the bottom toolbar from theme-color.
// The root layout sets it to cream, which showed as bands above and below
// the login background. The background image's own top edge is this
// colour, so the bars now blend into the picture. The rest of the viewport
// settings are copied from the root layout, because a child layout's
// viewport replaces the root one rather than merging with it.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#E7D8D8',
  interactiveWidth: 'overlays-content',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
