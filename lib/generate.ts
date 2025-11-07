import { promises as fs } from 'fs'
import { basename, extname, join } from 'path'
import { ensureDir, writeFile, copyDir, copyFile } from './fsutil'
import { withFrontMatter } from './format'

export type Target = 'codex' | 'claude' | 'gemini' | 'opencode'

async function readExistingFile(path: string): Promise<string | null> {
  try {
    return await fs.readFile(path, 'utf8')
  } catch {
    return null
  }
}

function mergeWithGlobal(globalMd: string | null, existingContent: string | null): string {
  if (!globalMd) return existingContent || ''
  if (!existingContent) return globalMd

  // Check if the existing content already contains the exact global instructions
  const normalizedGlobal = globalMd.trim()
  const normalizedExisting = existingContent.trim()

  // If the file starts with the exact global instructions, don't duplicate
  if (normalizedExisting.startsWith(normalizedGlobal)) {
    return existingContent
  }

  // If global instructions exist somewhere in the file (exact match), don't duplicate
  if (normalizedExisting.includes(normalizedGlobal)) {
    return existingContent
  }

  // Prepend global instructions with a separator
  return globalMd.trim() + '\n\n' + existingContent.trim() + '\n'
}

function mdFilesOf(dir: string): Promise<string[]> {
  return fs.readdir(dir).then((list) => list.filter((f) => f.endsWith('.md')).map((f) => join(dir, f))).catch(() => [])
}

