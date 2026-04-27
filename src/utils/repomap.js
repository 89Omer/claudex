import { execSync } from 'child_process'
import { existsSync, readFileSync, statSync } from 'fs'
import { join, extname, basename } from 'path'
import chalk from 'chalk'

const MAX_TREE_LINES = 80
const MAX_SIGNATURE_FILES = 30
const MAX_SIGS_PER_FILE = 20
const VISUAL_TREE_MAX = 45
const SIG_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.py', '.go', '.rs', '.java', '.rb', '.php'])
const COLLAPSE_THRESHOLD = 50

const DIRTY_LABELS = {
  'M':  'modified',
  'A':  'added',
  'D':  'deleted',
  'R':  'renamed',
  'C':  'copied',
  '?':  'untracked',
  '!':  'ignored',
  'U':  'conflict',
}

const LANG_COLORS = {
  '.js': 'yellow', '.mjs': 'yellow', '.cjs': 'yellow', '.jsx': 'yellow',
  '.ts': 'blueBright', '.tsx': 'blueBright',
  '.py': 'green', '.go': 'cyan', '.rs': 'redBright',
  '.java': 'red', '.rb': 'red', '.php': 'magenta',
  '.css': 'magenta', '.scss': 'magenta', '.less': 'magenta',
  '.html': 'redBright', '.vue': 'green', '.svelte': 'redBright',
  '.json': 'gray', '.yml': 'gray', '.yaml': 'gray', '.toml': 'gray',
  '.md': 'white', '.txt': 'white',
  '.sql': 'blue', '.graphql': 'magenta',
  '.sh': 'green', '.bash': 'green',
  '.dockerfile': 'cyan',
}

const DIRTY_COLORS = {
  'M': 'yellow', 'A': 'green', 'D': 'red', 'R': 'blue',
  'C': 'blue', '?': 'gray', '!': 'gray', 'U': 'redBright',
}

function fileColor(ext) { return LANG_COLORS[ext] || 'white' }

function exec(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 }).trim()
  } catch {
    return ''
  }
}

function estimateTokens(text) {
  if (!text) return 0
  return Math.ceil(text.length / 3.8)
}

// ─── .claudexignore ──────────────────────────────────────────────────────────

function loadIgnorePatterns(cwd) {
  const ignorePath = join(cwd, '.claudexignore')
  if (!existsSync(ignorePath)) return []
  try {
    return readFileSync(ignorePath, 'utf-8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
  } catch {
    return []
  }
}

function matchesIgnore(filePath, patterns) {
  for (const pattern of patterns) {
    if (pattern.endsWith('/')) {
      if (filePath.startsWith(pattern) || filePath.includes('/' + pattern)) return true
    } else if (pattern.startsWith('*.')) {
      if (filePath.endsWith(pattern.slice(1))) return true
    } else if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
      if (regex.test(filePath)) return true
    } else {
      if (filePath === pattern || filePath.startsWith(pattern + '/') || filePath.includes('/' + pattern)) return true
    }
  }
  return false
}

// ─── Git Helpers ─────────────────────────────────────────────────────────────

function getGitFiles(cwd) {
  const output = exec('git ls-files', cwd)
  if (!output) return []
  return output.split('\n').filter(Boolean)
}

function countNode(node) {
  if (node === null) return 1
  let count = 0
  for (const v of Object.values(node)) count += countNode(v)
  return count
}

function buildTreeStructure(files) {
  const tree = {}
  for (const file of files) {
    const parts = file.split('/')
    let node = tree
    for (let i = 0; i < parts.length; i++) {
      if (i === parts.length - 1) {
        node[parts[i]] = null
      } else {
        if (!node[parts[i]]) node[parts[i]] = {}
        node = node[parts[i]]
      }
    }
  }
  return tree
}

