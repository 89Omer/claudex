import readline from 'readline'
import chalk from 'chalk'
import { setConfig, saveProjectConfig, MODELS } from './config.js'
import { ROLES } from '../roles/index.js'

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve))
}

export async function runInit() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  console.log(chalk.cyan.bold('\n  claudex init\n'))
  console.log(chalk.gray('  Setting up your claudex configuration...\n'))
  console.log(chalk.gray('  These are your defaults. Project memory and CLAUDE.md can still override them later.\n'))
  console.log(chalk.gray('  ' + '─'.repeat(60) + '\n'))

  // ── Default role ──────────────────────────────────────────────
  console.log(chalk.white('  1. Default role\n'))
  Object.values(ROLES).forEach((r, i) => {
    console.log(`    ${chalk.bold(i + 1 + '.')}  ${r.emoji}  ${chalk[r.colorName].bold(r.id.padEnd(10))} ${chalk.gray(r.name)}`)
  })
  const roleAnswer = await ask(rl, chalk.white('\n  Enter number or name (dev/design/pm) [1]: '))
  const roleKeys = Object.keys(ROLES)
  const roleIdx = parseInt(roleAnswer.trim()) - 1
  let defaultRole = 'dev'
  if (!isNaN(roleIdx) && roleKeys[roleIdx]) {
    defaultRole = roleKeys[roleIdx]
  } else if (roleKeys.includes(roleAnswer.trim())) {
    defaultRole = roleAnswer.trim()
  }

  // ── Model ─────────────────────────────────────────────────────
  console.log(chalk.white('\n  2. Default model\n'))
  MODELS.forEach((m, i) => {
    const tierColor = m.tier === 'premium' ? 'magenta' : m.tier === 'balanced' ? 'cyan' : 'green'
    console.log(
      `    ${chalk.bold(i + 1 + '.')}  ${chalk[tierColor].bold(m.label.padEnd(14))}  ${chalk.gray(m.desc)}`
    )
  })
  const modelAnswer = await ask(rl, chalk.white('\n  Enter number or name (opus/sonnet/haiku) [2]: '))
  let defaultModel = 'claude-sonnet-4-6'
  const modelIdx = parseInt(modelAnswer.trim()) - 1
  if (!isNaN(modelIdx) && MODELS[modelIdx]) {
    defaultModel = MODELS[modelIdx].id
  } else {
    const aliases = { opus: 'claude-opus-4-6', sonnet: 'claude-sonnet-4-6', haiku: 'claude-haiku-4-5' }
    if (aliases[modelAnswer.trim()]) defaultModel = aliases[modelAnswer.trim()]
  }

  // ── Budget alert ──────────────────────────────────────────────
  console.log(chalk.white('\n  3. Budget alert\n'))
  const budgetAnswer = await ask(rl, chalk.white('  Warn when session cost exceeds (USD) [5.00]: '))
  const budgetAlert = parseFloat(budgetAnswer) || 5.00

  // ── Project config ────────────────────────────────────────────
  console.log(chalk.white('\n  4. Project config\n'))
  const projectAnswer = await ask(rl, chalk.white('  Create .claudex.json in current directory? (y/n) [y]: '))

  // ── Save ──────────────────────────────────────────────────────
  setConfig('defaultRole', defaultRole)
  setConfig('defaultModel', defaultModel)
  setConfig('budgetAlert', budgetAlert)

  if (projectAnswer.trim().toLowerCase() !== 'n') {
    saveProjectConfig({ defaultRole, defaultModel })
    console.log(chalk.gray('\n  ✓ Created .claudex.json'))
  }

  rl.close()

  const role = ROLES[defaultRole]
  const model = MODELS.find(m => m.id === defaultModel)
  console.log(chalk.green.bold('\n  ✓ claudex configured!\n'))
  console.log(chalk.gray(`  Role:    ${role.emoji} ${role.name}`))
  console.log(chalk.gray(`  Model:   ${model.label} (${model.id})`))
  console.log(chalk.gray(`  Budget:  $${budgetAlert}/session alert`))
  console.log(chalk.gray('\n  Useful next steps:'))
  console.log(chalk.gray('    claudex           Launch with your defaults'))
  console.log(chalk.gray('    claudex context   Inspect the active role/model and where they come from'))
  console.log(chalk.gray('    claudex doctor    Validate setup and Claude Code detection'))
  console.log(chalk.cyan('\n  Run claudex to start\n'))
}
