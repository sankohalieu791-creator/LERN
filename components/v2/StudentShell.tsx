'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import NotificationsBell from '@/components/v2/NotificationsBell'
import { useAuth } from '@/context/AuthContext'
import { Home, ClipboardList, Plus, Compass, User as UserIcon, Search } from 'lucide-react'

// theme_preference now actually drives what renders here: 'light' or
// 'dark' set data-theme explicitly; 'system' (or unset) sets nothing
// at all, which lets globals.css's own prefers-color-scheme media
// query resolve it -- no JS media-query listener needed for that case,
// the CSS cascade already does it. An explicit 'dark' choice still
// needs data-theme="dark" set literally though, not left absent --
// otherwise a device whose OS is in light mode would have the light
// media query override it despite the user's own explicit choice.
//
// Sizes here are pulled directly from the actual deleted v1
// components/BottomNav.tsx (git show a07a8c2~1), not eyeballed off a
// screenshot: 60px bar, 24px icons, 10px labels, a 46px plus button
// raised -mt-4 above the row. Guessed pixel bumps kept overshooting in
// both directions — this is ground truth, not a guess.
//
// Feed, My Work, Plus and Discover are reachable now — Profile stays
// visible (this is the real, final 5-button structure) but disabled,
// rather than linking to a page that doesn't match spec yet. Each one
// goes live as it's rebuilt, one at a time.
export default function StudentShell({ children, onPlus }: { children: React.ReactNode; onPlus?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const pref = user?.theme_preference
  const dataTheme = pref === 'light' ? 'light' : pref === 'dark' ? 'dark' : undefined
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  // The real v1 Feed page has its own header (LERN + search + bell);
  // Courses/Workshops (app/courses/page.tsx) has none at all -- its
  // tab bar sits right under the safe area. Same split here.
  const showHeader = isActive('/student/feed')

  // theme-color itself is now a real per-segment export
  // (app/student/layout.tsx's viewport), not a runtime hack here --
  // that's what actually stops the light-then-dark flash on
  // navigation. overscroll-contain below is a separate fix: <main> is
  // the actual scroll container in this fixed-shell layout (html/body
  // don't scroll), and without it, pulling past the top could still
  // trigger the browser's own native pull-to-refresh chrome, which is
  // never themed dark.
  //
  // h-[100dvh] + overflow-hidden here (not min-h-screen) is load-bearing,
  // not decorative -- min-h-screen is only a FLOOR, so if main's content
  // ever wants to be taller, the whole column (header included) grows
  // past one viewport and the real browser/PWA document takes over
  // scrolling instead of main's own overflow-y-auto. That's exactly
  // what "the header pulls down when I scroll" was: the header isn't
  // inside main at all, so it should be structurally unable to move --
  // it was only moving because this wrapper wasn't actually capped to
  // the viewport.
  //
  // dvh, not vh/h-screen: mobile Safari's 100vh is fixed to the
  // viewport's LARGEST possible size (toolbar chrome hidden), which is
  // taller than what's actually on screen while the address bar is
  // still showing. h-screen sized the shell for a viewport that isn't
  // there yet -- as you scroll and the toolbar animates away, the gap
  // between "sized for" and "actually visible" resolves itself, which
  // looks exactly like the shell pulling/settling and briefly exposing
  // whatever's behind it. 100dvh tracks the real, current viewport
  // continuously instead of the largest hypothetical one, so there's
  // no mismatch to resolve. main's own min-h-0 (below) is the other
  // half of the original fix -- a flex child defaults to min-height:
  // auto, which lets it refuse to shrink below its content's natural
  // height even with flex-1, silently defeating overflow-y-auto.
  return (
    <div data-theme={dataTheme} className="h-[100dvh] overflow-hidden bg-[var(--app-bg)] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {showHeader && (
        // Plain static position, not sticky -- header is already a
        // non-scrolling flex sibling of main (never inside the scroll
        // container it would need to "stick" within), so sticky here
        // was vestigial at best and one more thing that could misbehave
        // during scroll. Now h-screen/overflow-hidden actually caps the
        // shell, it has nothing to do.
        //
        // transform: translateZ(0) + will-change: transform force this
        // onto its own GPU compositing layer. Untouched, a plain static
        // element sitting next to a fast-scrolling sibling can get
        // recomposited a frame late during momentum scroll on iOS --
        // visually reading as "it moved" even though nothing in the DOM
        // actually repositioned it. The bottom nav is position:fixed,
        // which browsers already layer-promote automatically -- this
        // gives the header the same real isolation explicitly, since
        // static elements don't get it for free.
        <header
          className="flex-shrink-0 bg-[var(--app-bg)] border-b border-[var(--app-border)] z-20 will-change-transform"
          style={{ transform: 'translateZ(0)' }}
        >
          {/* Build Spec: Feed and My Work (student) v1.0, Part 1 --
              "LERN wordmark on the left at 20px weight 600 in #D4551A.
              On the right: a search icon and a notifications (bell)
              icon, both #5A5A5A." Only touches Feed -- this header is
              gated to isActive('/student/feed') above, nothing else
              renders it. */}
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="font-semibold text-[20px] tracking-tight" style={{ color: '#D4551A' }}>LERN</span>
            <div className="flex items-center gap-1">
              <button onClick={() => router.push('/student/search')} aria-label="Search" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--app-overlay-2)] transition" style={{ color: '#5A5A5A' }}>
                <Search className="w-5 h-5" />
              </button>
              <NotificationsBell />
            </div>
          </div>
        </header>
      )}

      {/* bg-[var(--app-bg)] here too, not just on the outer wrapper -- during
          iOS momentum/rubber-band scrolling a transparent overflow-y-auto
          element can composite straight through to whatever's behind the
          WHOLE app (body, which has no dark background of its own) rather
          than just its immediate parent. Painting main itself removes any
          chance of that white flash showing mid-scroll. */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-[var(--app-bg)]" style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}>{children}</main>

      <nav
        className="fixed bottom-0 left-0 right-0 bg-[var(--app-bg)] border-t border-[var(--app-border)] z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center h-[60px]">
          <NavItem href="/student/feed" icon={Home} label="Feed" active={isActive('/student/feed')} />
          <NavItem href="/student/work" icon={ClipboardList} label="My Work" active={isActive('/student/work')} />
          <PlusButton onClick={onPlus} />
          <NavItem href="/student/discover" icon={Compass} label="Discover" active={isActive('/student/discover')} />
          <NavItem href="/student/profile" icon={UserIcon} label="Profile" active={isActive('/student/profile')} />
        </div>
      </nav>
    </div>
  )
}

