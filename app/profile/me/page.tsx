'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  Grid3X3, Briefcase, Award, Users, MessageSquare,
  MapPin, Mail, Phone, Eye, Settings, Play,
  Star, Upload, Loader2, Plus, FileText, X, Trash2,
  BookOpen, Inbox, Check, Clock, MessageCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getProjectsByUser, getCertificatesByUser, getFeedback, getFeedbackGiven,
  getUserVideos, addCertificate, deleteVideo, deleteProject, deleteCertificate,
  getInstructorCourses, getInstructorRequests, updateRequestStatus,
  getMyTrainingRequestsFull, getOrCreateConversation,
  deleteCourse, deleteWorkshop, getInstructorWorkshops,
  getFollowersList, getFollowingList,
  supabase,
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

const STUDENT_TABS = [
  { id: 'posts',        icon: Grid3X3,       label: 'Posts'     },
  { id: 'projects',     icon: Briefcase,     label: 'Projects'  },
  { id: 'certificates', icon: Award,         label: 'Certs'     },
  { id: 'connections',  icon: Users,         label: 'Connect'   },
  { id: 'feedback',     icon: MessageSquare, label: 'Feedback'  },
]

const INSTRUCTOR_TABS = [
  { id: 'posts',     icon: Grid3X3,       label: 'Posts'     },
  { id: 'courses',   icon: BookOpen,      label: 'Courses'   },
  { id: 'workshops', icon: Users,         label: 'Workshops' },
  { id: 'requests',  icon: Inbox,         label: 'Requests'  },
  { id: 'feedback',  icon: MessageSquare, label: 'Feedback'  },
]

