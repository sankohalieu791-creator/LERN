import type { SupabaseClient } from '@supabase/supabase-js'

// The one place a cadence stage actually gets sent -- called from the
// Vercel Cron route only. Insert-guarded so a stage can never be sent
// twice, even if the cron job runs twice or overlaps itself.
//
// Routes through the exact same interest/interest_messages channel
// Discover's own "Express interest" and Interest Received already use
// -- reuses an existing thread if one's open with this candidate,
// starts a new one otherwise. Never a new, separate messaging surface.
export async function sendCadenceStage(
  admin: SupabaseClient,
  args: { memberId: string; employerId: string; studentId: string; stage: number; label: string; message: string },
): Promise<{ sent: boolean; error?: string }> {
  const { memberId, employerId, studentId, stage, label, message } = args

  // Insert-first, guarded by the (member_id, stage) unique constraint --
  // if this stage is already logged (the cron job and a manual send
  // racing, or the cron job running twice), this is a no-op conflict,
  // not a duplicate message.
  const { error: logError } = await admin
    .from('talent_pool_cadence_sends')
    .insert([{ member_id: memberId, stage, label, message }])
  if (logError) {
    if (logError.code === '23505') return { sent: false } // already sent -- not an error
    return { sent: false, error: logError.message }
  }

  const { data: existing } = await admin
    .from('interest')
    .select('id')
    .eq('employer_id', employerId)
    .eq('student_id', studentId)
    .limit(1)
    .maybeSingle()

  if (existing) {
    const { error } = await admin
      .from('interest_messages')
      .insert([{ interest_id: existing.id, sender_id: employerId, sender_role: 'employer', body: message }])
    if (error) return { sent: false, error: error.message }
  } else {
    const { error } = await admin
      .from('interest')
      .insert([{ employer_id: employerId, student_id: studentId, message, opportunity_label: 'Talent pool follow-up' }])
    if (error) return { sent: false, error: error.message }
  }

  return { sent: true }
}
