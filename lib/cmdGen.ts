import { resolve } from 'path'
import { generateAll } from './generate'
import { resolveAssistantsRoot } from './paths'

export type Target = 'codex' | 'claude' | 'gemini' | 'opencode'

export async function runGen(target: Target | 'all', rootArg?: string) {
  const cwd = process.cwd()
  const root = rootArg ? resolve(cwd, rootArg) : await resolveAssistantsRoot(cwd)
  const targets: Target[] = target === 'all' ? ['codex', 'gemini', 'opencode', 'claude'] : [target]
  await generateAll(targets, root)
  console.log(`Generated for: ${targets.join(', ')} at ${root}`)
}
