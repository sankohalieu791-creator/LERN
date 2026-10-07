'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LifeBuoy, X, Send } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { searchHelp, starterTopics } from '@/lib/helpDeskSearch'
import type { HelpRole } from '@/lib/helpDeskContent'

type Msg = { from: 'me' | 'desk'; text: string }

const FALLBACK = "I don't have a clear answer for that yet — try rephrasing, or pick one of the topics below."

// Staff-facing only (institution, provider, employer) -- built for "a
// teacher who isn't familiar with the technology" to ask a plain
// question and get a straight answer, styled like a chat assistant but
// deliberately NOT one: every answer in lib/helpDeskContent.ts was
// written by hand, so nothing it says can be a hallucination. When
// nothing in that list matches well enough, it says so rather than
// forcing a weak match through as a real answer -- see searchHelp's
// MIN_SCORE.
export default function HelpDesk() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  const role = user?.role as HelpRole | undefined
  const isStaff = role === 'institution_staff' || role === 'provider_staff' || role === 'employer'
  if (!isStaff) return null
  const safeRole = role as HelpRole

  const ask = (q: string) => {
    if (!q.trim()) return
    const results = searchHelp(q, safeRole)
    const answer = results[0]?.answer ?? FALLBACK
    setMessages(m => [...m, { from: 'me', text: q }, { from: 'desk', text: answer }])
    setInput('')
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="LERN Help Desk"
        className="fixed left-5 z-40 w-12 h-12 rounded-full bg-brand text-white shadow-lg flex items-center justify-center active:scale-95 transition"
        style={{ bottom: 'calc(0.5rem + env(safe-area-inset-bottom))', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' }}
      >
        <LifeBuoy className="w-5 h-5" />
      </button>
    )
  }

  const topics = starterTopics(safeRole)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-start" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/30" />
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full sm:w-[380px] sm:ml-5 h-[85dvh] sm:h-[600px] bg-surface sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden border border-edge"
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-edge flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center flex-shrink-0">
              <LifeBuoy className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="font-bold text-ink text-[14px] leading-tight truncate">LERN Help Desk</p>
              <p className="text-[11px] text-ink-tertiary leading-tight">Written answers, not AI</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)} aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink-tertiary hover:bg-surface-muted transition flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
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
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.from === 'me'
                    ? 'bg-brand text-white rounded-br-sm'
                    : 'bg-surface-subtle text-ink border border-edge-subtle rounded-bl-sm'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className="flex-shrink-0 border-t border-edge p-3">
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
      </div>
    </div>,
    document.body
  )
}
