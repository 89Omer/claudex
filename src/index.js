#!/usr/bin/env node
import { spawn } from 'child_process'
import { execSync } from 'child_process'
import readline from 'readline'
import chalk from 'chalk'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

import { getConfig, getProjectConfig, MODELS, resolveModel } from './utils/config.js'
import { getRole, ROLES } from './roles/index.js'
import { runInit } from './utils/init.js'
import { saveSession, updateStats, saveProjectMemory, getProjectMemory, loadSessions, saveSessionNotes } from './utils/store.js'
import { getRecommendationHint } from './utils/recommendation.js'
import { detectRelatedSessions, buildContextInjection } from './utils/continuity.js'
import { calcCost, formatCost, formatTokens, formatDuration, getClaudeCodeSessions } from './utils/cost.js'
import { getTemplates, formatTemplateList } from './utils/templates.js'
import { printSessionSummary, printHistory, printStats, printResumePicker, printTemplatePicker, printPreLaunchStats } from './utils/display.js'
import { launchWatch, runWatcher, writeWatchState } from './utils/watch.js'
import { printDoctorReport, printContextReport } from './utils/doctor.js'

// ─── CLI Args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const subcommand = args[0]

// Internal flag: run as live watcher (right pane in tmux)
if (args.includes('--watch-mode')) {
  const { runWatcher } = await import('./utils/watch.js')
  runWatcher()
  // Keep process alive
  setInterval(() => {}, 60000)
  process.stdin.resume()
}

// ─── Config ───────────────────────────────────────────────────────────────────
const globalConfig = getConfig()
const projectConfig = getProjectConfig()
const config = { ...globalConfig, ...projectConfig }

// ─── Claude Code Detection ────────────────────────────────────────────────────
function detectClaudeCommand() {
  const isWindows = process.platform === 'win32'
  const candidates = ['claude', 'claude-code', 'claude-cli']

  for (const cmd of candidates) {
    try {
      const findCmd = isWindows ? `where.exe ${cmd}` : `which ${cmd}`
      const result = execSync(findCmd, { stdio: 'pipe', encoding: 'utf-8' }).trim()
      if (result) return isWindows ? `${cmd}.cmd` : cmd
    } catch {}
  }
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'pipe' })
      return process.platform === 'win32' ? `${cmd}.cmd` : cmd
    } catch {}
  }
  return null
}

