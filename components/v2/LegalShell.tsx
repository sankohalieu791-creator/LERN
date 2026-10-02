'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, List } from 'lucide-react'
import Logo from '@/components/v2/Logo'

// Reachable from Settings (opened in a new tab -- see SettingsPanel's
// LinkRow) and from sign-up without being logged in -- no RoleGate, no
// shell chrome tied to a role.
//
// Rebuilt 2 Oct 2026 with a sticky section nav down the left on wider
// screens -- a proper reference-document shell, closer to how a real
// policy/help page reads, instead of one long unbroken scroll with
// nothing marking where you are in it. The nav is built by scanning
// this page's own rendered <h2> headings after mount rather than a
// second hardcoded list per page -- the two could never drift apart,
// and a new section just needs an <h2>, nothing else. A short
// document (cookies, guest-terms -- two or three headings) hides the
// nav outright rather than showing a sidebar barely worth scrolling.
const MIN_SECTIONS_FOR_NAV = 3

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter()
  const contentRef = useRef<HTMLDivElement>(null)
  const [sections, setSections] = useState<{ id: string; text: string }[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    const headings = Array.from(root.querySelectorAll('h2'))
    const found = headings.map(h => {
      const text = h.textContent || ''
      const id = slugify(text)
      h.id = id
      return { id, text }
    })
    setSections(found)
    if (found.length) setActiveId(found[0].id)

    // Highlights whichever section is currently in view as you scroll
    // -- a plain static list can't show where you actually are.
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-10% 0px -70% 0px' }
    )
    headings.forEach(h => observer.observe(h))
    return () => observer.disconnect()
  }, [])

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setNavOpen(false)
  }

  const showNav = sections.length >= MIN_SECTIONS_FOR_NAV

  return (
    <div className="min-h-screen bg-paper" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="flex items-center justify-between px-6 lg:px-10 py-6 border-b border-edge-subtle">
        {/* router.back() -- not a hardcoded href="/". That sent a
            logged-in student who tapped this from Settings out to the
            marketing root, which then redirects them back into the
            app but drops them at Feed, not wherever they actually
            came from. Real browser history returns them to the exact
            screen they left; opened in a fresh tab from Settings,
            there's simply nowhere to go and the button is a no-op. */}
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-secondary hover:text-ink transition">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-ink-tertiary"><Logo size="sm" /></span>
      </header>

      <div className="max-w-5xl mx-auto px-6 pb-20 lg:flex lg:gap-12">
        {showNav && (
          <>
            {/* Laptop: a sticky sidebar list. */}
            <nav className="hidden lg:block w-56 flex-shrink-0 pt-10">
              <div className="sticky top-10">
                <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-3">On this page</p>
                <ul className="space-y-0.5">
                  {sections.map(s => (
                    <li key={s.id}>
                      <button
                        onClick={() => jumpTo(s.id)}
                        className={`block w-full text-left text-[13px] leading-snug py-1.5 pl-3 border-l-2 transition ${
                          activeId === s.id ? 'border-brand text-brand font-semibold' : 'border-edge-subtle text-ink-tertiary hover:text-ink hover:border-edge-input'
                        }`}
                      >
                        {s.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>

            {/* Phone/tablet: a collapsible jump menu above the content,
                same section list, no sidebar space to spare. */}
            <div className="lg:hidden pt-4 mb-2">
              <button
                onClick={() => setNavOpen(v => !v)}
                className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-secondary bg-surface border border-edge rounded-lg px-3 py-2"
              >
                <List className="w-3.5 h-3.5" /> On this page
              </button>
              {navOpen && (
                <div className="mt-2 bg-surface border border-edge rounded-xl divide-y divide-edge-subtle overflow-hidden">
                  {sections.map(s => (
                    <button key={s.id} onClick={() => jumpTo(s.id)} className="block w-full text-left text-[13px] text-ink px-3.5 py-2.5 hover:bg-surface-muted transition">
                      {s.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <main className="flex-1 min-w-0 pt-10">
          <h1 className="text-2xl font-bold text-ink mb-6">{title}</h1>
          <div
            ref={contentRef}
            className="space-y-4 text-[14px] text-ink-body leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_h2]:scroll-mt-10"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
