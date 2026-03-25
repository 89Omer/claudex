import { loadSessions } from './store.js'
import { formatDuration } from './cost.js'

/**
 * Find prior sessions related to current task
 * Returns: [{ session, relevanceScore, reason }, ...] — max 3 sessions
 */
export function detectRelatedSessions(projectPath, roleId, limit = 3) {
  const sessions = loadSessions()
  const recentSessions = sessions
    .filter(s => s.project === projectPath && s.role === roleId)
    .filter(s => s.notes) // Only sessions with notes
    .slice(0, 20)

  return recentSessions
    .map(s => ({
      session: s,
      relevanceScore: 1 - (Date.now() - s.endTime) / (7 * 24 * 60 * 60 * 1000), // Recency
      reason: `${formatDuration(Date.now() - s.endTime)} ago — "${s.taskName || s.notes.substring(0, 50)}${s.notes.length > 50 ? '...' : ''}"`
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit)
}

/**
 * Build context string for CLAUDE.md injection
 */
export function buildContextInjection(sessions) {
  if (!sessions || sessions.length === 0) return null

  const recent = sessions[0].session
  let context = `## Prior Session Context\n\n`
  context += `**Last session:** ${formatDuration(Date.now() - recent.endTime)} ago\n`
  context += `**Task:** ${recent.taskName || 'See notes below'}\n`

  if (recent.notes) {
    context += `**Notes:**\n\`\`\`\n${recent.notes}\n\`\`\`\n`
  }

  if (recent.nextSteps) {
    context += `**Next steps:**\n${recent.nextSteps}\n`
  }

  if (sessions.length > 1) {
    context += `\n**Earlier sessions:**\n`
    sessions.slice(1).forEach(s => {
      context += `- ${formatDuration(Date.now() - s.session.endTime)} ago: ${s.session.taskName}\n`
    })
  }

  return context
}
