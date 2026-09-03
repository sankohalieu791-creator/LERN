'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getFollowCounts, getVerifiedWorkForProfile, getMyPosts, getSelfQualifications,
  addSelfQualification, deleteSelfQualification, uploadSelfQualificationFile, getSignedFileUrl, deletePost,
  updateProfileBioTags, getExperienceEntries, addExperienceEntry, deleteExperienceEntry,
  getSavedOpportunities, unsaveOpportunity, updateUserProfile, uploadAvatar, removeAvatar, getAvatarUrl,
  isUsernameAvailable,
} from '@/lib/supabase'
import {
  FolderCheck, Briefcase, Grid3x3, Settings as SettingsIcon, Plus, X, Trash2, Play,
  Bookmark, Lock, FilePlus, CheckCircle2, Camera, ChevronLeft, ChevronRight, ArrowRight,
} from 'lucide-react'

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}
function daysAgo(dateStr: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)))
}

type Folder = 'verified' | 'experience' | 'posts' | 'saved'

// LERN Student Profile, Final Layout Spec v2.0 -- supersedes the
// earlier compact-stack layout. Spacious, centred, TikTok-style top;
// compact 3-tile folder row (not tall bars); Saved jobs + Settings as
// full rows; folders open by REPLACING the body, with a "Profile" back
// link, rather than expanding inline underneath the tiles the way the
// old layout did.
//
// Structural colours (page/card backgrounds, hairline borders) stay
// this app's own dark palette rather than the spec text's literal
// #FFFFFF card -- the user's own reference screenshot for this exact
// screen is dark, the same call made for every dark rebuild this
// session. Every PINNED accent hex (avatar, tag pills, folder icon
// colours, the blue privacy note) is used exactly as given regardless.
// The one deliberate exception: the avatar is a SOLID #185FA5 fill
// with white text rather than the spec text's light-pill claim --
// that's what the reference screenshot itself actually shows, and it's
// built from a hex the spec already pinned, not an invented colour.
export default function ProfilePanel({ userId, ownView = true }: { userId?: string; ownView?: boolean }) {
  const { user: authUser, refreshUser } = useAuth()
  const router = useRouter()
  const profileId = userId || authUser?.id
  const isOwn = ownView && profileId === authUser?.id

  const [profile, setProfile] = useState<any>(authUser)
  const [counts, setCounts] = useState({ followers: 0, following: 0 })
  const [verified, setVerified] = useState<any[]>([])
  const [quals, setQuals] = useState<any[]>([])
  const [experience, setExperience] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [saved, setSaved] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // TikTok-style now, not a navigate-away screen: the tabs stay put,
  // this just tracks which one is active. Always has a value -- there
  // is no "closed" state, same as TikTok's own profile always having
  // one of Posts/Private/Liked selected.
  const [folder, setFolder] = useState<Folder>('verified')
  const [editingBio, setEditingBio] = useState(false)
  const [addingExperience, setAddingExperience] = useState(false)
  const [addingQual, setAddingQual] = useState(false)

  const load = () => {
    if (!profileId) return
    if (isOwn) setProfile(authUser)
    getFollowCounts(profileId).then(setCounts)
    getVerifiedWorkForProfile(profileId).then(({ data }) => { setVerified(data || []); setLoading(false) })
    getSelfQualifications(profileId).then(({ data }) => setQuals(data || []))
    getExperienceEntries(profileId).then(({ data }) => setExperience(data || []))
    getMyPosts(profileId).then(({ data }) => setPosts(data || []))
    if (isOwn) getSavedOpportunities(profileId).then(({ data }) => setSaved(data || []))
  }
  useEffect(load, [profileId, isOwn])

  if (!profile) return null

  const folderCount = { verified: verified.length, experience: experience.length, posts: posts.length, saved: saved.length }

  return (
    // Flat, edge-to-edge, no enclosing card -- exactly how Feed, My
    // Work, Discover and Settings already work. The previous version
    // wrapped the whole screen in a separate #1a1a1a card floating on
    // the #0f0f0f page, which is not a pattern anything else in this
    // app uses -- every other screen just IS the dark surface, cards
    // are for individual rows/tiles inside it, never the whole page.
    // That boxed-card structure is what actually made the profile
    // look like "a square" instead of a real screen: a self-contained
    // box with its own visible corners sitting in the middle of a
    // taller page, not a surface that fills it. Removing the box
    // outright fixes both the look and the leftover-height problem in
    // one move -- there's no card left that needs to be tricked into
    // filling a guessed-at height, content just flows like every other
    // screen here does.
    <div className="relative bg-[var(--app-bg)] min-h-[calc(100vh-56px)] px-4 pt-4 pb-8 text-[var(--app-text)]">
        {/* Settings: a quiet icon in the corner, own view only. Always
            here now -- there's no separate "inside a folder" screen
            to hide it behind any more. */}
        {isOwn && (
          <button
            onClick={() => router.push('/student/settings')}
            aria-label="Settings"
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 transition text-[var(--app-text-secondary)]"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        )}

        {editingBio && (
          <EditProfileScreen
            profile={profile}
            onDone={async () => { await refreshUser(); setEditingBio(false); load() }}
            onClose={() => setEditingBio(false)}
          />
        )}

        {/* ── 1. Top block: avatar/name/username/bio, stat numbers
            (with thin "|" dividers between them, TikTok-style), tags,
            Edit profile. ── */}
        <div className="flex flex-col items-center text-center pt-1">
          <Avatar path={profile.avatar_path} name={profile.full_name} size={88} textSize={30} variant="solid" />
          <p className="text-[19px] font-bold mt-3.5 tracking-tight">{profile.full_name}</p>
          {profile.username && <p className="text-[13px] text-[var(--app-text-secondary)] mt-0.5">@{profile.username}</p>}
          {profile.bio && (
            <p className="text-[13.5px] text-[var(--app-text-body)] leading-[1.5] mt-2.5" style={{ maxWidth: 300 }}>{profile.bio}</p>
          )}

          <div className="flex items-center gap-3 mt-4">
            <Stat n={folderCount.verified} label="work" />
            <span className="text-[var(--app-text)]/15">|</span>
            <Stat n={counts.followers} label="followers" />
            <span className="text-[var(--app-text)]/15">|</span>
            <Stat n={counts.following} label="following" />
          </div>

          {(profile.interest_tags || []).length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mt-3.5">
              {profile.interest_tags.slice(0, 3).map((t: string) => (
                <span key={t} className="text-[11.5px] font-medium px-3 py-[5px] rounded-full" style={{ backgroundColor: '#E6F1FB', color: '#0C447C' }}>{t}</span>
              ))}
            </div>
          )}
          {isOwn && (
            <button
              onClick={() => setEditingBio(true)}
              className="mt-4 px-6 py-2 rounded-full border border-white/15 text-[13px] font-semibold hover:bg-white/[0.06] active:scale-[0.98] transition"
            >
              Edit profile
            </button>
          )}
        </div>

        {/* ── 2. Folders as TikTok-style tabs: Verified, Experience,
            Posts, and (own view only) Saved jobs. Tapping one doesn't
            navigate anywhere -- it swaps the grid below, same screen,
            tabs stay visible, active tab gets an underline. "Tap
            Posts, see your posts. Tap Saved, see what's saved." ── */}
        <div className={`grid ${isOwn ? 'grid-cols-4' : 'grid-cols-3'} mt-6 border-b border-[var(--app-border)]`}>
          <FolderTab active={folder === 'verified'} onClick={() => setFolder('verified')} icon={FolderCheck} iconColor="#0F6E56" label="Verified" count={folderCount.verified} />
          <FolderTab active={folder === 'experience'} onClick={() => setFolder('experience')} icon={Briefcase} iconColor="#D4551A" label="Experience" count={folderCount.experience} />
          <FolderTab active={folder === 'posts'} onClick={() => setFolder('posts')} icon={Grid3x3} iconColor="#5A5A5A" label="Posts" count={folderCount.posts} />
          {isOwn && (
            <FolderTab active={folder === 'saved'} onClick={() => setFolder('saved')} icon={Bookmark} iconColor="#D4551A" label="Saved" count={folderCount.saved} />
          )}
        </div>

        {/* ── 3. The active tab's content, directly below -- no back
            link, nothing to navigate away from. ── */}
        <div className="pt-4">
          <FolderContent
            folder={folder} isOwn={isOwn} loading={loading}
            verified={verified} quals={quals} experience={experience} posts={posts} saved={saved}
            profileId={profileId!}
            onChanged={load}
            addingExperience={addingExperience} setAddingExperience={setAddingExperience}
            addingQual={addingQual} setAddingQual={setAddingQual}
          />
        </div>
    </div>
  )
}

// Shared everywhere a profile photo shows: real image if avatar_path
// is set, initials otherwise -- so there's never a broken/empty state,
// just a graceful fallback. Two colour treatments, both built only
// from hex values the specs themselves already pinned (nothing
// invented): 'light' is the original #E6F1FB-on-#185FA5 pill used in
// Settings/Edit-profile rows and everywhere else. 'solid' -- used only
// on the Profile screen's own top block -- is the exact same #185FA5
// as a SOLID fill with white text: the Final Layout Spec v2.0
// reference screenshot shows a solid dark-blue circle there, the
// inverse of the spec text's literal light-pill claim, the same
// "screenshot wins over spec text" call made for every dark rebuild
// this session -- just applied to one element this time, not the
// whole screen, since the tag pills right below it in that same
// screenshot DO match the spec text's light pill exactly.
export function Avatar({ path, name, size, textSize, variant = 'light' }: { path?: string | null; name?: string; size: number; textSize: number; variant?: 'light' | 'solid' }) {
  const url = getAvatarUrl(path)
  if (url) {
    return (
      <img
        src={url} alt="" width={size} height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  const colors = variant === 'solid' ? { backgroundColor: '#185FA5', color: '#FFFFFF' } : { backgroundColor: '#E6F1FB', color: '#185FA5' }
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-semibold"
      style={{ width: size, height: size, fontSize: textSize, ...colors }}
    >
      {initials(name)}
    </div>
  )
}

// TikTok-sized, not the earlier bolder/bigger treatment -- a compact
// "n label" pair read horizontally, no divider lines around the row.
function Stat({ n, label }: { n: number; label: string }) {
  return (
    <p className="text-[13.5px] leading-none">
      <span className="font-bold">{n}</span> <span className="text-[var(--app-text-secondary)]">{label}</span>
    </p>
  )
}

// TikTok-style tab, not a navigate-away tile -- icon, label, count,
// and an underline that only appears on the active one. No card box
// around it, per direct feedback.
function FolderTab({ active, onClick, icon: Icon, iconColor, label, count }: {
  active: boolean; onClick: () => void; icon: any; iconColor: string; label: string; count: number
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 pb-2.5 border-b-2 transition"
      style={{ borderColor: active ? '#D4551A' : 'transparent' }}
    >
      <Icon className="w-4 h-4" style={{ color: active ? iconColor : '#666' }} />
      <span>
        <span className={`text-[12px] font-semibold ${active ? 'text-[var(--app-text)]' : 'text-[var(--app-text-secondary)]'}`}>{label}</span>
        <span className="text-[10.5px] text-[var(--app-text-secondary)]"> · {count}</span>
      </span>
    </button>
  )
}

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center text-center py-10">
      <Icon className="w-7 h-7 text-[var(--app-text-quaternary)] mb-2.5" />
      <p className="font-semibold text-[13px] mb-1">{title}</p>
      <p className="text-[12px] text-[var(--app-text-tertiary)]">{hint}</p>
    </div>
  )
}

