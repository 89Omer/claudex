import { ROLES } from '../roles/index.js'

export function parseCommand(input) {
  const trimmed = input.trim()

  // Role switching
  if (trimmed === '/dev' || trimmed === '/developer') return { type: 'role', role: 'dev' }
  if (trimmed === '/design' || trimmed === '/designer') return { type: 'role', role: 'design' }
  if (trimmed === '/pm') return { type: 'role', role: 'pm' }

  // Template usage: /use <name>
  if (trimmed.startsWith('/use ')) {
    const templateName = trimmed.slice(5).trim()
    return { type: 'template', name: templateName }
  }

  // List templates
  if (trimmed === '/templates' || trimmed === '/t') return { type: 'list-templates' }

  // Model switching
  if (trimmed.startsWith('/model ')) {
    const model = trimmed.slice(7).trim()
    return { type: 'model', model }
  }

  // Help
  if (trimmed === '/help' || trimmed === '/h') return { type: 'help' }

  // Quit
  if (trimmed === '/quit' || trimmed === '/exit' || trimmed === '/q') return { type: 'quit' }

  // Status
  if (trimmed === '/status') return { type: 'status' }

  // Not a claudex command — pass through to claude
  return { type: 'passthrough', input: trimmed }
}

export function resolveTemplate(templateName, role) {
  const templates = ROLES[role.id]?.templates || {}

  // Exact match
  if (templates[templateName]) return templates[templateName]

  // Fuzzy match
  const keys = Object.keys(templates)
  const match = keys.find(k => k.startsWith(templateName))
  if (match) return templates[match]

  return null
}

export function getHelpText(role) {
  const templates = ROLES[role.id]?.templates || {}
  const templateList = Object.keys(templates).map(k => `  /use ${k}`).join('\n')

  return `
claudex commands:
  /dev, /developer     Switch to Developer role
  /design, /designer   Switch to Designer role  
  /pm                  Switch to Product Manager role

  /use <template>      Use a prompt template for current role
  /templates           List all templates for current role
  /model <name>        Switch model (sonnet, opus, haiku)
  /status              Show session stats
  /help                Show this help
  /quit                Exit claudex

Templates for ${role.emoji} ${role.name}:
${templateList}
`
}
