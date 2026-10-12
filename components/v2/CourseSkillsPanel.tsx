'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/context/AuthContext'
import { useResolvedTheme } from '@/context/ThemeProvider'
import { getCourses, createCourse, getCourseSkills, createSkill } from '@/lib/supabase'
import { TextField, PrimaryButton, ErrorBanner, Spinner } from '@/components/v2/Field'
import type { Course, Skill } from '@/lib/types'
import { Plus, X } from 'lucide-react'

// Skill Wallet (Phase 1), staff-only -- set up a course once, add 2-4
// skills each with 2-4 criteria. Nothing here touches work_items at
// all; tagging a brief/workshop/course against these skills happens
// from the ordinary create-work form instead (WorkItemsPanel's own
// SkillTagPicker reads whatever's set up here).
export default function CourseSkillsPanel() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [skills, setSkills] = useState<Skill[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [showNewCourse, setShowNewCourse] = useState(false)
  const [showNewSkill, setShowNewSkill] = useState(false)

  const load = () => {
    if (!user?.organisation_id) return
    getCourses(user.organisation_id).then(({ data }) => {
      const list = data || []
      setCourses(list)
      setLoading(false)
      if (!selectedId && list.length > 0) setSelectedId(list[0].id)
    })
  }
  useEffect(load, [user?.organisation_id])

  const loadSkills = (courseId: string) => {
    setSkillsLoading(true)
    getCourseSkills(courseId).then(({ data }) => { setSkills(data || []); setSkillsLoading(false) })
  }
  useEffect(() => { if (selectedId) loadSkills(selectedId) }, [selectedId])

  const selected = courses.find(c => c.id === selectedId) || null

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-bold text-ink text-[15px]">Skills</p>
          <p className="text-[13px] text-ink-tertiary mt-0.5">Set up once per course — tag briefs and workshops against them when you create one.</p>
        </div>
        <button
          onClick={() => setShowNewCourse(true)}
          className="flex items-center gap-1.5 border border-edge text-ink font-semibold text-[13px] px-4 py-2 rounded-lg hover:border-edge-input transition flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> New course
        </button>
      </div>

      {loading ? (
        <p className="text-ink-tertiary text-[14px]">Loading…</p>
      ) : courses.length === 0 ? (
        <p className="text-ink-tertiary text-[14px]">No courses yet — create one, then add skills to it.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            {courses.map(c => (
              <button
                key={c.id} onClick={() => setSelectedId(c.id)}
                className={`px-4 py-2 rounded-lg text-[13px] font-semibold border transition ${selectedId === c.id ? 'border-ink bg-surface text-ink' : 'border-edge text-ink-tertiary hover:text-ink'}`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {selected && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-semibold text-ink-tertiary uppercase tracking-wide">{selected.name} — skills</p>
                <button
                  onClick={() => setShowNewSkill(true)}
                  className="flex items-center gap-1.5 border border-edge text-ink font-semibold text-[13px] px-4 py-2 rounded-lg hover:border-edge-input transition flex-shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add skill
                </button>
              </div>
              {skillsLoading ? (
                <p className="text-ink-tertiary text-[14px]">Loading…</p>
              ) : skills.length === 0 ? (
                <p className="text-ink-tertiary text-[14px]">No skills yet for this course.</p>
              ) : (
                <div className="space-y-3">
                  {skills.map(s => <SkillCard key={s.id} skill={s} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showNewCourse && (
        <NewCourseForm
          onClose={() => setShowNewCourse(false)}
          onCreated={course => { setCourses(prev => [course, ...prev]); setSelectedId(course.id); setShowNewCourse(false) }}
        />
      )}
      {showNewSkill && selected && (
        <NewSkillForm
          course={selected}
          sortOrder={skills.length}
          onClose={() => setShowNewSkill(false)}
          onCreated={() => { setShowNewSkill(false); loadSkills(selected.id) }}
        />
      )}
    </div>
  )
}

function SkillCard({ skill }: { skill: Skill }) {
  return (
    <div className="bg-surface border border-edge rounded-xl p-[14px]">
      <p className="text-[14px] font-semibold text-ink">{skill.name}</p>
      {skill.unit_label && <p className="text-[12px] text-ink-tertiary mt-0.5">{skill.unit_label}</p>}
      {(skill.skill_criteria || []).length > 0 && (
        <ul className="mt-2 space-y-1">
          {(skill.skill_criteria || []).map(c => (
            <li key={c.id} className="text-[13px] text-ink-secondary leading-snug">— {c.text}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NewCourseForm({ onClose, onCreated }: { onClose: () => void; onCreated: (course: Course) => void }) {
  const { user } = useAuth()
  const theme = useResolvedTheme()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!name.trim()) return setError('Give the course a name.')
    if (!user?.organisation_id) return setError("Your account isn't linked to an organisation yet — try refreshing the page.")
    setLoading(true)
    const { data, error: createError } = await createCourse(user.organisation_id, user.id, name.trim())
    setLoading(false)
    if (createError || !data) return setError(createError?.message || 'Could not create the course.')
    onCreated(data as Course)
  }

  return createPortal((
    <div data-theme={theme} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-8">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-ink text-[16px]">New course</p>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-tertiary transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <ErrorBanner message={error} />
        <TextField label="Course name" value={name} onChange={setName} placeholder="e.g. Digital Media Level 2" autoFocus />
        <PrimaryButton onClick={handleSubmit} loading={loading}>Create</PrimaryButton>
      </div>
    </div>
  ), document.body)
}

function NewSkillForm({ course, sortOrder, onClose, onCreated }: {
  course: Course; sortOrder: number; onClose: () => void; onCreated: () => void
}) {
  const { user } = useAuth()
  const theme = useResolvedTheme()
  const [name, setName] = useState('')
  const [unitLabel, setUnitLabel] = useState('')
  const [criteria, setCriteria] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!name.trim()) return setError('Give the skill a name.')
    const criteriaLines = criteria.split('\n').map(l => l.trim()).filter(Boolean)
    if (criteriaLines.length === 0) return setError('Add at least one criterion — this is what a tutor checks work against.')
    if (!user) return
    setLoading(true)
    const { error: createError } = await createSkill(course.id, user.id, { name: name.trim(), unit_label: unitLabel.trim() || undefined, sort_order: sortOrder, criteria: criteriaLines })
    setLoading(false)
    if (createError) return setError(createError.message)
    onCreated()
  }

  return createPortal((
    <div data-theme={theme} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-8">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-ink text-[16px]">Add skill to {course.name}</p>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted text-ink-tertiary transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <ErrorBanner message={error} />
        <TextField label="Skill name" value={name} onChange={setName} placeholder="e.g. Adobe Illustrator" autoFocus />
        <TextField label="Unit label (optional)" value={unitLabel} onChange={setUnitLabel} placeholder="e.g. Unit 1: Digital Imaging" />
        <label className="block mb-5">
          <span className="block text-[13px] font-semibold text-ink mb-1.5">Criteria — 2 to 4 lines</span>
          <textarea
            value={criteria} onChange={e => setCriteria(e.target.value)}
            placeholder={'One per line, e.g.:\nUses layers and vector shapes correctly\nExports at the right size and format\nCan explain the choices made'}
            rows={4}
            className="w-full bg-surface border border-edge rounded-lg px-3 py-2.5 text-[13px] text-ink placeholder-ink-quaternary outline-none focus:border-brand transition resize-none"
          />
          <p className="text-[12px] text-ink-tertiary mt-1.5">Whoever reviews work tagged with this skill marks each line Met, Partly met, or Not met.</p>
        </label>
        <PrimaryButton onClick={handleSubmit} loading={loading}>Add skill</PrimaryButton>
      </div>
    </div>
  ), document.body)
}