function buildCompactTree(files) {
  const tree = buildTreeStructure(files)
  const lines = []
  function render(node, prefix = '', depth = 0) {
    const entries = Object.entries(node)
    const dirs = entries.filter(([, v]) => v !== null).sort(([a], [b]) => a.localeCompare(b))
    const fileEntries = entries.filter(([, v]) => v === null).sort(([a], [b]) => a.localeCompare(b))

    for (const [name, subtree] of dirs) {
      const childCount = countNode(subtree)
      if (childCount > COLLAPSE_THRESHOLD && depth > 0) {
        lines.push(`${prefix}${name}/ (${childCount} files)`)
      } else {
        lines.push(`${prefix}${name}/`)
        render(subtree, prefix + '  ', depth + 1)
      }
    }
    for (const [name] of fileEntries) {
      lines.push(`${prefix}${name}`)
    }
  }

  render(tree)
  if (lines.length > MAX_TREE_LINES) {
    return lines.slice(0, MAX_TREE_LINES).join('\n') + `\n... and ${lines.length - MAX_TREE_LINES} more files`
  }
  return lines.join('\n')
}

// ─── Project Detection ───────────────────────────────────────────────────────

function getProjectMeta(cwd) {
  const pkgPath = join(cwd, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const meta = { type: 'node' }
      if (pkg.name) meta.name = pkg.name
      if (pkg.version) meta.version = pkg.version
      if (pkg.description) meta.description = pkg.description
      if (pkg.scripts) meta.scripts = Object.keys(pkg.scripts)
      if (pkg.dependencies) meta.deps = Object.keys(pkg.dependencies)
      if (pkg.devDependencies) meta.devDeps = Object.keys(pkg.devDependencies)
      if (pkg.main) meta.main = pkg.main
      if (pkg.type) meta.moduleType = pkg.type
      if (pkg.bin) {
        meta.bin = typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin)
      }
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
      const frameworks = []
      if (allDeps.next) frameworks.push('Next.js')
      if (allDeps.react && !allDeps.next) frameworks.push('React')
      if (allDeps.vue) frameworks.push('Vue')
      if (allDeps['@angular/core']) frameworks.push('Angular')
      if (allDeps.express) frameworks.push('Express')
      if (allDeps.fastify) frameworks.push('Fastify')
      if (allDeps.svelte || allDeps['@sveltejs/kit']) frameworks.push('Svelte')
      if (allDeps.electron) frameworks.push('Electron')
      if (allDeps.tailwindcss) frameworks.push('Tailwind')
      if (allDeps.prisma || allDeps['@prisma/client']) frameworks.push('Prisma')
      if (allDeps.drizzle || allDeps['drizzle-orm']) frameworks.push('Drizzle')
      if (frameworks.length > 0) meta.frameworks = frameworks
      return meta
    } catch { /* fall through */ }
  }

  if (existsSync(join(cwd, 'pyproject.toml'))) return { type: 'python' }
  if (existsSync(join(cwd, 'requirements.txt'))) return { type: 'python' }
  if (existsSync(join(cwd, 'go.mod'))) return { type: 'go' }
  if (existsSync(join(cwd, 'Cargo.toml'))) return { type: 'rust' }
  if (existsSync(join(cwd, 'pom.xml'))) return { type: 'java' }
  if (existsSync(join(cwd, 'build.gradle'))) return { type: 'java' }
  if (existsSync(join(cwd, 'Gemfile'))) return { type: 'ruby' }
  if (existsSync(join(cwd, 'composer.json'))) return { type: 'php' }

  return { type: 'unknown' }
}

// ─── Git Context ─────────────────────────────────────────────────────────────

function getGitContext(cwd) {
  const branch = exec('git branch --show-current', cwd)
  const log = exec('git log --oneline -8 --no-decorate', cwd)
  const status = exec('git status --short', cwd)
  const remote = exec('git remote get-url origin', cwd)
  const stashCount = exec('git stash list', cwd)

  return {
    branch: branch || null,
    recentCommits: log ? log.split('\n') : [],
    dirtyFiles: status ? status.split('\n').filter(Boolean) : [],
    remote: remote || null,
    stashCount: stashCount ? stashCount.split('\n').filter(Boolean).length : 0,
  }
}

function formatDirtyFile(line) {
  if (!line || line.length < 2) return null
  const match = line.match(/^(.{1,2})\s+(.+)$/)
  if (!match) return `  [changed] ${line.trim()}`
  const statusCode = match[1].trim()
  const file = match[2]
  const firstChar = statusCode[0]
  const label = DIRTY_LABELS[firstChar] || DIRTY_LABELS[statusCode[statusCode.length - 1]] || 'changed'
  return `  [${label}] ${file}`
}

