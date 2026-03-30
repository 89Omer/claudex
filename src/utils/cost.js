import { readdirSync, readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { PRICING } from './config.js'

// Claude Code stores sessions as JSONL in ~/.claude/projects/
const CLAUDE_DIR = join(homedir(), '.claude')
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects')

export function calcCost(inputTokens, outputTokens, model) {
  const pricing = PRICING[model] || PRICING['claude-sonnet-4-6']
  return (inputTokens / 1_000_000) * pricing.input +
         (outputTokens / 1_000_000) * pricing.output
}

export function formatCost(cost) {
  if (!cost || cost === 0) return '$0.000'
  if (cost < 0.001) return '<$0.001'
  return `$${cost.toFixed(3)}`
}

export function formatTokens(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

export function formatDuration(ms) {
  if (!ms) return '0s'
  const secs = Math.floor(ms / 1000)
  const mins = Math.floor(secs / 60)
  const hrs = Math.floor(mins / 60)
  if (hrs > 0) return `${hrs}h ${mins % 60}m`
  if (mins > 0) return `${mins}m ${secs % 60}s`
  return `${secs}s`
}

export function formatDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHrs / 24)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString()
}

// Parse token usage from Claude Code's JSONL session files
export function parseClaudeSessionTokens(sessionId) {
  if (!existsSync(PROJECTS_DIR)) return null

  try {
    const projectDirs = readdirSync(PROJECTS_DIR)
    for (const projectDir of projectDirs) {
      const projectPath = join(PROJECTS_DIR, projectDir)
      const sessionFile = join(projectPath, `${sessionId}.jsonl`)
      if (existsSync(sessionFile)) {
        return parseJSONLTokens(sessionFile)
      }
    }

    // Try scanning all JSONL files for the most recent one
    for (const projectDir of projectDirs) {
      const projectPath = join(PROJECTS_DIR, projectDir)
      try {
        const files = readdirSync(projectPath).filter(f => f.endsWith('.jsonl'))
        for (const file of files) {
          const filePath = join(projectPath, file)
          const tokens = parseJSONLTokens(filePath)
          if (tokens) return tokens
        }
      } catch {}
    }
  } catch {}

  return null
}

function parseJSONLTokens(filePath) {
  try {
    const lines = readFileSync(filePath, 'utf-8').trim().split('\n')

    // Prefer the result entry — it's the definitive cumulative total for the session
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i])
        if (entry.type === 'result' && entry.usage) {
          return {
            inputTokens: entry.usage.input_tokens || 0,
            outputTokens: entry.usage.output_tokens || 0,
          }
        }
      } catch {}
    }

    // Fallback: sum per-message usage from assistant entries (session still in progress)
    let inputTokens = 0, outputTokens = 0, found = false
    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        if (entry.message?.usage) {
          inputTokens += entry.message.usage.input_tokens || 0
          outputTokens += entry.message.usage.output_tokens || 0
          found = true
        }
      } catch {}
    }

    return found ? { inputTokens, outputTokens } : null
  } catch {}
  return null
}

// Parse tokens from JSONL files modified after `since` (ms timestamp)
export function parseRecentSessionTokens(since) {
  if (!existsSync(PROJECTS_DIR)) return null
  let inputTokens = 0, outputTokens = 0, found = false

  try {
    for (const projectDir of readdirSync(PROJECTS_DIR)) {
      const projectPath = join(PROJECTS_DIR, projectDir)
      try {
        for (const file of readdirSync(projectPath).filter(f => f.endsWith('.jsonl'))) {
          const filePath = join(projectPath, file)
          try {
            if (statSync(filePath).mtimeMs < since) continue
            const tokens = parseJSONLTokens(filePath)
            if (tokens) {
              inputTokens += tokens.inputTokens
              outputTokens += tokens.outputTokens
              found = true
            }
          } catch {}
        }
      } catch {}
    }
  } catch {}

  return found ? { inputTokens, outputTokens } : null
}

// Get latest Claude Code session ID from ~/.claude
export function getLatestClaudeSession() {
  if (!existsSync(PROJECTS_DIR)) return null
  try {
    const projectDirs = readdirSync(PROJECTS_DIR)
    let latest = null
    let latestTime = 0

    for (const projectDir of projectDirs) {
      const projectPath = join(PROJECTS_DIR, projectDir)
      try {
        const files = readdirSync(projectPath)
          .filter(f => f.endsWith('.jsonl'))
          .map(f => ({
            name: f,
            path: join(projectPath, f),
            id: f.replace('.jsonl', '')
          }))

        for (const file of files) {
          try {
            const stat = readFileSync(file.path)
            if (stat && file.name > latestTime) {
              latestTime = file.name
              latest = file.id
            }
          } catch {}
        }
      } catch {}
    }
    return latest
  } catch {}
  return null
}

// Get Claude Code sessions for resume feature
export function getClaudeCodeSessions(limit = 10) {
  if (!existsSync(PROJECTS_DIR)) return []
  const sessions = []

  try {
    const projectDirs = readdirSync(PROJECTS_DIR)
    for (const projectDir of projectDirs) {
      const projectPath = join(PROJECTS_DIR, projectDir)
      try {
        const files = readdirSync(projectPath).filter(f => f.endsWith('.jsonl'))
        for (const file of files) {
          const filePath = join(projectPath, file)
          try {
            const lines = readFileSync(filePath, 'utf-8').trim().split('\n')
            const firstLine = JSON.parse(lines[0] || '{}')
            const lastLine = JSON.parse(lines[lines.length - 1] || '{}')
            sessions.push({
              id: file.replace('.jsonl', ''),
              project: projectDir,
              startTime: firstLine.timestamp,
              endTime: lastLine.timestamp,
              messageCount: lines.length,
            })
          } catch {}
        }
      } catch {}
    }
  } catch {}

  return sessions
    .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
    .slice(0, limit)
}
