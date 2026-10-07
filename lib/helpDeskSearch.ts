import { HELP_ENTRIES, type HelpEntry, type HelpRole } from './helpDeskContent'

// Word-overlap scoring, nothing fancier -- this is a small, fixed
// vocabulary (a few dozen entries), not a general search problem. Every
// word of 3+ letters in the query that appears anywhere in the entry's
// question or keyword list scores a point; an exact phrase match scores
// extra on top. Deterministic and cheap enough to run on every keystroke
// if the UI ever wants that.
const STOPWORDS = new Set(['how', 'the', 'what', 'does', 'and', 'for', 'with', 'you', 'can', 'where', 'why', 'that', 'this', 'are', 'has'])

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
}

// Below this, the best match is too weak to trust -- better to say "I
// don't have an answer for that" than show something only loosely
// related and let it pass as a real answer.
const MIN_SCORE = 1

export function searchHelp(query: string, role: HelpRole, limit = 3): HelpEntry[] {
  const pool = HELP_ENTRIES.filter(e => e.roles.includes(role))
  const words = normalise(query).split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS.has(w))
  if (words.length === 0) return []

  const haystacks = pool.map(e => normalise(`${e.question} ${e.keywords.join(' ')}`))

  // A word's weight depends on how many entries it shows up in -- a word
  // that's specific to one or two entries (e.g. "reported") says a lot
  // about intent; a word that's everywhere (e.g. "work", which also
  // substring-matches "workshop") says almost nothing and would otherwise
  // let a generic entry outscore the one that's actually on-topic.
  const weightFor = (w: string): number => {
    const df = haystacks.filter(h => h.includes(w)).length
    if (df <= 1) return 3
    if (df <= 3) return 1.5
    return 0.6
  }

  const normalisedQuery = normalise(query)
  const scored = pool.map((entry, i) => {
    const haystack = haystacks[i]
    let score = 0
    for (const w of words) if (haystack.includes(w)) score += weightFor(w)
    if (query.trim().length > 4 && haystack.includes(normalisedQuery)) score += 2
    return { entry, score }
  }).filter(x => x.score >= MIN_SCORE)

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map(x => x.entry)
}

// A handful of starter topics shown when the panel first opens, so
// there's something to tap before anyone's typed anything -- scoped per
// role since an employer and a school have almost no overlap in what
// they'd ask.
export function starterTopics(role: HelpRole): HelpEntry[] {
  const ids: Record<HelpRole, string[]> = {
    institution_staff: ['briefs-create', 'review-verify', 'guest-invite-create', 'workexp-export', 'students-filter-group'],
    provider_staff: ['courses-create', 'review-verify', 'bootcamp-what', 'guest-invite-create', 'bootcamp-export'],
    employer: ['discover-express-interest', 'talentpools-what', 'jobs-post', 'candidates-pipeline', 'employer-why-no-direct-contact'],
  }
  return ids[role].map(id => HELP_ENTRIES.find(e => e.id === id)).filter(Boolean) as HelpEntry[]
}
