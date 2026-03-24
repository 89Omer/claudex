import chalk from 'chalk'
import { formatCost, formatTokens, formatDuration, formatDate, calcCost } from './cost.js'
import { loadSessions, loadStats } from './store.js'
import { ROLES } from '../roles/index.js'
import { MODELS, PRICING, getContextWindow } from './config.js'

const cols = () => Math.min(process.stdout.columns || 80, 100)

function divider(char = '─', c = 'gray') {
  return chalk[c](char.repeat(cols()))
}

function roleColor(roleId) { return ROLES[roleId]?.colorName || 'white' }
function modelLabel(modelId) { return MODELS.find(m => m.id === modelId)?.label || modelId }

function makeBar(value, total, width = 16, fillChar = '█', emptyChar = '░') {
  if (!total || total === 0) return chalk.gray(emptyChar.repeat(width))
  const filled = Math.round(Math.min(value / total, 1) * width)
  return filled + (width - filled) === 0
    ? chalk.red(fillChar.repeat(width))
    : chalk.green(fillChar.repeat(filled)) + chalk.gray(emptyChar.repeat(width - filled))
}

function costBar(value, total, width = 16) {
  if (!total || total === 0) return chalk.gray('░'.repeat(width))
  const pct = Math.min(value / total, 1)
  const filled = Math.round(pct * width)
  const color = pct > 0.85 ? 'red' : pct > 0.65 ? 'yellow' : 'green'
  return chalk[color]('█'.repeat(filled)) + chalk.gray('░'.repeat(width - filled))
}

// ─── Pre-launch Stats (shown before session starts) ──────────────────────────

export function printPreLaunchStats(role, model, cwd) {
  const stats = loadStats()
  const sessions = loadSessions()
  const m = MODELS.find(x => x.id === model)
  const contextMax = getContextWindow(model)

  const lastSession = sessions.find(s => s.project === cwd)
  const projectSessions = sessions.filter(s => s.project === cwd)
  const projectCost = projectSessions.reduce((a, s) => a + (s.cost || 0), 0)

  const c = cols()
  console.log()
  console.log(chalk.gray('─'.repeat(c)))
  console.log(
    chalk.cyan.bold('  claudex') +
    chalk.gray('  ') +
    chalk[role.colorName].bold(`${role.emoji} ${role.name}`) +
    chalk.gray('  ·  ') +
    chalk.white(modelLabel(model)) +
    chalk.gray(`  ·  $${m?.inputCost ?? '?'}/$${m?.outputCost ?? '?'} per 1M tokens`)
  )
  console.log(chalk.gray('─'.repeat(c)))
  console.log()

  // Two-column layout
  const left = [
    [chalk.gray('All-time cost '), chalk.green.bold(formatCost(stats.totalCost || 0))],
    [chalk.gray('Sessions total'), chalk.white(String(stats.totalSessions || 0))],
    [chalk.gray('Avg per session'), chalk.white(stats.totalSessions > 0 ? formatCost((stats.totalCost || 0) / stats.totalSessions) : '—')],
    [chalk.gray('This project  '), chalk.white(projectSessions.length > 0 ? `${formatCost(projectCost)} · ${projectSessions.length} sessions` : 'First session here')],
  ]

  left.forEach(([label, value]) => {
    console.log(`  ${label}  ${value}`)
  })

  // Context window bar
  console.log()
  console.log(`  ${chalk.gray('Context window')}  ${makeBar(0, contextMax, 20)}  ${chalk.gray(`0 / ${formatTokens(contextMax)}`)}`)

  // Last session hint
  if (lastSession) {
    console.log()
    console.log(`  ${chalk.gray('Last session')}   ${chalk[role.colorName](lastSession.role)} · ${formatCost(lastSession.cost || 0)} · ${formatDuration(lastSession.duration || 0)} · ${formatDate(lastSession.startTime)}`)
  }

  console.log()
  console.log(chalk.gray('─'.repeat(c)))
  console.log()
}

