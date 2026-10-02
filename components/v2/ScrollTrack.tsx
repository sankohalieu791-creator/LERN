'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

// A real, always-visible scrollbar drawn by the app itself, not the
// browser's native one -- built after the native-CSS approach
// (::-webkit-scrollbar styling) turned out unreliable in practice:
// modern Windows Chrome/Edge can render its own "Fluent" overlay
// scrollbar for web content that only appears on hover and ignores
// custom ::-webkit-scrollbar styling outright, so a laptop user with a
// plain mouse (not actively hovering the exact scroll edge) saw no
// scrollbar at all even though the CSS was correct. This sidesteps
// that entirely: it's a plain positioned <div>, not a pseudo-element,
// so no browser setting can hide it. Includes its own up/down arrow
// buttons at each end (a classic scrollbar's own affordance) since
// those went away along with the native scrollbar this replaces.
// Desktop (lg) only -- phone's native touch scrolling needs no visual
// affordance and this shouldn't compete with it.
const ARROW_STEP = 48
const HOLD_REPEAT_MS = 60

export default function ScrollTrack({ containerRef }: { containerRef: React.RefObject<HTMLElement> }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null)
  const dragState = useRef<{ startY: number; startScrollTop: number } | null>(null)
  const holdTimer = useRef<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    const track = trackRef.current
    if (!el || !track) return

    const measure = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      if (scrollHeight <= clientHeight + 1) { setThumb(null); return }
      const trackHeight = track.clientHeight
      const height = Math.max((clientHeight / scrollHeight) * trackHeight, 24)
      const maxTop = trackHeight - height
      const top = maxTop <= 0 ? 0 : (scrollTop / (scrollHeight - clientHeight)) * maxTop
      setThumb({ top, height })
    }

    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    ro.observe(track)
    // Content inside can change height without the container itself
    // resizing (a list growing, a panel switching) -- observe the
    // first child too, when there is one, so the thumb stays accurate.
    if (el.firstElementChild) ro.observe(el.firstElementChild)

    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [containerRef])

  const onThumbMouseDown = (e: React.MouseEvent) => {
    const el = containerRef.current
    const track = trackRef.current
    if (!el || !track) return
    e.preventDefault()
    dragState.current = { startY: e.clientY, startScrollTop: el.scrollTop }

    const onMove = (ev: MouseEvent) => {
      const el2 = containerRef.current
      if (!el2 || !dragState.current || !track) return
      const { scrollHeight, clientHeight } = el2
      const trackHeight = track.clientHeight
      const thumbHeight = Math.max((clientHeight / scrollHeight) * trackHeight, 24)
      const maxTop = trackHeight - thumbHeight
      if (maxTop <= 0) return
      const deltaY = ev.clientY - dragState.current.startY
      const scrollRange = scrollHeight - clientHeight
      el2.scrollTop = dragState.current.startScrollTop + (deltaY / maxTop) * scrollRange
    }
    const onUp = () => {
      dragState.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Click on the bare track (not the thumb) jumps a page toward the
  // click, same as a native scrollbar track click.
  const onTrackMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el || !thumb) return
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickY = e.clientY - rect.top
    const direction = clickY < thumb.top ? -1 : 1
    el.scrollTop += direction * el.clientHeight * 0.9
  }

  // Native scrollbar arrow buttons: one step per click, repeating
  // while held -- same feel as a classic Windows scrollbar's end
  // buttons, which is exactly what this is standing in for.
  const startHold = (direction: 1 | -1) => {
    const step = () => { containerRef.current?.scrollBy({ top: direction * ARROW_STEP }) }
    step()
    holdTimer.current = window.setInterval(step, HOLD_REPEAT_MS)
  }
  const stopHold = () => {
    if (holdTimer.current !== null) { window.clearInterval(holdTimer.current); holdTimer.current = null }
  }
  useEffect(() => () => stopHold(), [])

  // The track div below has to be mounted (with its ref attached) for
  // measure() to ever be able to read its height in the first place --
  // bailing out to `return null` while thumb is still null would mean
  // trackRef.current never exists, measure() always bails, thumb never
  // gets set, and the whole thing stays permanently invisible. Kept
  // always-mounted and hidden via CSS instead, so the chicken-and-egg
  // resolves on the very first measure() call.
  return (
    <div
      className="hidden lg:flex flex-col absolute top-0.5 right-0 bottom-0.5 w-3 z-10"
      style={{ visibility: thumb ? 'visible' : 'hidden' }}
    >
      <button
        aria-label="Scroll up"
        onMouseDown={e => { e.preventDefault(); startHold(-1) }}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        className="flex-shrink-0 h-3.5 flex items-center justify-center text-[var(--text-quaternary)] hover:text-[var(--text-tertiary)] transition-colors"
      >
        <ChevronUp className="w-2.5 h-2.5" />
      </button>

      <div ref={trackRef} onMouseDown={onTrackMouseDown} className="relative flex-1">
        {thumb && (
          // left-1/2 -translate-x-1/2, not a fixed right offset -- that
          // put the thumb visibly off-centre from the arrow buttons
          // above/below it (which centre via items-center/justify-
          // center), and made it grow asymmetrically on hover since a
          // right-anchored box only gets wider to the left. This stays
          // centred under the arrows regardless of width.
          <div
            onMouseDown={onThumbMouseDown}
            className="absolute left-1/2 -translate-x-1/2 w-1 rounded-full bg-[var(--border-input)] hover:bg-[var(--text-tertiary)] hover:w-1.5 cursor-pointer transition-[background-color,width]"
            style={{ top: thumb.top, height: thumb.height }}
          />
        )}
      </div>

      <button
        aria-label="Scroll down"
        onMouseDown={e => { e.preventDefault(); startHold(1) }}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        className="flex-shrink-0 h-3.5 flex items-center justify-center text-[var(--text-quaternary)] hover:text-[var(--text-tertiary)] transition-colors"
      >
        <ChevronDown className="w-2.5 h-2.5" />
      </button>
    </div>
  )
}
