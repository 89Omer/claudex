import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import chalk from 'chalk'

import { getConfig, getProjectConfig, MODELS } from './config.js'
import { getProjectMemory, loadSessions, loadStats } from './store.js'
import { formatCost } from './cost.js'
import { ROLES } from '../roles/index.js'
import { getTemplates } from './templates.js'

const CLAUDE_DIR = join(homedir(), '.claude')
const CLAUDE_PROJECTS_DIR = join(CLAUDE_DIR, 'projects')

function ok(label, value) {
  console.log(`  ${chalk.green('OK')}  ${chalk.white(label.padEnd(18))} ${chalk.gray(value)}`)
}

function warn(label, value) {
  console.log(`  ${chalk.yellow('WARN')} ${chalk.white(label.padEnd(18))} ${chalk.gray(value)}`)
}

function fail(label, value) {
  console.log(`  ${chalk.red('FAIL')} ${chalk.white(label.padEnd(18))} ${chalk.gray(value)}`)
}

function detectClaudeCommandDetails() {
  const isWindows = process.platform === 'win32'
  const candidates = ['claude', 'claude-code', 'claude-cli']

  for (const cmd of candidates) {
    try {
      const findCmd = isWindows ? `where.exe ${cmd}` : `which ${cmd}`
      const result = execSync(findCmd, { stdio: 'pipe', encoding: 'utf-8' }).trim()
      if (result) {
        const first = result.split(/\r?\n/)[0]
        return { command: isWindows ? `${cmd}.cmd` : cmd, path: first }
      }
    } catch {}
  }

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'pipe' })
      return { command: process.platform === 'win32' ? `${cmd}.cmd` : cmd, path: 'Available in PATH' }
    } catch {}
  }

  return null
}

function getActiveClaudeMd(cwd) {
  const claudeMdPath = join(cwd, 'CLAUDE.md')
  if (!existsSync(claudeMdPath)) return null

  const content = readFileSync(claudeMdPath, 'utf-8')
  const roleMatch = content.match(/<!-- claudex:role:([^ ]+) -->/)
  const modelMatch = content.match(/<!-- claudex:model:([^>]+) -->/)

  return {
    path: claudeMdPath,
    hasClaudexMarkers: Boolean(roleMatch || modelMatch),
    role: roleMatch?.[1] || null,
    model: modelMatch?.[1] || null,
    content,
  }
}

export function printDoctorReport(cwd = process.cwd()) {
  const projectConfig = getProjectConfig()
  const globalConfig = getConfig()
  const projectMemory = getProjectMemory(cwd)
  const stats = loadStats()
  const sessions = loadSessions()
  const claude = detectClaudeCommandDetails()
  const activeClaudeMd = getActiveClaudeMd(cwd)
  const hasClaudeProjects = existsSync(CLAUDE_PROJECTS_DIR)
  const projectSessions = sessions.filter(s => s.project === cwd)

  console.log()
  console.log(chalk.cyan.bold('  claudex doctor'))
  console.log(chalk.gray('  Inspecting your local setup, saved context, and Claude Code availability.\n'))

  if (claude) {
    ok('Claude Code', `${claude.command} (${claude.path})`)
  } else {
    fail('Claude Code', 'Not found in PATH. Install with npm install -g @anthropic-ai/claude-code')
  }

  try {
    ok('Node.js', process.version)
  } catch {
    warn('Node.js', 'Unable to determine version')
  }

  if (existsSync(CLAUDE_DIR)) {
    ok('Claude home', CLAUDE_DIR)
  } else {
    warn('Claude home', `${CLAUDE_DIR} not found yet`)
  }

  if (hasClaudeProjects) {
    ok('Claude sessions', `${CLAUDE_PROJECTS_DIR} exists`)
  } else {
    warn('Claude sessions', 'No ~/.claude/projects directory found yet')
  }

  console.log()
  console.log(chalk.white('  Configuration'))
  console.log()

  const defaultRole = describeRole(globalConfig.defaultRole)
  const defaultModel = describeModel(globalConfig.defaultModel)
  if (defaultRole.valid) ok('Default role', defaultRole.label)
  else warn('Default role', `${defaultRole.label} (not in current role list)`)
  if (defaultModel.valid) ok('Default model', defaultModel.label)
  else warn('Default model', `${defaultModel.label} (not in current model list)`)
  ok('Budget alert', `$${Number(globalConfig.budgetAlert || 0).toFixed(2)}`)

  if (Object.keys(projectConfig).length > 0) {
    ok('Project config', '.claudex.json loaded')
  } else {
    warn('Project config', 'No .claudex.json in this project')
  }

  if (projectMemory) {
    const memoryRole = describeRole(projectMemory.lastRole)
    const memoryModel = describeModel(projectMemory.lastModel)
    const label = `${memoryRole.label} / ${memoryModel.label}`
    if (memoryRole.valid && memoryModel.valid) ok('Project memory', label)
    else warn('Project memory', `${label} (contains unsupported role or model)`)
  } else {
    warn('Project memory', 'No saved role/model memory for this project yet')
  }

  if (activeClaudeMd) {
    const source = activeClaudeMd.hasClaudexMarkers ? 'Managed by claudex' : 'User-managed'
    ok('CLAUDE.md', `${source} (${activeClaudeMd.path})`)
  } else {
    warn('CLAUDE.md', 'No CLAUDE.md found in current directory')
  }

  console.log()
  console.log(chalk.white('  Usage'))
  console.log()
  ok('All-time spend', formatCost(stats.totalCost || 0))
  ok('Saved sessions', `${stats.totalSessions || 0} tracked by claudex`)
  ok('Project sessions', `${projectSessions.length} in this directory`)

  const customTemplateGroups = Object.keys(projectConfig.templates || {})
  if (customTemplateGroups.length > 0) {
    ok('Custom templates', customTemplateGroups.join(', '))
  } else {
    warn('Custom templates', 'No project-level custom templates configured')
  }

  console.log()
}

