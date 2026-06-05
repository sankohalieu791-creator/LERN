'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  Grid3X3, Briefcase, Award, Users, MessageSquare,
  MapPin, Mail, Phone, Eye, Settings, Play,
  Star, Upload, Loader2, Plus, FileText, X, Trash2
} from 'lucide-react'
import Link from 'next/link'
import {
  getProjectsByUser, getCertificatesByUser, getFeedback,
  getUserVideos, addCertificate, deleteVideo, deleteProject, deleteCertificate, supabase,
} from '@/lib/supabase'
import type { Project, Certificate, Video } from '@/lib/types'

// ── Verified badge ────────────────────────────────────────────
function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center bg-[#1d9bf0] rounded-full flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24" fill="none" stroke="white"
        strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ width: size * 0.58, height: size * 0.58 }}
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )
}

// ── Stars ─────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-[#333]'}`}
        />
      ))}
    </div>
  )
}

const TABS = [
  { id: 'posts',        icon: Grid3X3,       label: 'Posts'     },
  { id: 'projects',     icon: Briefcase,     label: 'Projects'  },
  { id: 'certificates', icon: Award,         label: 'Certs'     },
  { id: 'employers',    icon: Users,         label: 'Employers' },
  { id: 'feedback',     icon: MessageSquare, label: 'Feedback'  },
]

