'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  getWorkItems, createWorkItem, getGroups, createGroup, getGroupMembers,
  uploadWorkItemAttachment, uploadSubmissionFileFor, submitWorkForStudents, getSignedFileUrl,
} from '@/lib/supabase'
import { TextField, PrimaryButton, ErrorBanner } from '@/components/v2/Field'
import WorkshopSession from '@/components/v2/WorkshopSession'
import type { WorkItem, Group } from '@/lib/types'
import { Plus, X, Paperclip, UploadCloud, FileText, ExternalLink, CalendarClock, Users2, Video, MapPin } from 'lucide-react'

type ItemType = 'brief' | 'course' | 'workshop'

const COPY: Record<ItemType, { heading: string; button: string; empty: string }> = {
  brief:    { heading: 'Briefs',   button: 'New brief',   empty: 'No briefs yet.' },
  course:   { heading: 'Courses',  button: 'New course',  empty: 'No courses yet.' },
  workshop: { heading: 'Workshops', button: 'New workshop', empty: 'No workshops yet.' },
}

// Institution "Briefs", provider "Courses", and both roles' "Workshops"
// are the same underlying work_items table, filtered by type. Briefs
// gets the full rebuilt form (topic/assignment/attachments/deadline/
// group) per spec; Courses/Workshops keep the simpler creation form —
// the old platform's course system was a whole separate multi-week
// session-scheduling engine (course_sessions, live classrooms, project
// days) that doesn't exist in this schema, so "match the old flow" here
// means the field set, not resurrecting that entire subsystem.
export default function WorkItemsPanel({ type }: { type: ItemType }) {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const copy = COPY[type]

  const load = () => {
    if (!user?.organisation_id) return
    getWorkItems(user.organisation_id).then(({ data }) => {
      setItems((data || []).filter((i: any) => i.type === type))
      setLoading(false)
    })
  }
  useEffect(load, [user?.organisation_id, type])

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="font-bold text-ink text-[15px]">{copy.heading}</p>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 bg-brand text-white font-semibold text-[13px] px-4 py-2 rounded-lg hover:bg-brand-hover transition"
        >
          {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showCreate ? 'Cancel' : copy.button}
        </button>
      </div>

      {showCreate && (
        type === 'brief'
          ? <CreateBriefForm onCreated={() => { setShowCreate(false); load() }} />
          : <CreateWorkItemForm type={type} onCreated={() => { setShowCreate(false); load() }} />
      )}

      {loading ? (
        <p className="text-ink-tertiary text-[14px]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-ink-tertiary text-[14px]">{copy.empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => <WorkItemCard key={item.id} item={item} onChanged={load} />)}
        </div>
      )}
    </div>
  )
}

