import { promises as fs } from 'fs'
import { join, resolve } from 'path'
import { resolveAssistantsRoot, globalPaths } from './paths'
import { ensureDir, exists, copyFile } from './fsutil'

async function syncFromGlobal(srcDir: string, dstDir: string) {
  if (!(await exists(srcDir))) return 0
  await ensureDir(dstDir)
  const files = (await fs.readdir(srcDir)).filter((f) => !f.startsWith('.'))
  for (const f of files) {
    await copyFile(join(srcDir, f), join(dstDir, f))
  }
  return files.length
}

export async function runSyncFromGlobal(rootArg?: string, dryRun = false) {
  const cwd = process.cwd()
  const root = rootArg ? resolve(cwd, rootArg) : await resolveAssistantsRoot(cwd)
  const gp = globalPaths()

  // Create source directory if it doesn't exist
  const sourceDir = join(root, 'source')
  if (!dryRun) await ensureDir(sourceDir)

  // Claude - only sync commands and agents to source/
  if (dryRun) console.log(`[dry-run] ${gp.claude.commands} -> ${join(sourceDir, 'commands')}`)
  else {
    const commandsCount = await syncFromGlobal(gp.claude.commands, join(sourceDir, 'commands'))
    if (commandsCount > 0) console.log(`Synced ${commandsCount} Claude commands`)
  }

  if (dryRun) console.log(`[dry-run] ${gp.claude.agents} -> ${join(sourceDir, 'agents')}`)
  else {
    const agentsCount = await syncFromGlobal(gp.claude.agents, join(sourceDir, 'agents'))
    if (agentsCount > 0) console.log(`Synced ${agentsCount} Claude agents`)
  }

  console.log('Synced Claude commands and agents from globals to source/')
}