'use client'

import Logo from '@/components/v2/Logo'

// Shared layout for every auth/onboarding screen: desktop/laptop-first
// (generous centered column, not a mobile card), paper/ink/orange theme.
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
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="flex-shrink-0 px-10 py-7">
        <Logo />
      </header>

      <main className="flex-1 flex items-start justify-center px-6 pb-20">
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