async function ensureClaudeCode() {
  const cmd = detectClaudeCommand()
  if (cmd) {
    const base = cmd.replace('.cmd', '')
    if (base !== 'claude') console.log(chalk.gray(`  Detected Claude Code as: ${chalk.white(cmd)}\n`))
    return cmd
  }

  console.log(chalk.red('  ✗ Claude Code not found\n'))
  console.log(chalk.white('  claudex requires Claude Code to be installed.\n'))
  console.log(chalk.gray('  Install it with:'))
  console.log(chalk.cyan('    npm install -g @anthropic-ai/claude-code\n'))
  console.log(chalk.gray('  After installing, run: ') + chalk.cyan('claude login\n'))

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise(resolve => rl.question(chalk.white('  Try installing now? (y/n) [y]: '), resolve))
  rl.close()

  if (answer.trim().toLowerCase() !== 'n') {
    console.log(chalk.gray('\n  Running: npm install -g @anthropic-ai/claude-code\n'))
    try {
      execSync('npm install -g @anthropic-ai/claude-code', { stdio: 'inherit' })
      const newCmd = detectClaudeCommand()
      if (newCmd) {
        console.log(chalk.green(`\n  ✓ Installed! Run: claude login  then claudex again.\n`))
      } else {
        console.log(chalk.yellow('\n  Installed but not in PATH yet. Restart your terminal.\n'))
      }
    } catch {
      console.log(chalk.red('\n  Install failed. Please run manually:\n'))
      console.log(chalk.cyan('  npm install -g @anthropic-ai/claude-code\n'))
    }
  } else {
    console.log(chalk.gray('\n  Install Claude Code and run claudex again.\n'))
  }
  process.exit(1)
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function printBanner() {
  console.log()
  console.log(chalk.cyan.bold('  ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗██╗  ██╗'))
  console.log(chalk.cyan    ('  ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝╚██╗██╔╝'))
  console.log(chalk.cyan    ('  ██║     ██║     ███████║██║   ██║██║  ██║█████╗   ╚███╔╝ '))
  console.log(chalk.cyan    ('  ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝   ██╔██╗ '))
  console.log(chalk.cyan    ('  ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗██╔╝ ██╗'))
  console.log(chalk.cyan    ('   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝'))
  console.log()
  console.log(chalk.gray('  supercharged claude code  •  v2.0.0'))
  console.log(chalk.gray('  ' + '─'.repeat((process.stdout.columns || 80) - 2)))
  console.log()
}

function printHelp() {
  console.log(chalk.white('  Usage:\n'))
  console.log(chalk.gray('    claudex                          Interactive launcher'))
  console.log(chalk.gray('    claudex --role=<role>            Skip role picker'))
  console.log(chalk.gray('    claudex --model=<model>          Skip model picker'))
  console.log(chalk.gray('    claudex --role=design --model=opus'))
  console.log()
  console.log(chalk.white('  Commands:\n'))
  console.log(chalk.gray('    claudex doctor      Check setup, config, and Claude Code availability'))
  console.log(chalk.gray('    claudex context     Explain the active role/model/context for this project'))
  console.log(chalk.gray('    claudex watch       Launch with live stats in split terminal (requires tmux)'))
  console.log(chalk.gray('    claudex init        Setup wizard'))
  console.log(chalk.gray('    claudex models      List available models'))
  console.log(chalk.gray('    claudex history     View past sessions'))
  console.log(chalk.gray('    claudex stats       Usage & cost dashboard'))
  console.log(chalk.gray('    claudex resume      Resume a past Claude Code session'))
  console.log(chalk.gray('    claudex use         Pick a prompt template then launch'))
  console.log()
  console.log(chalk.white('  Roles:   ') + chalk.gray(Object.keys(ROLES).join('  ')))
  console.log(chalk.white('  Models:  ') + chalk.gray('opus  sonnet  haiku'))
  console.log()
}

function printModels() {
  printBanner()
  console.log(chalk.white('  Available models:\n'))
  MODELS.forEach((m, i) => {
    const tierColor = m.tier === 'premium' ? 'magenta' : m.tier === 'balanced' ? 'cyan' : 'green'
    console.log(`    ${chalk.bold(`${i + 1}.`)}  ${chalk[tierColor].bold(m.label.padEnd(14))}  ${chalk.gray(m.desc)}`)
    console.log(`        ${chalk.gray('id: ' + m.id)}`)
    console.log()
  })
  console.log(chalk.gray('  Usage:  claudex --model=sonnet\n'))
}

function buildClaudeMd(role, model, template = null, userContent = '', priorContext = null) {
  const modelInfo = MODELS.find(m => m.id === model) || { label: model }
  const templateBlock = template ? `\n\n## Active Template: ${template.label}\n${template.prompt}` : ''
  const contextBlock = priorContext ? `\n\n${priorContext}\n\n---` : ''
  const separator = userContent ? `\n\n---\n\n${userContent}` : ''
  return `# claudex — Active Role: ${role.name} ${role.emoji}
# Model: ${modelInfo.label} (${model})

${role.systemPrompt}${templateBlock}${contextBlock}
<!-- claudex:role:${role.id} -->
<!-- claudex:model:${model} -->${separator}
`.trim() + '\n'
}

function injectRole(role, model, template = null, cwd, priorContext = null) {
  const claudeMdPath = join(cwd, 'CLAUDE.md')
  let userContent = ''
  if (existsSync(claudeMdPath)) {
    const existing = readFileSync(claudeMdPath, 'utf-8')
    if (existing.includes('<!-- claudex:role:')) {
      const parts = existing.split(/\n---\n/)
      if (parts.length > 1) {
        userContent = parts.slice(1).join('\n---\n')
          .replace(/<!-- claudex:role:\w+ -->/, '')
          .replace(/<!-- claudex:model:[^>]+ -->/, '')
          .replace(/<!-- claudex:context:auto-injected -->/, '')
          .trim()
      }
    } else {
      userContent = existing.trim()
    }
  }
  writeFileSync(claudeMdPath, buildClaudeMd(role, model, template, userContent, priorContext))
}

function makeAsker(rl) {
  return (q) => new Promise(resolve => rl.question(q, resolve))
}

// ─── Session Notes & Context Helpers ───────────────────────────────────────────

async function askYesNo(question, defaultAnswer = true) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise(resolve => rl.question(question, resolve))
  rl.close()
  const response = answer.trim().toLowerCase()
  if (response === 'y') return true
  if (response === 'n') return false
  return defaultAnswer
}

