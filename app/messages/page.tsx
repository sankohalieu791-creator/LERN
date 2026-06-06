'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getConversations } from '@/lib/supabase'
import { ArrowLeft, MessageCircle, Loader2 } from 'lucide-react'

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      const { data } = await getConversations(user.id)
      setConversations(data || [])
      setLoading(false)
    }
    load()
  }, [user])

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
            <p className="text-[#333] text-xs mt-1">When an instructor accepts your request you can start a conversation</p>
          </div>
        ) : (
          <div>
            {conversations.map((c: any) => {
              const other = c.otherUser
              const last = c.lastMessage
              const initial = other?.username?.[0]?.toUpperCase() ?? '?'
              return (
                <button
                  key={c.id}
                  onClick={() => router.push(`/messages/${c.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-4 border-b border-[rgba(255,255,255,0.05)] active:bg-[#1a1a1a] transition text-left"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-base font-bold overflow-hidden flex-shrink-0">
                    {other?.avatar_url
                      ? <img src={other.avatar_url} alt={other.username} className="w-full h-full object-cover" />
                      : initial
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-white font-bold text-sm">{other?.username ?? 'User'}</p>
                      {last && (
                        <p className="text-[#444] text-xs flex-shrink-0 ml-2">{timeAgo(last.created_at)}</p>
                      )}
                    </div>
                    <p className="text-[#555] text-sm truncate">
                      {last
                        ? (last.sender_id === user?.id ? 'You: ' : '') + last.content
                        : 'Start a conversation'
                      }
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
