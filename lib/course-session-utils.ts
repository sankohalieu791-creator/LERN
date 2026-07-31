export function getSessionScheduleTime(session: any) {
  const dateValue = session?.session_date
  if (!dateValue) return Number.MAX_SAFE_INTEGER

  const timeValue = session?.session_time || '00:00:00'
  const parsed = new Date(`${dateValue}T${timeValue}`)
  if (Number.isNaN(parsed.getTime())) return Number.MAX_SAFE_INTEGER
  return parsed.getTime()
}

export function getNextUpcomingSession(sessions: any[] = [], now = new Date()) {
  const sorted = [...sessions]
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = getSessionScheduleTime(a)
      const bTime = getSessionScheduleTime(b)
      if (aTime !== bTime) return aTime - bTime
      return (a?.session_number ?? 999) - (b?.session_number ?? 999)
    })

  const liveSession = sorted.find((session: any) => session.is_live && !session.is_completed)
  if (liveSession) return liveSession

  const upcoming = sorted.find((session: any) => {
    if (session.is_completed) return false
    const scheduledAt = getSessionScheduleTime(session)
    if (scheduledAt !== Number.MAX_SAFE_INTEGER && scheduledAt < now.getTime()) return false
    return true
  })

  return upcoming ?? sorted.find((session: any) => !session.is_completed) ?? null
}

// Whether a course's Project Day is open for submission — all teaching
// sessions finished, and the project day session itself isn't marked done.
export function getProjectDayInfo(sessions: any[] = []) {
  const projectDaySession = sessions.find((s: any) => s.is_project_day)
  const teachingSessions = sessions.filter((s: any) => !s.is_project_day)
  const teachingDone = teachingSessions.length > 0
    ? teachingSessions.every((s: any) => s.is_completed)
    : sessions.length > 0 && sessions.every((s: any) => s.is_completed)
  const projectDayOpen = !!(projectDaySession && !projectDaySession.is_completed && teachingDone)
  return { projectDaySession, teachingSessions, teachingDone, projectDayOpen }
}