async function promptSessionNotesAsync(sessionId) {
  // Non-blocking: shows prompt with 5s timeout
  // If user provides input: save notes
  // If timeout: silently exit
  if (!process.stdin.isTTY) return null // Skip in non-interactive mode

  try {
    return await Promise.race([
      getUserInputForNotes(),
      new Promise((_, reject) => setTimeout(() => reject('timeout'), 5000))
    ])
  } catch (err) {
    // Timeout or error — just return null
    return null
  }
}

async function getUserInputForNotes() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    console.log(chalk.blue('  Save session notes for next time? (Ctrl+D to finish, or press Enter to skip)'))
    let notes = ''

    rl.on('line', line => {
      notes += (notes ? '\n' : '') + line
    })

    rl.on('close', () => {
      if (notes.trim()) {
        resolve(notes.trim())
      } else {
        resolve(null)
      }
    })
  })
}

function shouldShowFirstRunGuide(cwd) {
  const projectMemory = getProjectMemory(cwd)
  const hasProjectConfig = Object.keys(projectConfig || {}).length > 0
  const hasTrackedSessions = loadSessions().length > 0
  return !projectMemory && !hasProjectConfig && !hasTrackedSessions
}

function printFirstRunGuide() {
  console.log(chalk.gray('  First run guide'))
  console.log(chalk.gray('  ' + '-'.repeat(Math.max((process.stdout.columns || 80) - 2, 20))))
  console.log(chalk.gray('  claudex does three things before Claude Code starts:'))
  console.log(chalk.gray('    1. Picks a role and model for this project'))
  console.log(chalk.gray('    2. Writes that context into CLAUDE.md'))
  console.log(chalk.gray('    3. Remembers your last setup for next time'))
  console.log()
  console.log(chalk.gray('  Helpful commands after this launch:'))
  console.log(chalk.gray('    claudex context   See exactly which context sources are active'))
  console.log(chalk.gray('    claudex doctor    Check setup, config, and Claude Code detection'))
  console.log(chalk.gray('    claudex use       Start with a built-in template'))
  console.log()
}

// ─── Pickers ──────────────────────────────────────────────────────────────────
async function pickRole(preselected) {
  if (preselected) return getRole(preselected)

  const cwd = process.cwd()
  const memory = getProjectMemory(cwd)
  const defaultRoleId = memory?.lastRole || config.defaultRole || 'dev'
  const roleList = Object.values(ROLES)

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = makeAsker(rl)

  console.log(chalk.white('  Choose a role:\n'))
  roleList.forEach((r, i) => {
    const hint = r.systemPrompt.split('\n').find(l => l.startsWith('- '))?.replace('- ', '').slice(0, 48) || ''
    const isLast = memory?.lastRole === r.id ? chalk.gray(' ← last used') : ''
    console.log(`    ${chalk.bold(`${i + 1}.`)}  ${r.emoji}  ${chalk[r.colorName].bold(r.name.padEnd(20))} ${chalk.gray(hint)}${isLast}`)
  })

  const defaultIdx = roleList.findIndex(r => r.id === defaultRoleId) + 1
  const answer = await ask(chalk.white(`\n  Enter number [${defaultIdx}]: `))
  rl.close()

  const idx = parseInt(answer.trim()) - 1
  return (!isNaN(idx) && roleList[idx]) ? roleList[idx] : getRole(defaultRoleId)
}

