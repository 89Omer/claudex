import chalk from 'chalk'
import { formatCost, formatTokens, formatDuration, formatDate, calcCost } from './cost.js'
import { loadSessions, loadStats } from './store.js'
import { ROLES } from '../roles/index.js'
import { MODELS, PRICING, getContextWindow } from './config.js'

const cols = () => Math.min(process.stdout.columns || 80, 100)
let frameCount = 0

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
  frameCount += 1

  const {
    role,
    model,
    sessionCost = 0,
    totalCost = 0,
    inputTokens = 0,
    outputTokens = 0,
    duration,
    sessionStart,
    budget = 0,
    lastActivity
  } = state

  const roleInfo = ROLES[role] || { emoji: '?', name: role || 'Unknown', colorName: 'white' }
  const modelInfo = MODELS.find(x => x.id === model) || { id: model, label: model || 'Unknown model' }
  const pricing = PRICING[model] || PRICING['claude-sonnet-4-6'] || { input: 0, output: 0 }
  const contextMax = getContextWindow(model)
  const totalTokens = inputTokens + outputTokens
  const elapsedMs = duration || (Date.now() - (sessionStart || Date.now()))
  const elapsedSecs = Math.max(elapsedMs / 1000, 1)
  const elapsedMins = Math.max(elapsedMs / 60000, 1 / 60)
  const ctxPct = contextMax > 0 ? Math.min((totalTokens / contextMax) * 100, 100) : 0
  const tokenBurnRate = totalTokens > 0 ? totalTokens / elapsedSecs : 0
  const costBurnRate = sessionCost > 0 ? sessionCost / elapsedMins : 0
  const budgetPct = budget > 0 ? Math.min((sessionCost / budget) * 100, 100) : 0
  const budgetRemaining = Math.max(budget - sessionCost, 0)
  const isStreaming = !lastActivity || ((Date.now() - lastActivity) / 1000) < 8
  const pulsingDot = frameCount % 2 === 0 ? chalk.cyanBright('●') : chalk.cyan.dim('●')
  const width = Math.max(Math.min(process.stdout.columns || 80, 110), 72)
  const innerWidth = width - 2
  const contextBarWidth = Math.max(Math.min(innerWidth - 18, 36), 20)

  const fmtNumber = n => Number(n || 0).toLocaleString('en-US')
  const fmtCompact = n => {
    const value = Number(n || 0)
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
    return fmtNumber(Math.round(value))
  }
  const fmtMoney = n => `$${Number(n || 0).toFixed(4)}`
  const fmtElapsed = ms => {
    const totalSeconds = Math.max(Math.floor(ms / 1000), 0)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    const hours = Math.floor(mins / 60)
    if (hours > 0) return `${hours}h ${mins % 60}m`
    return `${mins}m ${secs}s`
  }
  const visible = text => String(text).replace(/\u001b\[[0-9;]*m/g, '').length
  const padRight = (text, widthValue) => text + ' '.repeat(Math.max(widthValue - visible(text), 0))
  const padBetween = (left, right, widthValue) => {
    const spaces = Math.max(widthValue - visible(left) - visible(right), 1)
    return left + ' '.repeat(spaces) + right
  }
  const line = text => `║${padRight(`  ${text}`, innerWidth)}║`
  const split = (left, right) => `║${padBetween(`  ${left}`, right, innerWidth)}║`
  const sectionDivider = char => `╠${char.repeat(innerWidth)}╣`

  const contextFilled = Math.round((ctxPct / 100) * contextBarWidth)
  let contextBar = ''
  for (let i = 0; i < contextBarWidth; i++) {
    const block = i < contextFilled ? '█' : '░'
    const fillPct = ((i + 1) / contextBarWidth) * 100
    if (i >= contextFilled) {
      contextBar += chalk.gray(block)
    } else if (fillPct <= 50) {
      contextBar += chalk.green(block)
    } else if (fillPct <= 75) {
      contextBar += chalk.yellow(block)
    } else if (fillPct <= 90) {
      contextBar += chalk.hex('#ff8c00')(block)
    } else {
      contextBar += chalk.redBright(block)
    }
  }

  const costColor = sessionCost > 1 ? 'red' : sessionCost >= 0.5 ? 'yellow' : 'green'
  const budgetColor = budgetPct >= 90 ? 'redBright' : budgetPct >= 70 ? 'yellow' : 'green'
  const budgetSegments = 20
  const budgetFilled = budget > 0 ? Math.round((budgetPct / 100) * budgetSegments) : 0
  const budgetBar = Array.from({ length: budgetSegments }, (_, i) => {
    const block = i < budgetFilled ? '■' : '□'
    if (i >= budgetFilled) return chalk.gray(block)
    if (budgetPct >= 90) return frameCount % 2 === 0 ? chalk.redBright(block) : chalk.red(block)
    if (budgetPct >= 70) return chalk.yellow(block)
    return chalk.green(block)
  }).join('')

  const sparklineLevels = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
  const sparkIndex = Math.min(
    Math.round(Math.min(tokenBurnRate / 60, 1) * (sparklineLevels.length - 1)),
    sparklineLevels.length - 1
  )
  const sparkline = Array.from({ length: 8 }, (_, i) => {
    const index = Math.max(0, sparkIndex - Math.max(0, 4 - i))
    return sparklineLevels[Math.min(index, sparklineLevels.length - 1)]
  }).join('')

  const tips = [
    { threshold: 0, icon: '💡', msg: 'Tip: Haiku is 6x cheaper for simple tasks' },
    { threshold: 0.15, icon: '✂️', msg: 'Tip: Clear context after switching topics' },
    { threshold: 0.30, icon: '🎯', msg: 'Tip: Specific prompts = shorter answers = lower cost' },
    { threshold: 0.60, icon: '📦', msg: 'Tip: Break large tasks into smaller messages' },
    { threshold: 1.20, icon: '⚡', msg: 'Tip: Switch to Haiku for brainstorming' },
  ]
  const tipPool = tips.filter(tip => sessionCost >= tip.threshold)
  const rotatedTips = tipPool.length > 0 ? tipPool : [tips[0]]
  const activeTip = rotatedTips[Math.floor(frameCount / 10) % rotatedTips.length]
  const contextWarning = ctxPct >= 80 ? `${chalk.redBright('⚠')} ${chalk.yellow('Consider clearing context soon')}` : null
  const budgetWarning = budget > 0 && budgetPct >= 90
    ? (frameCount % 2 === 0 ? chalk.redBright('🚨 BUDGET WARNING') : chalk.red('🚨 BUDGET WARNING'))
    : null
  const burnLine = isStreaming && tokenBurnRate > 0.2
    ? `${chalk.yellow('🔥')} ${chalk.yellow.bold(`${fmtNumber(Math.round(tokenBurnRate))} tok/s`)} ${chalk.gray(sparkline)}`
    : `${chalk.gray('…')} ${chalk.gray('Waiting for token updates')}`

  process.stdout.write('\x1b[2J\x1b[H')

  const output = [
    `╔${'═'.repeat(innerWidth)}╗`,
    split(
      `${pulsingDot} ${chalk.cyanBright.bold('claudex watch')}  ${chalk[roleInfo.colorName].bold(`${roleInfo.emoji} ${roleInfo.name}`)}`,
      chalk.white.bold(fmtElapsed(elapsedMs))
    ),
    split(
      `${chalk.gray('Model')} ${chalk.white(modelInfo.label)} ${chalk.gray('·')} ${chalk.gray(`$${pricing.input}/$${pricing.output} per 1M`)}`,
      chalk.gray(isStreaming ? 'live' : 'idle')
    ),
    sectionDivider('═'),
    line(chalk.gray.bold('TOKENS')),
    line(`${chalk.white.bold(`${fmtNumber(totalTokens)} total`)} ${chalk.gray(`(${fmtCompact(totalTokens)})`)}`),
    split(
      `${chalk.blue('↑')} ${chalk.blueBright(fmtNumber(inputTokens))} ${chalk.gray('input')}`,
      `${chalk.green('↓')} ${chalk.greenBright(fmtNumber(outputTokens))} ${chalk.gray('output')}`
    ),
    line(burnLine),
    sectionDivider('─'),
    split(
      `${chalk.gray.bold('CONTEXT')}  ${ctxPct >= 90 ? chalk.redBright('⚠ ') : ''}${chalk.white.bold(`${ctxPct.toFixed(1)}%`)}`,
      chalk.gray(`${fmtCompact(totalTokens)} / ${fmtCompact(contextMax)}`)
    ),
    split(contextBar, chalk[ctxPct >= 90 ? 'redBright' : ctxPct >= 75 ? 'yellow' : 'green'](`${ctxPct.toFixed(1)}%`)),
    ...(contextWarning ? [line(contextWarning)] : []),
    sectionDivider('─'),
    split(
      `${chalk.gray.bold('COST')}  ${chalk[costColor].bold(fmtMoney(sessionCost))}`,
      `${chalk.gray('$/min')} ${chalk[costColor](fmtMoney(costBurnRate))}`
    ),
    line(chalk.gray(`${fmtMoney(totalCost)} all-time`)),
    ...(budget > 0 ? [
      sectionDivider('─'),
      split(
        `${chalk.gray.bold('🪙 BUDGET')}  ${chalk[budgetColor].bold(`${budgetPct.toFixed(1)}% used`)}`,
        chalk.gray(`${fmtMoney(budgetRemaining)} remaining`)
      ),
      line(`${budgetBar} ${chalk.gray(`· ${fmtMoney(sessionCost)} / ${fmtMoney(budget)}`)}`),
      ...(budgetWarning ? [line(budgetWarning)] : []),
    ] : []),
    sectionDivider('─'),
    line(`${activeTip.icon} ${chalk.white(activeTip.msg)}`),
    sectionDivider('─'),
    split(
      chalk.gray(`Updated ${new Date().toLocaleTimeString('en-GB', { hour12: false })}`),
      chalk.gray('Ctrl+C to exit')
    ),
    `╚${'═'.repeat(innerWidth)}╝`,
  ]

  process.stdout.write(output.join('\n') + '\n')
}