// ── 3. The active tab's content -- TikTok-style, no back link and no
// repeated header (the tab itself already shows what's selected).
// Same component for all four, just the grid inside changes.
function FolderContent({
  folder, isOwn, loading, verified, quals, experience, posts, saved, profileId, onChanged,
  addingExperience, setAddingExperience, addingQual, setAddingQual,
}: {
  folder: Folder; isOwn: boolean; loading: boolean
  verified: any[]; quals: any[]; experience: any[]; posts: any[]; saved: any[]
  profileId: string; onChanged: () => void
  addingExperience: boolean; setAddingExperience: (v: boolean | ((v: boolean) => boolean)) => void
  addingQual: boolean; setAddingQual: (v: boolean | ((v: boolean) => boolean)) => void
}) {
  const [openWork, setOpenWork] = useState<any | null>(null)

  return (
    <div>
      {folder === 'verified' && (
        loading ? <p className="text-[13px] text-[var(--app-text-tertiary)]">Loading…</p> : (verified.length === 0 && quals.length === 0) ? (
          <EmptyState icon={FolderCheck} title="Nothing here yet" hint="It'll show up here the moment a tutor verifies your first piece of work" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-[10px]">
              {verified.map(v => (
                <button key={v.id} onClick={() => setOpenWork(v)} className="text-left bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl p-[14px] hover:border-white/20 transition">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5" style={{ backgroundColor: '#E1F5EE' }}>
                    <CheckCircle2 className="w-4 h-4" style={{ color: '#0F6E56' }} />
                  </span>
                  <p className="text-[13px] font-semibold leading-snug line-clamp-2">{v.submissions?.work_items?.title}</p>
                  <p className="text-[12px] mt-1" style={{ color: '#4ade80' }}>
                    Verified · {new Date(v.verified_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                  </p>
                </button>
              ))}
              {quals.map(q => (
                <div key={q.id} className="rounded-xl p-[14px] border border-dashed relative" style={{ borderColor: '#8A8A8A' }}>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 bg-white/5">
                    <FilePlus className="w-4 h-4" style={{ color: '#8A8A8A' }} />
                  </span>
                  <p className="text-[13px] font-semibold leading-snug line-clamp-2">{q.title}</p>
                  <p className="text-[12px] mt-1">
                    <span>Self-added certificate</span><span style={{ color: '#8A8A8A' }}> · not verified by LERN</span>
                  </p>
                  {isOwn && (
                    <button onClick={async () => { await deleteSelfQualification(q.id); onChanged() }} className="absolute top-2.5 right-2.5 text-[var(--app-text-tertiary)] hover:text-danger-text transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isOwn && (
              <button onClick={() => setAddingQual(v => !v)} className="text-[12px] font-semibold text-brand flex items-center gap-1 mt-3">
                {addingQual ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} Add a self-added certificate
              </button>
            )}
            {addingQual && <div className="mt-3"><AddQualForm profileId={profileId} onAdded={() => { setAddingQual(false); onChanged() }} /></div>}
          </>
        )
      )}

      {folder === 'experience' && (
        <>
          {experience.length === 0 ? (
            <EmptyState icon={Briefcase} title="Nothing added yet" hint="Work placements, volunteering, part-time work — anything real-world" />
          ) : (
            <div className="grid grid-cols-2 gap-[10px]">
              {experience.map(e => (
                <div key={e.id} className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl p-[14px] relative">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5" style={{ backgroundColor: '#E6F1FB' }}>
                    <Briefcase className="w-4 h-4" style={{ color: '#D4551A' }} />
                  </span>
                  <p className="text-[13px] font-semibold leading-snug line-clamp-2">{e.title}</p>
                  <p className="text-[12px] text-[var(--app-text-secondary)] mt-1 truncate">{e.organisation || 'Work experience'}</p>
                  {isOwn && (
                    <button onClick={async () => { await deleteExperienceEntry(e.id); onChanged() }} className="absolute top-2.5 right-2.5 text-[var(--app-text-tertiary)] hover:text-danger-text transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {isOwn && (
            <button onClick={() => setAddingExperience(v => !v)} className="text-[12px] font-semibold text-brand flex items-center gap-1 mt-3">
              {addingExperience ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} Add experience
            </button>
          )}
          {addingExperience && <div className="mt-3"><AddExperienceForm profileId={profileId} onAdded={() => { setAddingExperience(false); onChanged() }} /></div>}
        </>
      )}

      {folder === 'posts' && (
        posts.length === 0 ? (
          <EmptyState icon={Grid3x3} title="No posts yet" hint="Tap + to share something" />
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {posts.map(p => <PostThumb key={p.id} post={p} canDelete={isOwn} onDeleted={onChanged} />)}
          </div>
        )
      )}

      {folder === 'saved' && (
        <>
          {saved.length === 0 ? (
            <EmptyState icon={Bookmark} title="Nothing saved yet" hint="Bookmark a job from Discover to save it here" />
          ) : (
            <div className="space-y-2 mb-4">
              {saved.map(s => (
                <div key={s.id} className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl px-[14px] py-3 flex items-center gap-2.5">
                  <Bookmark className="w-[18px] h-[18px] flex-shrink-0" style={{ color: '#D4551A' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium truncate">{s.opportunity?.title}</p>
                    <p className="text-[12px] text-[var(--app-text-secondary)] truncate">{s.opportunity?.employer?.full_name || 'An employer'} · saved {daysAgo(s.created_at)} days ago</p>
                  </div>
                  <a href="/student/discover" className="flex items-center gap-1 text-[13px] font-semibold flex-shrink-0" style={{ color: '#D4551A' }}>
                    Apply <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={async () => { await unsaveOpportunity(profileId, s.opportunity_id); onChanged() }}
                    aria-label="Remove from saved" className="text-[var(--app-text-tertiary)] hover:text-danger-text transition flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-lg px-[12px] py-[10px] flex items-start gap-2" style={{ backgroundColor: '#E6F1FB' }}>
            <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#185FA5' }} />
            <p className="text-[12px]" style={{ color: '#0C447C' }}>Saved jobs is private. Only you can see it. Employers see only your Verified, Experience and Posts folders.</p>
          </div>
        </>
      )}

      {openWork && <VerifiedWorkDetail work={openWork} onClose={() => setOpenWork(null)} />}
    </div>
  )
}

// "When I click the work it should open so I can see it" -- tapping a
// verified piece used to do nothing at all. This shows the actual
// submitted content: the written answer/link, and the attached file
// (an image previews inline, anything else is a real download link),
// plus who verified it and against what criteria.
function VerifiedWorkDetail({ work, onClose }: { work: any; onClose: () => void }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const sub = work.submissions
  const wi = sub?.work_items
  const isImage = sub?.file_type && ['image/png', 'image/jpeg', 'image/webp'].includes(sub.file_type)

  useEffect(() => {
    if (sub?.file_path) getSignedFileUrl('submission-files', sub.file_path).then(({ url }) => setFileUrl(url))
  }, [sub?.file_path])

  return (
    // z-50 already paints this over the shell's nav (z-30) entirely --
    // this screen is meant to fully replace the visible chrome while
    // open, not sit alongside it. paddingBottom added for the home
    // indicator's own safe area, which nothing here was reserving --
    // matches every other full-screen overlay's convention.
    <div className="fixed inset-0 z-50 bg-[var(--app-bg)] overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="sticky top-0 z-10 flex items-center h-14 px-3 bg-[var(--app-bg)]/95 backdrop-blur border-b border-[var(--app-border)]">
        <button onClick={onClose} aria-label="Back" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 pb-10">
        <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl p-5">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full mb-3" style={{ backgroundColor: '#E1F5EE', color: '#0F6E56' }}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
          </span>
          <h1 className="text-[20px] font-bold leading-snug mb-2">{wi?.title}</h1>
          <p className="text-[12.5px] text-[var(--app-text-secondary)] mb-4">
            Verified by {wi?.organisations?.name || work.verifier?.full_name || 'a reviewer'} · {new Date(work.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>

          {wi?.criteria && (
            <div className="bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl px-4 py-3 mb-4">
              <p className="text-[11px] font-semibold text-[var(--app-text-secondary)] uppercase tracking-wide mb-1">Criteria</p>
              <p className="text-[13px] text-[var(--app-text-body)] leading-relaxed">{wi.criteria}</p>
            </div>
          )}

          {sub?.content && (
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-[var(--app-text-secondary)] uppercase tracking-wide mb-1.5">The work</p>
              <p className="text-[14px] text-[var(--app-text)] whitespace-pre-wrap leading-relaxed">{sub.content}</p>
            </div>
          )}

          {sub?.file_path && (
            isImage && fileUrl ? (
              <img src={fileUrl} alt="" className="w-full rounded-lg border border-[var(--app-border)]" />
            ) : (
              <a
                href={fileUrl || '#'} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl px-4 py-3 text-[13px] font-semibold text-[var(--app-text)] hover:border-white/20 transition"
              >
                <FilePlus className="w-4 h-4 text-[var(--app-text-secondary)] flex-shrink-0" />
                <span className="truncate">{sub.file_path.split('/').pop()}</span>
              </a>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// Full-screen, not an inline card -- matches how Instagram/TikTok
// actually do "Edit profile": its own screen, a centred avatar up top,
// each field on its own labelled row with real room to breathe, a
// Cancel/Save header instead of buttons buried at the bottom of a
// cramped box.
// Exported -- Settings' Account section (Display name / Bio /
// Interests / Profile photo rows) reuses this exact same screen
// rather than rebuilding four near-identical forms.
export function EditProfileScreen({ profile, onDone, onClose }: { profile: any; onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState(profile.full_name || '')
  const [username, setUsername] = useState(profile.username || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [tags, setTags] = useState((profile.interest_tags || []).join(', '))
  const [avatarPath, setAvatarPath] = useState<string | null>(profile.avatar_path || null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [error, setError] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)

  const pickPhoto = () => photoRef.current?.click()

  const onPhotoChosen = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setPhotoError('Choose an image file.')
    setUploadingPhoto(true); setPhotoError('')
    const { path, error } = await uploadAvatar(profile.id, file)
    setUploadingPhoto(false)
    if (error) return setPhotoError(error.message || 'Upload failed — try again.')
    setAvatarPath(path)
  }

  const removePhoto = async () => {
    setUploadingPhoto(true); setPhotoError('')
    const { error } = await removeAvatar(profile.id, avatarPath)
    setUploadingPhoto(false)
    if (error) return setPhotoError(error.message || "Couldn't remove that — try again.")
    setAvatarPath(null)
  }

  const save = async () => {
    setError('')
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '')
    if (cleanUsername && !/^[a-z0-9._]{3,20}$/.test(cleanUsername)) {
      return setError('Username: 3–20 characters, lowercase letters, numbers, dots or underscores only.')
    }
    setSaving(true)
    if (cleanUsername && cleanUsername !== (profile.username || '')) {
      const { available, error: checkErr } = await isUsernameAvailable(cleanUsername, profile.id)
      if (checkErr) { setSaving(false); return setError(checkErr.message) }
      if (!available) { setSaving(false); return setError('That username is taken — try another.') }
    }
    await Promise.all([
      updateUserProfile(profile.id, { full_name: name.trim(), username: cleanUsername || null }),
      updateProfileBioTags(profile.id, bio.trim(), tags.split(',').map((t: string) => t.trim()).filter(Boolean)),
    ])
    setSaving(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--app-bg)] overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 bg-[var(--app-bg)]/95 backdrop-blur border-b border-[var(--app-border)]">
        <button onClick={onClose} className="text-[15px] text-[var(--app-text-secondary)]">Cancel</button>
        <p className="text-[15px] font-semibold text-[var(--app-text)]">Edit profile</p>
        <button onClick={save} disabled={saving || !name.trim()} className="text-[15px] font-semibold text-brand disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="flex flex-col items-center pt-8 pb-6">
        <button onClick={pickPhoto} disabled={uploadingPhoto} className="relative disabled:opacity-60">
          <Avatar path={avatarPath} name={name || profile.full_name} size={96} textSize={32} variant="solid" />
          <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand flex items-center justify-center border-2 border-[#0f0f0f]">
            <Camera className="w-3.5 h-3.5 text-[var(--app-text)]" />
          </span>
        </button>
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => onPhotoChosen(e.target.files?.[0] || null)} />
        {photoError && <p className="text-[12px] text-danger-text mt-2 text-center px-8">{photoError}</p>}
        <div className="flex items-center gap-4 mt-3">
          <button onClick={pickPhoto} disabled={uploadingPhoto} className="text-[13px] font-semibold text-brand disabled:opacity-40">
            {uploadingPhoto ? 'Uploading…' : avatarPath ? 'Change photo' : 'Add photo'}
          </button>
          {avatarPath && (
            <button onClick={removePhoto} disabled={uploadingPhoto} className="text-[13px] font-semibold text-[var(--app-text-secondary)] disabled:opacity-40">
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="px-5 space-y-6 pb-10">
        {error && <p className="text-[13px] text-danger-text">{error}</p>}
        <EditField label="Name" value={name} onChange={setName} placeholder="Your name" />
        <EditField
          label="Username" value={username} onChange={setUsername} placeholder="e.g. amara.designs"
          hint="Your handle, shown as @username under your name."
        />
        <EditField
          label="Bio" value={bio} onChange={setBio} multiline maxLength={120}
          placeholder="Aspiring graphic designer · Year 10 · loves branding and illustration"
        />
        <EditField
          label="Interests" value={tags} onChange={setTags}
          placeholder="Up to 3, comma separated — e.g. Design, Illustration, Media"
          hint="Shown as tags on your profile — separate with commas."
        />
      </div>
    </div>
  )
}

function EditField({ label, value, onChange, placeholder, hint, multiline, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; multiline?: boolean; maxLength?: number
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold text-[var(--app-text-secondary)] mb-2">{label}</span>
      {multiline ? (
        <textarea
          value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} maxLength={maxLength}
          className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl px-4 py-3 text-[15px] text-[var(--app-text)] placeholder-[#555] outline-none focus:border-brand transition resize-none leading-relaxed"
        />
      ) : (
        <input
          value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl px-4 py-3 text-[15px] text-[var(--app-text)] placeholder-[#555] outline-none focus:border-brand transition"
        />
      )}
      {hint && <span className="block text-[12px] text-[var(--app-text-tertiary)] mt-1.5">{hint}</span>}
    </label>
  )
}

function AddExperienceForm({ profileId, onAdded }: { profileId: string; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!title.trim()) return
    setSaving(true)
    await addExperienceEntry(profileId, { title: title.trim(), organisation: organisation.trim() || undefined })
    setSaving(false)
    onAdded()
  }

  return (
    <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-3.5 space-y-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Saturday job at a local print shop" className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--app-text)] placeholder-[#555] outline-none focus:border-brand transition" />
      <input value={organisation} onChange={e => setOrganisation(e.target.value)} placeholder="Where (optional)" className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--app-text)] placeholder-[#555] outline-none focus:border-brand transition" />
      <button onClick={submit} disabled={!title.trim() || saving} className="px-3.5 py-2 rounded-lg bg-brand text-[var(--app-text)] text-[12px] font-semibold disabled:opacity-40">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

function AddQualForm({ profileId, onAdded }: { profileId: string; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [issuer, setIssuer] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    if (!title.trim()) return
    setSaving(true)
    let file_path: string | undefined
    if (file) {
      const { path } = await uploadSelfQualificationFile(profileId, file)
      if (path) file_path = path
    }
    await addSelfQualification(profileId, { title: title.trim(), issuer: issuer.trim() || undefined, file_path })
    setSaving(false)
    onAdded()
  }

  return (
    <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-3.5 space-y-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Level 2 Food Hygiene Certificate" className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--app-text)] placeholder-[#555] outline-none focus:border-brand transition" />
      <input value={issuer} onChange={e => setIssuer(e.target.value)} placeholder="Issued by (optional)" className="w-full bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-[13px] text-[var(--app-text)] placeholder-[#555] outline-none focus:border-brand transition" />
      <button onClick={() => fileRef.current?.click()} className="text-[12px] font-semibold text-[var(--app-text-secondary)] hover:text-brand transition">
        {file ? file.name : 'Attach a file (optional)'}
      </button>
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
      <div>
        <button onClick={submit} disabled={!title.trim() || saving} className="px-3.5 py-2 rounded-lg bg-brand text-[var(--app-text)] text-[12px] font-semibold disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function PostThumb({ post, canDelete, onDeleted }: { post: any; canDelete: boolean; onDeleted: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (post.image_path) getSignedFileUrl('post-images', post.image_path).then(({ url }) => setUrl(url))
    else if (post.video_path) getSignedFileUrl('post-videos', post.video_path).then(({ url }) => setUrl(url))
  }, [post.image_path, post.video_path])

  const remove = async () => { await deletePost(post.id); onDeleted() }

  return (
    <div className="relative aspect-square bg-[var(--app-surface-2)] rounded-lg overflow-hidden group">
      {post.video_path && url ? (
        <video src={url} className="w-full h-full object-cover" muted />
      ) : url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-2">
          {post.video_path
            ? <Play className="w-6 h-6 text-[var(--app-text-quaternary)]" />
            : <p className="text-[11px] text-[var(--app-text-tertiary)] line-clamp-4">{post.content}</p>}
        </div>
      )}
      {canDelete && (
        <button
          onClick={remove}
          className="absolute top-1.5 right-1.5 w-7 h-7 bg-[#2a2a2a] rounded-full flex items-center justify-center z-10"
        >
          <Trash2 className="w-3.5 h-3.5 text-[var(--app-text)]" />
        </button>
      )}
    </div>
  )
}
