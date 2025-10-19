// Assistants Sync (Bun + TypeScript, no deps)
// Source of truth: assistants/source/{agents,commands,global_instructions.md}
// Outputs per assistant under assistants/{claude,codex,gemini,opencode}

import { promises as fs } from 'fs'
import { basename, dirname, extname, join, resolve } from 'path'

type Target = 'codex' | 'claude' | 'gemini' | 'opencode'

type Command = { slug: string; name: string; description?: string; body: string }
type Agent = { slug: string; name: string; system: string }

function assistantRootDefault(_fromCwd: string): string {
  // Hard default: $HOME/tools/assistants
  const home = process.env.HOME || process.env.USERPROFILE || ''
  return resolve(home, 'tools', 'assistants')
}

function getArgValue(names: string[]): string | undefined {
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    for (const n of names) {
      if (a.startsWith(n + '=')) return a.slice(n.length + 1)
      if (a === n && i + 1 < argv.length) return argv[i + 1]
    }
  }
  return undefined
}

function listAncestors(dir: string, maxDepth = 6): string[] {
  const out: string[] = []
  let cur = dir
  for (let i = 0; i < maxDepth; i++) {
    out.push(cur)
    const parent = resolve(cur, '..')
    if (parent === cur) break
    cur = parent
  }
  return out
}

async function resolveAssistantsRoot(fromCwd: string): Promise<string> {
  const hint = getArgValue(['--root', '--assistants', '-r'])
  const envRoot = process.env.ASSISTANTS_ROOT || process.env.ASSISTANTS_DIR

  const tryDirs = new Set<string>()
  if (hint) tryDirs.add(resolve(fromCwd, hint))
  if (envRoot) tryDirs.add(resolve(fromCwd, envRoot))

  // Current directory and ancestors
  for (const anc of listAncestors(fromCwd, 6)) {
    tryDirs.add(anc)
    tryDirs.add(resolve(anc, 'assistants'))
  }

  // Conventional default when running from sources/assistants-sync
  tryDirs.add(assistantRootDefault(fromCwd))

  for (const d of tryDirs) {
    try {
      const st = await fs.stat(join(d, 'source'))
      if (st.isDirectory()) return d
    } catch {}
  }

  // Fallback: prefer envRoot if provided, else last conventional default
  if (envRoot) return resolve(fromCwd, envRoot)
  return assistantRootDefault(fromCwd)
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true })
}

async function writeFile(path: string, content: string | Uint8Array) {
  await ensureDir(dirname(path))
  await fs.writeFile(path, content)
}

function toYAML(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj)
  if (keys.length === 0) return ''
  const serialize = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(serialize).join(', ')}]`
    if (v === null || v === undefined) return 'null'
    if (typeof v === 'object') {
      return '\n' + Object.entries(v as Record<string, unknown>).map(([k, vv]) => `  ${k}: ${serialize(vv)}`).join('\n')
    }
    if (typeof v === 'string') {
      const needsQuote = v === '' || /[:\-?{}\[\],&*#\s]|^\d/.test(v)
      return needsQuote ? JSON.stringify(v) : v
    }
    return String(v)
  }
  return keys.map((k) => `${k}: ${serialize((obj as any)[k])}`).join('\n')
}

function withFrontMatter(fm: Record<string, unknown>, body: string): string {
  const y = toYAML(fm)
  return y ? `---\n${y}\n---\n${body}` : body
}

function mdFilesOf(dir: string): Promise<string[]> {
  return fs.readdir(dir).then((list) => list.filter((f) => f.endsWith('.md')).map((f) => join(dir, f))).catch(() => [])
}

async function readCommands(srcDir: string): Promise<Command[]> {
  const dir = join(srcDir, 'commands')
  const files = await mdFilesOf(dir)
  const out: Command[] = []
  for (const f of files) {
    const raw = await fs.readFile(f, 'utf8')
    const slug = basename(f, extname(f))
    const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? slug
    const bodyStartIdx = raw.match(/^#\s+(.+)$/m) ? (raw.indexOf(raw.match(/^#\s+(.+)$/m)![0]) + raw.match(/^#\s+(.+)$/m)![0].length) : 0
    const body = raw.slice(bodyStartIdx).replace(/^\s+/, '')
    const desc = body.split(/\r?\n/).map((s) => s.trim()).find((l) => l && !l.startsWith('#') && !l.startsWith('```'))
    out.push({ slug, name: title, description: desc, body })
  }
  return out
}

