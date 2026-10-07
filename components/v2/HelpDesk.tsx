'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Send } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useResolvedTheme } from '@/context/ThemeProvider'
import { searchHelp, starterTopics } from '@/lib/helpDeskSearch'
import type { HelpRole } from '@/lib/helpDeskContent'

type Msg = { id: number; from: 'me' | 'desk'; text: string; thinking?: boolean }

const FALLBACK = "I don't have a clear answer for that yet — try rephrasing, or pick one of the topics below."

// The orb's two dashes, standing in for an "ask an AI" icon without
// actually being one -- see the knowledge base comment in
// lib/helpDeskContent.ts for why that distinction is the whole point.
function OrbFace({ size = 8 }: { size?: number }) {
  return (
    <span className="flex items-center" style={{ gap: Math.max(2, size * 0.3) }}>
      <span className="rounded-full" style={{ width: Math.max(2, size * 0.3), height: size, backgroundColor: '#2b2622' }} />
      <span className="rounded-full" style={{ width: Math.max(2, size * 0.3), height: size, backgroundColor: '#2b2622' }} />
    </span>
  )
}

// Staff-facing only (institution, provider, employer) -- built for "a
// teacher who isn't familiar with the technology" to ask a plain
// question and get a straight answer. A floating glass orb that opens
// into a draggable card (not a full-screen sheet) so it never has to
// fully block whatever page it was opened over -- see
// lib/helpDeskContent.ts for why it still isn't an AI despite looking
// and feeling like a chat.
export default function HelpDesk() {
  const { user } = useAuth()
  const theme = useResolvedTheme()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(0)
  const baseRectRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null)
  const draggingRef = useRef(false)
  const pointerOriginRef = useRef({ x: 0, y: 0 })
  const dragOriginRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  // Captures the panel's un-dragged position once it opens, so drag
  // moves can be clamped to the viewport without the panel ever being
  // draggable fully off-screen.
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => {
        if (panelRef.current) {
          const r = panelRef.current.getBoundingClientRect()
          baseRectRef.current = { left: r.left - drag.x, top: r.top - drag.y, width: r.width, height: r.height }
        }
      })
      return () => cancelAnimationFrame(raf)
    }
    baseRectRef.current = null
    setDrag({ x: 0, y: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onDragStart = (e: React.PointerEvent) => {
    draggingRef.current = true
    dragOriginRef.current = { ...drag }
    pointerOriginRef.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onDragMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    let nx = dragOriginRef.current.x + (e.clientX - pointerOriginRef.current.x)
    let ny = dragOriginRef.current.y + (e.clientY - pointerOriginRef.current.y)
    const base = baseRectRef.current
    if (base) {
      const margin = 10
      nx = Math.min(Math.max(nx, margin - base.left), window.innerWidth - margin - base.width - base.left)
      ny = Math.min(Math.max(ny, margin - base.top), window.innerHeight - margin - base.height - base.top)
    }
    setDrag({ x: nx, y: ny })
  }
  const onDragEnd = () => { draggingRef.current = false }

  const role = user?.role as HelpRole | undefined
  const isStaff = role === 'institution_staff' || role === 'provider_staff' || role === 'employer'
  if (!isStaff) return null
  const safeRole = role as HelpRole

  const ask = (q: string) => {
    if (!q.trim()) return
    const results = searchHelp(q, safeRole)
    const answer = results[0]?.answer ?? FALLBACK
    const userId = ++idRef.current
    const deskId = ++idRef.current
    setMessages(m => [...m, { id: userId, from: 'me', text: q }, { id: deskId, from: 'desk', text: '', thinking: true }])
    setInput('')
    // A brief, randomised pause before the answer lands -- just enough
    // to read as "thinking" rather than an instant lookup table, since
    // that's genuinely what it's doing underneath.
    window.setTimeout(() => {
      setMessages(m => m.map(msg => (msg.id === deskId ? { ...msg, text: answer, thinking: false } : msg)))
    }, 450 + Math.random() * 400)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="LERN Help Desk"
        className="fixed left-5 z-40 w-14 h-14 active:scale-95 transition"
        style={{ bottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        <span
          className="absolute inset-0 rounded-full pointer-events-none animate-ping"
          style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 40%, transparent)', animationDuration: '2.4s' }}
        />
        <span
          className="absolute inset-0 rounded-full flex items-center justify-center border"
          style={{
            background: 'color-mix(in srgb, var(--brand) 18%, white 62%)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderColor: 'color-mix(in srgb, var(--brand) 40%, white 45%)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.5)',
          }}
        >
          <OrbFace size={10} />
        </span>
      </button>
    )
  }

  const topics = starterTopics(safeRole)

  return createPortal(
    <div
      ref={panelRef}
      data-theme={theme}
      className="fixed z-40 flex flex-col rounded-2xl overflow-hidden"
      style={{
        left: '1.25rem',
        bottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
        width: 'min(340px, calc(100vw - 2rem))',
        height: 'min(480px, calc(100dvh - 6rem))',
        transform: `translate3d(${drag.x}px, ${drag.y}px, 0)`,
        backgroundColor: 'color-mix(in srgb, var(--surface) 72%, transparent)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        border: '1px solid color-mix(in srgb, var(--border) 55%, transparent)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      {/* Drag handle -- the only part that starts a drag, so the close
          button and header text stay ordinary click targets. touch-none
          so a finger drag here repositions the card instead of
          scrolling the page behind it. */}
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        className="flex-shrink-0 pt-2 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none"
      >
        <span className="w-9 h-1.5 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--ink) 25%, transparent)' }} />
      </div>

      <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border"
            style={{
              background: 'color-mix(in srgb, var(--brand) 18%, white 60%)',
              borderColor: 'color-mix(in srgb, var(--brand) 35%, white 50%)',
            }}
          >
            <OrbFace size={8} />
          </span>
          <p className="font-bold text-ink text-[14px] leading-tight truncate">LERN Help Desk</p>
        </div>
        <button
          onClick={() => setOpen(false)} aria-label="Close"
          className="w-8 h-8 rounded-full flex items-center justify-center text-ink-tertiary hover:bg-surface-muted transition flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <>
            <p className="text-[13px] text-ink-secondary leading-relaxed">
              Ask how to do something on LERN and I'll walk you through it. Every answer here was written by the LERN team, not generated — if I don't know something, I'll say so rather than guess.
            </p>
            <p className="text-[11px] font-semibold text-ink-tertiary uppercase tracking-wide mt-4 mb-1.5">Try one of these</p>
            <div className="flex flex-col gap-1.5">
              {topics.map(t => (
                <button
                  key={t.id} onClick={() => ask(t.question)}
                  className="text-left text-[13px] font-medium text-ink bg-surface-subtle border border-edge-subtle rounded-lg px-3 py-2 hover:border-edge-input transition"
                >
                  {t.question}
                </button>
              ))}
            </div>
          </>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                m.from === 'me' ? 'bg-brand text-white rounded-br-sm' : 'text-ink rounded-bl-sm border'
              }`}
              style={m.from === 'desk' ? {
                backgroundColor: 'color-mix(in srgb, var(--surface-subtle) 85%, transparent)',
                borderColor: 'color-mix(in srgb, var(--border-subtle) 70%, transparent)',
              } : undefined}
            >
              {m.thinking ? (
                <span className="flex items-center gap-1 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: '120ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce" style={{ animationDelay: '240ms' }} />
                </span>
              ) : m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="flex-shrink-0 border-t p-3" style={{ borderColor: 'color-mix(in srgb, var(--border) 55%, transparent)' }}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }}
            placeholder="Ask a question…"
            rows={1}
            className="flex-1 bg-surface-subtle border border-edge rounded-xl px-3.5 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none resize-none max-h-24 focus:border-brand transition"
          />
          <button
            onClick={() => ask(input)}
            disabled={!input.trim()}
            aria-label="Ask"
            className="flex-shrink-0 w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand-hover transition disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