export function printContextReport(cwd = process.cwd()) {
  const globalConfig = getConfig()
  const projectConfig = getProjectConfig()
  const projectMemory = getProjectMemory(cwd)
  const activeClaudeMd = getActiveClaudeMd(cwd)

  const memoryRole = projectMemory?.lastRole || projectConfig.defaultRole || globalConfig.defaultRole || 'dev'
  const memoryModel = projectMemory?.lastModel || projectConfig.defaultModel || globalConfig.defaultModel
  const activeRoleId = activeClaudeMd?.role || memoryRole
  const activeModelId = activeClaudeMd?.model || memoryModel
  const activeRole = ROLES[activeRoleId] || ROLES.dev
  const activeModel = MODELS.find(m => m.id === activeModelId)
  const templates = getTemplates(activeRole.id)
  const templateKeys = Object.keys(templates)

  console.log()
  console.log(chalk.cyan.bold('  claudex context'))
  console.log(chalk.gray('  This is the context a new launch in this project will use or inherit.\n'))

  console.log(`  ${chalk.gray('Project')}        ${chalk.white(cwd)}`)
  console.log(`  ${chalk.gray('Active role')}    ${activeRole.emoji} ${chalk[activeRole.colorName].bold(activeRole.name)} ${chalk.gray(`(${activeRole.id})`)}`)
  console.log(`  ${chalk.gray('Active model')}   ${chalk.white(activeModel?.label || activeModelId)} ${chalk.gray(`(${activeModelId})`)}`)
  console.log(`  ${chalk.gray('Budget alert')}   ${chalk.white(`$${Number(globalConfig.budgetAlert || 0).toFixed(2)}`)}`)
  console.log()

  console.log(chalk.white('  Resolution order'))
  console.log()
  console.log(`  ${chalk.gray('Role source')}    ${describeSource(activeClaudeMd?.role, projectMemory?.lastRole, projectConfig.defaultRole, globalConfig.defaultRole)}`)
  console.log(`  ${chalk.gray('Model source')}   ${describeSource(activeClaudeMd?.model, projectMemory?.lastModel, projectConfig.defaultModel, globalConfig.defaultModel)}`)
  console.log(`  ${chalk.gray('CLAUDE.md')}      ${activeClaudeMd ? chalk.white(activeClaudeMd.path) : chalk.gray('Not present')}`)
  console.log(`  ${chalk.gray('Project config')} ${Object.keys(projectConfig).length > 0 ? chalk.white('.claudex.json loaded') : chalk.gray('Not present')}`)
  console.log(`  ${chalk.gray('Saved memory')}   ${projectMemory ? chalk.white('Available for this project') : chalk.gray('No saved memory yet')}`)
  console.log()

  console.log(chalk.white('  Prompt layers'))
  console.log()
  console.log(`  ${chalk.gray('Role prompt')}    ${chalk.white(firstPromptLine(activeRole.systemPrompt))}`)
  console.log(`  ${chalk.gray('Templates')}      ${templateKeys.length > 0 ? chalk.white(templateKeys.join(', ')) : chalk.gray('None available')}`)

  if (activeClaudeMd?.content) {
    const hasUserContent = activeClaudeMd.content.split(/\n---\n/).length > 1
    console.log(`  ${chalk.gray('User content')}   ${hasUserContent ? chalk.white('Present below claudex block in CLAUDE.md') : chalk.gray('No extra content detected')}`)
  } else {
    console.log(`  ${chalk.gray('User content')}   ${chalk.gray('No CLAUDE.md found yet')}`)
  }

  console.log()
}

function describeSource(active, projectMemory, projectConfig, globalConfig) {
  if (active) return chalk.green(`CLAUDE.md marker (${active})`)
  if (projectMemory) return chalk.cyan(`project memory (${projectMemory})`)
  if (projectConfig) return chalk.yellow(`.claudex.json (${projectConfig})`)
  if (globalConfig) return chalk.white(`global config (${globalConfig})`)
  return chalk.gray('fallback default')
}

function firstPromptLine(prompt) {
  return prompt
    .split('\n')
    .map(line => line.trim())
    .find(line => line.startsWith('- '))
    ?.replace(/^- /, '') || 'No summary available'
}

function describeRole(roleId) {
  if (!roleId) return { valid: false, label: 'Not set' }
  const role = ROLES[roleId]
  return {
    valid: Boolean(role),
    label: role ? role.name : roleId,
  }
}

function describeModel(modelId) {
  if (!modelId) return { valid: false, label: 'Not set' }
  const model = MODELS.find(entry => entry.id === modelId)
  return {
    valid: Boolean(model),
    label: model ? `${model.label} (${model.id})` : modelId,
  }
}
