'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getInstructorDashboardStats, updateSubmissionStatus } from '@/lib/supabase'
import {
  ChevronLeft, Loader2, Users, BookOpen, BarChart2,
  CheckCircle, XCircle, Clock, FileText, MessageSquare,
  TrendingUp, Award, ChevronRight, X, Check,
} from 'lucide-react'

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-[rgba(255,255,255,0.06)] flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-white font-bold text-2xl leading-none">{value}</p>
        <p className="text-[#555] text-xs mt-1 font-medium">{label}</p>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  if (status === 'accepted') return (
    <span className="flex items-center gap-1 bg-green-500/15 text-green-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-500/25">
      <CheckCircle className="w-3 h-3" /> Accepted
    </span>
  )
  if (status === 'declined') return (
    <span className="flex items-center gap-1 bg-red-500/15 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-500/25">
      <XCircle className="w-3 h-3" /> Declined
    </span>
  )
  return (
    <span className="flex items-center gap-1 bg-yellow-500/15 text-yellow-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-yellow-500/25">
      <Clock className="w-3 h-3" /> Pending
    </span>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'submissions'>('overview')
  const [reviewModal, setReviewModal] = useState<any>(null)
  const [feedback, setFeedback] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'declined'>('all')

  useEffect(() => {
    if (!user) return
    if (user.account_type !== 'instructor') { router.replace('/courses'); return }
    getInstructorDashboardStats(user.id).then(data => {
      setStats(data)
      setLoading(false)
    })
  }, [user, router])

  const handleReview = async (status: 'accepted' | 'declined') => {
    if (!reviewModal) return
    setReviewing(true)
    const { data } = await updateSubmissionStatus(reviewModal.id, status, feedback.trim() || undefined)
    if (data) {
      setStats((prev: any) => ({
        ...prev,
        submissions: prev.submissions.map((s: any) =>
          s.id === reviewModal.id ? { ...s, status, feedback: feedback.trim() || null } : s
        ),
      }))
    }
    setReviewing(false)
    setReviewModal(null)
    setFeedback('')
  }

  if (loading) return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <Loader2 className="w-6 h-6 text-[#444] animate-spin" />
    </div>
  )

  if (!user || user.account_type !== 'instructor') return null

  const { courses, workshops, submissions, totalEnrolled, totalWorkshopJoins } = stats

  const pendingCount  = submissions.filter((s: any) => s.status === 'pending').length
  const acceptedCount = submissions.filter((s: any) => s.status === 'accepted').length
  const declinedCount = submissions.filter((s: any) => s.status === 'declined').length

  const filteredSubs = filter === 'all' ? submissions : submissions.filter((s: any) => s.status === filter)

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.07)] bg-[#0f0f0f]">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#1a1a1a] flex-shrink-0">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-bold text-lg">Instructor Dashboard</h1>
          <p className="text-[#555] text-xs">@{(user as any).username}</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
          {(user as any).avatar_url
            ? <img src={(user as any).avatar_url} className="w-full h-full object-cover" />
            : (user as any).username?.[0]?.toUpperCase()}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-[rgba(255,255,255,0.07)] bg-[#0f0f0f]">
        {(['overview', 'submissions'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3.5 text-sm font-semibold capitalize border-b-2 transition ${
              activeTab === tab ? 'text-white border-white' : 'text-[#555] border-transparent'
            }`}>
            {tab === 'submissions' ? `Submissions ${pendingCount > 0 ? `(${pendingCount})` : ''}` : 'Overview'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}>

        {/* ── OVERVIEW TAB ─────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="px-4 py-5 space-y-6">

            {/* Key stats */}
            <div>
              <p className="text-[#555] text-[11px] font-bold uppercase tracking-widest mb-3">At a Glance</p>
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Users} label="Total Enrolled" value={totalEnrolled} color="bg-[#FF6B2B]" />
                <StatCard icon={BarChart2} label="Workshop Joins" value={totalWorkshopJoins} color="bg-[#C026D3]" />
                <StatCard icon={BookOpen} label="Active Courses" value={courses.length} color="bg-[#1d9bf0]" />
                <StatCard icon={FileText} label="Project Submissions" value={submissions.length} color="bg-green-500" />
              </div>
            </div>

            {/* Submissions summary */}
            {submissions.length > 0 && (
              <div>
                <p className="text-[#555] text-[11px] font-bold uppercase tracking-widest mb-3">Submission Status</p>
                <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-[rgba(255,255,255,0.06)]">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 text-center">
                      <p className="text-yellow-400 font-bold text-2xl">{pendingCount}</p>
                      <p className="text-[#555] text-xs mt-0.5">Pending</p>
                    </div>
                    <div className="w-px h-10 bg-[rgba(255,255,255,0.07)]" />
                    <div className="flex-1 text-center">
                      <p className="text-green-400 font-bold text-2xl">{acceptedCount}</p>
                      <p className="text-[#555] text-xs mt-0.5">Accepted</p>
                    </div>
                    <div className="w-px h-10 bg-[rgba(255,255,255,0.07)]" />
                    <div className="flex-1 text-center">
                      <p className="text-red-400 font-bold text-2xl">{declinedCount}</p>
                      <p className="text-[#555] text-xs mt-0.5">Declined</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
                    {acceptedCount > 0 && (
                      <div className="bg-green-500 rounded-l-full" style={{ flex: acceptedCount }} />
                    )}
                    {pendingCount > 0 && (
                      <div className="bg-yellow-500" style={{ flex: pendingCount }} />
                    )}
                    {declinedCount > 0 && (
                      <div className="bg-red-500 rounded-r-full" style={{ flex: declinedCount }} />
                    )}
                  </div>
                  {pendingCount > 0 && (
                    <button
                      onClick={() => setActiveTab('submissions')}
                      className="mt-4 w-full flex items-center justify-between text-[#FF6B2B] text-sm font-semibold"
                    >
                      <span>Review {pendingCount} pending submission{pendingCount !== 1 ? 's' : ''}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Courses */}
            {courses.length > 0 && (
              <div>
                <p className="text-[#555] text-[11px] font-bold uppercase tracking-widest mb-3">Your Courses</p>
                <div className="space-y-2">
                  {courses.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 bg-[#1a1a1a] rounded-2xl px-4 py-3 border border-[rgba(255,255,255,0.06)]">
                      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-[#252525]">
                        {c.thumbnail_url
                          ? <img src={c.thumbnail_url} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3]" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{c.title}</p>
                        <p className="text-[#555] text-xs mt-0.5">{c.enrolled_count || 0} enrolled</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#555] text-xs">
                        <Users className="w-3.5 h-3.5" />
                        <span className="font-bold text-white">{c.enrolled_count || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Workshops */}
            {workshops.length > 0 && (
              <div>
                <p className="text-[#555] text-[11px] font-bold uppercase tracking-widest mb-3">Your Workshops</p>
                <div className="space-y-2">
                  {workshops.map((w: any) => (
                    <div key={w.id} className="flex items-center gap-3 bg-[#1a1a1a] rounded-2xl px-4 py-3 border border-[rgba(255,255,255,0.06)]">
                      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-[#252525]">
                        {w.thumbnail_url
                          ? <img src={w.thumbnail_url} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-gradient-to-br from-[#1d9bf0] to-[#C026D3]" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{w.title}</p>
                        <p className="text-[#555] text-xs mt-0.5">{w.enrolled_count || 0} joined</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#555] text-xs">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="font-bold text-white">{w.enrolled_count || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {courses.length === 0 && workshops.length === 0 && (
              <div className="text-center py-16">
                <Award className="w-12 h-12 text-[#222] mx-auto mb-4" />
                <p className="text-[#444] text-sm font-semibold">No courses or workshops yet</p>
                <p className="text-[#333] text-xs mt-1">Create your first course to get started</p>
              </div>
            )}
          </div>
        )}

        {/* ── SUBMISSIONS TAB ──────────────────────────── */}
        {activeTab === 'submissions' && (
          <div className="px-4 py-5">

            {/* Filter pills */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {(['all', 'pending', 'accepted', 'declined'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold capitalize transition ${
                    filter === f
                      ? 'bg-white text-black'
                      : 'bg-[#1a1a1a] text-[#555] border border-[rgba(255,255,255,0.07)]'
                  }`}>
                  {f === 'all' ? `All (${submissions.length})` : f === 'pending' ? `Pending (${pendingCount})` : f === 'accepted' ? `Accepted (${acceptedCount})` : `Declined (${declinedCount})`}
                </button>
              ))}
            </div>

            {filteredSubs.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="w-12 h-12 text-[#222] mx-auto mb-4" />
                <p className="text-[#444] text-sm font-semibold">No submissions yet</p>
                <p className="text-[#333] text-xs mt-1">Students will appear here once they submit</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSubs.map((s: any) => (
                  <div key={s.id} className="bg-[#1a1a1a] rounded-2xl p-4 border border-[rgba(255,255,255,0.06)]">
                    {/* Student */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
                          {s.user?.avatar_url
                            ? <img src={s.user.avatar_url} className="w-full h-full object-cover" />
                            : s.user?.username?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p className="text-white text-sm font-bold">{s.user?.username ?? 'Unknown'}</p>
                          <p className="text-[#555] text-[10px]">
                            {new Date(s.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <StatusPill status={s.status} />
                    </div>

                    {/* Project name */}
                    {s.project?.title && (
                      <p className="text-[#555] text-[10px] font-bold uppercase tracking-widest mb-2">{s.project.title}</p>
                    )}

                    {/* Content */}
                    {s.description && (
                      <p className="text-[#888] text-sm leading-relaxed mb-3 line-clamp-3">{s.description}</p>
                    )}

                    {s.file_url && (
                      <a href={s.file_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[#1d9bf0] text-xs font-semibold mb-3">
                        <FileText className="w-3.5 h-3.5" />
                        {s.file_type === 'image' ? 'View image' : s.file_type === 'video' ? 'View video' : 'View file'}
                      </a>
                    )}

                    {s.feedback && (
                      <div className="bg-[#111] rounded-xl p-3 mb-3 border border-[rgba(255,255,255,0.05)]">
                        <p className="text-[#555] text-[10px] font-bold uppercase mb-1">Your Feedback</p>
                        <p className="text-[#777] text-xs">{s.feedback}</p>
                      </div>
                    )}

                    {/* Actions */}
                    {s.status === 'pending' && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => { setReviewModal(s); setFeedback('') }}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-green-500/15 border border-green-500/25 text-green-400 font-bold py-3 rounded-xl text-sm hover:bg-green-500/25 transition"
                        >
                          <Check className="w-4 h-4" /> Accept
                        </button>
                        <button
                          onClick={() => { setReviewModal({ ...s, _decline: true }); setFeedback('') }}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/15 border border-red-500/25 text-red-400 font-bold py-3 rounded-xl text-sm hover:bg-red-500/25 transition"
                        >
                          <X className="w-4 h-4" /> Decline
                        </button>
                      </div>
                    )}
                    {s.status !== 'pending' && (
                      <button
                        onClick={() => { setReviewModal(s); setFeedback(s.feedback || '') }}
                        className="w-full flex items-center justify-center gap-1.5 bg-[#222] text-[#888] font-semibold py-2.5 rounded-xl text-xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Change Decision
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── REVIEW MODAL ─────────────────────────────── */}
      {reviewModal && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setReviewModal(null); setFeedback('') }} />
          <div className="relative bg-[#141414] rounded-t-3xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
            <div className="flex justify-center pt-3">
              <div className="w-10 h-1 bg-[#333] rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[rgba(255,255,255,0.07)]">
              <h2 className="text-white text-lg font-bold">
                {reviewModal._decline ? 'Decline Submission' : 'Accept Submission'}
              </h2>
              <button onClick={() => { setReviewModal(null); setFeedback('') }} className="w-8 h-8 bg-[#222] rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="px-5 pt-4 pb-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF6B2B] to-[#C026D3] flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
                  {reviewModal.user?.avatar_url
                    ? <img src={reviewModal.user.avatar_url} className="w-full h-full object-cover" />
                    : reviewModal.user?.username?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{reviewModal.user?.username}</p>
                  <p className="text-[#555] text-xs">{reviewModal.project?.title}</p>
                </div>
              </div>
              <div>
                <label className="block text-[#888] text-[11px] font-bold uppercase tracking-wider mb-2">Feedback (optional)</label>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder={reviewModal._decline
                    ? "Tell the student what to improve and resubmit…"
                    : "Great work! Any comments for the student?"}
                  rows={3}
                  className="w-full bg-[#1e1e1e] border border-[rgba(255,255,255,0.08)] rounded-2xl px-4 py-3 text-white text-sm placeholder-[#444] outline-none focus:border-[rgba(255,255,255,0.2)] transition resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setReviewModal(null); setFeedback('') }}
                  className="flex-1 bg-[#252525] text-white font-bold py-3.5 rounded-2xl text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReview(reviewModal._decline ? 'declined' : 'accepted')}
                  disabled={reviewing}
                  className={`flex-1 font-bold py-3.5 rounded-2xl text-sm disabled:opacity-40 flex items-center justify-center gap-2 ${
                    reviewModal._decline
                      ? 'bg-red-500 text-white'
                      : 'bg-green-500 text-white'
                  }`}
                >
                  {reviewing
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : reviewModal._decline ? <><X className="w-4 h-4" />Decline</> : <><Check className="w-4 h-4" />Accept</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