export default function ProfileMePage() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const certFileRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState('posts')

  // Data
  const [videos,       setVideos]       = useState<Video[]>([])
  const [projects,     setProjects]     = useState<Project[]>([])
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [feedback,     setFeedback]     = useState<any[]>([])
  const [dataLoading,  setDataLoading]  = useState(false)

  // Certificate form
  const [certTitle,  setCertTitle]  = useState('')
  const [certIssuer, setCertIssuer] = useState('')
  const [certYear,   setCertYear]   = useState('')
  const [certFile,   setCertFile]   = useState<File | null>(null)
  const [addingCert, setAddingCert] = useState(false)
  const [certError,  setCertError]  = useState('')

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'post' | 'project' | 'cert'; id: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const initial = user?.username?.[0]?.toUpperCase() ?? 'U'

  // Load all tab data once user is available
  useEffect(() => {
    if (!user) return
    const load = async () => {
      setDataLoading(true)
      const [v, p, c, f] = await Promise.all([
        getUserVideos(user.id),
        getProjectsByUser(user.id),
        getCertificatesByUser(user.id),
        getFeedback(user.id),
      ])
      setVideos(v.data ?? [])
      setProjects(p.data ?? [])
      setCertificates(c.data ?? [])
      setFeedback(f.data ?? [])
      setDataLoading(false)
    }
    load()
  }, [user])

  const handleAddCertificate = async () => {
    if (!user) return
    if (!certTitle || !certIssuer || !certYear) {
      setCertError('Please fill all fields')
      return
    }
    setAddingCert(true)
    setCertError('')
    try {
      let certUrl = 'none'
      if (certFile) {
        const ext = certFile.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('certificates')
          .upload(path, certFile)
        if (uploadErr) throw new Error('File upload failed: ' + uploadErr.message)
        const { data: urlData } = await supabase.storage
          .from('certificates')
          .createSignedUrl(path, 60 * 60 * 24 * 365)
        certUrl = urlData?.signedUrl ?? 'none'
      }
      const { error } = await addCertificate(user.id, {
        title: certTitle,
        issuer: certIssuer,
        year: parseInt(certYear),
        certificate_url: certUrl,
      })
      if (error) throw error
      const { data: fresh } = await getCertificatesByUser(user.id)
      setCertificates(fresh ?? [])
      setCertTitle('')
      setCertIssuer('')
      setCertYear('')
      setCertFile(null)
    } catch (e: any) {
      setCertError(e.message || 'Failed to add certificate')
    } finally {
      setAddingCert(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    if (deleteTarget.type === 'post') {
      await deleteVideo(deleteTarget.id)
      setVideos(vs => vs.filter(v => v.id !== deleteTarget.id))
    } else if (deleteTarget.type === 'project') {
      await deleteProject(deleteTarget.id)
      setProjects(ps => ps.filter(p => p.id !== deleteTarget.id))
    } else {
      await deleteCertificate(deleteTarget.id)
      setCertificates(cs => cs.filter(c => c.id !== deleteTarget.id))
    }
    setDeleting(false)
    setDeleteTarget(null)
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] theme-bg pb-24">

      {/* ── HEADER ROW: avatar left · stats right ───────────── */}
      <div className="px-4 pt-5 flex items-center gap-4 mb-4">

        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-2xl font-bold overflow-hidden flex-shrink-0">
          {user?.avatar_url
            ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
            : initial}
        </div>

        <div className="flex flex-1 justify-around">
          {[
            { label: 'Posts',     value: videos.length             },
            { label: 'Followers', value: user?.followers_count ?? 0 },
            { label: 'Following', value: user?.following_count ?? 0 },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-white theme-text-1 font-bold text-lg leading-none">{s.value.toLocaleString()}</p>
              <p className="text-[#555] theme-text-2 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── NAME + BADGE ─────────────────────────────────────── */}
      <div className="px-4 mb-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-white theme-text-1 text-xl font-bold">{user?.username ?? 'Your Name'}</h1>
          {user?.verified && <VerifiedBadge size={18} />}
          <span className="text-[10px] font-bold bg-[#1e1e1e] text-[#888] border border-[rgba(255,255,255,0.08)] px-2 py-0.5 rounded-full uppercase">
            {user?.account_type ?? 'student'}
          </span>
        </div>
      </div>

      {user?.title && (
        <p className="px-4 text-[#777] theme-text-2 text-sm mb-1">{user.title}</p>
      )}

      {user?.bio && (
        <p className="px-4 text-[#aaa] theme-text-1 text-sm mb-2 leading-snug">{user.bio}</p>
      )}

      {/* ── LOCATION + CONTACT ───────────────────────────────── */}
      <div className="px-4 mb-3 space-y-1.5">
        {user?.work_description && (
          <div className="flex items-center gap-1.5 text-[#555] text-xs">
            <MapPin className="w-3 h-3" />
            <span>{user.work_description}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {user?.email && (
            <div className="flex items-center gap-1 text-[#555] text-xs">
              <Mail className="w-3 h-3" /><span>{user.email}</span>
            </div>
          )}
          {user?.phone_number && (
            <div className="flex items-center gap-1 text-[#555] text-xs">
              <Phone className="w-3 h-3" /><span>{user.phone_number}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── VIEWED BY ────────────────────────────────────────── */}
      <div className="mx-4 mb-4 flex items-center gap-2 text-xs bg-[#1a1a1a] theme-card border border-[rgba(255,255,255,0.06)] theme-border rounded-xl px-3 py-2">
        <Eye className="w-3 h-3 text-[#555]" />
        <span className="text-[#555] font-bold">VIEWED BY</span>
        <span className="text-white font-semibold">{user?.views_count ?? 0} Profile</span>
        <span className="text-[#FF6B2B] font-semibold">0 Employers</span>
      </div>

      {/* ── ACTION BUTTONS ───────────────────────────────────── */}
      <div className="px-4 flex gap-2 mb-5">
        <Link
          href="/profile/me/edit"
          className="flex-1 bg-[#1a1a1a] theme-card border border-[rgba(255,255,255,0.1)] theme-border text-white theme-text-1 py-2.5 rounded-xl text-sm font-semibold text-center hover:bg-[#222] transition"
        >
          Edit profile
        </Link>
        <Link
          href="/settings"
          className="bg-[#1a1a1a] theme-card border border-[rgba(255,255,255,0.1)] theme-border text-white theme-text-1 p-2.5 rounded-xl hover:bg-[#222] transition"
        >
          <Settings className="w-4 h-4" />
        </Link>
      </div>

      {/* ── TABS ─────────────────────────────────────────────── */}
      <div className="flex border-b border-[rgba(255,255,255,0.07)] theme-border">
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex justify-center py-3 border-b-2 transition-colors ${
                active ? 'border-white text-white' : 'border-transparent text-[#444] hover:text-[#777]'
              }`}
            >
              <Icon className="w-5 h-5" />
            </button>
          )
        })}
      </div>

      {/* ── TAB CONTENT ──────────────────────────────────────── */}
      <div className="p-4">

        {/* POSTS */}
        {activeTab === 'posts' && (
          dataLoading ? <LoadingSpinner /> :
          videos.length === 0 ? (
            <Empty icon={<Grid3X3 className="w-10 h-10" />} title="No posts yet" hint="Tap + to share a video" />
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {videos.map(v => (
                <div key={v.id} className="relative aspect-square bg-[#1a1a1a] rounded-lg overflow-hidden group">
                  <Link href={`/feed/${v.id}`} className="block w-full h-full">
                    {v.thumbnail_url
                      ? <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-6 h-6 text-[#333]" />
                        </div>
                    }
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <div className="flex items-center gap-1 text-white text-xs font-semibold">
                        <Play className="w-3.5 h-3.5 fill-white" />
                        {v.views.toLocaleString()}
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); setDeleteTarget({ type: 'post', id: v.id }) }}
                    className="absolute top-1.5 right-1.5 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center z-10"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* PROJECTS */}
        {activeTab === 'projects' && (
          dataLoading ? <LoadingSpinner /> :
          projects.length === 0 ? (
            <Empty icon={<Briefcase className="w-10 h-10" />} title="No projects yet" hint="Projects from your courses appear here" />
          ) : (
            <div className="space-y-3">
              {projects.map(p => (
                <div
                  key={p.id}
                  className="bg-[#1a1a1a] theme-card border border-[rgba(255,255,255,0.06)] theme-border rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white theme-text-1 font-semibold text-sm">{p.title}</p>
                      {p.description && (
                        <p className="text-[#555] theme-text-2 text-xs mt-1 line-clamp-2">{p.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.visibility === 'public'
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-[#2a2a2a] text-[#555]'
                      }`}>
                        {p.visibility}
                      </span>
                      <button
                        onClick={() => setDeleteTarget({ type: 'project', id: p.id })}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-[#2a2a2a] text-[#555] hover:text-red-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* CERTIFICATES */}
        {activeTab === 'certificates' && (
          <div>
            {/* Add certificate form */}
            <div className="bg-[#1a1a1a] theme-card border border-[rgba(255,255,255,0.06)] theme-border rounded-2xl p-4 mb-4">
              <p className="text-[#555] theme-text-2 text-xs font-bold uppercase tracking-wider mb-3">Add Certificate</p>

              {certError && (
                <p className="text-red-400 text-xs mb-3 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{certError}</p>
              )}

              <input
                value={certTitle}
                onChange={e => setCertTitle(e.target.value)}
                placeholder="Certificate title"
                className="w-full bg-[#111] theme-input border border-[rgba(255,255,255,0.07)] theme-border rounded-xl px-3 py-2.5 text-white theme-text-1 text-sm placeholder-[#444] outline-none mb-2"
              />
              <div className="flex gap-2 mb-2">
                <input
                  value={certIssuer}
                  onChange={e => setCertIssuer(e.target.value)}
                  placeholder="Issuer"
                  className="flex-1 bg-[#111] theme-input border border-[rgba(255,255,255,0.07)] theme-border rounded-xl px-3 py-2.5 text-white theme-text-1 text-sm placeholder-[#444] outline-none"
                />
                <input
                  value={certYear}
                  onChange={e => setCertYear(e.target.value)}
                  placeholder="Year"
                  type="number"
                  className="w-20 bg-[#111] theme-input border border-[rgba(255,255,255,0.07)] theme-border rounded-xl px-3 py-2.5 text-white theme-text-1 text-sm placeholder-[#444] outline-none"
                />
              </div>

              <button
                onClick={() => certFileRef.current?.click()}
                className="w-full bg-[#111] theme-input border border-[rgba(255,255,255,0.07)] theme-border text-[#555] theme-text-2 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 mb-3 hover:text-white transition"
              >
                {certFile
                  ? <><FileText className="w-4 h-4 text-[#FF6B2B]" />{certFile.name}</>
                  : <><Upload className="w-4 h-4" />Tap to upload PDF or image</>
                }
              </button>
              <input
                ref={certFileRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => e.target.files?.[0] && setCertFile(e.target.files[0])}
              />

              <button
                onClick={handleAddCertificate}
                disabled={addingCert}
                className="w-full bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {addingCert ? <><Loader2 className="w-4 h-4 animate-spin" />Adding…</> : '+ Add to my certificates'}
              </button>
            </div>

            {dataLoading ? <LoadingSpinner /> :
              certificates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[#444] text-sm">No certificates yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {certificates.map(c => (
                    <div key={c.id} className="bg-[#1a1a1a] theme-card border border-[rgba(255,255,255,0.06)] theme-border rounded-2xl p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center flex-shrink-0">
                        <Award className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white theme-text-1 font-semibold text-sm truncate">{c.title}</p>
                        <p className="text-[#555] theme-text-2 text-xs mt-0.5">{c.issuer} · {c.year}</p>
                      </div>
                      {c.certificate_url && c.certificate_url !== 'pending' && (
                        <a
                          href={c.certificate_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#FF6B2B] text-xs font-semibold flex-shrink-0"
                        >
                          View
                        </a>
                      )}
                      <button
                        onClick={() => setDeleteTarget({ type: 'cert', id: c.id })}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-[#2a2a2a] text-[#555] hover:text-red-400 transition flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {/* EMPLOYERS */}
        {activeTab === 'employers' && (
          <Empty
            icon={<Users className="w-10 h-10" />}
            title="No employer connections yet"
            hint="Employers who view your profile appear here"
          />
        )}

        {/* FEEDBACK */}
        {activeTab === 'feedback' && (
          dataLoading ? <LoadingSpinner /> :
          feedback.length === 0 ? (
            <div>
              <div className="bg-[#1a1a1a] theme-card border border-[rgba(255,255,255,0.06)] theme-border rounded-2xl p-4 mb-4">
                <p className="text-[#555] theme-text-2 text-sm text-center leading-relaxed">
                  Only employers can leave feedback. Employers who have reviewed your profile can rate your skills here.
                </p>
              </div>
              <div className="text-center py-8">
                <p className="text-[#444] text-sm">No feedback yet</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {feedback.map((f: any) => (
                <div key={f.id} className="bg-[#1a1a1a] theme-card border border-[rgba(255,255,255,0.06)] theme-border rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {f.users?.username?.[0]?.toUpperCase() ?? 'E'}
                      </div>
                      <p className="text-white theme-text-1 text-sm font-semibold">{f.users?.username ?? 'Employer'}</p>
                    </div>
                    <Stars rating={f.rating} />
                  </div>
                  <p className="text-[#777] theme-text-2 text-sm leading-relaxed">{f.feedback_text}</p>
                  <p className="text-[#444] text-xs mt-2">{new Date(f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── DELETE CONFIRM SHEET ─────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-[#1a1a1a] rounded-t-3xl px-5 pt-6 pb-8"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 bg-[#333] rounded-full" />
            </div>
            <h3 className="text-white font-bold text-lg mb-1 text-center">Delete this {deleteTarget.type === 'post' ? 'post' : deleteTarget.type}?</h3>
            <p className="text-[#555] text-sm text-center mb-6">This can't be undone.</p>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="w-full bg-red-500 text-white font-bold py-4 rounded-2xl mb-3 disabled:opacity-40"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button
              onClick={() => setDeleteTarget(null)}
              className="w-full bg-[#252525] text-white font-bold py-4 rounded-2xl"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
    </div>
  )
}

function Empty({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="text-center py-16">
      <div className="text-[#2a2a2a] flex justify-center mb-3">{icon}</div>
      <p className="text-[#444] text-sm">{title}</p>
      <p className="text-[#333] text-xs mt-1">{hint}</p>
    </div>
  )
}