async function readAgents(srcDir: string): Promise<Agent[]> {
  const dir = join(srcDir, 'agents')
  const files = await mdFilesOf(dir)
  const out: Agent[] = []
  for (const f of files) {
    const raw = await fs.readFile(f, 'utf8')
    const slug = basename(f, extname(f))
    const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? slug
    const bodyStartIdx = raw.match(/^#\s+(.+)$/m) ? (raw.indexOf(raw.match(/^#\s+(.+)$/m)![0]) + raw.match(/^#\s+(.+)$/m)![0].length) : 0
    const system = raw.slice(bodyStartIdx).replace(/^\s+/, '')
    out.push({ slug, name: title, system })
  }
  return out
}

async function readGlobal(srcDir: string): Promise<string | null> {
  const p = join(srcDir, 'global_instructions.md')
  try { return await fs.readFile(p, 'utf8') } catch { return null }
}

function mapPlaceholdersForGemini(body: string): string {
  return body.replace(/\$ARGUMENTS/g, '{{args}}')
}

async function emitCodex(root: string, commands: Command[], globalMd: string | null) {
  const outDir = join(root, 'codex')
  const prompts = join(outDir, 'prompts')
  await ensureDir(prompts)
  for (const c of commands) {
    const fm: Record<string, unknown> = {}
    if (c.description) fm.description = c.description
    const content = withFrontMatter(fm, c.body)
    await writeFile(join(prompts, `${c.slug}.md`), content)
  }
  if (globalMd) await writeFile(join(outDir, 'AGENTS.md'), globalMd)
}

async function emitGemini(root: string, commands: Command[], globalMd: string | null) {
  const outDir = join(root, 'gemini')
  const cmdDir = join(outDir, 'commands')
  await ensureDir(cmdDir)
  for (const c of commands) {
    const lines: string[] = []
    const desc = (c.description || '').replace(/\$ARGUMENTS/g, '').trim()
    if (desc) lines.push(`description = ${JSON.stringify(desc)}`)
    lines.push('prompt = """')
    lines.push(mapPlaceholdersForGemini(c.body))
    lines.push('"""')
    await writeFile(join(cmdDir, `${c.slug}.toml`), lines.join('\n') + '\n')
  }
  if (globalMd) await writeFile(join(outDir, 'GEMINI.md'), globalMd)
}

async function emitOpenCode(root: string, commands: Command[], agents: Agent[], globalMd: string | null) {
  const outDir = join(root, 'opencode')
  const cmdDir = join(outDir, 'commands')
  const agentDir = join(outDir, 'agent')
  await ensureDir(cmdDir)
  await ensureDir(agentDir)
  for (const c of commands) {
    const body = c.body.includes('$ARGUMENTS') ? c.body : `${c.body}\n\n$ARGUMENTS\n`
    const rawDesc = (c.description ?? c.name) || ''
    const cleanDesc = rawDesc.replace(/\$ARGUMENTS/g, '').trim() || c.name
    const fm = { description: cleanDesc }
    await writeFile(join(cmdDir, `${c.slug}.md`), withFrontMatter(fm, body))
  }
  for (const a of agents) {
    const content = `# ${a.name}\n\n${a.system}`
    await writeFile(join(agentDir, `${a.slug}.md`), content)
  }
  if (globalMd) {
    await writeFile(join(outDir, 'global_instructions.md'), globalMd)
    const cfg = {
      $schema: 'https://opencode.ai/config.json',
      instructions: ['./global_instructions.md'],
    }
    const cfgStr = JSON.stringify(cfg, null, 2) + '\n'
    await writeFile(join(outDir, 'opencode.jsonc'), cfgStr)
    await writeFile(join(outDir, 'opencode.jsonrc'), cfgStr)
  }
}

async function emitClaude(root: string, commands: Command[], agents: Agent[], globalMd: string | null) {
  const outDir = join(root, 'claude')
  const cmdDir = join(outDir, 'commands')
  const agentDir = join(outDir, 'agents')
  await ensureDir(cmdDir)
  await ensureDir(agentDir)
  for (const c of commands) {
    const content = `# ${c.name}\n\n${c.body}`
    await writeFile(join(cmdDir, `${c.slug}.md`), content)
  }
  for (const a of agents) {
    const content = `# ${a.name}\n\n${a.system}`
    await writeFile(join(agentDir, `${a.slug}.md`), content)
  }
  if (globalMd) await writeFile(join(outDir, 'CLAUDE.md'), globalMd)
}

async function copyDir(srcDir: string, destDir: string) {
  try {
    const entries = await fs.readdir(srcDir, { withFileTypes: true } as any)
    await ensureDir(destDir)
    for (const e of entries as any[]) {
      const src = join(srcDir, e.name)
      const dst = join(destDir, e.name)
      if (e.isDirectory()) await copyDir(src, dst)
      else if (e.isFile()) {
        const data = await fs.readFile(src)
        await writeFile(dst, data)
      }
    }
  } catch {}
}

function defaultCodexConfig(): string {
  return [
    'model = "o3"',
    'approval_policy = "on-request"',
    '',
    '# Uncomment to use profiles',
    '# profile = "o3"',
    '',
    '[model_providers.openai]',
    'name = "OpenAI"',
    'base_url = "https://api.openai.com/v1"',
    'env_key = "OPENAI_API_KEY"',
    '# request_max_retries = 4',
    '# stream_max_retries = 5',
    '# stream_idle_timeout_ms = 300000',
    ''
  ].join('\n') + '\n'
}

function defaultGeminiSettings(): string {
  const obj = {
    context: { fileName: ["GEMINI.md", "AGENTS.md", "CLAUDE.md"] },
  } as Record<string, unknown>
  return JSON.stringify(obj, null, 2) + '\n'
}

function defaultClaudeSettings(): string {
  const obj = { includeCoAuthoredBy: false, alwaysThinkingEnabled: false }
  return JSON.stringify(obj, null, 2) + '\n'
}

function defaultOpenCodeConfig(): string {
  const obj = {
    $schema: 'https://opencode.ai/config.json',
    instructions: ['./global_instructions.md'],
    // provider, tools, rules can be added under source/config/opencode/
  } as Record<string, unknown>
  return JSON.stringify(obj, null, 2) + '\n'
}

async function emitConfigs(root: string, sourceRoot: string, target: Target) {
  const srcCfgBase = join(sourceRoot, 'config')
  if (target === 'codex') {
    const src = join(srcCfgBase, 'codex')
    const dest = join(root, 'codex')
    await copyDir(src, dest)
    // ensure config exists
    try { await fs.stat(join(dest, 'config.toml')) } catch { await writeFile(join(dest, 'config.toml'), defaultCodexConfig()) }
  } else if (target === 'gemini') {
    const src = join(srcCfgBase, 'gemini')
    const dest = join(root, 'gemini')
    await copyDir(src, dest)
    try { await fs.stat(join(dest, 'settings.json')) } catch { await writeFile(join(dest, 'settings.json'), defaultGeminiSettings()) }
  } else if (target === 'claude') {
    const src = join(srcCfgBase, 'claude')
    const dest = join(root, 'claude')
    await copyDir(src, dest)
    try { await fs.stat(join(dest, 'settings.json')) } catch { await writeFile(join(dest, 'settings.json'), defaultClaudeSettings()) }
  } else if (target === 'opencode') {
    const src = join(srcCfgBase, 'opencode')
    const dest = join(root, 'opencode')
    await copyDir(src, dest)
    // ensure opencode config present
    try {
      await fs.stat(join(dest, 'opencode.jsonc'))
    } catch {
      await writeFile(join(dest, 'opencode.jsonc'), defaultOpenCodeConfig())
    }
  }
}

export async function generateAll(targets: Target[], assistantsDir: string) {
  const sourceDir = join(assistantsDir, 'source')
  const [commands, agents, globalMd] = await Promise.all([
    readCommands(sourceDir),
    readAgents(sourceDir),
    readGlobal(sourceDir),
  ])
  for (const t of targets) {
    if (t === 'codex') await emitCodex(assistantsDir, commands, globalMd)
    else if (t === 'gemini') await emitGemini(assistantsDir, commands, globalMd)
    else if (t === 'opencode') await emitOpenCode(assistantsDir, commands, agents, globalMd)
    else if (t === 'claude') await emitClaude(assistantsDir, commands, agents, globalMd)
    await emitConfigs(assistantsDir, sourceDir, t)
  }
}

async function main() {
  const [, , cmd, targetArg] = process.argv
  if (cmd !== 'gen') {
    console.log('Usage: assistants-sync gen <codex|claude|gemini|opencode|all> [--root <assistants-dir>]')
    process.exit(1)
  }
  const targets: Target[] = ['codex', 'claude', 'gemini', 'opencode']
  const modeAll = targetArg === 'all'
  const selected = modeAll ? targets : (targets.includes(targetArg as Target) ? [targetArg as Target] : [])
  if (selected.length === 0) {
    console.error('Invalid target')
    process.exit(1)
  }
  const cwd = process.cwd()
  const assistantsDir = await resolveAssistantsRoot(cwd)
  const sourceDir = join(assistantsDir, 'source')

  const [commands, agents, globalMd] = await Promise.all([
    readCommands(sourceDir),
    readAgents(sourceDir),
    readGlobal(sourceDir),
  ])

  for (const t of selected) {
    if (t === 'codex') await emitCodex(assistantsDir, commands, globalMd)
    else if (t === 'gemini') await emitGemini(assistantsDir, commands, globalMd)
    else if (t === 'opencode') await emitOpenCode(assistantsDir, commands, agents, globalMd)
    else if (t === 'claude') await emitClaude(assistantsDir, commands, agents, globalMd)
    await emitConfigs(assistantsDir, sourceDir, t)
  }
  console.log(`Generated for: ${selected.join(', ')}`)
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
