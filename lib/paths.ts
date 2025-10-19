import { promises as fs } from 'fs'
import { join, resolve } from 'path'

export function assistantRootDefault(fromCwd: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || ''
  return resolve(home, 'tools', 'assistants')
}

export function listAncestors(dir: string, maxDepth = 6): string[] {
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

export async function resolveAssistantsRoot(fromCwd: string): Promise<string> {
  const argv = process.argv.slice(2)
  const getArgValue = (names: string[]): string | undefined => {
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i]
      for (const n of names) {
        if (a.startsWith(n + '=')) return a.slice(n.length + 1)
        if (a === n && i + 1 < argv.length) return argv[i + 1]
      }
    }
    return undefined
  }

  const hint = getArgValue(['--root', '--assistants', '-r'])
  const envRoot = process.env.ASSISTANTS_ROOT || process.env.ASSISTANTS_DIR

  const tryDirs = new Set<string>()
  if (hint) tryDirs.add(resolve(fromCwd, hint))
  if (envRoot) tryDirs.add(resolve(fromCwd, envRoot))

  for (const anc of listAncestors(fromCwd, 6)) {
    tryDirs.add(anc)
    tryDirs.add(resolve(anc, 'assistants'))
  }

  tryDirs.add(assistantRootDefault(fromCwd))

  for (const d of tryDirs) {
    try {
      const st = await fs.stat(join(d, 'source'))
      if (st.isDirectory()) return d
    } catch {}
  }

  if (envRoot) return resolve(fromCwd, envRoot)
  return assistantRootDefault(fromCwd)
}

export function globalPaths() {
  const home = process.env.HOME || process.env.USERPROFILE || ''
  return {
    claude: { root: join(home, '.claude'), commands: join(home, '.claude', 'commands'), agents: join(home, '.claude', 'agents'), files: { CLAUDE: join(home, '.claude', 'CLAUDE.md'), settings: join(home, '.claude', 'settings.json') } },
    codex:  { root: join(home, '.codex'), prompts: join(home, '.codex', 'prompts'), files: { AGENTS: join(home, '.codex', 'AGENTS.md'), config: join(home, '.codex', 'config.toml') } },
    gemini: { root: join(home, '.gemini'), commands: join(home, '.gemini', 'commands'), files: { GEMINI: join(home, '.gemini', 'GEMINI.md'), settings: join(home, '.gemini', 'settings.json') } },
    opencode: { root: join(home, '.config', 'opencode'), commands: join(home, '.config', 'opencode', 'command'), agents: join(home, '.config', 'opencode', 'agent'), files: { confJsonc: join(home, '.config', 'opencode', 'opencode.jsonc'), confJsonrc: join(home, '.config', 'opencode', 'opencode.jsonrc'), global: join(home, '.config', 'opencode', 'global_instructions.md') } },
  }
}