// ─── Session Summary (shown after claude exits) ───────────────────────────────

export function printSessionSummary(session) {
  const role = ROLES[session.role] || { emoji: '?', name: session.role, colorName: 'white' }
  const stats = loadStats()
  const allSessions = loadSessions()
  const m = MODELS.find(x => x.id === session.model)
  const contextMax = getContextWindow(session.model)
  const totalTok = (session.inputTokens || 0) + (session.outputTokens || 0)
  const ctxPct = Math.min((totalTok / contextMax) * 100, 100)
  const ctxColor = ctxPct > 85 ? 'red' : ctxPct > 65 ? 'yellow' : 'green'

  // Savings comparison
  const sonnetModel = MODELS.find(x => x.id === 'claude-sonnet-4-6')
  const haikusModel = MODELS.find(x => x.id === 'claude-haiku-4-5')
  const sonnetCost = calcCost(session.inputTokens || 0, session.outputTokens || 0, 'claude-sonnet-4-6')
  const haikuCost = calcCost(session.inputTokens || 0, session.outputTokens || 0, 'claude-haiku-4-5')
  const showSavings = session.model === 'claude-opus-4-6' && (session.cost || 0) > 0.01

  const c = cols()
  console.log()
  console.log(chalk.gray('═'.repeat(c)))
  console.log(chalk.cyan.bold('  claudex') + chalk.gray(' — session ended'))
  console.log(chalk.gray('═'.repeat(c)))
  console.log()

  // Role + model
  console.log(`  ${chalk.gray('Role    ')}   ${role.emoji} ${chalk[role.colorName].bold(role.name)}`)
  console.log(`  ${chalk.gray('Model   ')}   ${chalk.white(modelLabel(session.model))}`)
  console.log(`  ${chalk.gray('Duration')}   ${chalk.white(formatDuration(session.duration || 0))}`)
  console.log()

  // Tokens + context bar
  console.log(`  ${chalk.gray('Tokens  ')}   ${chalk.white(formatTokens(session.inputTokens || 0))} in  ${chalk.gray('/')}  ${chalk.white(formatTokens(session.outputTokens || 0))} out`)
  console.log(`  ${chalk.gray('Context ')}   ${chalk[ctxColor](makeBar(totalTok, contextMax, 20))}  ${chalk[ctxColor](`${ctxPct.toFixed(1)}%`)}`)
  console.log()

  // Cost
  const costColor = (session.cost || 0) > 1 ? 'red' : (session.cost || 0) > 0.5 ? 'yellow' : 'green'
  console.log(`  ${chalk.gray('Cost    ')}   ${chalk[costColor].bold(formatCost(session.cost || 0))}`)

  // All-time
  console.log(`  ${chalk.gray('All-time')}   ${chalk.gray(formatCost(stats.totalCost || 0) + ' across ' + (stats.totalSessions || 0) + ' sessions')}`)
  console.log()

  // Savings tip
  if (showSavings) {
    console.log(chalk.gray('─'.repeat(c)))
    console.log(chalk.yellow('  💡 Savings comparison'))
    console.log()
    console.log(`  ${chalk.gray('Opus 4.6   (used)')}   ${chalk.white(formatCost(session.cost || 0))}`)
    console.log(`  ${chalk.cyan('Sonnet 4.6        ')}   ${chalk.cyan(formatCost(sonnetCost))}  ${chalk.gray(`save ${formatCost((session.cost || 0) - sonnetCost)}`)}`)
    console.log(`  ${chalk.green('Haiku 4.5         ')}   ${chalk.green(formatCost(haikuCost))}  ${chalk.gray(`save ${formatCost((session.cost || 0) - haikuCost)}`)}`)
    console.log()
  }

  // Top roles bar chart
  if (Object.keys(stats.byRole || {}).length > 1) {
    console.log(chalk.gray('─'.repeat(c)))
    console.log(chalk.gray('  Usage by role'))
    console.log()
    Object.entries(stats.byRole).forEach(([roleId, data]) => {
      const r = ROLES[roleId] || { emoji: '?', name: roleId, colorName: 'white' }
      const bar = costBar(data.sessions, stats.totalSessions, 12)
      console.log(
        `  ${r.emoji} ${chalk[r.colorName](r.name.padEnd(16))}  ${bar}  ` +
        chalk.gray(`${data.sessions} sessions  ${formatCost(data.cost || 0)}`)
      )
    })
    console.log()
  }

  console.log(chalk.gray('═'.repeat(c)))
  console.log()
}