export default function ProfileMePage() {
  const { user } = useAuth()
  const router = useRouter()
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

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'post' | 'project' | 'cert' | 'course' | 'workshop'; id: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Instructor-specific data
  const [courses,          setCourses]          = useState<any[]>([])
  const [workshops,        setWorkshops]        = useState<any[]>([])
  const [requests,         setRequests]         = useState<any[]>([])
  const [updatingRequest,  setUpdatingRequest]  = useState<string | null>(null)

  // Followers sheet
  const [followSheet,     setFollowSheet]     = useState<'followers' | 'following' | null>(null)
  const [followList,      setFollowList]      = useState<any[]>([])
  const [followLoading,   setFollowLoading]   = useState(false)

  // Student connections (sent requests)
  const [myRequests,       setMyRequests]       = useState<any[]>([])
  const [openingMsg,       setOpeningMsg]       = useState<string | null>(null)

  const isInstructor = user?.account_type === 'instructor'
  const TABS = isInstructor ? INSTRUCTOR_TABS : STUDENT_TABS

  const initial = user?.username?.[0]?.toUpperCase() ?? 'U'

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setDataLoading(true)
      if (user.account_type === 'instructor') {
        const [v, f, c, ws, r] = await Promise.all([
          getUserVideos(user.id),
          getFeedbackGiven(user.id),
          getInstructorCourses(user.id),
          getInstructorWorkshops(user.id),
          getInstructorRequests(user.id),
        ])
        setVideos(v.data ?? [])
        setFeedback(f.data ?? [])
        setCourses(c.data ?? [])
        setWorkshops(ws.data ?? [])
        setRequests(r.data ?? [])
      } else {
        const [v, p, c, f, mr] = await Promise.all([
          getUserVideos(user.id),
          getProjectsByUser(user.id),
          getCertificatesByUser(user.id),
          getFeedback(user.id),
          getMyTrainingRequestsFull(user.id),
        ])
        setVideos(v.data ?? [])
        setProjects(p.data ?? [])
        setCertificates(c.data ?? [])
        setFeedback(f.data ?? [])
        setMyRequests(mr.data ?? [])
      }
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

  const handleOpenMessage = async (instructorId: string) => {
    if (!user) return
    setOpeningMsg(instructorId)
    const { data } = await getOrCreateConversation(user.id, instructorId)
    setOpeningMsg(null)
    if (data?.id) router.push(`/messages/${data.id}`)
  }

  const handleRequestAction = async (requestId: string, status: 'accepted' | 'declined') => {
    setUpdatingRequest(requestId)
    await updateRequestStatus(requestId, status)
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status } : r))
    setUpdatingRequest(null)
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
    } else if (deleteTarget.type === 'course') {
      if (user) await deleteCourse(deleteTarget.id, user.id)
      setCourses(cs => cs.filter(c => c.id !== deleteTarget.id))
    } else if (deleteTarget.type === 'workshop') {
      if (user) await deleteWorkshop(deleteTarget.id, user.id)
      setWorkshops(ws => ws.filter(w => w.id !== deleteTarget.id))
    } else {
      await deleteCertificate(deleteTarget.id)
      setCertificates(cs => cs.filter(c => c.id !== deleteTarget.id))
    }
    setDeleting(false)
    setDeleteTarget(null)
  }

  return (
    <>
    <div className="fixed inset-0 bg-[#0f0f0f] theme-bg flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
    <div className="flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>

      {/* ── HEADER ROW: avatar left · stats right ───────────── */}
      <div className="px-4 pt-5 flex items-center gap-4 mb-4">

        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-2xl font-bold overflow-hidden flex-shrink-0">
          {user?.avatar_url
            ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
            : initial}
        </div>

        <div className="flex flex-1 justify-around">
          {[
            { label: 'Posts',     value: videos.length,             tap: null                },
            { label: 'Followers', value: user?.followers_count ?? 0, tap: 'followers' as const },
            { label: 'Following', value: user?.following_count ?? 0, tap: 'following' as const },
          ].map(s => (
            <button
              key={s.label}
              className="text-center active:opacity-70 transition"
              onClick={async () => {
                if (!s.tap || !user) return
                setFollowSheet(s.tap)
                setFollowLoading(true)
                const { data } = s.tap === 'followers'
                  ? await getFollowersList(user.id)
                  : await getFollowingList(user.id)
                setFollowList(data ?? [])
                setFollowLoading(false)
              }}
            >
              <p className="text-white theme-text-1 font-bold text-lg leading-none">{s.value.toLocaleString()}</p>
              <p className="text-[#555] theme-text-2 text-xs mt-0.5">{s.label}</p>
            </button>
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
        <span className="text-white font-semibold">{user?.views_count ?? 0} Profiles</span>
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

        {/* CONNECTIONS (student only) */}
        {activeTab === 'connections' && (
          dataLoading ? <LoadingSpinner /> :
          myRequests.length === 0 ? (
            <Empty icon={<Users className="w-10 h-10" />} title="No connections yet" hint="Send a training or mentorship request to an instructor" />
          ) : (
            <div className="space-y-3">
              {myRequests.map((r: any) => (
                <div key={r.id} className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
                      {r.instructor?.avatar_url
                        ? <img src={r.instructor.avatar_url} className="w-full h-full object-cover" />
                        : r.instructor?.username?.[0]?.toUpperCase() ?? '?'
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-bold">{r.instructor?.username ?? 'Instructor'}</p>
                      <p className="text-[#555] text-xs">{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                      r.type === 'training' ? 'bg-orange-500/15 text-orange-400' : 'bg-purple-500/15 text-purple-400'
                    }`}>
                      {r.type === 'training' ? '🎯 Training' : '🤝 Mentorship'}
                    </span>
                  </div>
                  <p className="text-[#888] text-sm bg-[#111] rounded-xl px-3 py-2.5 mb-3 leading-relaxed line-clamp-2">{r.message}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                      r.status === 'accepted'
                        ? 'bg-green-500/15 text-green-400'
                        : r.status === 'declined'
                        ? 'bg-[#252525] text-[#555]'
                        : 'bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {r.status === 'accepted' ? '✓ Accepted' : r.status === 'declined' ? '✕ Declined' : '⏳ Pending'}
                    </span>
                    {r.status === 'accepted' && (
                      <button
                        onClick={() => handleOpenMessage(r.to_instructor_id)}
                        disabled={openingMsg === r.to_instructor_id}
                        className="flex items-center gap-1.5 bg-gradient-to-r from-[#FF6B2B] to-[#C026D3] text-white text-xs font-bold px-4 py-1.5 rounded-full active:scale-95 transition disabled:opacity-50"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        {openingMsg === r.to_instructor_id ? '…' : 'Message'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* COURSES (instructor only) */}
        {activeTab === 'courses' && (
          dataLoading ? <LoadingSpinner /> :
          courses.length === 0 ? (
            <Empty icon={<BookOpen className="w-10 h-10" />} title="No courses yet" hint="Press + to create your first course" />
          ) : (
            <div className="space-y-3">
              {courses.map((c: any) => (
                <div key={c.id} className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">{c.title}</p>
                      {c.description && <p className="text-[#555] text-xs mt-0.5 line-clamp-2">{c.description}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[#888] text-xs">{c.enrolled_count ?? 0} enrolled</span>
                        <span className="text-[#444] text-xs capitalize">{c.level}</span>
                        {c.subject && (
                          <span className="text-[10px] font-bold bg-[#252525] text-[#888] px-2 py-0.5 rounded-full">{c.subject}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                    <button
                      onClick={() => setDeleteTarget({ type: 'course', id: c.id })}
                      className="flex items-center gap-1.5 text-[#444] text-xs hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete course
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* WORKSHOPS (instructor only) */}
        {activeTab === 'workshops' && (
          dataLoading ? <LoadingSpinner /> :
          workshops.length === 0 ? (
            <Empty icon={<Users className="w-10 h-10" />} title="No workshops yet" hint="Press + to create your first workshop" />
          ) : (
            <div className="space-y-3">
              {workshops.map((w: any) => (
                <div key={w.id} className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#C026D3] flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">{w.title}</p>
                      {w.description && <p className="text-[#555] text-xs mt-0.5 line-clamp-2">{w.description}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        {w.workshop_date && (
                          <span className="text-[#888] text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(w.workshop_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {w.max_participants && (
                          <span className="text-[#444] text-xs">{w.max_participants} spots</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                    <button
                      onClick={() => setDeleteTarget({ type: 'workshop', id: w.id })}
                      className="flex items-center gap-1.5 text-[#444] text-xs hover:text-red-400 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete workshop
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* REQUESTS (instructor only) */}
        {activeTab === 'requests' && (
          dataLoading ? <LoadingSpinner /> :
          requests.length === 0 ? (
            <Empty icon={<Inbox className="w-10 h-10" />} title="No requests yet" hint="1-to-1 training and mentorship requests appear here" />
          ) : (
            <div className="space-y-3">
              {requests.map((r: any) => (
                <div key={r.id} className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4">
                  {/* Requester */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
                      {r.requester?.avatar_url
                        ? <img src={r.requester.avatar_url} className="w-full h-full object-cover" />
                        : r.requester?.username?.[0]?.toUpperCase() ?? '?'
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-bold">{r.requester?.username ?? 'Someone'}</p>
                      <p className="text-[#555] text-xs">{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    {/* Type badge */}
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                      r.type === 'training' ? 'bg-orange-500/15 text-orange-400' : 'bg-purple-500/15 text-purple-400'
                    }`}>
                      {r.type === 'training' ? '🎯 Training' : '🤝 Mentorship'}
                    </span>
                  </div>

                  {/* Message */}
                  <p className="text-[#888] text-sm bg-[#111] rounded-xl px-3 py-2.5 mb-3 leading-relaxed">{r.message}</p>

                  {/* Status / Actions */}
                  {r.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRequestAction(r.id, 'accepted')}
                        disabled={updatingRequest === r.id}
                        className="flex-1 py-2.5 bg-green-500/15 border border-green-500/30 text-green-400 rounded-full text-sm font-semibold flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        <Check className="w-4 h-4" />
                        {updatingRequest === r.id ? '…' : 'Accept'}
                      </button>
                      <button
                        onClick={() => handleRequestAction(r.id, 'declined')}
                        disabled={updatingRequest === r.id}
                        className="flex-1 py-2.5 bg-[#252525] border border-[rgba(255,255,255,0.07)] text-[#888] rounded-full text-sm font-semibold transition active:scale-95"
                      >
                        Decline
                      </button>
                    </div>
                  ) : (
                    <div className={`flex items-center gap-2 text-sm font-semibold ${
                      r.status === 'accepted' ? 'text-green-400' : 'text-[#555]'
                    }`}>
                      {r.status === 'accepted'
                        ? <><Check className="w-4 h-4" /> Accepted</>
                        : <><Clock className="w-4 h-4" /> Declined</>
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* FEEDBACK */}
        {activeTab === 'feedback' && (
          dataLoading ? <LoadingSpinner /> :
          feedback.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-10 h-10 text-[#2a2a2a] mx-auto mb-3" />
              <p className="text-[#444] text-sm">
                {isInstructor ? 'No feedback given yet' : 'No feedback yet'}
              </p>
              <p className="text-[#333] text-xs mt-1">
                {isInstructor ? 'Visit a student profile to leave feedback' : 'Employers and instructors can leave feedback on your profile'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedback.map((f: any) => {
                // instructors: show who they gave feedback to (recipient); students: show reviewer
                const displayUser = isInstructor ? f.recipient : f.users
                const label = isInstructor ? 'To' : 'From'
                return (
                  <div key={f.id} className="bg-[#1a1a1a] theme-card border border-[rgba(255,255,255,0.06)] theme-border rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                          {displayUser?.avatar_url
                            ? <img src={displayUser.avatar_url} className="w-full h-full object-cover" />
                            : displayUser?.username?.[0]?.toUpperCase() ?? '?'
                          }
                        </div>
                        <div>
                          <p className="text-[#555] text-[10px]">{label}</p>
                          <p className="text-white theme-text-1 text-sm font-semibold">{displayUser?.username ?? 'User'}</p>
                        </div>
                      </div>
                      <Stars rating={f.rating} />
                    </div>
                    <p className="text-[#777] theme-text-2 text-sm leading-relaxed">{f.feedback_text}</p>
                    <p className="text-[#444] text-xs mt-2">{new Date(f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

    </div>
  </div>

    {deleteTarget && (
      <div className="fixed inset-0 z-[70] flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteTarget(null)} />
        <div className="relative bg-[#1a1a1a] rounded-t-3xl px-5 pt-6 pb-8"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1 bg-[#333] rounded-full" />
          </div>
          <h3 className="text-white font-bold text-lg mb-1 text-center">Delete this {deleteTarget.type === 'post' ? 'post' : deleteTarget.type === 'course' ? 'course' : deleteTarget.type}?</h3>
          <p className="text-[#555] text-sm text-center mb-6">This can&apos;t be undone.</p>
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
    {/* ── FOLLOWERS / FOLLOWING SHEET ─────────────────────── */}
    {followSheet && (
      <div className="fixed inset-0 z-[70] flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/70" onClick={() => setFollowSheet(null)} />
        <div className="relative bg-[#141414] rounded-t-3xl flex flex-col" style={{ maxHeight: '80vh', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex justify-center pt-3 flex-shrink-0">
            <div className="w-10 h-1 bg-[#333] rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
            <h2 className="text-white font-bold text-lg capitalize">{followSheet}</h2>
            <button onClick={() => setFollowSheet(null)} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {followLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
              </div>
            ) : followList.length === 0 ? (
              <p className="text-center text-[#444] text-sm py-16">No {followSheet} yet</p>
            ) : (
              <div className="divide-y divide-[rgba(255,255,255,0.05)]">
                {followList.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] overflow-hidden flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {u.avatar_url
                        ? <img src={u.avatar_url} className="w-full h-full object-cover" />
                        : u.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-bold flex items-center gap-1">
                        {u.username}
                        {u.verified && <VerifiedBadge size={13} />}
                      </p>
                      {u.title && <p className="text-[#555] text-xs truncate">{u.title}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
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