async function pickModel(preselected, roleId = null) {
  if (preselected) return resolveModel(preselected) || config.defaultModel || 'claude-sonnet-4-6'

  const cwd = process.cwd()
  const memory = getProjectMemory(cwd)
  const defaultModelId = memory?.lastModel || config.defaultModel || 'claude-sonnet-4-6'

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = makeAsker(rl)

  // Show recommendation if available
  if (roleId) {
    const hint = getRecommendationHint(roleId, cwd)
    if (hint) {
      console.log(chalk.cyan(`\n  💡 Recommended: ${hint.modelLabel} (${hint.confidence}% confidence)`))
      console.log(chalk.cyan.dim(`     ${hint.reason}\n`))
    }
  }

  console.log(chalk.white('  Choose a model:\n'))
  MODELS.forEach((m, i) => {
    const tierColor = m.tier === 'premium' ? 'magenta' : m.tier === 'balanced' ? 'cyan' : 'green'
    const isDefault = m.id === defaultModelId ? chalk.gray(' ← last used') : ''
    console.log(`    ${chalk.bold(`${i + 1}.`)}  ${chalk[tierColor].bold(m.label.padEnd(14))}  ${chalk.gray(m.desc)}${isDefault}`)
  })

  const defaultIdx = MODELS.findIndex(m => m.id === defaultModelId) + 1
  const answer = await ask(chalk.white(`\n  Enter number [${defaultIdx}]: `))
  rl.close()

  const idx = parseInt(answer.trim()) - 1
  if (!isNaN(idx) && MODELS[idx]) return MODELS[idx].id
  if (answer.trim()) return resolveModel(answer.trim()) || defaultModelId
  return defaultModelId
}

async function pickTemplate(role) {
  const templates = formatTemplateList(role.id)
  printTemplatePicker(templates, role)

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise(resolve => rl.question(chalk.white('  Enter number [0]: '), resolve))
  rl.close()

  const idx = parseInt(answer.trim())
  if (idx === 0 || isNaN(idx)) return null
  const t = templates[idx - 1]
  if (!t) return null

  const allTemplates = getTemplates(role.id)
  return { key: t.key, label: t.label, prompt: allTemplates[t.key].prompt }
}

