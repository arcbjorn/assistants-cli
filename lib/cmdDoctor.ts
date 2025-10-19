import { resolve } from 'path'
import { resolveAssistantsRoot, globalPaths } from './paths'
import { exists } from './fsutil'

export type Target = 'codex' | 'claude' | 'gemini' | 'opencode'

export async function runDoctor(rootArg?: string) {
  const cwd = process.cwd()
  const root = rootArg ? resolve(cwd, rootArg) : await resolveAssistantsRoot(cwd)
  const gp = globalPaths()
  const which = (cmd: string) => (Bun.which ? Bun.which(cmd) : null)
  const report: string[] = []
  const ok = (s: string) => report.push(`✓ ${s}`)
  const warn = (s: string) => report.push(`! ${s}`)

  for (const c of ['claude','codex','gemini','opencode','ast-grep']) {
    which(c) ? ok(`${c} on PATH`) : warn(`${c} missing on PATH`)
  }
  for (const t of ['claude','codex','gemini','opencode'] as Target[]) {
    (await exists(`${root}/${t}`)) ? ok(`generated: ${t}/`) : warn(`missing generated: ${t}/ (run gen)`)
  }
  ;(await exists(gp.claude.root)) ? ok(`claude global dir ok`) : warn(`claude global dir missing`)
  ;(await exists(gp.codex.root)) ? ok(`codex global dir ok`) : warn(`codex global dir missing`)
  ;(await exists(gp.gemini.root)) ? ok(`gemini global dir ok`) : warn(`gemini global dir missing`)
  ;(await exists(gp.opencode.root)) ? ok(`opencode global dir ok`) : warn(`opencode global dir missing`)

  console.log(report.join('\n'))
}