function parseDirtyFile(line) {
  if (!line || line.length < 2) return null
  const match = line.match(/^(.{1,2})\s+(.+)$/)
  if (!match) return { status: '?', file: line.trim() }
  const statusCode = match[1].trim()
  const file = match[2]
  const firstChar = statusCode[0]
  return { status: firstChar, file }
}

// ─── Signatures ──────────────────────────────────────────────────────────────

function getRecentlyChangedFiles(cwd) {
  const output = exec('git log --oneline -5 --name-only --no-decorate', cwd)
  if (!output) return []
  const files = new Set()
  for (const line of output.split('\n')) {
    if (line && !line.match(/^[a-f0-9]+ /)) files.add(line.trim())
  }
  return [...files]
}

function identifyKeyFiles(cwd, allFiles, meta) {
  const ranked = new Map()
  const addFile = (f, weight) => ranked.set(f, (ranked.get(f) || 0) + weight)

  if (meta.main) addFile(meta.main, 10)
  if (meta.bin) meta.bin.forEach(b => addFile(b, 10))

  getRecentlyChangedFiles(cwd).forEach(f => addFile(f, 5))

  for (const f of allFiles) {
    const name = basename(f, extname(f))
    if (['index', 'main', 'app', 'server', 'cli', 'mod', 'lib', 'routes', 'api', 'schema', 'types', 'models'].includes(name)) addFile(f, 3)
  }

  for (const f of allFiles) {
    if (SIG_EXTENSIONS.has(extname(f))) addFile(f, 1)
  }

  return [...ranked.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f)
    .filter(f => SIG_EXTENSIONS.has(extname(f)))
    .slice(0, MAX_SIGNATURE_FILES)
}