function WorkItemCard({ item, onChanged }: { item: any; onChanged: () => void }) {
  const attachments = item.work_item_attachments || []
  const [inSession, setInSession] = useState(false)
  return (
    <div className="border border-edge-subtle rounded-xl px-4 py-3.5">
      <div className="flex items-center justify-between mb-1">
        <p className="font-bold text-ink text-[14px]">{item.title}</p>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary bg-surface-muted px-2 py-0.5 rounded-full">
          {item.visibility}
        </span>
      </div>
      {item.topic && <p className="text-[12px] text-ink-tertiary mb-1.5">{item.topic}</p>}
      {(item.assignment || item.description) && <p className="text-[13px] text-ink-secondary mb-2 whitespace-pre-wrap">{item.assignment || item.description}</p>}
      <p className="text-[12px] text-ink-tertiary mb-2"><span className="font-semibold">Criteria:</span> {item.criteria}</p>
      <div className="flex items-center gap-3.5 flex-wrap text-[12px] text-ink-tertiary">
        {item.deadline && (
          <span className="flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> Due {new Date(item.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        )}
        <span className="flex items-center gap-1"><Users2 className="w-3.5 h-3.5" /> {item.groups?.name || 'Whole organisation'}</span>
        {(item.type === 'workshop' || item.type === 'course') && item.mode === 'online' && (
          <span className="flex items-center gap-1 text-success-text font-semibold"><Video className="w-3.5 h-3.5" /> Online</span>
        )}
        {(item.type === 'workshop' || item.type === 'course') && item.mode === 'in_person' && (
          <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {item.location || 'In person'}</span>
        )}
      </div>
      {(item.type === 'workshop' || item.type === 'course') && item.mode === 'online' && (
        item.ended_at ? (
          <span className="inline-flex items-center gap-1.5 bg-surface-muted text-ink-tertiary font-semibold text-[12px] px-3.5 py-2 rounded-lg mt-3">
            <Video className="w-3.5 h-3.5" /> Ended
          </span>
        ) : (
          <button
            onClick={() => setInSession(true)}
            className="flex items-center gap-1.5 bg-success-solid text-white font-semibold text-[12px] px-3.5 py-2 rounded-lg mt-3 hover:bg-success-solid-hover transition"
          >
            <Video className="w-3.5 h-3.5" /> Start / join session
          </button>
        )
      )}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-edge-subtle">
          {attachments.map((a: any) => <AttachmentChip key={a.id} attachment={a} />)}
        </div>
      )}
      {inSession && (
        <WorkshopSession
          workItemId={item.id} title={item.title} canEnd
          onClose={() => setInSession(false)}
          onEnded={onChanged}
        />
      )}
    </div>
  )
}

function AttachmentChip({ attachment }: { attachment: any }) {
  const [url, setUrl] = useState<string | null>(null)
  const open = async () => {
    if (url) return window.open(url, '_blank')
    const { url: signed } = await getSignedFileUrl('work-item-attachments', attachment.file_path)
    if (signed) { setUrl(signed); window.open(signed, '_blank') }
  }
  return (
    <button onClick={open} className="flex items-center gap-1.5 bg-surface-subtle border border-edge rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink-secondary hover:border-brand transition">
      <Paperclip className="w-3 h-3" /> {attachment.file_name}
    </button>
  )
}

// Assign-to picker: pick an existing group, or create one inline --
// orgs start with zero groups, so this has to be usable from empty.
function GroupPicker({ organisationId, value, onChange, required }: { organisationId?: string; value: string; onChange: (id: string) => void; required?: boolean }) {
  const { user } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    if (!organisationId) return
    getGroups(organisationId).then(({ data }) => setGroups(data || []))
  }
  useEffect(load, [organisationId])

  const handleCreate = async () => {
    if (!newName.trim() || !organisationId || !user) return
    setBusy(true)
    const { data, error } = await createGroup(organisationId, user.id, newName.trim())
    setBusy(false)
    if (!error && data) {
      setGroups(prev => [...prev, data as Group])
      onChange((data as Group).id)
      setNewName(''); setCreating(false)
    }
  }

  return (
    <label className="block mb-5">
      <span className="block text-[13px] font-semibold text-ink mb-1.5">
        Assign to {required ? '' : <span className="text-ink-tertiary font-normal">(leave blank for the whole organisation)</span>}
      </span>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-surface border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition"
        >
          <option value="">{required ? 'Select a group…' : 'Whole organisation'}</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button type="button" onClick={() => setCreating(v => !v)} className="px-3 py-2.5 rounded-lg border border-edge text-[13px] font-semibold text-ink-secondary hover:border-brand transition flex-shrink-0">
          + New group
        </button>
      </div>
      {creating && (
        <div className="flex gap-2 mt-2">
          <input
            value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Year 12 Media Studies" autoFocus
            className="flex-1 bg-surface border border-edge rounded-lg px-3 py-2 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
          />
          <button type="button" onClick={handleCreate} disabled={busy || !newName.trim()} className="px-3.5 py-2 rounded-lg bg-brand text-white text-[13px] font-semibold disabled:opacity-40">
            Add
          </button>
        </div>
      )}
    </label>
  )
}