// ─── Launch ───────────────────────────────────────────────────────────────────
function launchClaudeCode(role, model, claudeCmd, template = null, extraArgs = [], priorContext = null) {
  const cwd = process.cwd()
  const modelInfo = MODELS.find(m => m.id === model) || { label: model, tier: 'balanced' }
  const tierColor = modelInfo.tier === 'premium' ? 'magenta' : modelInfo.tier === 'balanced' ? 'cyan' : 'green'

  console.log(chalk.gray(`  Role    `) + `${role.emoji} ${chalk[role.colorName].bold(role.name)}`)
  console.log(chalk.gray(`  Model   `) + chalk[tierColor].bold(modelInfo.label) + chalk.gray(` (${model})`))
  if (template) console.log(chalk.gray(`  Template`) + ` ${chalk.yellow(template.label)}`)
  if (priorContext) console.log(chalk.gray(`  Context `) + chalk.blue.dim(`Prior session injected`))
  console.log()
  console.log(chalk.gray(`  Writing CLAUDE.md and launching...`))
  console.log()

  injectRole(role, model, template, cwd, priorContext)

  // Show pre-launch stats
  printPreLaunchStats(role, model, cwd)

  // Write initial watch state
  writeWatchState({ role: role.id, model, sessionCost: 0, inputTokens: 0, outputTokens: 0, sessionStart: Date.now() })

  // Save project memory
  saveProjectMemory(cwd, { lastRole: role.id, lastModel: model })

  console.log(chalk.gray('  ' + '─'.repeat((process.stdout.columns || 80) - 2)))
  console.log()

  const sessionStart = Date.now()
  const sessionId = Date.now().toString(36)
  const claudeArgs = ['--model', model, ...extraArgs]
  const isWindows = process.platform === 'win32'

  const claude = spawn(claudeCmd, claudeArgs, {
    stdio: 'inherit',
    cwd,
    env: { ...process.env },
    shell: isWindows
  })

  claude.on('close', async (code) => {
    const duration = Date.now() - sessionStart

    // Try to get real token counts from Claude Code's session files
    // Estimate as fallback (rough: 1 token ≈ 4 chars, assume avg session)
    const session = {
      id: sessionId,
      role: role.id,
      model,
      startTime: sessionStart,
      endTime: Date.now(),
      duration,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      project: cwd,
      template: template?.key || null,
    }

    // Save session + update stats
    saveSession(session)
    updateStats(session)

    // Non-blocking: prompt for session notes (5s timeout)
    if (process.stdin.isTTY) {
      promptSessionNotesAsync(sessionId).then(notes => {
        if (notes) {
          saveSessionNotes(sessionId, notes)
        }
      }).catch(() => {
        // Timeout or error — just continue
      })
    }

    // Print summary
    printSessionSummary(session)
    process.exit(code || 0)
  })

  claude.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.log(chalk.red(`\n  ✗ Failed to launch '${claudeCmd}'`))
      console.log(chalk.gray('  Try: ' + chalk.white(claudeCmd.replace('.cmd', '') + ' --version')))
      console.log(chalk.gray('  Reinstall: ' + chalk.cyan('npm install -g @anthropic-ai/claude-code')))
    } else {
      console.log(chalk.red(`\n  ✗ ${err.message}`))
    }
    process.exit(1)
  })
}