// ─── History Table ────────────────────────────────────────────────────────────

export function printHistory(limit = 20) {
  const sessions = loadSessions().slice(0, limit)
  if (sessions.length === 0) {
    console.log(chalk.gray('\n  No sessions recorded yet. Run claudex to start one.\n'))
    return
  }

  const c = cols()
  console.log()
  console.log(divider())
  console.log(chalk.cyan.bold('  claudex history') + chalk.gray(` — last ${sessions.length} sessions`))
  console.log(divider())
  console.log()
  console.log(
    chalk.gray('  #   ') + chalk.gray('Role'.padEnd(14)) + chalk.gray('Model'.padEnd(14)) +
    chalk.gray('Cost'.padEnd(10)) + chalk.gray('Tokens'.padEnd(12)) +
    chalk.gray('Duration'.padEnd(10)) + chalk.gray('When')
  )
  console.log(chalk.gray('  ' + '─'.repeat(c - 4)))

  sessions.forEach((s, i) => {
    const role = ROLES[s.role] || { emoji: '?', name: s.role, colorName: 'white' }
    console.log(
      `  ${chalk.gray(String(i + 1).padStart(2) + '. ')}` +
      `${chalk[role.colorName](`${role.emoji} ${role.name}`.padEnd(14))}` +
      `${chalk.white(modelLabel(s.model).padEnd(14))}` +
      `${chalk.green(formatCost(s.cost || 0).padEnd(10))}` +
      `${chalk.gray(formatTokens((s.inputTokens || 0) + (s.outputTokens || 0)).padEnd(12))}` +
      `${chalk.gray(formatDuration(s.duration || 0).padEnd(10))}` +
      `${chalk.gray(formatDate(s.startTime))}`
    )
  })

  console.log()
  console.log(divider())
  console.log()
}

// ─── Stats Dashboard ──────────────────────────────────────────────────────────