// Inactive used var(--app-text-quaternary) -- #bbbbbb in light mode,
// on an #fafafa bg that's ~1.6:1 contrast, functionally invisible
// (the "bottom nav icon needs to be black" report). #5A5A5A is the
// same pinned inactive-icon grey already used everywhere else in the
// app (search icon, My Work's inactive tab label) -- it reads clearly
// against both a black and a white bar, so it doesn't need a
// theme-conditional value at all.
function NavItem({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Link href={href} className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full" style={{ color: active ? 'var(--app-text)' : '#5A5A5A' }}>
      <Icon className="w-6 h-6" />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  )
}

// Plain "+", no box behind it, raised slightly above the row -- a
// quick press twists it into a cross (matches the old app exactly).
function PlusButton({ onClick }: { onClick?: () => void }) {
  return (
    <div className="flex-shrink-0 flex items-center justify-center w-[72px]">
      <button onClick={onClick} aria-label="New post" className="flex items-center justify-center w-[46px] h-[46px] -mt-4" style={{ color: 'var(--app-text)' }}>
        <Plus className="w-7 h-7 transition-transform duration-200 active:rotate-45" />
      </button>
    </div>
  )
}

function DisabledNavItem({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div aria-disabled className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-[#333] cursor-not-allowed">
      <Icon className="w-6 h-6" />
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  )
}
