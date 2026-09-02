'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import {
  getFollowCounts, getVerifiedWorkForProfile, getMyPosts, getSelfQualifications,
  addSelfQualification, deleteSelfQualification, uploadSelfQualificationFile, getSignedFileUrl, deletePost,
  updateProfileBioTags, getExperienceEntries, addExperienceEntry, deleteExperienceEntry,
  getSavedOpportunities, unsaveOpportunity, updateUserProfile, uploadAvatar, removeAvatar, getAvatarUrl,
} from '@/lib/supabase'
import {
  FolderCheck, Briefcase, Grid3x3, Settings, Plus, X, Trash2, Play,
  Eye, Bookmark, Lock, FilePlus, CheckCircle2, Camera,
} from 'lucide-react'

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}
function daysAgo(dateStr: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)))
}

type Folder = 'verified' | 'experience' | 'posts'

// LERN Complete Build Spec: Student Profile, Job Tracker, Employer
// Side v1.0, Part 1. Colours/sizes here are the spec's pinned values
// EXCEPT page/card background and body text, which stay this app's
// existing dark palette (#0f0f0f/#1a1a1a/white) rather than the spec's
// literal #FFFDF9 light claim -- same call as Briefs: the user's own
// reference screenshot for this exact screen is dark, not light, and
// that's what's authoritative. The pinned accent hex values (avatar,
// tag pills, folder icons, the blue safeguarding note) are used
// exactly as given regardless -- those read fine as colour accents on
// a dark page and the spec is explicit that hex codes aren't to be
// substituted.
//
// ownView === true adds the private Saved jobs section; nothing else
// changes between public and own view. A userId prop will be how a
// future "view someone else's profile" screen reuses this same
// component -- not wired to any other surface yet, only this student's
// own /student/profile route.
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

  const folderCount = { verified: verified.length, experience: experience.length, posts: posts.length }

  return (
    // px-4, matching every other panel (Feed/My Work/Discover) against
    // main's own zero padding -- this used to be -mx-4 px-5, a leftover
    // assumption that main already had 16px of its own padding to cancel
    // out. It doesn't (checked directly against main's className), so
    // that combo left only a ~4px gutter on each side: content read as
    // "too wide" because it really was rendered almost edge-to-edge,
    // not because of the internal spacing.
    <div className="bg-[#0f0f0f] min-h-[calc(100vh-56px)] text-white px-4 pt-4 pb-8">
      {/* ── HEADER: avatar left, 3 counts, name, bio, tags ──
          More breathing room throughout this screen than the first
          pass -- generous gaps and padding instead of the spec's
          literal (very tight) pixel values, closer to how Instagram/
          TikTok actually give a profile room rather than packing it
          edge to edge. */}
      <div className="flex items-center gap-5 mb-5">
        <Avatar path={profile.avatar_path} name={profile.full_name} size={64} textSize={22} />
        <div className="flex flex-1 justify-around">
          <Stat n={folderCount.verified} label="work" />
          <Stat n={counts.followers} label="followers" />
          <Stat n={counts.following} label="following" />
        </div>
      </div>

      <p className="text-[16px] font-medium mb-1.5">{profile.full_name}</p>
      {profile.bio && <p className="text-[13px] text-[#999] leading-[1.6] mb-2.5">{profile.bio}</p>}
      {(profile.interest_tags || []).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {profile.interest_tags.slice(0, 3).map((t: string) => (
            <span key={t} className="text-[12px] px-3 py-1 rounded-full" style={{ backgroundColor: '#E6F1FB', color: '#0C447C' }}>{t}</span>
          ))}
        </div>
      )}

      {isOwn && (
        <div className="flex gap-2.5 mb-6">
          <button onClick={() => setEditingBio(true)} className="flex-1 bg-[#1a1a1a] border border-white/10 py-3 rounded-xl text-sm font-semibold text-center hover:bg-[#222] transition">
            Edit profile
          </button>
          <button onClick={() => router.push('/student/settings')} className="bg-[#1a1a1a] border border-white/10 p-3 rounded-xl hover:bg-[#222] transition">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      )}
      {editingBio && (
        <EditProfileScreen
          profile={profile}
          onDone={async () => { await refreshUser(); setEditingBio(false); load() }}
          onClose={() => setEditingBio(false)}
        />
      )}

      {/* ── THREE FOLDERS (public shopfront, exact order) ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <FolderTile active={folder === 'verified'} onClick={() => setFolder('verified')} icon={FolderCheck} iconColor="#0F6E56" label="Verified work" count={`${folderCount.verified} pieces`} />
        <FolderTile active={folder === 'experience'} onClick={() => setFolder('experience')} icon={Briefcase} iconColor="#D4551A" label="Experience" count={`${folderCount.experience} entries`} />
        <FolderTile active={folder === 'posts'} onClick={() => setFolder('posts')} icon={Grid3x3} iconColor="#888888" label="Posts" count={`${folderCount.posts} posts`} />
      </div>

      {/* ── OWN VIEW ONLY: Your view + Saved jobs button ── */}
      {isOwn && (
        <div className="flex items-center justify-between mb-4">
          <span className="flex items-center gap-1.5 text-[12px] text-[#999]"><Eye className="w-3.5 h-3.5" /> Your view</span>
          <button onClick={() => setFolder('saved' as any)} className="flex items-center gap-1.5 bg-[#141414] border border-white/10 px-3.5 py-2 rounded-lg text-[12px] font-semibold">
            <Bookmark className="w-3.5 h-3.5" /> Saved jobs · {saved.length}
          </button>
        </div>
      )}

      {folder === 'saved' as any ? (
        <SavedJobsSection profileId={profileId!} saved={saved} onChanged={load} />
      ) : (
        <>
          <p className="text-[13px] font-medium text-[#999] mb-2.5">Inside {folder === 'verified' ? 'verified work' : folder === 'experience' ? 'experience' : 'posts'}</p>

          {folder === 'verified' && (
            loading ? <p className="text-[13px] text-[#666]">Loading…</p> : (verified.length === 0 && quals.length === 0) ? (
              <EmptyState icon={FolderCheck} title="Nothing here yet" hint="It'll show up here the moment a tutor verifies your first piece of work" />
            ) : (
              <div className="space-y-2">
                {verified.map(v => (
                  <div key={v.id} className="bg-[#141414] border border-white/10 rounded-lg px-[11px] py-[9px] flex items-start gap-2.5">
                    <CheckCircle2 className="w-[18px] h-[18px] flex-shrink-0 mt-0.5" style={{ color: '#0F6E56' }} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate">{v.submissions?.work_items?.title}</p>
                      <p className="text-[12px] text-[#999]">
                        Verified by {v.submissions?.work_items?.organisations?.name || v.verifier?.full_name || 'a reviewer'} · {new Date(v.verified_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
                {quals.map(q => (
                  <div key={q.id} className="rounded-lg px-[11px] py-[9px] flex items-start gap-2.5 border border-dashed" style={{ borderColor: '#8A8A8A' }}>
                    <FilePlus className="w-[18px] h-[18px] flex-shrink-0 mt-0.5" style={{ color: '#8A8A8A' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium truncate">{q.title}</p>
                      <p className="text-[12px]"><span style={{ color: '#8A8A8A' }}>Self-added certificate · not verified by LERN</span></p>
                    </div>
                    {isOwn && (
                      <button onClick={async () => { await deleteSelfQualification(q.id); load() }} className="text-[#666] hover:text-danger-text transition flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {isOwn && (
                  <button onClick={() => setAddingQual(v => !v)} className="text-[12px] font-semibold text-brand flex items-center gap-1">
                    {addingQual ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} Add a self-added certificate
                  </button>
                )}
                {addingQual && <AddQualForm profileId={profileId!} onAdded={() => { setAddingQual(false); load() }} />}
              </div>
            )
          )}

          {folder === 'experience' && (
            <div className="space-y-2">
              {experience.length === 0 ? (
                <EmptyState icon={Briefcase} title="Nothing added yet" hint="Work placements, volunteering, part-time work — anything real-world" />
              ) : experience.map(e => (
                <div key={e.id} className="bg-[#141414] border border-white/10 rounded-lg px-[11px] py-[9px] flex items-start gap-2.5">
                  <Briefcase className="w-[18px] h-[18px] flex-shrink-0 mt-0.5" style={{ color: '#D4551A' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium truncate">{e.title}</p>
                    {e.organisation && <p className="text-[12px] text-[#999] truncate">{e.organisation}</p>}
                  </div>
                  {isOwn && (
                    <button onClick={async () => { await deleteExperienceEntry(e.id); load() }} className="text-[#666] hover:text-danger-text transition flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {isOwn && (
                <button onClick={() => setAddingExperience(v => !v)} className="text-[12px] font-semibold text-brand flex items-center gap-1">
                  {addingExperience ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} Add experience
                </button>
              )}
              {addingExperience && <AddExperienceForm profileId={profileId!} onAdded={() => { setAddingExperience(false); load() }} />}
            </div>
          )}

          {folder === 'posts' && (
            posts.length === 0 ? (
              <EmptyState icon={Grid3x3} title="No posts yet" hint="Tap + to share something" />
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {posts.map(p => <PostThumb key={p.id} post={p} canDelete={isOwn} onDeleted={load} />)}
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}

// Shared everywhere a profile photo shows: real image if avatar_path
// is set, initials on the same brand-blue circle otherwise -- so
// there's never a broken/empty state, just a graceful fallback.
export function Avatar({ path, name, size, textSize }: { path?: string | null; name?: string; size: number; textSize: number }) {
  const url = getAvatarUrl(path)
  return url ? (
    <img
      src={url} alt="" width={size} height={size}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-medium"
      style={{ width: size, height: size, fontSize: textSize, backgroundColor: '#E6F1FB', color: '#185FA5' }}
    >
      {initials(name)}
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-[17px] font-medium leading-none">{n}</p>
      <p className="text-[12px] text-[#999] mt-1">{label}</p>
    </div>
  )
}

function FolderTile({ active, onClick, icon: Icon, iconColor, label, count }: { active: boolean; onClick: () => void; icon: any; iconColor: string; label: string; count: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center text-center py-3.5 px-2 rounded-xl border transition ${active ? 'border-white/25 bg-[#1a1a1a]' : 'border-white/10 bg-[#141414]'}`}
    >
      <Icon className="w-[26px] h-[26px] mb-1.5" style={{ color: iconColor }} />
      <p className="text-[13px] font-medium">{label}</p>
      <p className="text-[12px] text-[#999] mt-0.5">{count}</p>
    </button>
  )
}

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center text-center py-10">
      <Icon className="w-7 h-7 text-[#333] mb-2.5" />
      <p className="font-semibold text-[13px] mb-1">{title}</p>
      <p className="text-[12px] text-[#666]">{hint}</p>
    </div>
  )
}

function SavedJobsSection({ profileId, saved, onChanged }: { profileId: string; saved: any[]; onChanged: () => void }) {
  return (
    <div>
      <div className="rounded-lg px-[12px] py-[10px] mb-3 flex items-start gap-2" style={{ backgroundColor: '#E6F1FB' }}>
        <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#185FA5' }} />
        <p className="text-[12px]" style={{ color: '#0C447C' }}>Saved jobs is private. Only you can see it. Employers see only your three folders above.</p>
      </div>
      <p className="text-[13px] font-medium text-[#999] mb-2.5">Saved jobs</p>
      {saved.length === 0 ? (
        <EmptyState icon={Bookmark} title="Nothing saved yet" hint="Bookmark a job from Discover to save it here" />
      ) : (
        <div className="space-y-2">
          {saved.map(s => (
            <div key={s.id} className="bg-[#141414] border border-white/10 rounded-lg px-[11px] py-[9px] flex items-center gap-2.5">
              <Bookmark className="w-[18px] h-[18px] flex-shrink-0" style={{ color: '#D4551A' }} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium truncate">{s.opportunity?.title}</p>
                <p className="text-[12px] text-[#999] truncate">{s.opportunity?.employer?.full_name || 'An employer'} · saved {daysAgo(s.created_at)} days ago</p>
              </div>
              <button
                onClick={async () => { await unsaveOpportunity(profileId, s.opportunity_id); onChanged() }}
                className="text-[13px] font-semibold flex-shrink-0" style={{ color: '#D4551A' }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
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
  const [bio, setBio] = useState(profile.bio || '')
  const [tags, setTags] = useState((profile.interest_tags || []).join(', '))
  const [avatarPath, setAvatarPath] = useState<string | null>(profile.avatar_path || null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photoError, setPhotoError] = useState('')
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
    setSaving(true)
    await Promise.all([
      updateUserProfile(profile.id, { full_name: name.trim() }),
      updateProfileBioTags(profile.id, bio.trim(), tags.split(',').map((t: string) => t.trim()).filter(Boolean)),
    ])
    setSaving(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f0f] overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 bg-[#0f0f0f]/95 backdrop-blur border-b border-white/10">
        <button onClick={onClose} className="text-[15px] text-[#999]">Cancel</button>
        <p className="text-[15px] font-semibold text-white">Edit profile</p>
        <button onClick={save} disabled={saving || !name.trim()} className="text-[15px] font-semibold text-brand disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="flex flex-col items-center pt-8 pb-6">
        <button onClick={pickPhoto} disabled={uploadingPhoto} className="relative disabled:opacity-60">
          <Avatar path={avatarPath} name={name || profile.full_name} size={96} textSize={32} />
          <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand flex items-center justify-center border-2 border-[#0f0f0f]">
            <Camera className="w-3.5 h-3.5 text-white" />
          </span>
        </button>
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => onPhotoChosen(e.target.files?.[0] || null)} />
        {photoError && <p className="text-[12px] text-danger-text mt-2 text-center px-8">{photoError}</p>}
        <div className="flex items-center gap-4 mt-3">
          <button onClick={pickPhoto} disabled={uploadingPhoto} className="text-[13px] font-semibold text-brand disabled:opacity-40">
            {uploadingPhoto ? 'Uploading…' : avatarPath ? 'Change photo' : 'Add photo'}
          </button>
          {avatarPath && (
            <button onClick={removePhoto} disabled={uploadingPhoto} className="text-[13px] font-semibold text-[#999] disabled:opacity-40">
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="px-5 space-y-6 pb-10">
        <EditField label="Name" value={name} onChange={setName} placeholder="Your name" />
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
      <span className="block text-[13px] font-semibold text-[#999] mb-2">{label}</span>
      {multiline ? (
        <textarea
          value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} maxLength={maxLength}
          className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-[15px] text-white placeholder-[#555] outline-none focus:border-brand transition resize-none leading-relaxed"
        />
      ) : (
        <input
          value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-[15px] text-white placeholder-[#555] outline-none focus:border-brand transition"
        />
      )}
      {hint && <span className="block text-[12px] text-[#666] mt-1.5">{hint}</span>}
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
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-3.5 space-y-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Saturday job at a local print shop" className="w-full bg-[#141414] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder-[#555] outline-none focus:border-brand transition" />
      <input value={organisation} onChange={e => setOrganisation(e.target.value)} placeholder="Where (optional)" className="w-full bg-[#141414] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder-[#555] outline-none focus:border-brand transition" />
      <button onClick={submit} disabled={!title.trim() || saving} className="px-3.5 py-2 rounded-lg bg-brand text-white text-[12px] font-semibold disabled:opacity-40">
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
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-3.5 space-y-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Level 2 Food Hygiene Certificate" className="w-full bg-[#141414] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder-[#555] outline-none focus:border-brand transition" />
      <input value={issuer} onChange={e => setIssuer(e.target.value)} placeholder="Issued by (optional)" className="w-full bg-[#141414] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder-[#555] outline-none focus:border-brand transition" />
      <button onClick={() => fileRef.current?.click()} className="text-[12px] font-semibold text-[#999] hover:text-brand transition">
        {file ? file.name : 'Attach a file (optional)'}
      </button>
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
      <div>
        <button onClick={submit} disabled={!title.trim() || saving} className="px-3.5 py-2 rounded-lg bg-brand text-white text-[12px] font-semibold disabled:opacity-40">
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
      {canDelete && (
        <button
          onClick={remove}
          className="absolute top-1.5 right-1.5 w-7 h-7 bg-[#2a2a2a] rounded-full flex items-center justify-center z-10"
        >
          <Trash2 className="w-3.5 h-3.5 text-white" />
        </button>
      )}
    </div>
  )
}