function extractSignatures(cwd, files) {
  const results = []

  for (const file of files) {
    const fullPath = join(cwd, file)
    if (!existsSync(fullPath)) continue

    let content
    try {
      const stat = statSync(fullPath)
      if (stat.size > 100_000) continue
      content = readFileSync(fullPath, 'utf-8')
    } catch { continue }

    const ext = extname(file)
    const sigs = []

    for (const line of content.split('\n')) {
      const t = line.trim()
      if (sigs.length >= MAX_SIGS_PER_FILE) break

      if (['.js', '.ts', '.jsx', '.tsx', '.mjs'].includes(ext)) {
        let m
        if ((m = t.match(/^export\s+(default\s+)?(async\s+)?function\s+(\w+)/))) sigs.push(`fn ${m[3]}()`)
        else if ((m = t.match(/^export\s+(default\s+)?class\s+(\w+)/))) sigs.push(`class ${m[2]}`)
        else if ((m = t.match(/^export\s+(const|let|var)\s+(\w+)/))) sigs.push(m[2])
        else if ((m = t.match(/^export\s+(type|interface)\s+(\w+)/))) sigs.push(`type ${m[2]}`)
      } else if (ext === '.py') {
        let m
        if ((m = t.match(/^def\s+(\w+)\s*\(/))) sigs.push(`def ${m[1]}()`)
        else if ((m = t.match(/^class\s+(\w+)/))) sigs.push(`class ${m[1]}`)
      } else if (ext === '.go') {
        let m
        if ((m = t.match(/^func\s+(\w+)/))) sigs.push(`func ${m[1]}()`)
        else if ((m = t.match(/^type\s+(\w+)\s+(struct|interface)/))) sigs.push(`${m[2]} ${m[1]}`)
      } else if (ext === '.rs') {
        let m
        if ((m = t.match(/^pub\s+(async\s+)?fn\s+(\w+)/))) sigs.push(`fn ${m[2]}()`)
        else if ((m = t.match(/^pub\s+struct\s+(\w+)/))) sigs.push(`struct ${m[1]}`)
        else if ((m = t.match(/^pub\s+enum\s+(\w+)/))) sigs.push(`enum ${m[1]}`)
        else if ((m = t.match(/^pub\s+trait\s+(\w+)/))) sigs.push(`trait ${m[1]}`)
      } else if (ext === '.java') {
        let m
        if ((m = t.match(/^public\s+(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/))) sigs.push(`${m[1]}()`)
        else if ((m = t.match(/^public\s+(?:abstract\s+)?class\s+(\w+)/))) sigs.push(`class ${m[1]}`)
        else if ((m = t.match(/^public\s+interface\s+(\w+)/))) sigs.push(`interface ${m[1]}`)
      }
    }

    if (sigs.length > 0) results.push({ file, sigs })
  }

  return results
}

function detectConfigFiles(files) {
  const known = new Set([
    'package.json', 'tsconfig.json', 'tsconfig.build.json',
    'pyproject.toml', 'setup.py', 'requirements.txt',
    'Cargo.toml', 'go.mod', 'go.sum',
    'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
    '.env.example', '.env.local.example',
    'Makefile', 'justfile',
    '.eslintrc.js', '.eslintrc.json', 'eslint.config.js', 'eslint.config.mjs',
    '.prettierrc', '.prettierrc.json',
    'vitest.config.ts', 'jest.config.js', 'jest.config.ts',
    'vite.config.ts', 'vite.config.js',
    'next.config.js', 'next.config.mjs', 'next.config.ts',
    'tailwind.config.js', 'tailwind.config.ts',
    'webpack.config.js',
    '.github/workflows/ci.yml', '.github/workflows/ci.yaml',
    'vercel.json', 'railway.json', 'fly.toml',
    'prisma/schema.prisma',
  ])

  return files.filter(f => known.has(f))
}

// ─── Default Exclusions ──────────────────────────────────────────────────────

function filterSourceFiles(files, ignorePatterns) {
  return files.filter(f => {
    if (f.startsWith('node_modules/') ||
        f.startsWith('vendor/') ||
        f.startsWith('dist/') ||
        f.startsWith('build/') ||
        f.startsWith('.git/') ||
        f.includes('.min.') ||
        f.endsWith('.lock') ||
        f.endsWith('-lock.json') ||
        f.endsWith('.map')) {
      return false
    }
    if (ignorePatterns.length > 0 && matchesIgnore(f, ignorePatterns)) return false
    return true
  })
}

// ─── Gather All Data ─────────────────────────────────────────────────────────

function gatherRepoData(cwd) {
  const allFiles = getGitFiles(cwd)
  if (allFiles.length === 0) return null

  const ignorePatterns = loadIgnorePatterns(cwd)
  const sourceFiles = filterSourceFiles(allFiles, ignorePatterns)
  const meta = getProjectMeta(cwd)
  const git = getGitContext(cwd)
  const keyFiles = identifyKeyFiles(cwd, sourceFiles, meta)
  const signatures = extractSignatures(cwd, keyFiles)
  const configFiles = detectConfigFiles(allFiles)

  const sigMap = new Map()
  for (const { file, sigs } of signatures) sigMap.set(file, sigs)

  const langCounts = new Map()
  for (const f of sourceFiles) {
    const ext = extname(f)
    if (ext) langCounts.set(ext, (langCounts.get(ext) || 0) + 1)
  }

  return { allFiles, sourceFiles, meta, git, signatures, sigMap, configFiles, langCounts }
}

// ─── Plain Text Map (for CLAUDE.md injection) ────────────────────────────────

export function generateRepoMap(cwd) {
  const data = gatherRepoData(cwd)
  if (!data) return null

  const { sourceFiles, meta, git, signatures, configFiles } = data

  let map = `# Repo Map\n`
  map += `> Auto-generated by claudex. Navigate with this map — read files only when you need full implementation.\n\n`

  if (meta.name || meta.type !== 'unknown') {
    map += `## Project`
    if (meta.name) map += `: ${meta.name}`
    if (meta.version) map += ` v${meta.version}`
    map += '\n'
    if (meta.description) map += `${meta.description}\n`
    if (meta.type !== 'unknown') map += `Type: ${meta.type}`
    if (meta.moduleType) map += ` (${meta.moduleType})`
    if (meta.frameworks?.length) map += ` | Stack: ${meta.frameworks.join(', ')}`
    map += '\n\n'
  }

  if (git.branch) {
    map += `## Git\n`
    map += `Branch: \`${git.branch}\``
    if (git.remote) map += ` | Remote: ${git.remote}`
    map += '\n'
    if (git.stashCount > 0) map += `Stashes: ${git.stashCount}\n`
    if (git.dirtyFiles.length > 0) {
      map += `Uncommitted (${git.dirtyFiles.length}):\n`
      for (const f of git.dirtyFiles.slice(0, 10)) {
        const formatted = formatDirtyFile(f)
        if (formatted) map += `${formatted}\n`
      }
      if (git.dirtyFiles.length > 10) map += `  ... +${git.dirtyFiles.length - 10} more\n`
    }
    if (git.recentCommits.length > 0) {
      map += `Recent commits:\n`
      for (const c of git.recentCommits) map += `  ${c}\n`
    }
    map += '\n'
  }

  map += `## Files (${sourceFiles.length} tracked)\n`
  map += '```\n'
  map += buildCompactTree(sourceFiles)
  map += '\n```\n\n'

  if (configFiles.length > 0) map += `## Config\n${configFiles.join(', ')}\n\n`

  if (meta.deps?.length) {
    map += `## Dependencies\n`
    map += `Production: ${meta.deps.join(', ')}\n`
    if (meta.devDeps?.length) map += `Dev: ${meta.devDeps.join(', ')}\n`
    map += '\n'
  }

  if (meta.scripts?.length) map += `## Scripts\n${meta.scripts.join(', ')}\n\n`

  if (signatures.length > 0) {
    map += `## Key Exports & Functions\n`
    for (const { file, sigs } of signatures) map += `**${file}**: ${sigs.join(', ')}\n`
    map += '\n'
  }

  const tokens = estimateTokens(map)
  map += `---\n_Map: ~${tokens} tokens | ${sourceFiles.length} files | ${signatures.length} modules scanned_\n`

  return map
}

// ─── Visual Rendering (terminal output) ──────────────────────────────────────

function renderLanguageBar(langCounts, barWidth = 40) {
  const sorted = [...langCounts.entries()].sort((a, b) => b[1] - a[1])
  const total = sorted.reduce((sum, [, c]) => sum + c, 0)
  if (total === 0) return []

  const lines = []
  const barLine = sorted.map(([ext, count]) => {
    const width = Math.max(1, Math.round((count / total) * barWidth))
    const color = fileColor(ext)
    return chalk[color]('█'.repeat(width))
  }).join('')

  lines.push(`  ${barLine}`)
  lines.push('  ' + sorted.slice(0, 6).map(([ext, count]) => {
    const color = fileColor(ext)
    return `${chalk[color]('█')} ${chalk.white(ext)} ${chalk.gray(count)}`
  }).join('  '))

  return lines
}

function renderVisualTree(tree, sigMap, maxLines = VISUAL_TREE_MAX) {
  const lines = []

  function render(node, prefix, parentPath) {
    if (lines.length >= maxLines) return

    const entries = Object.entries(node)
    const dirs = entries.filter(([, v]) => v !== null).sort(([a], [b]) => a.localeCompare(b))
    const fileEntries = entries.filter(([, v]) => v === null).sort(([a], [b]) => a.localeCompare(b))
    const all = [...dirs, ...fileEntries]

    for (let i = 0; i < all.length; i++) {
      if (lines.length >= maxLines) {
        lines.push(`${prefix}${chalk.gray(`... +${all.length - i} more`)}`)
        return
      }

      const [name, value] = all[i]
      const isLast = i === all.length - 1
      const connector = isLast ? '└── ' : '├── '
      const childPrefix = prefix + (isLast ? '    ' : '│   ')
      const fullPath = parentPath ? `${parentPath}/${name}` : name

      if (value !== null) {
        const count = countNode(value)
        if (count > COLLAPSE_THRESHOLD) {
          lines.push(`${prefix}${connector}${chalk.cyan.bold(name)}/  ${chalk.gray(`(${count} files)`)}`)
        } else {
          lines.push(`${prefix}${connector}${chalk.cyan.bold(name)}/`)
          render(value, childPrefix, fullPath)
        }
      } else {
        const ext = extname(name)
        const color = fileColor(ext)
        const sigs = sigMap.get(fullPath)
        let sigStr = ''
        if (sigs && sigs.length > 0) {
          const short = sigs.slice(0, 3).map(s =>
            s.replace(/^fn /, '').replace(/^def /, '').replace(/^func /, '')
          )
          sigStr = chalk.gray('  ' + short.join(', '))
          if (sigs.length > 3) sigStr += chalk.gray('...')
        }
        lines.push(`${prefix}${connector}${chalk[color](name)}${sigStr}`)
      }
    }
  }

  render(tree, '  ', '')
  return lines
}

function renderDirtyFiles(dirtyFiles) {
  const lines = []
  for (const raw of dirtyFiles.slice(0, 8)) {
    const parsed = parseDirtyFile(raw)
    if (!parsed) continue
    const color = DIRTY_COLORS[parsed.status] || 'gray'
    const label = DIRTY_LABELS[parsed.status] || 'changed'
    lines.push(`  ${chalk[color].bold(label.padEnd(10))} ${chalk.white(parsed.file)}`)
  }
  if (dirtyFiles.length > 8) {
    lines.push(chalk.gray(`  ... +${dirtyFiles.length - 8} more`))
  }
  return lines
}

export function renderVisualMap(cwd) {
  const data = gatherRepoData(cwd)
  if (!data) {
    console.log(chalk.gray('  No git-tracked files found.\n'))
    return
  }

  const { sourceFiles, meta, git, signatures, sigMap, langCounts, configFiles } = data
  const tree = buildTreeStructure(sourceFiles)
  const plainMap = generateRepoMap(cwd)
  const tokens = estimateTokens(plainMap)
  const width = Math.min(process.stdout.columns || 80, 100)

  // ── Header ──
  console.log()
  console.log(chalk.cyan('  ╭' + '─'.repeat(width - 4) + '╮'))

  let title = chalk.cyan.bold('  │  🗺️  claudex map')
  if (meta.name) title += chalk.white(`  ${meta.name}`)
  if (meta.version) title += chalk.gray(` v${meta.version}`)
  console.log(title)

  let subtitle = '  │  '
  if (git.branch) subtitle += chalk.green(git.branch)
  if (meta.type !== 'unknown') subtitle += chalk.gray('  ·  ') + chalk.white(meta.type)
  if (meta.moduleType) subtitle += chalk.gray(` (${meta.moduleType})`)
  if (meta.frameworks?.length) subtitle += chalk.gray('  ·  ') + chalk.yellow(meta.frameworks.join(', '))
  subtitle += chalk.gray('  ·  ') + chalk.white(`${sourceFiles.length} files`)
  subtitle += chalk.gray('  ·  ') + chalk.gray(`~${tokens} tokens`)
  console.log(subtitle)

  if (meta.deps?.length) {
    console.log(`  │  ${chalk.gray('Deps: ')}${chalk.white(meta.deps.join(', '))}`)
  }
  if (meta.scripts?.length) {
    console.log(`  │  ${chalk.gray('Scripts: ')}${chalk.white(meta.scripts.join(', '))}`)
  }
  if (configFiles.length > 0) {
    console.log(`  │  ${chalk.gray('Config: ')}${chalk.white(configFiles.join(', '))}`)
  }

  console.log(chalk.cyan('  ├' + '─'.repeat(width - 4) + '┤'))

  // ── Language Bar ��─
  console.log(`  │`)
  console.log(`  │  ${chalk.white.bold('Languages')}`)
  const langLines = renderLanguageBar(langCounts, Math.max(width - 12, 30))
  for (const l of langLines) console.log(`  │${l}`)
  console.log(`  │`)

  console.log(chalk.cyan('  ├' + '─'.repeat(width - 4) + '┤'))

  // ── File Tree ──
  console.log(`  │`)
  console.log(`  │  ${chalk.white.bold('File Tree')}`)
  const treeLines = renderVisualTree(tree, sigMap)
  for (const l of treeLines) console.log(`  │${l}`)
  console.log(`  │`)

  // ── Signatures Summary ──
  if (signatures.length > 0) {
    console.log(chalk.cyan('  ├' + '─'.repeat(width - 4) + '┤'))
    console.log(`  │`)
    console.log(`  │  ${chalk.white.bold('Exports')}  ${chalk.gray(`${signatures.length} modules scanned`)}`)
    for (const { file, sigs } of signatures.slice(0, 10)) {
      const short = sigs.slice(0, 4).map(s =>
        s.replace(/^fn /, '').replace(/^def /, '').replace(/^func /, '')
      )
      let line = `  │  ${chalk.cyan(file.padEnd(28))} ${chalk.gray(short.join(', '))}`
      if (sigs.length > 4) line += chalk.gray(` +${sigs.length - 4} more`)
      console.log(line)
    }
    if (signatures.length > 10) {
      console.log(`  │  ${chalk.gray(`... +${signatures.length - 10} more modules`)}`)
    }
    console.log(`  │`)
  }

  // ── Git ──
  if (git.branch) {
    console.log(chalk.cyan('  ├' + '─'.repeat(width - 4) + '┤'))
    console.log(`  │`)

    if (git.dirtyFiles.length > 0) {
      console.log(`  │  ${chalk.white.bold('Uncommitted')}  ${chalk.yellow(`${git.dirtyFiles.length} files`)}`)
      const dirtyLines = renderDirtyFiles(git.dirtyFiles)
      for (const l of dirtyLines) console.log(`  │${l}`)
      console.log(`  │`)
    }

    if (git.recentCommits.length > 0) {
      console.log(`  │  ${chalk.white.bold('Recent Commits')}`)
      for (const c of git.recentCommits.slice(0, 5)) {
        const hash = c.slice(0, 7)
        const msg = c.slice(8).trim()
        console.log(`  │  ${chalk.yellow(hash)}  ${chalk.white(msg.slice(0, width - 18))}`)
      }
      if (git.recentCommits.length > 5) {
        console.log(`  │  ${chalk.gray(`... +${git.recentCommits.length - 5} more`)}`)
      }
    }

    if (git.remote) {
      console.log(`  │`)
      console.log(`  │  ${chalk.gray('Remote: ')}${chalk.white(git.remote)}`)
    }
    console.log(`  │`)
  }

  // ── Footer ──
  console.log(chalk.cyan('  ├' + '─'.repeat(width - 4) + '┤'))
  console.log(`  │  ${chalk.gray(`~${tokens} tokens injected into CLAUDE.md on launch`)}`)
  console.log(chalk.cyan('  ╰' + '─'.repeat(width - 4) + '╯'))
  console.log()
}

// ── Compact language bar for pre-launch display ──

export function renderCompactLangBar(cwd) {
  const allFiles = getGitFiles(cwd)
  if (allFiles.length === 0) return null

  const ignorePatterns = loadIgnorePatterns(cwd)
  const sourceFiles = filterSourceFiles(allFiles, ignorePatterns)
  const langCounts = new Map()
  for (const f of sourceFiles) {
    const ext = extname(f)
    if (ext) langCounts.set(ext, (langCounts.get(ext) || 0) + 1)
  }

  const sorted = [...langCounts.entries()].sort((a, b) => b[1] - a[1])
  const total = sorted.reduce((sum, [, c]) => sum + c, 0)
  if (total === 0) return null

  const barWidth = 24
  let bar = sorted.slice(0, 5).map(([ext, count]) => {
    const w = Math.max(1, Math.round((count / total) * barWidth))
    return chalk[fileColor(ext)]('█'.repeat(w))
  }).join('')

  const legend = sorted.slice(0, 4).map(([ext, count]) => {
    return chalk[fileColor(ext)]('█') + chalk.gray(` ${ext} ${count}`)
  }).join('  ')

  return `${bar}  ${legend}`
}

// ─── Stats (for pre-launch one-liner) ────────────────────────────────────────

export function getRepoMapStats(cwd) {
  const allFiles = getGitFiles(cwd)
  if (allFiles.length === 0) return null

  const ignorePatterns = loadIgnorePatterns(cwd)
  const sourceFiles = filterSourceFiles(allFiles, ignorePatterns)
  const meta = getProjectMeta(cwd)
  const git = getGitContext(cwd)
  const languages = new Map()
  for (const f of sourceFiles) {
    const ext = extname(f)
    if (ext) languages.set(ext, (languages.get(ext) || 0) + 1)
  }

  const topLangs = [...languages.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([ext, count]) => `${ext}(${count})`)

  return {
    totalFiles: sourceFiles.length,
    branch: git.branch,
    dirty: git.dirtyFiles.length,
    framework: meta.frameworks?.join(', ') || meta.type || 'unknown',
    languages: topLangs.join(' '),
  }
}

// ─── Legacy plain print (kept for compatibility) ─────────────────────────────

export function printRepoMap(cwd) {
  renderVisualMap(cwd)
}
