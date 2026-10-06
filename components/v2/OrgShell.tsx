'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useResolvedTheme } from '@/context/ThemeProvider'
import { setSidebarCollapsed, setPresenceStatus, signOut, supabase, getPendingReviewCount, getPendingInterestCount } from '@/lib/supabase'
import { useAvatarUrl } from '@/lib/useAvatarUrl'
import { ChevronLeft, ChevronRight, Settings, User as UserIcon, Plus, LogOut, Menu, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Logo from '@/components/v2/Logo'
import NotificationsBell from '@/components/v2/NotificationsBell'
import PostComposer from '@/components/v2/PostComposer'
import PresenceBadge from '@/components/v2/PresenceBadge'
import ScrollTrack from '@/components/v2/ScrollTrack'
import SettingsPanel from '@/components/v2/SettingsPanel'
import type { TabKey as SettingsTab } from '@/components/v2/SettingsPanel'

function orgInitials(name?: string | null) {
  if (!name) return 'LN'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

// "/institution" -> "Institution", "/provider" -> "Training provider",
// "/employer" -> "Employer" -- derived from sections[0].href the same
// way the Settings button already derives its own path, rather than
// threading a new prop through every layout.tsx for one label.
function roleLabelFromHref(href: string) {
  if (href.startsWith('/institution')) return 'Institution'
  if (href.startsWith('/provider')) return 'Training provider'
  if (href.startsWith('/employer')) return 'Employer'
  return ''
}

export interface NavItem { key: string; label: string; icon: LucideIcon; href: string }

// Colour + icon per status now lives in PresenceBadge.tsx (Teams-style
// -- a checkmark, clock, dash etc, not colour alone).
const PRESENCE_LABEL: Record<string, string> = {
  active: 'Active', busy: 'Busy', away: 'Away', offline: 'Offline', do_not_disturb: 'Do not disturb',
}
const PRESENCE_OPTIONS = ['active', 'busy', 'away', 'do_not_disturb', 'offline'] as const

// The shared shell for both organisation roles — collapsible sidebar on
// laptop (state remembered server-side, not just localStorage). Phone
// is a Gmail-style layout now: a hamburger opens a slide-out drawer
// (org identity, the full nav list with live badge counts, Settings
// pinned after a divider) instead of a bottom tab bar, and posting is
// a floating "+" in the bottom-right corner rather than embedded in a
// nav row -- built from a direct reference screenshot, not guessed.
export default function OrgShell({
  sections, phoneItems, children,
}: {
  sections: NavItem[]
  phoneItems: [NavItem, NavItem, NavItem] // feed, role-specific second item, dashboard — [0] is where a successful post lands
  children: React.ReactNode
}) {
  const { user, refreshUser } = useAuth()
  const theme = useResolvedTheme()
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [orgLogoPath, setOrgLogoPath] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [reviewCount, setReviewCount] = useState(0)
  const [interestCount, setInterestCount] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab | undefined>(undefined)
  const mainRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLElement>(null)

  // Keeps the same lern-theme cookie StudentShell writes in sync for
  // org accounts too -- the org layouts (institution/provider/employer)
  // are 'use client' (they need hooks like useAuth), so they can't
  // export generateViewport() themselves the way app/student/layout.tsx
  // does; a server-component wrapper around each reads this cookie
  // instead. Without it those routes were still on the root layout's
  // static, always-light viewport.themeColor regardless of the org's
  // actual dark/light toggle -- the phone's own status bar/address bar
  // colour never matched the page, on every org route, the exact same
  // "black thing" bug class already fixed for students.
  useEffect(() => {
    document.cookie = `lern-theme=${theme}; path=/; max-age=31536000; samesite=lax`
    // Body's own background is normally invisible (every real screen
    // paints its own full-bleed one over it) -- but a stray gap, like a
    // portaled dialog briefly rendering past the phone's real bottom
    // edge, exposes it. It only ever tracks the OS's prefers-color-
    // scheme, so it can flatly disagree with the theme actually on
    // screen; this keeps it honest. See globals.css for why this is a
    // separate attribute from data-theme, not the same one.
    document.documentElement.setAttribute('data-body-theme', theme)
  }, [theme])

  useEffect(() => { setCollapsed(!!user?.sidebar_collapsed) }, [user?.sidebar_collapsed])

  // Lets a deep child (e.g. Bootcamp Evidence's "Turn it on in
  // Settings" CTA) open this shell's own Settings modal without
  // prop-drilling a setter down through every intermediate component --
  // see openSettings() in SettingsPanel.tsx.
  useEffect(() => {
    const onOpenSettings = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: SettingsTab }>).detail?.tab
      setSettingsInitialTab(tab)
      setSettingsOpen(true)
    }
    window.addEventListener('lern:open-settings', onOpenSettings)
    return () => window.removeEventListener('lern:open-settings', onOpenSettings)
  }, [])

  // interactive-widget=resizes-content (see layout.tsx's own viewport)
  // asks the browser to shrink the layout viewport itself when the
  // keyboard opens, so fixed elements resize along with it -- but that
  // property is new enough that not every phone actually honours it.
  // This is the same fix with no dependency on browser support at all:
  // while any text field on the page is genuinely focused, hide the
  // fixed "+" FAB outright rather than trust it'll reposition itself
  // correctly. Real focus tracking (focusin bubbles to document) drives
  // the hide, immediate and lag-free while the keyboard animates in.
  //
  // History of getting the un-hide side of this wrong, twice: (1) tying
  // it to a field's own focusout fires well before the keyboard has
  // actually finished animating away, showing the FAB against a
  // viewport that hadn't resized back yet. (2) Gating it on
  // visualViewport reporting "height is back to near-full" sounds more
  // correct, but a browser can report several closely-spaced resize
  // events while the keyboard animates, and reacting to an early one
  // that LOOKS settled (a toolbar flicker, a rounding blip) reintroduces
  // the same bug in a subtler shape -- which is what kept happening. A
  // fixed delay has no such failure mode: it doesn't trust any one
  // signal to mean "definitely settled", it just waits comfortably past
  // how long the animation can possibly take (iOS/Android keyboard
  // dismiss is well under 300ms) before ever looking again.
  useEffect(() => {
    const isTextInput = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    let hideTimer: number | null = null
    const onFocusIn = (e: FocusEvent) => {
      if (!isTextInput(e.target)) return
      if (hideTimer !== null) { window.clearTimeout(hideTimer); hideTimer = null }
      document.body.classList.add('keyboard-open')
    }
    const onFocusOut = (e: FocusEvent) => {
      if (!isTextInput(e.target)) return
      hideTimer = window.setTimeout(() => { document.body.classList.remove('keyboard-open') }, 400)
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      if (hideTimer !== null) window.clearTimeout(hideTimer)
      document.body.classList.remove('keyboard-open')
    }
  }, [])

  // See StudentShell's identical effect for the full story: interactive-
  // widget=overlays-content isn't actually honoured by standalone
  // Home-Screen mode on a real iOS 26 device (confirmed -- a plain
  // Safari tab is fine, only the installed app leaves the FAB stuck
  // too high after the keyboard closes), so the fix can't rely on the
  // layout viewport ever being correct in that context. visualViewport
  // stays accurate regardless -- this measures the live gap between it
  // and the layout viewport's bottom edge and translates the FAB by
  // exactly that amount, correcting for a wrong measurement directly
  // instead of hoping the browser recalculates it right.
  //
  // Standalone-only, on purpose -- shipping this unscoped pushed the
  // FAB UP in an ordinary Safari tab too (a real gap this same
  // comparison sees there too, from Safari's own toolbar chrome, that
  // isn't a bug and needs no correction).
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
    if (!isStandalone) return
    const vv = window.visualViewport
    const fab = document.getElementById('org-fab')
    if (!vv || !fab) return
    const reposition = () => {
      const gap = document.documentElement.clientHeight - (vv.height + vv.offsetTop)
      fab.style.transform = gap > 1 ? `translateY(-${gap}px)` : ''
    }
    vv.addEventListener('resize', reposition)
    vv.addEventListener('scroll', reposition)
    reposition()
    return () => {
      vv.removeEventListener('resize', reposition)
      vv.removeEventListener('scroll', reposition)
      fab.style.transform = ''
    }
  }, [])
  useEffect(() => {
    if (!user?.organisation_id) return
    supabase.from('organisations').select('name, logo_path').eq('id', user.organisation_id).single()
      .then(({ data }) => { setOrgName(data?.name ?? null); setOrgLogoPath(data?.logo_path ?? null) })
  }, [user?.organisation_id])
  // Employers have no organisation row at all (only institution/
  // provider do) -- orgName stays null for them forever, which left
  // the top bar blank and the drawer showing "—" with a fallback "LN"
  // badge for the one role that actually needs its own identity shown
  // here most. Falls back to their own name in that case.
  const identityName = orgName || (!user?.organisation_id ? user?.full_name : null) || null
  // The logo uploaded in Settings' Organisation card was only ever
  // used on the student-facing course/brief/workshop cards -- it
  // needs to show up here too, wherever the org's own identity badge
  // renders (the drawer), not just in the form that set it. An
  // employer has no org logo to fall back to (no organisations row at
  // all) -- their own profile picture (Settings' Account card) is the
  // equivalent identity image for them.
  // Both hooks called unconditionally (rules of hooks), the choice
  // between their results made after -- same logic as before, just two
  // signed-URL fetches instead of two synchronous public-URL calls.
  const orgLogoUrl = useAvatarUrl(orgLogoPath)
  const myAvatarUrl = useAvatarUrl(user?.avatar_path)
  const identityLogoUrl = orgLogoPath ? orgLogoUrl : (!user?.organisation_id ? myAvatarUrl : null)

  // Badge counts are real, not decorative -- only fetched (and only
  // rendered, see NAV_BADGES below) for the sections that actually
  // have a matching count. No fabricated numbers on sections that
  // don't have one (employer's nav has neither key today).
  useEffect(() => {
    if (!user?.organisation_id) return
    if (sections.some(s => s.key === 'review')) getPendingReviewCount(user.organisation_id).then(({ count }) => setReviewCount(count))
    if (sections.some(s => s.key === 'interest')) getPendingInterestCount().then(({ count }) => setInterestCount(count))
  }, [user?.organisation_id])
  const NAV_BADGES: Record<string, number> = { review: reviewCount, interest: interestCount }

  const toggleCollapsed = async () => {
    const next = !collapsed
    setCollapsed(next)
    if (user) await setSidebarCollapsed(user.id, next)
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/auth/login')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // h-[100dvh] + overflow-hidden (not min-h-screen) — same fix as
  // StudentShell: a flex container that's only min-height means content
  // taller than the viewport grows the whole shell instead of scrolling
  // inside main, and every flex child down the chain needs min-h-0 to
  // actually respect that bound rather than refusing to shrink below
  // its own content's natural height (flexbox's default min-height:auto).
  // dvh not vh -- 100vh is fixed to mobile Safari's LARGEST viewport
  // (toolbar hidden), taller than what's visible while the address bar
  // is still showing, so h-screen looked right on desktop but caused
  // exactly the same "pulls down as you scroll" mismatch on phone.
  return (
    // paddingTop AND paddingBottom: env(safe-area-inset-*) -- top was
    // missing entirely before ("the top nav is so high"). Bottom was
    // missing too: with the old bottom tab bar gone (replaced by the
    // drawer), there was nothing left painting that bottom safe-area
    // strip in the shell's own bg-paper, so on a phone with a home
    // indicator it could show body's own hardcoded dark background
    // through the gap ("since there's no bottom nav there's a black
    // thing under"). box-sizing:border-box (global reset) means this
    // padding eats into the existing h-[100dvh] box rather than adding
    // to it, so it can't push the shell taller than the real viewport.
    <div data-theme={theme} className="h-[100dvh] overflow-hidden bg-paper flex org-safe-bottom" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* ── Laptop sidebar ── */}
      <aside className={`hidden lg:flex flex-col border-r border-edge-subtle bg-surface transition-[width] duration-150 flex-shrink-0 ${collapsed ? 'w-[72px]' : 'w-60'}`}>
        <div className={`flex items-center h-16 px-4 flex-shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {/* Plain wordmark, not the chip — matches the student feed's
              top-left header treatment exactly, per explicit request. */}
          {!collapsed && <span className="text-ink"><Logo size="md" /></span>}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-secondary transition flex-shrink-0"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        {/* relative wrapper + ScrollTrack, not a plain flex-1 -- this
            list grew to 11 rows once Settings joined it, tall enough to
            run past the bottom of a shorter laptop screen with no
            native overflow at all (not even an invisible one), which
            left Dashboard/Settings permanently unreachable there. Same
            fix as <main>'s own scroll area just above. */}
        <div className="relative flex-1 min-h-0">
        <nav ref={navRef} className="h-full overflow-y-auto px-3 space-y-1">
          {sections.map(s => (
            <Link
              key={s.key} href={s.href}
              title={collapsed ? s.label : undefined}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-semibold transition ${
                isActive(s.href) ? 'bg-accent-bg text-ink' : 'text-ink-secondary hover:bg-surface-muted'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <s.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="truncate">{s.label}</span>}
            </Link>
          ))}
          {/* Settings is a modal, not a route (see SettingsPanel.tsx) --
              a button here, not a Link, but styled and positioned
              identically to every real nav item above it, right under
              Dashboard per direct request. This is now the only way
              into it from the sidebar -- the top bar's gear icon was
              removed once this existed, so there's no second path to
              keep in sync any more. */}
          <button
            onClick={() => setSettingsOpen(true)}
            title={collapsed ? 'Settings' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-semibold transition text-ink-secondary hover:bg-surface-muted ${collapsed ? 'justify-center' : ''}`}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="truncate">Settings</span>}
          </button>
        </nav>
        <ScrollTrack containerRef={navRef} />
        </div>
      </aside>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {/* ── Top bar ── phone gets a hamburger (opens the drawer) before
            the wordmark, and the same Settings gear laptop has, next
            to the bell -- it used to be drawer-only on phone, which is
            what the drawer's own trailing Settings row was for; that
            row is gone now this is the one path to Settings everywhere. */}
        <header className="flex items-center justify-between h-16 px-5 lg:px-8 border-b border-edge-subtle flex-shrink-0">
          <div className="flex items-center gap-1 lg:hidden">
            <button
              onClick={() => setDrawerOpen(true)} aria-label="Open menu"
              className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-secondary transition flex-shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* No colour wrapper here before -- currentColor had
                nothing to inherit but the browser's plain black
                default, invisible against a dark-mode header. The
                laptop sidebar's own wordmark right above already gets
                text-ink; this one just never did. */}
            {/* md, not sm -- StudentShell's own phone header already
                uses md; this one was noticeably smaller for no reason. */}
            <span className="text-ink"><Logo size="md" /></span>
          </div>
          <div className="hidden lg:flex items-center gap-2 min-w-0">
            {identityLogoUrl && <img src={identityLogoUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />}
            <span className="text-[14px] font-semibold text-ink-secondary truncate">{identityName}</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <div className="relative flex items-center gap-1.5">
              {/* Colour alone ("just green") isn't a status -- the dot
                  on the avatar below stays as a compact always-there
                  indicator, but the actual word only fits without
                  crowding the header on wider screens (same lg-only
                  allowance identityName above already gets). Text only
                  here, no second badge -- the avatar's own dot below is
                  the one status indicator, this was showing it twice. */}
              <span className="hidden lg:flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-tertiary">
                {PRESENCE_LABEL[user?.presence_status || 'active']}
              </span>
              <button
                onClick={() => setProfileOpen(v => !v)}
                aria-label={`Profile menu — status: ${PRESENCE_LABEL[user?.presence_status || 'active']}`}
                title={`Status: ${PRESENCE_LABEL[user?.presence_status || 'active']}`}
                className="relative w-10 h-10 flex items-center justify-center rounded-full bg-accent-bg text-brand font-bold text-[14px] ml-1"
              >
                {/* overflow-hidden used to live on the button itself, which
                    clipped the presence dot below -- invisible with a plain
                    initial (nothing there to clip against), but the moment
                    a real photo filled the whole circle it clipped the dot
                    's corner right along with it. Moved onto this inner
                    span so only the avatar content clips, not the dot
                    sitting outside it. */}
                <span className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center">
                  {myAvatarUrl ? (
                    <img src={myAvatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user?.full_name?.[0]?.toUpperCase() || <UserIcon className="w-[18px] h-[18px]" />
                  )}
                </span>
                <PresenceBadge status={user?.presence_status} size={15} className="absolute -bottom-0.5 -right-0.5 border-2 border-surface" />
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-11 bg-surface border border-edge rounded-xl shadow-lg py-1.5 w-52 z-20">
                    <div className="px-3.5 py-2 border-b border-edge-subtle">
                      <p className="text-[13px] font-semibold text-ink truncate">{user?.full_name}</p>
                      <p className="text-[12px] text-ink-tertiary truncate">{user?.email}</p>
                    </div>
                    <div className="px-3.5 py-2.5 border-b border-edge-subtle">
                      <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mb-1.5">Status</p>
                      <div className="grid grid-cols-2 gap-1">
                        {PRESENCE_OPTIONS.map(s => (
                          <button
                            key={s}
                            onClick={async () => { if (user) { await setPresenceStatus(user.id, s); await refreshUser() } }}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11.5px] font-semibold transition ${
                              (user?.presence_status || 'active') === s ? 'bg-surface-muted text-ink' : 'text-ink-tertiary hover:bg-surface-muted'
                            }`}
                          >
                            <PresenceBadge status={s} size={12} ringColor="var(--surface)" /> <span className="truncate">{PRESENCE_LABEL[s]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] text-ink-secondary hover:bg-surface-muted transition">
                      <LogOut className="w-3.5 h-3.5" /> Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Feed is built edge-to-edge (Instagram-style cards, full-bleed
            media) the same way for every role -- it's the exact same
            FeedPanel component the student app renders. Every other org
            page assumes the standard px-5/py-7 breathing room this <main>
            has always given it, so the padding is dropped only for the
            Feed route rather than globally, which would strip margins
            from Dashboard/Review/Students/Settings etc. too. */}
        {/* tabIndex so a keyboard-only user can Tab straight into this
            scrollable region -- otherwise arrow keys/Page Down/Space have
            no focused scrollable element to act on. relative wrapper +
            ScrollTrack: see that component for why this isn't just
            ::-webkit-scrollbar CSS. */}
        <div className="relative flex-1 min-h-0">
          <main ref={mainRef} tabIndex={0} className={`h-full overflow-y-auto bg-paper ${pathname.endsWith('/feed') ? '' : 'px-5 lg:px-10 py-7 pb-8'}`}>
            {children}
          </main>
          <ScrollTrack containerRef={mainRef} />
        </div>
      </div>

      {/* ── Phone floating "+" -- Gmail-style: bottom-right, elevated
          above content rather than reserving a row for it in a bottom
          bar (there is no bottom bar any more; navigation moved into
          the drawer). Opens the post composer directly now, same as
          the student app's own "+" -- it used to just navigate to
          Feed and leave posting to a control on that page, which
          wasn't actually "to post", just "to the place you post from".
          safe-area-inset-bottom so it never sits under a phone's own
          home-indicator/gesture bar. ── */}
      {/* Feed only -- posting from Review, Interest received etc. made
          no sense there; this was showing on every org page with no
          condition on it at all. */}
      {pathname === phoneItems[0].href && (
        // Plain and simple, not an orange fill -- same weight as the
        // student app's own "+" (a bare icon, theme-coloured, no brand
        // fill), just floating rather than docked in a tab bar since
        // this shell doesn't have one. Sits closer to the true bottom
        // edge now too, not floating noticeably above it.
        <button
          id="org-fab"
          onClick={() => setComposerOpen(true)}
          aria-label="New post"
          className="lg:hidden fixed right-5 z-20 w-12 h-12 rounded-full bg-surface border border-edge text-ink shadow-lg flex items-center justify-center active:scale-95 transition"
          style={{ bottom: 'calc(0.5rem + env(safe-area-inset-bottom))', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {settingsOpen && <SettingsPanel initialTab={settingsInitialTab} onClose={() => { setSettingsOpen(false); setSettingsInitialTab(undefined) }} />}

      {composerOpen && (
        <PostComposer
          onClose={() => setComposerOpen(false)}
          onPosted={() => {
            setComposerOpen(false)
            // FeedPanel fetches client-side, once on mount -- router.
            // refresh() only re-runs server components, so it wouldn't
            // actually pick up the new post here. The old
            // window.location.reload() did, but by re-downloading and
            // re-booting the whole app (the logo/splash flash the
            // reload bug report describes). This event asks FeedPanel
            // to refetch directly, no reload needed either way.
            if (pathname === phoneItems[0].href) window.dispatchEvent(new Event('lern:feed-refresh'))
            else router.push(phoneItems[0].href)
          }}
        />
      )}

      {/* ── Phone nav drawer -- Gmail-style: org identity card, the
          full section list (live badge counts, active item highlighted),
          plus its own Settings row at the bottom (see below) since the
          top bar's gear icon is gone now that the sidebar/drawer both
          open it directly. Replaces the old bottom tab bar entirely;
          direct 1:1 with the reference screenshot. ── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          {/* bg-surface-muted, not bg-surface -- in dark mode --surface
              is a near-black #1D1917, which read as flat/stark next to
              a real mail app's drawer (a mid grey, not black). The muted
              token is a shade lighter and still theme-correct in light
              mode, rather than hardcoding a grey that would look wrong
              there. */}
          <div
            className="relative w-[82%] max-w-[320px] h-full bg-surface-muted flex flex-col overflow-y-auto"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-1 flex-shrink-0">
              <span className="text-brand"><Logo size="md" /></span>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-secondary transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0">
              {/* rounded-full, not rounded-2xl -- every other avatar in
                  the app (profile, feed, students roster, review queue)
                  is a circle; a squared badge here was the exact
                  inconsistency flagged before on Profile. */}
              {identityLogoUrl ? (
                <img src={identityLogoUrl} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
              ) : (
                <span className="w-12 h-12 rounded-full bg-accent-bg text-brand font-bold text-[15px] flex items-center justify-center flex-shrink-0">
                  {orgInitials(identityName)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[16px] font-bold text-ink truncate">{identityName || '—'}</p>
                <p className="text-[13px] text-ink-tertiary">{roleLabelFromHref(sections[0]?.href || '')}</p>
              </div>
            </div>
            <div className="border-t border-edge-subtle flex-shrink-0" />

            {/* Gmail-density pass, round two -- the first pass (14.5px
                text, 19px icons, py-2.5) undershot; "Gmail size" means a
                real medium row, not the smallest one that still fits.
                Settled between that and the original 16px/22px/py-3.5
                tap-target sizing. Active row keeps the neutral surface
                tint (not brand-orange) from the first pass -- that part
                landed right. */}
            <nav className="flex-1 px-3 py-2 space-y-1">
              {sections.map(s => {
                const active = isActive(s.href)
                const badge = NAV_BADGES[s.key]
                return (
                  <Link
                    key={s.key} href={s.href} onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-[15px] transition ${
                      // bg-surface, a shade DARKER than this drawer's own
                      // bg-surface-muted -- the two used to be the same
                      // token (bg-accent-bg on bg-surface), which worked
                      // because accent-bg was a distinct orange; now that
                      // the drawer itself is the lighter muted tone, the
                      // active pill needs the darker one for contrast,
                      // not the same one it'd otherwise disappear into.
                      active ? 'bg-surface text-ink font-bold' : 'text-ink-secondary font-medium'
                    }`}
                  >
                    <s.icon className="w-[21px] h-[21px] flex-shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{s.label}</span>
                    {!!badge && (
                      <span className="flex-shrink-0 min-w-[21px] text-center text-[11px] font-bold text-white bg-brand rounded-full px-[6px] py-[1.5px]">
                        {badge}
                      </span>
                    )}
                  </Link>
                )
              })}
              {/* Same modal, not a route -- see the laptop sidebar's
                  identical addition above for why this is a button. */}
              <button
                onClick={() => { setDrawerOpen(false); setSettingsOpen(true) }}
                className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-[15px] font-medium transition text-ink-secondary"
              >
                <Settings className="w-[21px] h-[21px] flex-shrink-0" />
                <span className="flex-1 min-w-0 truncate text-left">Settings</span>
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
