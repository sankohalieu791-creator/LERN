import { supabase } from './supabase'

export type AIBriefFields = {
  title: string; assignment: string; criteria: string
  topic?: string; deadline?: string; group_name?: string
}
export type AIWorkshopFields = {
  title: string; criteria: string; mode: 'online' | 'in_person'
  description?: string; topic?: string; location?: string; starts_at?: string; deadline?: string; group_name?: string
}
export type AIReply =
  | { type: 'reply'; text: string }
  | { type: 'proposal'; kind: 'brief'; fields: AIBriefFields }
  | { type: 'proposal'; kind: 'workshop'; fields: AIWorkshopFields }
  | { type: 'error'; text: string }

// "can you create me a brief about X" vs "how do I create a brief" --
// the written knowledge base answers the second instantly and for
// free; this regex is what routes the first one to the real AI
// instead, since no amount of hand-written copy answers a request
// that's actually asking LERN to go and do something.
const HOW_TO_RE = /^\s*(how|what|where|why)\b/i
const ACTION_RE = /\b(create|make|set\s*up|schedule|start|book|draft)\b[\s\S]{0,60}\b(brief|workshop)\b/i

export function looksLikeAction(message: string): boolean {
  return !HOW_TO_RE.test(message) && ACTION_RE.test(message)
}

export async function askHelpDeskAI(message: string, history: { role: 'user' | 'assistant'; content: string }[]): Promise<AIReply> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { type: 'error', text: "You're not signed in." }

  try {
    const res = await fetch('/api/helpdesk/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ message, history }),
    })
    const data = await res.json()
    if (!res.ok) return { type: 'error', text: data?.error || 'Something went wrong.' }
    return data as AIReply
  } catch {
    return { type: 'error', text: "Couldn't reach the AI assistant — check your connection and try again." }
  }
}
