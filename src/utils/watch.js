import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir, tmpdir } from 'os'
import { spawn, execSync } from 'child_process'
import chalk from 'chalk'
import { calcCost, formatCost, formatTokens } from './cost.js'
import { loadStats } from './store.js'
import { renderWatchHUD } from './display.js'
import { getConfig } from './config.js'

const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects')
const STATE_FILE = join(tmpdir(), '.claudex-watch-state.json')

// ─── State file (shared between watcher and main process) ─────────────────────

export function writeWatchState(state) {
  try { writeFileSync(STATE_FILE, JSON.stringify(state)) } catch {}
}

export function readWatchState() {
  try {
    if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
  } catch {}
  return null
}

// ─── Parse tokens from Claude Code JSONL files ───────────────────────────────

function parseProjectTokens(since) {
  let inputTokens = 0, outputTokens = 0
  if (!existsSync(CLAUDE_PROJECTS_DIR)) return { inputTokens, outputTokens }

  try {
    for (const projectDir of readdirSync(CLAUDE_PROJECTS_DIR)) {
      const projectPath = join(CLAUDE_PROJECTS_DIR, projectDir)
      try {
        for (const file of readdirSync(projectPath).filter(f => f.endsWith('.jsonl'))) {
          const filePath = join(projectPath, file)
          try {
            const mtime = statSync(filePath).mtimeMs
            if (mtime < since) continue
            const lines = readFileSync(filePath, 'utf-8').trim().split('\n')
            for (const line of lines) {
              try {
                const entry = JSON.parse(line)
                if (entry.usage) {
                  inputTokens += entry.usage.input_tokens || 0
                  outputTokens += entry.usage.output_tokens || 0
                }
                if (entry.message?.usage) {
                  inputTokens += entry.message.usage.input_tokens || 0
                  outputTokens += entry.message.usage.output_tokens || 0
                }
              } catch {}
            }
          } catch {}
        }
      } catch {}
    }
  } catch {}

  return { inputTokens, outputTokens }
}

// ─── Watcher process (runs in the right pane) ─────────────────────────────────

export function runWatcher() {
  const config = getConfig()
  const budget = config.budgetAlert || 0
  const totalCost = loadStats().totalCost || 0

  let state = readWatchState() || {
    role: 'dev',
    model: config.defaultModel || 'claude-sonnet-4-6',
    sessionCost: 0,
    totalCost,
    inputTokens: 0,
    outputTokens: 0,
    duration: 0,
    sessionStart: Date.now(),
    budget,
  }

  const sessionStart = Date.now()

  const refresh = () => {
    // Read latest state written by main process
    const latest = readWatchState()
    if (latest) {
      state = { ...latest, totalCost: totalCost + (latest.sessionCost || 0) }
    }

    // Also try to pull fresh tokens from JSONL files
    const { inputTokens, outputTokens } = parseProjectTokens(sessionStart - 5000)
    if (inputTokens > 0 || outputTokens > 0) {
      state.inputTokens = inputTokens
      state.outputTokens = outputTokens
      state.sessionCost = calcCost(inputTokens, outputTokens, state.model || 'claude-sonnet-4-6')
    }

    renderWatchHUD({ ...state, sessionStart, budget })
  }

  // Initial render
  refresh()

  // Refresh every 2 seconds
  setInterval(refresh, 2000)

  // Handle terminal resize
  process.stdout.on('resize', refresh)
}

// ─── Launch claudex watch (tmux split) ────────────────────────────────────────

export async function launchWatch(role, model, claudeCmd, extraArgs = [], priorContext = null) {
  // Check if tmux is available
  const hasTmux = (() => {
    try { execSync('tmux -V', { stdio: 'ignore' }); return true } catch { return false }
  })()

  if (!hasTmux) {
    console.log(chalk.yellow('\n  tmux not found — falling back to standard launch\n'))
    console.log(chalk.gray('  Install tmux for the split-pane live stats experience:'))
    console.log(chalk.gray('    macOS:  brew install tmux'))
    console.log(chalk.gray('    Ubuntu: sudo apt install tmux'))
    console.log(chalk.gray('    Windows: use WSL or Windows Terminal\n'))
    return false
  }

  // Write initial state
  writeWatchState({
    role: role.id,
    model,
    sessionCost: 0,
    inputTokens: 0,
    outputTokens: 0,
    sessionStart: Date.now(),
  })

  const isWindows = process.platform === 'win32'
  const claudeArgs = ['--model', model, ...extraArgs].join(' ')
  const watchCmd = `node "${join(import.meta.url.replace('file://', ''), '../../index.js')}" --watch-mode`

  // Create a new tmux session or use existing
  const sessionName = `claudex-${Date.now()}`

  try {
    // Create tmux session with two panes
    // Left pane (70%): Claude Code
    // Right pane (30%): claudex live stats
    execSync(`tmux new-session -d -s ${sessionName} -x $(tput cols) -y $(tput lines)`, { stdio: 'ignore' })

    // Split right pane (30% width) for stats
    execSync(`tmux split-window -h -p 30 -t ${sessionName}`, { stdio: 'ignore' })

    // Right pane: run watcher
    execSync(`tmux send-keys -t ${sessionName}.1 "node '${process.argv[1]}' --watch-mode" Enter`, { stdio: 'ignore' })

    // Left pane: run claude
    const fullCmd = `${claudeCmd} --model ${model} ${extraArgs.join(' ')}`
    execSync(`tmux send-keys -t ${sessionName}.0 "${fullCmd}" Enter`, { stdio: 'ignore' })

    // Attach to session
    execSync(`tmux attach-session -t ${sessionName}`, { stdio: 'inherit' })

    return true
  } catch (err) {
    console.log(chalk.red(`\n  tmux error: ${err.message}`))
    console.log(chalk.gray('  Falling back to standard launch\n'))
    return false
  }
}