async function readCommands(srcDir: string) {
  const dir = join(srcDir, 'commands')
  const files = await mdFilesOf(dir)
  const out: { slug: string; name: string; description?: string; body: string }[] = []
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

async function readAgents(srcDir: string) {
  const dir = join(srcDir, 'agents')
  const files = await mdFilesOf(dir)
  const out: { slug: string; name: string; system: string; description?: string; explicitName?: boolean }[] = []
  for (const f of files) {
    const raw = await fs.readFile(f, 'utf8')
    const slug = basename(f, extname(f))

    let system = raw
    let name = slug
    let description: string | undefined
    let explicitName = false

    // Handle YAML frontmatter
    if (raw.startsWith('---')) {
      const frontmatterEnd = raw.indexOf('---', 3)
      if (frontmatterEnd !== -1) {
        const frontmatterStr = raw.slice(3, frontmatterEnd).trim()
        system = raw.slice(frontmatterEnd + 3).replace(/^\s+/, '')

        const nameMatch = frontmatterStr.match(/^name:\s*(.+)$/m)
        if (nameMatch) {
          name = nameMatch[1].replace(/^["']|["']$/g, '')
          explicitName = true
        }
        const descMatch = frontmatterStr.match(/^description:\s*(.+)$/m)
        if (descMatch) description = descMatch[1].replace(/^["']|["']$/g, '')
      }
    } else {
      // Handle markdown title
      const titleMatch = raw.match(/^#\s+(.+)$/m)
      if (titleMatch) {
        name = titleMatch[1].trim()
        const titleIdx = raw.indexOf(titleMatch[0])
        system = raw.slice(titleIdx + titleMatch[0].length).replace(/^\s+/, '')
      }
    }

    out.push({ slug, name, system, description, explicitName })
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

async function emitCodex(root: string, commands: any[], globalMd: string | null) {
  const outDir = join(root, 'codex')
  const prompts = join(outDir, 'prompts')
  await ensureDir(prompts)
  for (const c of commands) {
    const fm: Record<string, unknown> = {}
    if (c.description) fm.description = c.description
    const content = withFrontMatter(fm, c.body)
    await writeFile(join(prompts, `${c.slug}.md`), content)
  }
  if (globalMd) {
    const agentsPath = join(outDir, 'AGENTS.md')
    const existing = await readExistingFile(agentsPath)
    const merged = mergeWithGlobal(globalMd, existing)
    await writeFile(agentsPath, merged)
  }
}

async function emitGemini(root: string, commands: any[], globalMd: string | null) {
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
  if (globalMd) {
    const geminiPath = join(outDir, 'GEMINI.md')
    const existing = await readExistingFile(geminiPath)
    const merged = mergeWithGlobal(globalMd, existing)
    await writeFile(geminiPath, merged)
  }
}

async function emitOpenCode(root: string, commands: any[], agents: any[], globalMd: string | null) {
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
  function randName(len = 8): string {
    const letters = 'abcdefghijklmnopqrstuvwxyz'
    let out = ''
    for (let i = 0; i < len; i++) out += letters[Math.floor(Math.random() * letters.length)]
    return out
  }

  for (const a of agents) {
    const fm: Record<string, unknown> = {}
    // name: explicit frontmatter stays; else random 8 letters
    fm.name = (a.explicitName ? a.name : randName(8))
    // description: prefer frontmatter, else title (a.name)
    const desc = (a.description ?? a.name) as string
    fm.description = desc.length > 100 ? desc.substring(0, 97) + '...' : desc

    fm.mode = 'primary'
    const content = withFrontMatter(fm, a.system)
    await writeFile(join(agentDir, `${a.slug}.md`), content)
  }
  if (globalMd) {
    const globalPath = join(outDir, 'global_instructions.md')
    const existing = await readExistingFile(globalPath)
    const merged = mergeWithGlobal(globalMd, existing)
    await writeFile(globalPath, merged)
    const cfg = { $schema: 'https://opencode.ai/config.json', instructions: ['./global_instructions.md'] }
    await writeFile(join(outDir, 'opencode.jsonc'), JSON.stringify(cfg, null, 2) + '\n')
  }
}

async function emitClaude(root: string, commands: any[], agents: any[], globalMd: string | null, sourceDir: string) {
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
    const agentFile = join(sourceDir, 'agents', `${a.slug}.md`)
    await copyFile(agentFile, join(agentDir, `${a.slug}.md`))
  }
  if (globalMd) {
    const claudePath = join(outDir, 'CLAUDE.md')
    const existing = await readExistingFile(claudePath)
    const merged = mergeWithGlobal(globalMd, existing)
    await writeFile(claudePath, merged)
  }
}

function defaultCodexConfig(): string {
  return [
    'model = "o3"',
    'approval_policy = "on-request"',
    '',
    '# Uncomment to use profiles',
    '# profile = "o3"',
    ''
  ].join('\n') + '\n'
}
function defaultGeminiSettings(): string { return JSON.stringify({ context: { fileName: ["GEMINI.md", "AGENTS.md", "CLAUDE.md"] } }, null, 2) + '\n' }
function defaultClaudeSettings(): string { return JSON.stringify({ includeCoAuthoredBy: false, alwaysThinkingEnabled: false }, null, 2) + '\n' }
function defaultOpenCodeConfig(): string { return JSON.stringify({ $schema: 'https://opencode.ai/config.json', instructions: ['./global_instructions.md'] }, null, 2) + '\n' }

async function emitConfigs(root: string, sourceRoot: string, target: Target) {
  const srcCfgBase = join(sourceRoot, 'config')
  if (target === 'codex') {
    const src = join(srcCfgBase, 'codex')
    const dest = join(root, 'codex')
    await copyDir(src, dest)
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
    try { await fs.stat(join(dest, 'opencode.jsonc')) } catch { await writeFile(join(dest, 'opencode.jsonc'), defaultOpenCodeConfig()) }
  }
}

export async function generateAll(targets: Target[], assistantsDir: string) {
  const sourceDir = join(assistantsDir, 'source')
  const [commands, agents, globalMd] = await Promise.all([
    readCommands(sourceDir), readAgents(sourceDir), readGlobal(sourceDir)
  ])
  for (const t of targets) {
    if (t === 'codex') await emitCodex(assistantsDir, commands, globalMd)
    else if (t === 'gemini') await emitGemini(assistantsDir, commands, globalMd)
    else if (t === 'opencode') await emitOpenCode(assistantsDir, commands, agents, globalMd)
    else if (t === 'claude') await emitClaude(assistantsDir, commands, agents, globalMd, sourceDir)
    await emitConfigs(assistantsDir, sourceDir, t)
  }
}
