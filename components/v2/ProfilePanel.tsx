'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getFollowCounts, getVerifiedWorkForProfile, getMyPosts, getSelfQualifications,
  addSelfQualification, deleteSelfQualification, uploadSelfQualificationFile, getSignedFileUrl, deletePost,
} from '@/lib/supabase'
import { Grid3x3, BadgeCheck, Award, Settings, Plus, X, Trash2, Play } from 'lucide-react'

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

type Tab = 'posts' | 'verified' | 'quals'
const TABS: { id: Tab; icon: any }[] = [
  { id: 'posts', icon: Grid3x3 },
  { id: 'verified', icon: BadgeCheck },
  { id: 'quals', icon: Award },
]

// Deliberately rebuilt to match the old app's profile screen exactly —
// dark, avatar+stats row, role pill, edit/settings row, icon-only
// tabs, 3-column grid with a delete overlay — not a light-themed
// reinterpretation of it. The only real content changes from the old
// app: no comments/messaging/connections tabs (this app has none of
// those, per the safeguarding red lines), and "Certs" is now genuinely
// two separate things — verified work (green tick, from a tutor) and
// self-added qualifications (unverified, your own upload) — instead
// of one blended tab.
export default function ProfilePanel() {
  const { user } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('posts')
  const [counts, setCounts] = useState({ followers: 0, following: 0 })
  const [verified, setVerified] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [quals, setQuals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [addingQual, setAddingQual] = useState(false)

  const load = () => {
    if (!user) return
    getFollowCounts(user.id).then(setCounts)
    getVerifiedWorkForProfile(user.id).then(({ data }) => setVerified(data || []))
    getMyPosts(user.id).then(({ data }) => { setPosts(data || []); setLoading(false) })
    getSelfQualifications(user.id).then(({ data }) => setQuals(data || []))
  }
  useEffect(load, [user?.id])

  return (
    <div className="-mx-4 -mt-5 bg-[#0f0f0f] min-h-[calc(100vh-56px)] text-white">
      {/* ── HEADER ROW: avatar left · stats right ── */}
      <div className="px-4 pt-5 flex items-center gap-4 mb-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#3A2E24] to-[#241C15] flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
          {initials(user?.full_name)}
        </div>
        <div className="flex flex-1 justify-around">
          <div className="text-center">
            <p className="font-bold text-lg leading-none">{posts.length}</p>
            <p className="text-[#666] text-xs mt-1">Posts</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg leading-none">{counts.followers}</p>
            <p className="text-[#666] text-xs mt-1">Followers</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg leading-none">{counts.following}</p>
            <p className="text-[#666] text-xs mt-1">Following</p>
          </div>
        </div>
      </div>

      {/* ── NAME + ROLE ── */}
      <div className="px-4 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold">{user?.full_name ?? 'Your name'}</h1>
          <span className="text-[10px] font-bold bg-[#1e1e1e] text-[#888] border border-white/10 px-2 py-0.5 rounded-full uppercase">
            {user?.role === 'student' ? 'Student' : user?.role}
          </span>
        </div>
      </div>

      {/* ── VERIFIED STRIP ── */}
      <div className="px-4 mb-3 flex items-center gap-2">
        <div className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-xl py-2.5 text-center">
          <p className="font-bold text-base leading-none text-success-text">{verified.length}</p>
          <p className="text-[#666] text-[11px] mt-1">Verified</p>
        </div>
        <div className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-xl py-2.5 text-center">
          <p className="font-bold text-base leading-none">{quals.length}</p>
          <p className="text-[#666] text-[11px] mt-1">Qualifications</p>
        </div>
      </div>

      {/* ── ACTION BUTTONS ── */}
      <div className="px-4 flex gap-2 mb-3">
        <button className="flex-1 bg-[#1a1a1a] border border-white/10 py-2.5 rounded-xl text-sm font-semibold text-center hover:bg-[#222] transition">
          Edit profile
        </button>
        <button onClick={() => router.push('/student/settings')} className="bg-[#1a1a1a] border border-white/10 p-2.5 rounded-xl hover:bg-[#222] transition">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* ── TABS ── */}
      <div className="flex border-b border-white/10 sticky top-0 bg-[#0f0f0f] z-10">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex justify-center py-3 border-b-2 transition-colors ${active ? 'border-white text-white' : 'border-transparent text-[#444] hover:text-[#777]'}`}
            >
              <Icon className="w-5 h-5" />
            </button>
          )
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="p-4">
        {tab === 'posts' && (
          loading ? (
            <p className="text-[13px] text-[#666]">Loading…</p>
          ) : posts.length === 0 ? (
            <EmptyState icon={Grid3x3} title="No posts yet" hint="Tap + to share something" />
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {posts.map(p => <PostThumb key={p.id} post={p} onDeleted={load} />)}
            </div>
          )
        )}

        {tab === 'verified' && (
          verified.length === 0 ? (
            <EmptyState icon={BadgeCheck} title="Nothing verified yet" hint="It'll show up here the moment a tutor verifies your first piece of work" />
          ) : (
            <div className="space-y-2">
              {verified.map(v => (
                <div key={v.id} className="bg-[#1a1a1a] border border-white/10 rounded-xl p-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-[13.5px]">{v.submissions?.work_items?.title}</p>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-success-text flex-shrink-0"><BadgeCheck className="w-3.5 h-3.5" /> Verified</span>
                  </div>
                  <p className="text-[11.5px] text-[#777]">
                    By {v.verifier?.full_name || 'a reviewer'} · {new Date(v.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'quals' && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11.5px] text-[#888] leading-relaxed pr-3">Self-added — not checked or verified by anyone. Only the Verified tab has been checked by a tutor.</p>
              <button onClick={() => setAddingQual(v => !v)} className="text-[12px] font-semibold text-brand flex items-center gap-1 flex-shrink-0">
                {addingQual ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} Add
              </button>
            </div>
            {addingQual && <AddQualificationForm onAdded={() => { setAddingQual(false); load() }} />}
            {quals.length === 0 ? (
              <EmptyState icon={Award} title="Nothing added yet" hint="Certificates you've earned elsewhere can go here" />
            ) : (
              <div className="space-y-2">
                {quals.map(q => <QualificationRow key={q.id} qual={q} onChanged={load} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center text-center py-12">
      <Icon className="w-8 h-8 text-[#333] mb-3" />
      <p className="font-semibold text-[14px] mb-1">{title}</p>
      <p className="text-[12.5px] text-[#666]">{hint}</p>
    </div>
  )
}

function PostThumb({ post, onDeleted }: { post: any; onDeleted: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (post.image_path) getSignedFileUrl('post-images', post.image_path).then(({ url }) => setUrl(url))
    else if (post.video_path) getSignedFileUrl('post-videos', post.video_path).then(({ url }) => setUrl(url))
  }, [post.image_path, post.video_path])

  const remove = async () => { await deletePost(post.id); onDeleted() }

  return (
    <div className="relative aspect-square bg-[#1a1a1a] rounded-lg overflow-hidden group">
      {post.video_path && url ? (
        <video src={url} className="w-full h-full object-cover" muted />
      ) : url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-2">
          {post.video_path
            ? <Play className="w-6 h-6 text-[#333]" />
            : <p className="text-[11px] text-[#666] line-clamp-4">{post.content}</p>}
        </div>
      )}
      <button
        onClick={remove}
        className="absolute top-1.5 right-1.5 w-7 h-7 bg-[#2a2a2a] rounded-full flex items-center justify-center z-10"
      >
        <Trash2 className="w-3.5 h-3.5 text-white" />
      </button>
    </div>
  )
}

function AddQualificationForm({ onAdded }: { onAdded: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [issuer, setIssuer] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    if (!title.trim() || !user) return
    setSaving(true)
    let file_path: string | undefined
    if (file) {
      const { path } = await uploadSelfQualificationFile(user.id, file)
      if (path) file_path = path
    }
    await addSelfQualification(user.id, { title: title.trim(), issuer: issuer.trim() || undefined, file_path })
    setSaving(false)
    onAdded()
  }

  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-3.5 mb-2.5 space-y-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Level 2 Food Hygiene Certificate" className="w-full bg-[#141414] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder-[#555] outline-none focus:border-brand transition" />
      <input value={issuer} onChange={e => setIssuer(e.target.value)} placeholder="Issued by (optional)" className="w-full bg-[#141414] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder-[#555] outline-none focus:border-brand transition" />
      <button onClick={() => fileRef.current?.click()} className="text-[12px] font-semibold text-[#999] hover:text-brand transition">
        {file ? file.name : 'Attach a file (optional)'}
      </button>
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
      <button onClick={submit} disabled={!title.trim() || saving} className="px-3.5 py-2 rounded-lg bg-brand text-white text-[12px] font-semibold disabled:opacity-40">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

function QualificationRow({ qual, onChanged }: { qual: any; onChanged: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const open = async () => {
    if (url) return window.open(url, '_blank')
    if (!qual.file_path) return
    const { url: signed } = await getSignedFileUrl('self-qualifications', qual.file_path)
    if (signed) { setUrl(signed); window.open(signed, '_blank') }
  }
  const remove = async () => { await deleteSelfQualification(qual.id); onChanged() }

  return (
    <div className="flex items-center justify-between bg-[#1a1a1a] border border-white/10 rounded-xl px-3.5 py-2.5">
      <button onClick={open} disabled={!qual.file_path} className="text-left min-w-0">
        <p className="text-[13px] font-semibold truncate">{qual.title}</p>
        {qual.issuer && <p className="text-[11.5px] text-[#777] truncate">{qual.issuer}</p>}
      </button>
      <button onClick={remove} className="text-[#666] hover:text-danger-text transition flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  )
}