export function printStats() {
  const stats = loadStats()
  const sessions = loadSessions()
  const c = cols()

  console.log()
  console.log(divider())
  console.log(chalk.cyan.bold('  claudex stats'))
  console.log(divider())
  console.log()

  console.log(chalk.white('  Overview'))
  console.log()
  console.log(`  ${chalk.gray('Total sessions ')}  ${chalk.white(stats.totalSessions || 0)}`)
  console.log(`  ${chalk.gray('Total cost     ')}  ${chalk.green.bold(formatCost(stats.totalCost || 0))}`)
  console.log(`  ${chalk.gray('Total tokens   ')}  ${chalk.white(formatTokens((stats.totalInputTokens || 0) + (stats.totalOutputTokens || 0)))}`)
  if (stats.totalSessions > 0) {
    console.log(`  ${chalk.gray('Avg per session')}  ${chalk.white(formatCost((stats.totalCost || 0) / stats.totalSessions))}`)
  }

  if (Object.keys(stats.byRole || {}).length > 0) {
    console.log()
    console.log(chalk.white('  By Role'))
    console.log()
    Object.entries(stats.byRole).forEach(([roleId, data]) => {
      const role = ROLES[roleId] || { emoji: '?', name: roleId, colorName: 'white' }
      const bar = costBar(data.sessions, stats.totalSessions, 12)
      console.log(
        `  ${role.emoji} ${chalk[role.colorName].bold(role.name.padEnd(18))}` +
        `${bar}  ${chalk.white(data.sessions + ' sessions')}  ${chalk.green(formatCost(data.cost || 0))}`
      )
    })
  }

  if (Object.keys(stats.byModel || {}).length > 0) {
    console.log()
    console.log(chalk.white('  By Model'))
    console.log()
    Object.entries(stats.byModel).forEach(([modelId, data]) => {
      const bar = costBar(data.sessions, stats.totalSessions, 12)
      console.log(
        `  ${chalk.white(modelLabel(modelId).padEnd(18))}` +
        `${bar}  ${chalk.white(data.sessions + ' sessions')}  ${chalk.green(formatCost(data.cost || 0))}`
      )
    })
  }

  if (sessions.length > 0) {
    console.log()
    console.log(chalk.white('  Recent Sessions'))
    console.log()
    sessions.slice(0, 5).forEach((s, i) => {
      const role = ROLES[s.role] || { emoji: '?', name: s.role, colorName: 'white' }
      console.log(
        `  ${chalk.gray(String(i + 1) + '.')}  ` +
        `${role.emoji} ${chalk[role.colorName](role.name.padEnd(14))}  ` +
        `${chalk.green(formatCost(s.cost || 0).padEnd(8))}  ` +
        chalk.gray(formatDate(s.startTime))
      )
    })
  }

  console.log()
  console.log(divider())
  console.log()
}

// ─── Resume Picker ────────────────────────────────────────────────────────────

export function printResumePicker(claudeSessions) {
  if (!claudeSessions || claudeSessions.length === 0) {
    console.log(chalk.gray('\n  No Claude Code sessions found in ~/.claude\n'))
    return false
  }

  console.log()
  console.log(chalk.white('  Resume a session:\n'))
  claudeSessions.forEach((s, i) => {
    const when = formatDate(s.endTime ? s.endTime * 1000 : null)
    console.log(`    ${chalk.bold(`${i + 1}.`)}  ${chalk.white(s.id.slice(0, 8))}…  ${chalk.gray(s.project?.slice(-30) || 'unknown')}  ${chalk.gray(s.messageCount + ' msgs')}  ${chalk.gray(when)}`)
  })
  console.log()
  return true
}

// ─── Template Picker ─────────────────────────────────────────────────────────

export function printTemplatePicker(templates, role) {
  console.log()
  console.log(chalk.white(`  Templates for ${role.emoji} ${role.name}:\n`))
  templates.forEach(t => {
    console.log(
      `    ${chalk.bold(`${t.index}.`)}  ${chalk[role.colorName || 'white'].bold(t.label.padEnd(20))}  ` +
      chalk.gray(t.preview)
    )
  })
  console.log(`    ${chalk.bold('0.')}  ${chalk.gray('No template — just launch')}`)
  console.log()
}

// ─── Live Watch HUD (for claudex watch) ───────────────────────────────────────

