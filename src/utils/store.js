import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const CLAUDEX_DIR = join(homedir(), '.claudex')
const SESSIONS_FILE = join(CLAUDEX_DIR, 'sessions.json')
const PROJECTS_FILE = join(CLAUDEX_DIR, 'projects.json')
const STATS_FILE = join(CLAUDEX_DIR, 'stats.json')

function ensureDir() {
  if (!existsSync(CLAUDEX_DIR)) mkdirSync(CLAUDEX_DIR, { recursive: true })
}

function readJSON(file, fallback) {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf-8'))
  } catch {}
  return fallback
}

function writeJSON(file, data) {
  ensureDir()
  writeFileSync(file, JSON.stringify(data, null, 2))
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function loadSessions() {
  return readJSON(SESSIONS_FILE, [])
}

export function saveSession(session) {
  const sessions = loadSessions()
  sessions.unshift(session) // newest first
  // Keep last 100 sessions
  writeJSON(SESSIONS_FILE, sessions.slice(0, 100))
}

export function getSession(id) {
  return loadSessions().find(s => s.id === id)
}

export function saveSessionNotes(sessionId, notes, metadata = {}) {
  const sessions = loadSessions()
  const session = sessions.find(s => s.id === sessionId)
  if (!session) return

  session.notes = notes
  session.contextTags = metadata.tags || []
  session.taskName = metadata.taskName || null
  session.nextSteps = metadata.nextSteps || null

  writeJSON(SESSIONS_FILE, sessions)
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export function loadProjects() {
  return readJSON(PROJECTS_FILE, {})
}

export function saveProjectMemory(projectPath, data) {
  const projects = loadProjects()
  projects[projectPath] = { ...projects[projectPath], ...data, updatedAt: Date.now() }
  writeJSON(PROJECTS_FILE, projects)
}

export function getProjectMemory(projectPath) {
  const projects = loadProjects()
  return projects[projectPath] || null
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function loadStats() {
  return readJSON(STATS_FILE, {
    totalCost: 0,
    totalSessions: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    byRole: {},
    byModel: {},
  })
}

export function updateStats(session) {
  const stats = loadStats()
  stats.totalCost = (stats.totalCost || 0) + (session.cost || 0)
  stats.totalSessions = (stats.totalSessions || 0) + 1
  stats.totalInputTokens = (stats.totalInputTokens || 0) + (session.inputTokens || 0)
  stats.totalOutputTokens = (stats.totalOutputTokens || 0) + (session.outputTokens || 0)

  // By role
  if (!stats.byRole[session.role]) stats.byRole[session.role] = { sessions: 0, cost: 0 }
  stats.byRole[session.role].sessions++
  stats.byRole[session.role].cost = (stats.byRole[session.role].cost || 0) + (session.cost || 0)

  // By model
  if (!stats.byModel[session.model]) stats.byModel[session.model] = { sessions: 0, cost: 0 }
  stats.byModel[session.model].sessions++
  stats.byModel[session.model].cost = (stats.byModel[session.model].cost || 0) + (session.cost || 0)

  writeJSON(STATS_FILE, stats)
}

// ─── Model Recommendation ──────────────────────────────────────────────────────

/**
 * Analyze model usage patterns for a given role
 * Returns: { modelId: { count, avgCost, avgDuration, confidence } }
 */
export function getModelPatterns(roleId, sessionLimit = 30) {
  const sessions = loadSessions()
  const roleSessions = sessions
    .filter(s => s.role === roleId)
    .slice(0, sessionLimit)

  if (roleSessions.length === 0) return {}

  // Group by model, aggregate stats
  const patterns = {}
  roleSessions.forEach(s => {
    if (!patterns[s.model]) {
      patterns[s.model] = { count: 0, totalCost: 0, totalDuration: 0 }
    }
    patterns[s.model].count += 1
    patterns[s.model].totalCost += s.cost || 0
    patterns[s.model].totalDuration += s.duration || 0
  })

  // Calculate averages and confidence
  Object.keys(patterns).forEach(model => {
    const p = patterns[model]
    p.avgCost = p.totalCost / p.count
    p.avgDuration = p.totalDuration / p.count
    p.confidence = Math.min(1, p.count / 10) // Confidence grows with count
    delete p.totalCost
    delete p.totalDuration
  })

  return patterns
}

/**
 * Get recommended model for a role and project
 * Returns: { recommended: modelId, confidence: 0-1, reason: string }
 */
export function getModelRecommendation(roleId, projectPath) {
  // 1. Check project-specific history (highest weight)
  const projectSessions = loadSessions()
    .filter(s => s.project === projectPath && s.role === roleId)
    .slice(0, 5)

  if (projectSessions.length > 0) {
    const mostUsed = projectSessions[0].model // Most recent
    return {
      recommended: mostUsed,
      confidence: Math.min(1, projectSessions.length * 0.3),
      reason: `Last used for this role in this project`
    }
  }

  // 2. Check global patterns for role
  const patterns = getModelPatterns(roleId)
  const modelsByFrequency = Object.entries(patterns)
    .sort((a, b) => b[1].count - a[1].count)

  if (modelsByFrequency.length > 0) {
    const [modelId, stats] = modelsByFrequency[0]
    return {
      recommended: modelId,
      confidence: stats.confidence,
      reason: `Most used model for this role (${stats.count} sessions)`
    }
  }

  // 3. No pattern found
  return { recommended: null, confidence: 0, reason: null }
}
