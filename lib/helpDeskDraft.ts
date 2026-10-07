// No AI, same as the rest of the Help Desk -- when a staff member
// asks to create a brief or schedule a workshop, this pulls out what
// it can reliably read off the sentence (a date, a group that
// actually exists, a rough title) with plain pattern matching, and
// leaves everything else blank for the human to fill in on the
// ProposalCard. Nothing here is a guess dressed up as understanding:
// if a pattern doesn't match, the field just stays empty rather than
// being invented.

export type DraftBriefFields = { title: string; assignment: string; criteria: string; topic?: string; deadline?: string; group_id?: string }
export type DraftWorkshopFields = { title: string; criteria: string; mode: 'online' | 'in_person'; description?: string; topic?: string; location?: string; starts_at?: string; deadline?: string; group_id?: string }
export type Draft = { kind: 'brief'; fields: DraftBriefFields } | { kind: 'workshop'; fields: DraftWorkshopFields }

// "how do I create a brief" vs "create a brief about our open day" --
// the written knowledge base answers the first for free; this is what
// routes the second into a draft instead.
const HOW_TO_RE = /^\s*(how|what|where|why)\b/i
const ACTION_RE = /\b(create|make|set\s*up|schedule|start|book|draft)\b[\s\S]{0,60}\b(brief|workshop)\b/i

export function looksLikeAction(message: string): boolean {
  return !HOW_TO_RE.test(message) && ACTION_RE.test(message)
}

export function detectKind(message: string): 'brief' | 'workshop' {
  return /\bworkshop\b/i.test(message) ? 'workshop' : 'brief'
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function toISODate(d: Date): string {
  const z = new Date(d)
  z.setMinutes(z.getMinutes() - z.getTimezoneOffset())
  return z.toISOString().slice(0, 10)
}

// Only "today" / "tomorrow" / "[next] <weekday>" -- deliberately not a
// full date parser. Good enough for how people actually phrase a
// deadline in a chat message; anything it can't place just leaves the
// date field blank rather than guessing wrong.
export function extractDeadline(text: string, now = new Date()): string | undefined {
  const t = text.toLowerCase()
  if (/\btomorrow\b/.test(t)) {
    const d = new Date(now); d.setDate(d.getDate() + 1); return toISODate(d)
  }
  if (/\btoday\b/.test(t)) return toISODate(now)
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (!new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(t)) continue
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    let diff = (i - d.getDay() + 7) % 7
    if (diff === 0) diff = 7 // today IS that weekday -- treat as next week's, not "due today"
    d.setDate(d.getDate() + diff)
    return toISODate(d)
  }
  return undefined
}

// Matches against groups that actually exist in this org -- never
// invents a group name, only recognises one that's really there.
export function extractGroupId(text: string, groups: { id: string; name: string }[]): string | undefined {
  const t = text.toLowerCase()
  return groups.find(g => g.name && t.includes(g.name.toLowerCase()))?.id
}

export function extractTitle(text: string): string {
  const quoted = text.match(/["'“”]([^"'“”]{3,80})["'“”]/)
  if (quoted) return quoted[1].trim()
  const about = text.match(/\babout\s+(.+?)(?:,|\.|\bdue\b|\bfor\b|\bby\b|$)/i)
  if (about) return about[1].trim()
  return ''
}

export function extractMode(text: string): 'online' | 'in_person' {
  return /\bin[- ]?person\b|\bon[- ]?site\b/i.test(text) ? 'in_person' : 'online'
}

export function buildDraft(message: string, groups: { id: string; name: string }[]): Draft {
  const kind = detectKind(message)
  const title = extractTitle(message)
  const deadline = extractDeadline(message)
  const group_id = extractGroupId(message, groups)
  if (kind === 'brief') {
    return { kind, fields: { title, assignment: '', criteria: '', deadline, group_id } }
  }
  return { kind, fields: { title, criteria: '', mode: extractMode(message), deadline, group_id } }
}
