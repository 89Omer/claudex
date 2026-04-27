import { execSync } from 'child_process'
import { existsSync, readFileSync, statSync } from 'fs'
import { join, extname, basename } from 'path'

const MAX_TREE_LINES = 80
const MAX_SIGNATURE_FILES = 30
const MAX_SIGS_PER_FILE = 20
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

function buildCompactTree(files) {
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

// ─── Main ────────────────────────────────────────────────────────────────────

export function generateRepoMap(cwd) {
  const allFiles = getGitFiles(cwd)
  if (allFiles.length === 0) return null

  const ignorePatterns = loadIgnorePatterns(cwd)
  const sourceFiles = filterSourceFiles(allFiles, ignorePatterns)
  const meta = getProjectMeta(cwd)
  const git = getGitContext(cwd)
  const keyFiles = identifyKeyFiles(cwd, sourceFiles, meta)
  const signatures = extractSignatures(cwd, keyFiles)
  const configFiles = detectConfigFiles(allFiles)

  let map = `# Repo Map\n`
  map += `> Auto-generated by claudex. Navigate with this map — read files only when you need full implementation.\n\n`

  // Project identity
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

  // Git context
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

  // File tree
  map += `## Files (${sourceFiles.length} tracked)\n`
  map += '```\n'
  map += buildCompactTree(sourceFiles)
  map += '\n```\n\n'

  // Config files
  if (configFiles.length > 0) {
    map += `## Config\n${configFiles.join(', ')}\n\n`
  }

  // Dependencies
  if (meta.deps?.length) {
    map += `## Dependencies\n`
    map += `Production: ${meta.deps.join(', ')}\n`
    if (meta.devDeps?.length) map += `Dev: ${meta.devDeps.join(', ')}\n`
    map += '\n'
  }

  // Scripts
  if (meta.scripts?.length) {
    map += `## Scripts\n${meta.scripts.join(', ')}\n\n`
  }

  // Code signatures
  if (signatures.length > 0) {
    map += `## Key Exports & Functions\n`
    for (const { file, sigs } of signatures) {
      map += `**${file}**: ${sigs.join(', ')}\n`
    }
    map += '\n'
  }

  // Token estimate footer
  const tokens = estimateTokens(map)
  map += `---\n_Map: ~${tokens} tokens | ${sourceFiles.length} files | ${signatures.length} modules scanned_\n`

  return map
}

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

export function printRepoMap(cwd) {
  const map = generateRepoMap(cwd)
  if (!map) {
    console.log('  No git-tracked files found.\n')
    return
  }
  console.log(map)
  console.log(`  Token estimate: ~${estimateTokens(map)} tokens\n`)
}