export function renderWatchHUD(state) {
  const { role, model, sessionCost, totalCost, inputTokens, outputTokens, duration, sessionStart, budget, lastActivity } = state
  const r = ROLES[role] || { emoji: '?', name: role, colorName: 'white' }
  const m = MODELS.find(x => x.id === model)
  const contextMax = getContextWindow(model)
  const totalTok = (inputTokens || 0) + (outputTokens || 0)
  const ctxPct = Math.min((totalTok / contextMax) * 100, 100)
  const ctxColor = ctxPct > 85 ? 'red' : ctxPct > 65 ? 'yellow' : 'cyan'
  const elapsedMs = Date.now() - (sessionStart || Date.now())
  const elapsedMins = elapsedMs / 60000
  const burnRate = elapsedMins > 0.1 ? (sessionCost || 0) / elapsedMins : 0
  const budgetPct = budget > 0 ? Math.min(((sessionCost || 0) / budget) * 100, 100) : 0
  const budgetColor = budgetPct > 90 ? 'red' : budgetPct > 70 ? 'yellow' : 'green'
  const costColor = (sessionCost || 0) > 1 ? 'red' : (sessionCost || 0) > 0.5 ? 'yellow' : 'green'

  const fmtEl = ms => {
    const s = Math.floor(ms / 1000), mi = Math.floor(s / 60), h = Math.floor(mi / 60)
    return h > 0 ? `${h}h ${mi % 60}m` : mi > 0 ? `${mi}m ${s % 60}s` : `${s}s`
  }

  // Clear screen and redraw
  process.stdout.write('\x1b[2J\x1b[H')

  const w = Math.min(process.stdout.columns || 40, 42)
  const line = '─'.repeat(w)

  console.log(chalk.cyan.bold('  claudex') + chalk.gray(' watch'))
  console.log(chalk.gray(line))
  console.log()

  // Role + model
  console.log(`  ${chalk[r.colorName].bold(`${r.emoji} ${r.name}`)}`)
  console.log(`  ${chalk.gray(modelLabel(model))}  ${chalk.gray(`$${m?.inputCost ?? '?'}/$${m?.outputCost ?? '?'}/1M`)}`)
  console.log()

  // Token counter
  console.log(chalk.gray('  TOKENS'))
  console.log(`  ${chalk.white.bold(formatTokens(totalTok))} ${chalk.gray('total')}`)
  console.log(`  ${chalk.gray(formatTokens(inputTokens || 0))} in  ${chalk.gray('/')}  ${chalk.cyan(formatTokens(outputTokens || 0))} out`)
  console.log()

  // Context bar
  console.log(chalk.gray('  CONTEXT WINDOW'))
  console.log(`  ${chalk[ctxColor](makeBar(totalTok, contextMax, 20))}`)
  console.log(`  ${chalk[ctxColor](`${ctxPct.toFixed(1)}%`)} ${chalk.gray(`of ${formatTokens(contextMax)}`)}`)
  console.log()

  // Cost
  console.log(chalk.gray('  SESSION COST'))
  console.log(`  ${chalk[costColor].bold(formatCost(sessionCost || 0))}`)
  console.log(`  ${chalk.gray(formatCost(totalCost || 0))} ${chalk.gray('all-time')}`)
  if (burnRate > 0) {
    console.log(`  ${chalk.gray(formatCost(burnRate) + '/min')}`)
  }
  console.log()

  // Duration
  console.log(chalk.gray('  DURATION'))
  console.log(`  ${chalk.white(fmtEl(elapsedMs))}`)
  console.log()

  // Budget
  if (budget > 0) {
    console.log(chalk.gray('  BUDGET'))
    console.log(`  ${chalk[budgetColor](makeBar(sessionCost || 0, budget, 20))}`)
    console.log(`  ${chalk[budgetColor](`${budgetPct.toFixed(1)}%`)} ${chalk.gray(`of ${formatCost(budget)} limit`)}`)
    console.log()
  }

  // Savings tip
  const TIPS = [
    { t: 0.05, msg: 'Use Haiku for quick Q&A — 6x cheaper' },
    { t: 0.20, msg: 'Clear chat after topics change' },
    { t: 0.50, msg: 'Be specific — vague = longer = costlier' },
    { t: 1.00, msg: 'Break large tasks into smaller messages' },
  ]
  const tip = [...TIPS].reverse().find(x => (sessionCost || 0) >= x.t)
  if (tip) {
    console.log(chalk.gray('  TIP'))
    console.log(`  ${chalk.yellow('💡')} ${chalk.gray(tip.msg)}`)
    console.log()
  }

  console.log(chalk.gray(line))
  console.log(chalk.gray(`  Updated ${new Date().toLocaleTimeString()}`))
}
