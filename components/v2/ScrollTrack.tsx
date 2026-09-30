'use client'

import { useEffect, useRef, useState } from 'react'

// A real, always-visible scrollbar drawn by the app itself, not the
// browser's native one -- built after the native-CSS approach
// (::-webkit-scrollbar styling) turned out unreliable in practice:
// modern Windows Chrome/Edge can render its own "Fluent" overlay
// scrollbar for web content that only appears on hover and ignores
// custom ::-webkit-scrollbar styling outright, so a laptop user with a
// plain mouse (not actively hovering the exact scroll edge) saw no
// scrollbar at all even though the CSS was correct. This sidesteps
// that entirely: it's a plain positioned <div>, not a pseudo-element,
// so no browser setting can hide it. Desktop (lg) only -- phone's
// native touch scrolling needs no visual affordance and this shouldn't
// compete with it.
export default function ScrollTrack({ containerRef }: { containerRef: React.RefObject<HTMLElement> }) {
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null)
  const dragState = useRef<{ startY: number; startScrollTop: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      if (scrollHeight <= clientHeight + 1) { setThumb(null); return }
      const trackHeight = clientHeight
      const height = Math.max((clientHeight / scrollHeight) * trackHeight, 28)
      const maxTop = trackHeight - height
      const top = maxTop <= 0 ? 0 : (scrollTop / (scrollHeight - clientHeight)) * maxTop
      setThumb({ top, height })
    }

    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
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
    if (!el) return
    e.preventDefault()
    dragState.current = { startY: e.clientY, startScrollTop: el.scrollTop }

    const onMove = (ev: MouseEvent) => {
      const el2 = containerRef.current
      if (!el2 || !dragState.current) return
      const { scrollHeight, clientHeight } = el2
      const trackHeight = clientHeight
      const thumbHeight = Math.max((clientHeight / scrollHeight) * trackHeight, 28)
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

  if (!thumb) return null

  return (
    <div
      onMouseDown={onTrackMouseDown}
      className="hidden lg:block absolute top-0 right-0 bottom-0 w-2.5 z-10"
    >
      <div
        onMouseDown={onThumbMouseDown}
        className="absolute right-0 w-2.5 rounded-full bg-[var(--border-input)] hover:bg-[var(--text-tertiary)] cursor-pointer transition-colors"
        style={{ top: thumb.top, height: thumb.height }}
      />
    </div>
  )
}
