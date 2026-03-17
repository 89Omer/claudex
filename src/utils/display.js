import chalk from 'chalk'
import { formatCost, formatTokens, formatDuration, formatDate } from './cost.js'
import { loadSessions, loadStats } from './store.js'
import { ROLES } from '../roles/index.js'
import { MODELS } from './config.js'

const cols = () => process.stdout.columns || 80

function divider(char = '─') {
  return chalk.gray(char.repeat(cols()))
}

function roleColor(roleId) {
  return ROLES[roleId]?.colorName || 'white'
}

function modelLabel(modelId) {
  return MODELS.find(m => m.id === modelId)?.label || modelId
}

// ─── Session Summary (shown after claude exits) ───────────────────────────────

export function printSessionSummary(session) {
  const role = ROLES[session.role] || { emoji: '?', name: session.role, colorName: 'white' }
  const cost = formatCost(session.cost || 0)
  const duration = formatDuration(session.duration || 0)
  const inputTok = formatTokens(session.inputTokens || 0)
  const outputTok = formatTokens(session.outputTokens || 0)
  const allTimeStats = loadStats()

  console.log()
  console.log(divider())
  console.log(chalk.cyan.bold('  claudex') + chalk.gray(' — session ended'))
  console.log(divider())
  console.log()
  console.log(`  ${chalk.gray('Role    ')}  ${role.emoji} ${chalk[role.colorName].bold(role.name)}`)
  console.log(`  ${chalk.gray('Model   ')}  ${chalk.white(modelLabel(session.model))}`)
  console.log(`  ${chalk.gray('Duration')}  ${chalk.white(duration)}`)
  console.log()
  console.log(`  ${chalk.gray('Tokens  ')}  ${chalk.white(inputTok)} in / ${chalk.white(outputTok)} out`)
  console.log(`  ${chalk.gray('Cost    ')}  ${chalk.green.bold(cost)}`)
  console.log()
  const allTimeCost = formatCost(allTimeStats.totalCost || 0)
  const allTimeSessions = allTimeStats.totalSessions || 0
  console.log(`  ${chalk.gray('All-time')}  ${chalk.gray(allTimeCost + ' across ' + allTimeSessions + ' sessions')}`)
  console.log()
  console.log(divider())
  console.log()
}

// ─── History Table ────────────────────────────────────────────────────────────

export function printHistory(limit = 20) {
  const sessions = loadSessions().slice(0, limit)

  if (sessions.length === 0) {
    console.log(chalk.gray('\n  No sessions recorded yet. Run claudex to start one.\n'))
    return
  }

  console.log()
  console.log(divider())
  console.log(chalk.cyan.bold('  claudex history') + chalk.gray(` — last ${sessions.length} sessions`))
  console.log(divider())
  console.log()

  // Header
  console.log(
    chalk.gray('  #   ') +
    chalk.gray('Role'.padEnd(14)) +
    chalk.gray('Model'.padEnd(14)) +
    chalk.gray('Cost'.padEnd(10)) +
    chalk.gray('Tokens'.padEnd(12)) +
    chalk.gray('Duration'.padEnd(10)) +
    chalk.gray('When')
  )
  console.log(chalk.gray('  ' + '─'.repeat(cols() - 4)))

  sessions.forEach((s, i) => {
    const role = ROLES[s.role] || { emoji: '?', name: s.role, colorName: 'white' }
    const num = chalk.gray(String(i + 1).padStart(2) + '. ')
    const roleStr = chalk[role.colorName](`${role.emoji} ${role.name}`.padEnd(14))
    const modelStr = chalk.white(modelLabel(s.model).padEnd(14))
    const costStr = chalk.green(formatCost(s.cost || 0).padEnd(10))
    const totalTok = formatTokens((s.inputTokens || 0) + (s.outputTokens || 0))
    const tokStr = chalk.gray(totalTok.padEnd(12))
    const durStr = chalk.gray(formatDuration(s.duration || 0).padEnd(10))
    const whenStr = chalk.gray(formatDate(s.startTime))

    console.log(`  ${num}${roleStr}${modelStr}${costStr}${tokStr}${durStr}${whenStr}`)
  })

  console.log()
  console.log(divider())
  console.log()
}

// ─── Stats Dashboard ──────────────────────────────────────────────────────────

export function printStats() {
  const stats = loadStats()
  const sessions = loadSessions()

  console.log()
  console.log(divider())
  console.log(chalk.cyan.bold('  claudex stats'))
  console.log(divider())
  console.log()

  // Overview
  console.log(chalk.white('  Overview'))
  console.log()
  console.log(`  ${chalk.gray('Total sessions')}   ${chalk.white(stats.totalSessions || 0)}`)
  console.log(`  ${chalk.gray('Total cost    ')}   ${chalk.green.bold(formatCost(stats.totalCost || 0))}`)
  console.log(`  ${chalk.gray('Total tokens  ')}   ${chalk.white(formatTokens((stats.totalInputTokens || 0) + (stats.totalOutputTokens || 0)))}`)
  if (stats.totalSessions > 0) {
    const avgCost = (stats.totalCost || 0) / stats.totalSessions
    console.log(`  ${chalk.gray('Avg per session')}  ${chalk.white(formatCost(avgCost))}`)
  }

  // By role
  if (Object.keys(stats.byRole || {}).length > 0) {
    console.log()
    console.log(chalk.white('  By Role'))
    console.log()
    Object.entries(stats.byRole).forEach(([roleId, data]) => {
      const role = ROLES[roleId] || { emoji: '?', name: roleId, colorName: 'white' }
      const bar = makeBar(data.sessions, stats.totalSessions, 12)
      console.log(
        `  ${role.emoji} ${chalk[role.colorName].bold(role.name.padEnd(18))}` +
        `${chalk.gray(bar)}  ` +
        `${chalk.white(data.sessions + ' sessions')}  ` +
        chalk.green(formatCost(data.cost || 0))
      )
    })
  }

  // By model
  if (Object.keys(stats.byModel || {}).length > 0) {
    console.log()
    console.log(chalk.white('  By Model'))
    console.log()
    Object.entries(stats.byModel).forEach(([modelId, data]) => {
      const label = modelLabel(modelId)
      const bar = makeBar(data.sessions, stats.totalSessions, 12)
      console.log(
        `  ${chalk.white(label.padEnd(18))}` +
        `${chalk.gray(bar)}  ` +
        `${chalk.white(data.sessions + ' sessions')}  ` +
        chalk.green(formatCost(data.cost || 0))
      )
    })
  }

  // Recent sessions
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
    const msgs = chalk.gray(`${s.messageCount} messages`)
    const proj = chalk.gray(s.project?.slice(-30) || 'unknown project')
    console.log(`    ${chalk.bold(`${i + 1}.`)}  ${chalk.white(s.id.slice(0, 8))}…  ${proj}  ${msgs}  ${when}`)
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBar(value, total, width) {
  if (!total) return '░'.repeat(width)
  const filled = Math.round((value / total) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}
