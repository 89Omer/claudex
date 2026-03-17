import Conf from 'conf'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const store = new Conf({
  projectName: 'claudex',
  defaults: {
    theme: 'dark',
    defaultRole: 'dev',
    defaultModel: 'claude-sonnet-4-6',
    budgetAlert: 5.0,
    sessions: []
  }
})

// All selectable Claude models
export const MODELS = [
  { id: 'claude-opus-4-6',    label: 'Opus 4.6',    desc: 'Most capable — coding, agents, 1M context, best reasoning', tier: 'premium' },
  { id: 'claude-sonnet-4-6',  label: 'Sonnet 4.6',  desc: 'Recommended — near-Opus performance, fast, 1M context',     tier: 'balanced' },
  { id: 'claude-haiku-4-5',   label: 'Haiku 4.5',   desc: 'Fastest & cheapest — quick tasks, high volume',             tier: 'fast' },
]

// Pricing per 1M tokens (input / output)
export const PRICING = {
  'claude-opus-4-6':   { input: 5.00,  output: 25.00 },
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':  { input: 0.80,  output: 4.00  },
}

export function getConfig() {
  return store.store
}

export function setConfig(key, value) {
  store.set(key, value)
}

export function getProjectConfig() {
  const projectConfigPath = join(process.cwd(), '.claudex.json')
  if (existsSync(projectConfigPath)) {
    try { return JSON.parse(readFileSync(projectConfigPath, 'utf-8')) } catch {}
  }
  return {}
}

export function saveProjectConfig(config) {
  const projectConfigPath = join(process.cwd(), '.claudex.json')
  writeFileSync(projectConfigPath, JSON.stringify(config, null, 2))
}

export function resolveModel(input) {
  if (!input) return null
  const lower = input.toLowerCase().trim()
  // Shorthand aliases
  const aliases = {
    'opus':    'claude-opus-4-6',
    'sonnet':  'claude-sonnet-4-6',
    'haiku':   'claude-haiku-4-5',
  }
  if (aliases[lower]) return aliases[lower]
  // Full model id passed directly
  const found = MODELS.find(m => m.id === lower)
  return found ? found.id : null
}
