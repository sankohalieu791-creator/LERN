'use client'

import Logo from '@/components/v2/Logo'

// Shared layout for every auth/onboarding screen: desktop/laptop-first
// (generous centered column, not a mobile card), paper/ink/orange theme.
// The big, faded "LERN" behind the content is the "professional, not
// bare" touch the brand needed here — brand-tinted, low-opacity, sized
// to the viewport, never competing with the actual form for attention.
export default function AuthShell({
  step, totalSteps, title, subtitle, children, wide = false,
}: {
  step?: number
  totalSteps?: number
  title: string
  subtitle?: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="relative min-h-screen bg-paper flex flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none select-none absolute inset-0 flex items-center justify-end overflow-hidden">
        <span className="text-[220px] sm:text-[320px] lg:text-[420px] font-black leading-none tracking-tighter text-brand/[0.06] -mr-10 lg:-mr-16 whitespace-nowrap">
          LERN
        </span>
      </div>

      <header className="relative flex-shrink-0 px-10 py-7">
        <Logo />
      </header>

      <main className="relative flex-1 flex items-start justify-center px-6 pb-20">
        <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'} pt-6`}>
          {step && totalSteps && (
            <div className="flex items-center gap-1.5 mb-8">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i < step ? 'bg-brand' : 'bg-[#EDE9E1]'
                  }`}
                />
              ))}
            </div>
          )}

          <h1 className="text-3xl font-bold text-ink mb-2 leading-tight">{title}</h1>
          {subtitle && <p className="text-[#6B6558] text-[15px] leading-relaxed mb-8">{subtitle}</p>}
          {!subtitle && <div className="mb-8" />}

          {children}
        </div>
      </main>
    </div>
  )
}
