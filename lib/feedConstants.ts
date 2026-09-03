// Feed v2.0 build spec -- shared between FeedPanel (Wins strip, post
// cards) and PostComposer (milestone picker). One source of truth so
// the ring colour on a win and the pill colour on a post carrying the
// same milestone_type can never drift apart.
export type MilestoneType = 'job' | 'interview' | 'verified' | 'finished' | 'start' | 'goal'

export const MILESTONE_TYPES: {
  key: MilestoneType; sheetLabel: string; pillLabel: string
  ring: string; pillBg: string; pillText: string
}[] = [
  { key: 'job', sheetLabel: 'I got a job or apprenticeship', pillLabel: 'New job', ring: '#F26B21', pillBg: '#FCEEE4', pillText: '#F26B21' },
  { key: 'interview', sheetLabel: 'I got an interview', pillLabel: 'Interview', ring: '#E0A94B', pillBg: '#FAEEDA', pillText: '#854F0B' },
  { key: 'verified', sheetLabel: 'My work got verified', pillLabel: 'Verified', ring: '#0F6E56', pillBg: '#E1F5EE', pillText: '#0F6E56' },
  { key: 'finished', sheetLabel: 'I finished a course or project', pillLabel: 'Finished', ring: '#0F6E56', pillBg: '#E1F5EE', pillText: '#0F6E56' },
  { key: 'start', sheetLabel: 'I start my placement or new role', pillLabel: 'Starting', ring: '#F26B21', pillBg: '#FCEEE4', pillText: '#F26B21' },
  { key: 'goal', sheetLabel: 'I hit a personal goal', pillLabel: 'Goal', ring: '#0F6E56', pillBg: '#E1F5EE', pillText: '#0F6E56' },
]
export const MILESTONE_BY_KEY = Object.fromEntries(MILESTONE_TYPES.map(m => [m.key, m]))

// "The set adapts to the post -- an interview post offers Celebrate
// and Good luck; a verified post offers Well done and Keep going."
// Reactions are a function of milestone_type now, not author-picked
// (that was the old model -- sticker_choices on posts, now unused for
// new posts).
export const REACTIONS_BY_MILESTONE: Record<string, { key: string; emoji: string; label: string }[]> = {
  interview: [
    { key: 'congratulations', emoji: '🎉', label: 'Celebrate' },
    { key: 'good_luck', emoji: '🍀', label: 'Good luck' },
    { key: 'proud', emoji: '⭐', label: 'Proud' },
  ],
  verified: [
    { key: 'well_done', emoji: '👏', label: 'Well done' },
    { key: 'keep_going', emoji: '🔥', label: 'Keep going' },
  ],
  job: [
    { key: 'congratulations', emoji: '🎉', label: 'Celebrate' },
    { key: 'proud', emoji: '⭐', label: 'Proud' },
  ],
  finished: [
    { key: 'well_done', emoji: '👏', label: 'Well done' },
    { key: 'proud', emoji: '⭐', label: 'Proud' },
  ],
  start: [
    { key: 'congratulations', emoji: '🎉', label: 'Celebrate' },
    { key: 'good_luck', emoji: '🍀', label: 'Good luck' },
  ],
  goal: [
    { key: 'proud', emoji: '⭐', label: 'Proud' },
    { key: 'keep_going', emoji: '🔥', label: 'Keep going' },
  ],
  // A plain update with no milestone tag still gets a safe default --
  // reactions are never author-picked or absent.
  default: [
    { key: 'well_done', emoji: '👏', label: 'Well done' },
    { key: 'keep_going', emoji: '🔥', label: 'Keep going' },
  ],
}