// ─── Subcommands ──────────────────────────────────────────────────────────────
async function handleSubcommand(cmd) {
  switch (cmd) {
    case 'init':
      await runInit()
      process.exit(0)

    case 'doctor':
      printDoctorReport(process.cwd())
      process.exit(0)

    case 'context':
      printContextReport(process.cwd())
      process.exit(0)

    case '--help':
    case '-h':
      printBanner()
      printHelp()
      process.exit(0)

    case 'models':
      printModels()
      process.exit(0)

    case 'history': {
      printBanner()
      const limit = parseInt(args[1]) || 20
      printHistory(limit)
      process.exit(0)
    }

    case 'stats': {
      printBanner()
      printStats()
      process.exit(0)
    }

    case 'resume': {
      printBanner()
      const claudeCmd = await ensureClaudeCode()
      const claudeSessions = getClaudeCodeSessions(15)
      const hasSessions = printResumePicker(claudeSessions)
      if (!hasSessions) process.exit(0)

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      const answer = await new Promise(resolve => rl.question(chalk.white('  Enter number: '), resolve))
      rl.close()

      const idx = parseInt(answer.trim()) - 1
      if (isNaN(idx) || !claudeSessions[idx]) {
        console.log(chalk.red('  Invalid selection\n'))
        process.exit(1)
      }

      const picked = claudeSessions[idx]
      console.log(chalk.gray(`\n  Resuming session ${picked.id.slice(0, 8)}...\n`))
      const isWindows = process.platform === 'win32'
      const claude = spawn(claudeCmd, ['--resume', picked.id], {
        stdio: 'inherit',
        env: { ...process.env },
        shell: isWindows
      })
      claude.on('close', (code) => process.exit(code || 0))
      claude.on('error', (err) => {
        console.log(chalk.red(`\n  ✗ ${err.message}\n`))
        process.exit(1)
      })
      break
    }

    case 'watch': {
      printBanner()
      const claudeCmd = await ensureClaudeCode()
      const cwd = process.cwd()
      const role = await pickRole(args.find(a => a.startsWith('--role='))?.split('=')[1])
      console.log()
      const model = await pickModel(args.find(a => a.startsWith('--model='))?.split('=')[1], role.id)
      console.log()

      // Detect prior context for watch mode
      let priorContext = null
      const relatedSessions = detectRelatedSessions(cwd, role.id)
      if (relatedSessions.length > 0) {
        const injectContext = await askYesNo(chalk.white('  Inject prior context? (y/n) [n]: '), false)
        if (injectContext) {
          priorContext = buildContextInjection(relatedSessions)
        }
      }

      printPreLaunchStats(role, model, cwd)
      const launched = await launchWatch(role, model, claudeCmd, [], priorContext)
      if (!launched) {
        // tmux not available — fall through to normal launch
        launchClaudeCode(role, model, claudeCmd, null, [], priorContext)
      }
      break
    }

    case 'use': {
      printBanner()
      const claudeCmd = await ensureClaudeCode()
      const cwd = process.cwd()
      const role = await pickRole(args.find(a => a.startsWith('--role='))?.split('=')[1])
      console.log()
      const template = await pickTemplate(role)
      console.log()
      const model = await pickModel(args.find(a => a.startsWith('--model='))?.split('=')[1], role.id)
      console.log()

      // Detect prior context for template-based launch
      let priorContext = null
      const relatedSessions = detectRelatedSessions(cwd, role.id)
      if (relatedSessions.length > 0) {
        const injectContext = await askYesNo(chalk.white('  Inject prior context? (y/n) [n]: '), false)
        if (injectContext) {
          priorContext = buildContextInjection(relatedSessions)
        }
      }

      launchClaudeCode(role, model, claudeCmd, template, [], priorContext)
      break
    }

    default:
      return false // not a subcommand
  }
  return true
}

// ─── Main ─────────────────────────────────────────────────────────────────────
// Handle subcommands
if (subcommand === '--help' || subcommand === '-h') {
  await handleSubcommand(subcommand)
} else if (subcommand && !subcommand.startsWith('--')) {
  const handled = await handleSubcommand(subcommand)
  if (!handled) {
    printBanner()
    console.log(chalk.red(`  Unknown command: ${subcommand}\n`))
    printHelp()
    process.exit(1)
  }
} else {
  // Interactive launcher
  printBanner()
  const claudeCmd = await ensureClaudeCode()
  const cwd = process.cwd()
  if (shouldShowFirstRunGuide(cwd)) {
    printFirstRunGuide()
  }

  const roleFlag  = args.find(a => a.startsWith('--role='))
  const modelFlag = args.find(a => a.startsWith('--model='))
  const extraArgs = args.filter(a => !a.startsWith('--role=') && !a.startsWith('--model=') && !a.startsWith('-'))

  const role  = await pickRole(roleFlag?.split('=')[1])
  console.log()
  const model = await pickModel(modelFlag?.split('=')[1], role.id)
  console.log()

  // Detect and offer prior session context
  let priorContext = null
  const relatedSessions = detectRelatedSessions(cwd, role.id)
  if (relatedSessions.length > 0) {
    console.log(chalk.blue('  Prior sessions found:'))
    relatedSessions.forEach((s, i) => {
      console.log(chalk.blue.dim(`    ${i + 1}. ${s.reason}`))
    })
    console.log()

    const injectContext = await askYesNo(chalk.white('  Inject prior context? (y/n) [n]: '), false)
    if (injectContext) {
      priorContext = buildContextInjection(relatedSessions)
    }
    console.log()
  }

  launchClaudeCode(role, model, claudeCmd, null, extraArgs, priorContext)
}
