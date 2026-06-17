'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getConversations,
  deleteConversationForUser,
  setConversationFavorite,
  supabase,
} from '@/lib/supabase'
import { ArrowLeft, MessageCircle, Loader2, MoreVertical, Star, Trash2 } from 'lucide-react'

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function MessagesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading]             = useState(true)
  const [menuFor, setMenuFor]             = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    if (!user) return
    setLoading(true)
    const { data } = await getConversations(user.id)
    const sorted = [...(data || [])].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0))
    setConversations(sorted)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [user])

  // Realtime — update last message preview when a new message arrives in any conversation
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('messages-list-rt')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          const msg = payload.new
          setConversations(prev => {
            const idx = prev.findIndex(c => c.id === msg.conversation_id)
            if (idx === -1) return prev
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              lastMessage: {
                content:    msg.content,
                created_at: msg.created_at,
                sender_id:  msg.sender_id,
              },
            }
            // Move conversation with new message to top (unless favourites pinned)
            const [conv] = updated.splice(idx, 1)
            const firstNonFav = updated.findIndex(c => !c.isFavorite)
            const insertAt = conv.isFavorite ? 0 : (firstNonFav === -1 ? 0 : firstNonFav)
            updated.splice(insertAt, 0, conv)
            return updated
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuFor) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuFor(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuFor])

  const handleDelete = async (convId: string, isUser1: boolean) => {
    setMenuFor(null)
    await deleteConversationForUser(convId, isUser1)
    setConversations(prev => prev.filter(c => c.id !== convId))
  }

  const handleFavorite = async (convId: string, isUser1: boolean, current: boolean) => {
    setMenuFor(null)
    await setConversationFavorite(convId, isUser1, !current)
    setConversations(prev => {
      const updated = prev.map(c => c.id === convId ? { ...c, isFavorite: !current } : c)
      return [...updated].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0))
    })
  }

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.07)] flex-shrink-0">
        <button onClick={() => router.back()} className="text-white p-1 -ml-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-white font-bold text-lg flex-1">Messages</h1>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <MessageCircle className="w-12 h-12 text-[#2a2a2a] mb-4" />
            <p className="text-[#444] text-sm font-semibold">No messages yet</p>
            <p className="text-[#333] text-xs mt-1">Start a conversation from someone&apos;s profile</p>
          </div>
        ) : (
          <div>
            {conversations.map((c: any) => {
              const other   = c.otherUser
              const last    = c.lastMessage
              const initial = other?.username?.[0]?.toUpperCase() ?? '?'
              const isOpen  = menuFor === c.id
              const preview = last
                ? (last.sender_id === user?.id ? 'You: ' : '') + last.content
                : 'Start a conversation'
              return (
                <div key={c.id} className="relative flex items-center border-b border-[rgba(255,255,255,0.05)]">
                  {/* Conversation row */}
                  <button
                    onClick={() => router.push(`/messages/${c.id}`)}
                    className="flex-1 flex items-start gap-3 px-4 py-3.5 active:bg-[#1a1a1a] transition text-left min-w-0"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-base font-bold overflow-hidden">
                        {other?.avatar_url
                          ? <img src={other.avatar_url} alt={other.username} className="w-full h-full object-cover" />
                          : initial
                        }
                      </div>
                      {c.isFavorite && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
                          <Star className="w-3 h-3 text-yellow-900 fill-yellow-900" />
                        </span>
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-white font-bold text-sm truncate">{other?.username ?? 'User'}</p>
                        {last && (
                          <p className="text-[#444] text-xs flex-shrink-0">{timeAgo(last.created_at)}</p>
                        )}
                      </div>
                      {/* Show up to 2 lines so short messages are fully visible */}
                      <p className="text-[#888] text-sm line-clamp-2 leading-snug break-words">
                        {preview}
                      </p>
                    </div>
                  </button>

                  {/* Three-dot button */}
                  <div className="relative flex-shrink-0 pr-2 self-center" ref={isOpen ? menuRef : undefined}>
                    <button
                      onClick={e => { e.stopPropagation(); setMenuFor(isOpen ? null : c.id) }}
                      className="w-8 h-8 flex items-center justify-center text-[#444] hover:text-[#888] transition rounded-full hover:bg-[#1a1a1a]"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {isOpen && (
                      <div className="absolute right-0 top-9 z-50 bg-[#1e1e1e] border border-[rgba(255,255,255,0.1)] rounded-2xl overflow-hidden shadow-2xl min-w-[180px]">
                        <button
                          onClick={() => handleFavorite(c.id, c.isUser1, c.isFavorite)}
                          className="flex items-center gap-3 w-full px-4 py-3.5 text-white text-sm active:bg-[#2a2a2a] transition"
                        >
                          <Star className={`w-4 h-4 ${c.isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-[#888]'}`} />
                          {c.isFavorite ? 'Unfavourite' : 'Favourite'}
                        </button>
                        <div className="h-px bg-[rgba(255,255,255,0.07)]" />
                        <button
                          onClick={() => handleDelete(c.id, c.isUser1)}
                          className="flex items-center gap-3 w-full px-4 py-3.5 text-red-400 text-sm active:bg-[#2a2a2a] transition"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete conversation
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
