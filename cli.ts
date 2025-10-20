#!/usr/bin/env bun
// assistants-cli: gen | sync-global | doctor

import { runGen } from './lib/cmdGen'
import { runSyncGlobal } from './lib/cmdSyncGlobal'
import { runSyncFromGlobal } from './lib/cmdSyncFromGlobal'
import { runDoctor } from './lib/cmdDoctor'

export { runGen, runSyncGlobal, runSyncFromGlobal, runDoctor }

type Target = 'codex' | 'claude' | 'gemini' | 'opencode'

async function main() {
  const [, , cmd, arg1, ...rest] = process.argv
  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log('Usage: assistants-cli <gen|sync-global|sync-from-global|doctor> [args]')
    console.log('  gen [all|codex|gemini|opencode|claude] [--root <path>]')
    console.log('  sync-global [--root <path>] [--dry]')
    console.log('  sync-from-global [--root <path>] [--dry]')
    console.log('  doctor [--root <path>]')
    process.exit(0)
  }
  if (cmd === 'gen') {
    const target = (arg1 as any) || 'all'
    const rootArg = rest.includes('--root') ? rest[rest.indexOf('--root') + 1] : undefined
    await runGen(target, rootArg)
  } else if (cmd === 'sync-global') {
    const rootArg = arg1 === '--root' ? rest[0] : (arg1 && !arg1.startsWith('-') ? arg1 : undefined)
    const dry = (arg1 === '--dry') || rest.includes('--dry')
    await runSyncGlobal(rootArg, dry)
  } else if (cmd === 'sync-from-global') {
    const rootArg = arg1 === '--root' ? rest[0] : (arg1 && !arg1.startsWith('-') ? arg1 : undefined)
    const dry = (arg1 === '--dry') || rest.includes('--dry')
    await runSyncFromGlobal(rootArg, dry)
  } else if (cmd === 'doctor') {
    const rootArg = arg1 === '--root' ? rest[0] : (arg1 && !arg1.startsWith('-') ? arg1 : undefined)
    await runDoctor(rootArg)
  } else {
    console.error(`Unknown command: ${cmd}`)
    process.exit(1)
  }
}

if (import.meta.main) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