function FileDropzone({ files, onChange, multiple }: { files: File[]; onChange: (files: File[]) => void; multiple?: boolean }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (list: FileList | null) => {
    if (!list) return
    onChange(multiple ? [...files, ...Array.from(list)] : [Array.from(list)[0]])
  }

  return (
    <div className="mb-5">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl py-7 cursor-pointer transition ${
          dragOver ? 'border-brand bg-accent-bg' : 'border-edge hover:border-edge-input'
        }`}
      >
        <UploadCloud className="w-5 h-5 text-ink-tertiary" />
        <p className="text-[13px] font-semibold text-ink">Drag and drop, or click to choose {multiple ? 'files' : 'a file'}</p>
        <p className="text-[11px] text-ink-quaternary">PDF, Word, PowerPoint, or image · up to 25MB</p>
        <input
          ref={inputRef} type="file" multiple={multiple} className="hidden"
          onChange={e => addFiles(e.target.files)}
        />
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1.5 bg-surface-subtle border border-edge rounded-full pl-2.5 pr-1.5 py-1 text-[11px] font-semibold text-ink-secondary">
              <FileText className="w-3 h-3" /> {f.name}
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="hover:text-danger-text">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Courses/Workshops — both online-or-in-person, both with a real
// deadline and topic/description, not just a bare title+criteria.
function CreateWorkItemForm({ type, onCreated }: { type: ItemType; onCreated: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [criteria, setCriteria] = useState('')
  const [deadline, setDeadline] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const [mode, setMode] = useState<'online' | 'in_person'>('online')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) return setError('Give it a title.')
    if (!criteria.trim()) return setError('Criteria is required — this is what the tutor checks the work against, and what makes the green tick mean something.')
    if (mode === 'in_person' && !location.trim()) return setError(`Add where the ${type} is happening.`)
    if (!user?.organisation_id) return

    setLoading(true)
    const { error: createError } = await createWorkItem(user.organisation_id, user.id, {
      type, title: title.trim(), topic: topic.trim() || undefined, description: description.trim() || undefined,
      criteria: criteria.trim(), visibility, deadline: deadline || null,
      mode, location: mode === 'in_person' ? location.trim() : undefined,
    })
    setLoading(false)
    if (createError) return setError(createError.message)
    setTitle(''); setTopic(''); setDescription(''); setCriteria(''); setDeadline(''); setLocation('')
    onCreated()
  }

  return (
    <div className="bg-surface-subtle border border-edge-subtle rounded-xl p-5 mb-5">
      <ErrorBanner message={error} />
      <TextField label="Title" value={title} onChange={setTitle} placeholder={type === 'course' ? 'Intro to Web Development' : 'Design a mobile app icon'} autoFocus />
      <TextField label="Topic / subject (optional)" value={topic} onChange={setTopic} placeholder={type === 'course' ? 'e.g. Web Development' : 'e.g. Graphic Design'} />
      <TextField label="Description" value={description} onChange={setDescription} placeholder="What will students learn or do?" />
      <TextField
        label="Criteria — what success looks like"
        value={criteria} onChange={setCriteria}
        placeholder="e.g. Original, scalable to 16px, with a one-paragraph rationale"
        hint="Visible to students too. This is what a tutor checks the work against when they verify it."
      />
      <label className="block mb-4">
        <span className="block text-[13px] font-semibold text-ink mb-1.5">Deadline (optional)</span>
        <input
          type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
          className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition"
        />
      </label>
      <label className="block mb-4">
        <span className="block text-[13px] font-semibold text-ink mb-1.5">Where</span>
        <div className="flex gap-2 mb-2">
          {(['online', 'in_person'] as const).map(m => (
            <button
              key={m} type="button" onClick={() => setMode(m)}
              className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition ${
                mode === m ? 'bg-brand text-white' : 'bg-surface border border-edge text-ink-secondary'
              }`}
            >
              {m === 'online' ? 'Online' : 'In person'}
            </button>
          ))}
        </div>
        {mode === 'in_person' ? (
          <input
            value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Room 4B, main campus"
            className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition"
          />
        ) : (
          <p className="text-[12px] text-ink-tertiary">A live video room is created automatically — everyone joins from the {type} card.</p>
        )}
      </label>
      <label className="block mb-5">
        <span className="block text-[13px] font-semibold text-ink mb-1.5">Visibility</span>
        <div className="flex gap-2">
          {(['private', 'public'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold capitalize transition ${
                visibility === v ? 'bg-brand text-white' : 'bg-surface border border-edge text-ink-secondary'
              }`}
            >
              {v === 'private' ? 'Private — join code only' : 'Public'}
            </button>
          ))}
        </div>
      </label>
      <PrimaryButton onClick={handleSubmit} loading={loading}>Create</PrimaryButton>
    </div>
  )
}

type BriefMode = 'new' | 'existing'

// Briefs' "two ways": set a new brief, or upload coursework/exam work a
// group already produced elsewhere and mark it for verification directly
// — no new marking, straight into the review queue.
function CreateBriefForm({ onCreated }: { onCreated: () => void }) {
  const [mode, setMode] = useState<BriefMode>('new')
  return (
    <div className="mb-5">
      <div className="flex gap-2 mb-3">
        {([['new', 'Set a new brief'], ['existing', 'Upload work students already do']] as [BriefMode, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition ${
              mode === key ? 'bg-brand text-white' : 'bg-surface border border-edge text-ink-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'new' ? <NewBriefForm onCreated={onCreated} /> : <UploadExistingWorkForm onCreated={onCreated} />}
    </div>
  )
}

function NewBriefForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [assignment, setAssignment] = useState('')
  const [criteria, setCriteria] = useState('')
  const [deadline, setDeadline] = useState('')
  const [groupId, setGroupId] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) return setError('Give it a title.')
    if (!assignment.trim()) return setError('Write what the student has to do.')
    if (!criteria.trim()) return setError('Success criteria is required — this is what makes the tick mean something.')
    if (!user?.organisation_id) return

    setLoading(true)
    const { data: workItem, error: createError } = await createWorkItem(user.organisation_id, user.id, {
      type: 'brief', title: title.trim(), topic: topic.trim() || undefined, assignment: assignment.trim(),
      criteria: criteria.trim(), deadline: deadline || null, group_id: groupId || null, visibility,
    })
    if (createError || !workItem) { setLoading(false); return setError(createError?.message || 'Could not create the brief.') }

    for (const file of files) {
      const { error: attachError } = await uploadWorkItemAttachment((workItem as any).id, user.id, file)
      if (attachError) { setLoading(false); return setError(`Brief created, but "${file.name}" failed to attach: ${attachError.message}`) }
    }
    setLoading(false)
    setTitle(''); setTopic(''); setAssignment(''); setCriteria(''); setDeadline(''); setGroupId(''); setFiles([])
    onCreated()
  }

  return (
    <div className="bg-surface-subtle border border-edge-subtle rounded-xl p-5">
      <ErrorBanner message={error} />
      <TextField label="Title" value={title} onChange={setTitle} placeholder="Design a mobile app icon" autoFocus />
      <TextField label="Topic / subject" value={topic} onChange={setTopic} placeholder="e.g. Graphic Design" />
      <label className="block mb-4">
        <span className="block text-[13px] font-semibold text-ink mb-1.5">Assignment — what the student has to do</span>
        <textarea
          value={assignment} onChange={e => setAssignment(e.target.value)}
          placeholder="Write the full instructions here — as much room as you need."
          rows={6}
          className="w-full bg-surface border border-edge rounded-xl px-4 py-3 text-[14px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none leading-relaxed"
        />
      </label>
      <label className="block mb-1.5">
        <span className="block text-[13px] font-semibold text-ink mb-1.5">Attachments (optional)</span>
      </label>
      <FileDropzone files={files} onChange={setFiles} multiple />
      <TextField
        label="Success criteria" value={criteria} onChange={setCriteria}
        placeholder="e.g. Original, scalable to 16px, with a one-paragraph rationale"
        hint="Visible to the student too. What a tutor checks the work against when they verify it."
      />
      <label className="block mb-5">
        <span className="block text-[13px] font-semibold text-ink mb-1.5">Deadline (optional)</span>
        <input
          type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
          className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink outline-none focus:border-brand transition"
        />
      </label>
      <GroupPicker organisationId={user?.organisation_id} value={groupId} onChange={setGroupId} />
      <label className="block mb-5">
        <span className="block text-[13px] font-semibold text-ink mb-1.5">Visibility</span>
        <div className="flex gap-2">
          {(['private', 'public'] as const).map(v => (
            <button
              key={v} type="button" onClick={() => setVisibility(v)}
              className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold capitalize transition ${
                visibility === v ? 'bg-brand text-white' : 'bg-surface border border-edge text-ink-secondary'
              }`}
            >
              {v === 'private' ? 'Private — join code only' : 'Public'}
            </button>
          ))}
        </div>
      </label>
      <PrimaryButton onClick={handleSubmit} loading={loading}>Create</PrimaryButton>
    </div>
  )
}

function UploadExistingWorkForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [criteria, setCriteria] = useState('')
  const [groupId, setGroupId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) return setError('Give it a title.')
    if (!criteria.trim()) return setError('Criteria is required — this is what makes the tick mean something.')
    if (!groupId) return setError('Choose which class/group this work belongs to.')
    if (files.length === 0) return setError('Attach the existing work — drag it in or choose a file.')
    if (!user?.organisation_id) return

    setLoading(true)
    const { data: members, error: membersError } = await getGroupMembers(groupId)
    if (membersError || !members || members.length === 0) {
      setLoading(false)
      return setError('That group has no students in it yet.')
    }

    const { data: workItem, error: createError } = await createWorkItem(user.organisation_id, user.id, {
      type: 'brief', title: title.trim(), topic: topic.trim() || undefined,
      criteria: criteria.trim(), group_id: groupId, visibility: 'private',
    })
    if (createError || !workItem) { setLoading(false); return setError(createError?.message || 'Could not create the brief.') }

    const file = files[0]
    for (const member of members) {
      const { path, error: uploadError } = await uploadSubmissionFileFor(member.id, file)
      if (uploadError || !path) { setLoading(false); return setError(`Brief created, but uploading for ${member.full_name} failed: ${uploadError?.message}`); }
      const { error: submitError } = await submitWorkForStudents([member.id], (workItem as any).id, '', { path, type: file.type, size: file.size })
      if (submitError) { setLoading(false); return setError(`Brief created, but marking ${member.full_name}'s work failed: ${submitError.message}`) }
    }
    setLoading(false)
    setTitle(''); setTopic(''); setCriteria(''); setGroupId(''); setFiles([])
    onCreated()
  }

  return (
    <div className="bg-surface-subtle border border-edge-subtle rounded-xl p-5">
      <ErrorBanner message={error} />
      <TextField label="Title" value={title} onChange={setTitle} placeholder="Year 11 Coursework — Unit 3" autoFocus />
      <TextField label="Topic / subject" value={topic} onChange={setTopic} placeholder="e.g. GCSE Photography" />
      <label className="block mb-1.5">
        <span className="block text-[13px] font-semibold text-ink mb-1.5">The existing work</span>
      </label>
      <FileDropzone files={files} onChange={setFiles} />
      <TextField
        label="Success criteria" value={criteria} onChange={setCriteria}
        placeholder="e.g. Meets the exam board's grade 5+ descriptor"
        hint="What a tutor checks the existing work against when they verify it."
      />
      <GroupPicker organisationId={user?.organisation_id} value={groupId} onChange={setGroupId} required />
      <p className="text-[12px] text-ink-tertiary mb-4">This already happened outside LERN — no new marking, just verification. Every student currently in the group gets this marked as their submission, ready to review.</p>
      <PrimaryButton onClick={handleSubmit} loading={loading}>Create and send to review</PrimaryButton>
    </div>
  )
}
