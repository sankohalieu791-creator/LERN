import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

// The one place in the Help Desk that's genuinely AI, not a lookup --
// see components/v2/HelpDesk.tsx for when this gets called instead of
// the written knowledge base. It never writes anything itself: it can
// only *propose* a brief or workshop (via a tool call), which the
// client shows back to the staff member as an editable draft. Nothing
// reaches work_items until a human taps "Create" there, and that
// write goes through createWorkItem under the user's own session, so
// it's bound by the exact same RLS the manual Create-brief form is --
// this route never gets elevated DB access.
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = 'claude-sonnet-5-5'

const SYSTEM_PROMPT = `You are the LERN Help Desk's assistant for staff at a school, college or training provider. You help with two things only:
1. Drafting a new Brief (structured work set for students, checked against written criteria before it counts as verified).
2. Drafting a new Workshop (a live session, online or in person).

You do not create anything directly. When you have enough to draft one, call the matching tool with your best-effort fields -- the human reviews and edits every field before anything is actually created, so a reasonable draft is better than refusing to try. Still ask a short clarifying question in plain text (no tool call) if the title/topic itself is genuinely unclear, or if mode is in_person but you don't know where.

For criteria (both tools): write 2-4 short, concrete, checkable lines a tutor could actually tick off -- not a vague restatement of the title. This is LERN's replacement for grading, so it has to mean something.

If asked something outside these two things, say plainly that you can only help draft a brief or a workshop here, and suggest they try the written Help Desk topics for everything else.

Keep replies short -- this is a chat widget, not an essay.`

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'propose_create_brief',
    description: 'Draft a new Brief for the human to review, edit and confirm. Does not create anything.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short brief title' },
        topic: { type: 'string', description: 'Optional subject/topic, groups briefs together' },
        assignment: { type: 'string', description: 'What the student has to do -- give it real context, who it is for and why it matters, not just the task' },
        criteria: { type: 'string', description: '2-4 short, checkable success criteria, one per line' },
        deadline: { type: 'string', description: 'Optional deadline as YYYY-MM-DD' },
        group_name: { type: 'string', description: 'Optional class/group name as the user said it, if any' },
      },
      required: ['title', 'assignment', 'criteria'],
    },
  },
  {
    name: 'propose_create_workshop',
    description: 'Draft a new Workshop for the human to review, edit and confirm. Does not create anything.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short workshop title' },
        topic: { type: 'string', description: 'Optional subject/topic' },
        description: { type: 'string', description: 'Optional short description of the session' },
        criteria: { type: 'string', description: '2-4 short, checkable success criteria for attending/participating, one per line' },
        mode: { type: 'string', enum: ['online', 'in_person'], description: 'How the workshop runs' },
        location: { type: 'string', description: 'Required if mode is in_person -- where it happens' },
        starts_at: { type: 'string', description: 'Start date and time, ISO 8601, if known (e.g. 2026-11-15T14:00:00)' },
        deadline: { type: 'string', description: 'Optional deadline as YYYY-MM-DD' },
        group_name: { type: 'string', description: 'Optional class/group name as the user said it, if any' },
      },
      required: ['title', 'criteria', 'mode'],
    },
  },
]

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI actions are not configured yet.' }, { status: 503 })
  }

  const auth = req.headers.get('authorization') || ''
  const accessToken = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!accessToken) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(accessToken)
  if (callerError || !callerData?.user) return NextResponse.json({ error: 'Session expired — sign in again.' }, { status: 401 })

  const { data: profile } = await supabaseAdmin.from('users').select('role').eq('id', callerData.user.id).single()
  if (!profile || (profile.role !== 'institution_staff' && profile.role !== 'provider_staff')) {
    return NextResponse.json({ error: 'AI drafting is only available for institution or training provider staff.' }, { status: 403 })
  }

  const { message, history } = await req.json().catch(() => ({}))
  if (!message || typeof message !== 'string') return NextResponse.json({ error: 'Missing message.' }, { status: 400 })

  const priorTurns: Anthropic.MessageParam[] = Array.isArray(history)
    ? history
        .filter((h: any) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
        .slice(-10)
        .map((h: any) => ({ role: h.role, content: h.content }))
    : []

  let response: Anthropic.Message
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: [...priorTurns, { role: 'user', content: message }],
    })
  } catch (err: any) {
    console.error('[helpdesk/action] anthropic error', err)
    return NextResponse.json({ error: err?.message || 'The AI assistant is unavailable right now.' }, { status: 502 })
  }

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
  if (toolUse && (toolUse.name === 'propose_create_brief' || toolUse.name === 'propose_create_workshop')) {
    return NextResponse.json({
      type: 'proposal',
      kind: toolUse.name === 'propose_create_brief' ? 'brief' : 'workshop',
      fields: toolUse.input,
    })
  }

  const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('\n\n').trim()
  return NextResponse.json({ type: 'reply', text: text || "I'm not sure how to help with that here." })
}
