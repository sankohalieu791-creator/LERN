'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { searchPosts, getSignedFileUrl } from '@/lib/supabase'
import { ChevronLeft, Search as SearchIcon, X, Play } from 'lucide-react'

// The Feed header's search icon used to do nothing at all -- searches
// posts (which covers both "videos" and "posts": a video is just a
// post with video_path set) by title, caption and category, scoped to
// whatever the student can already see in Feed (their org + public).
export default function StudentSearchPanel() {
  const { user } = useAuth()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const query = q.trim()
    if (!query) { setResults([]); setSearched(false); return }
    setLoading(true)
    const t = setTimeout(() => {
      searchPosts(query, user?.organisation_id).then(({ data }) => {
        setResults(data || []); setLoading(false); setSearched(true)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [q, user?.organisation_id])

  return (
    // No negative margin here -- main itself has zero padding of its
    // own (checked directly, same fact that made the identical
    // -mx-4/-mt-4 pattern a real "too wide" bug in Profile/Settings
    // earlier this session), so there's nothing to cancel out.
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-2 h-14 px-3 bg-[#0f0f0f]/95 backdrop-blur border-b border-white/10">
        <button onClick={() => router.back()} aria-label="Back" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition flex-shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-[#1a1a1a] border border-white/10 rounded-full px-3.5 py-2">
          <SearchIcon className="w-4 h-4 text-[#666] flex-shrink-0" />
          <input
            ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search posts and videos…"
            className="flex-1 bg-transparent text-white text-[14px] placeholder-[#555] outline-none min-w-0"
          />
          {q && <button onClick={() => setQ('')}><X className="w-4 h-4 text-[#666]" /></button>}
        </div>
      </div>

      <div className="px-4 py-3">
        {!searched && !loading ? (
          <p className="text-center text-[13px] text-[#666] py-16">Search by caption, title, or topic.</p>
        ) : loading ? (
          <p className="text-center text-[13px] text-[#666] py-16">Searching…</p>
        ) : results.length === 0 ? (
          <p className="text-center text-[13px] text-[#666] py-16">No posts match "{q}".</p>
        ) : (
          <div className="space-y-2">
            {results.map(p => <SearchResultRow key={p.id} post={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function SearchResultRow({ post }: { post: any }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    if (post.image_path) getSignedFileUrl('post-images', post.image_path).then(({ url }) => setThumbUrl(url))
    else if (post.video_path) getSignedFileUrl('post-videos', post.video_path).then(({ url }) => setThumbUrl(url))
  }, [post.image_path, post.video_path])

  return (
    <div className="flex items-center gap-3 bg-[#1a1a1a] border border-white/10 rounded-xl p-3">
      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-[#141414] flex-shrink-0">
        {thumbUrl ? (
          post.video_path ? <video src={thumbUrl} className="w-full h-full object-cover" muted /> : <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
        ) : null}
        {post.video_path && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-white truncate">{post.author_name}</p>
        <p className="text-[12px] text-[#999] line-clamp-2 leading-snug">{post.title || post.content}</p>
      </div>
    </div>
  )
}
