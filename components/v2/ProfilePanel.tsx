'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getFollowCounts, getVerifiedWorkForProfile, getMyPosts, getSelfQualifications,
  addSelfQualification, deleteSelfQualification, uploadSelfQualificationFile, getSignedFileUrl,
} from '@/lib/supabase'
import { BadgeCheck, Grid3x3, Award, Plus, X, Trash2, ShieldAlert } from 'lucide-react'

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

// Verified work is the trusted core — it gets top billing, the green
// tick, and its own section. Self-added qualifications are real but
// unverified: kept visually and structurally separate (own table, own
// section, own "self-added, not verified" label) so the green tick
// never loses its meaning.
export default function ProfilePanel() {
  const { user } = useAuth()
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

  const verifiedCount = verified.length

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-accent-bg flex items-center justify-center text-brand font-bold text-xl flex-shrink-0">
          {initials(user?.full_name)}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-ink text-[17px] truncate">{user?.full_name}</p>
          <div className="flex items-center gap-4 mt-1 text-[13px]">
            <span><span className="font-bold text-ink">{counts.followers}</span> <span className="text-ink-tertiary">followers</span></span>
            <span><span className="font-bold text-ink">{counts.following}</span> <span className="text-ink-tertiary">following</span></span>
            <span><span className="font-bold text-success-text">{verifiedCount}</span> <span className="text-ink-tertiary">verified</span></span>
          </div>
        </div>
      </div>

      {/* ── Verified work — the trusted core ── */}
      <div>
        <p className="font-bold text-ink text-[14px] mb-2.5 flex items-center gap-1.5">
          <BadgeCheck className="w-4 h-4 text-success-text" /> Verified work
        </p>
        {verified.length === 0 ? (
          <p className="text-[13px] text-ink-tertiary">Nothing verified yet — it'll show up here the moment a tutor verifies your first piece of work.</p>
        ) : (
          <div className="space-y-2">
            {verified.map(v => (
              <div key={v.id} className="bg-surface border border-edge rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-ink text-[13.5px]">{v.submissions?.work_items?.title}</p>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-success-text flex-shrink-0"><BadgeCheck className="w-3.5 h-3.5" /> Verified</span>
                </div>
                <p className="text-[11.5px] text-ink-tertiary">
                  By {v.verifier?.full_name || 'a reviewer'} · {new Date(v.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Self-added qualifications — clearly separate, clearly unverified ── */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <p className="font-bold text-ink text-[14px] flex items-center gap-1.5">
            <Award className="w-4 h-4 text-ink-tertiary" /> Qualifications you've added
          </p>
          <button onClick={() => setAddingQual(v => !v)} className="text-[12px] font-semibold text-brand hover:underline flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        <div className="bg-warning-bg-soft border border-warning-text/20 rounded-lg px-3 py-2 mb-2.5 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-warning-text flex-shrink-0" />
          <p className="text-[11.5px] text-ink-secondary">Self-added — not checked or verified by anyone. Only work with a green tick above has been verified.</p>
        </div>
        {addingQual && <AddQualificationForm onAdded={() => { setAddingQual(false); load() }} />}
        {quals.length === 0 ? (
          <p className="text-[13px] text-ink-tertiary">Nothing added yet.</p>
        ) : (
          <div className="space-y-2">
            {quals.map(q => <QualificationRow key={q.id} qual={q} onChanged={load} />)}
          </div>
        )}
      </div>

      {/* ── Posts grid ── */}
      <div>
        <p className="font-bold text-ink text-[14px] mb-2.5 flex items-center gap-1.5">
          <Grid3x3 className="w-4 h-4 text-ink-tertiary" /> Posts
        </p>
        {loading ? (
          <p className="text-[13px] text-ink-tertiary">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="text-[13px] text-ink-tertiary">No posts yet — use the + button to share something.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {posts.map(p => <PostThumb key={p.id} post={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function PostThumb({ post }: { post: any }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (post.image_path) getSignedFileUrl('post-images', post.image_path).then(({ url }) => setUrl(url))
    else if (post.video_path) getSignedFileUrl('post-videos', post.video_path).then(({ url }) => setUrl(url))
  }, [post.image_path, post.video_path])

  return (
    <div className="aspect-square bg-surface-subtle rounded-lg overflow-hidden flex items-center justify-center relative">
      {post.video_path && url ? (
        <video src={url} className="w-full h-full object-cover" muted />
      ) : url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <p className="text-[11px] text-ink-tertiary p-2 line-clamp-4">{post.content}</p>
      )}
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
    <div className="bg-surface-subtle border border-edge-subtle rounded-xl p-3.5 mb-2.5 space-y-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Level 2 Food Hygiene Certificate" className="w-full bg-surface border border-edge rounded-lg px-3 py-2 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition" />
      <input value={issuer} onChange={e => setIssuer(e.target.value)} placeholder="Issued by (optional)" className="w-full bg-surface border border-edge rounded-lg px-3 py-2 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition" />
      <button onClick={() => fileRef.current?.click()} className="text-[12px] font-semibold text-ink-secondary hover:text-brand transition">
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
    <div className="flex items-center justify-between bg-surface border border-edge rounded-xl px-3.5 py-2.5">
      <button onClick={open} disabled={!qual.file_path} className="text-left min-w-0">
        <p className="text-[13px] font-semibold text-ink truncate">{qual.title}</p>
        {qual.issuer && <p className="text-[11.5px] text-ink-tertiary truncate">{qual.issuer}</p>}
      </button>
      <button onClick={remove} className="text-ink-quaternary hover:text-danger-text transition flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  )
}
