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
