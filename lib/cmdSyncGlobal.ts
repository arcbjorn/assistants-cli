import { promises as fs } from 'fs'
import { join, resolve } from 'path'
import { resolveAssistantsRoot, globalPaths } from './paths'
import { ensureDir, exists, copyFile, readJsonc, writeJsonWithBackup } from './fsutil'
import { mergeClaudeSettings, mergeGeminiSettings, mergeOpenCodeConfig, mergeCodexToml } from './merge'

async function syncDir(srcDir: string, dstDir: string) {
  if (!(await exists(srcDir))) return 0
  await ensureDir(dstDir)
  const files = (await fs.readdir(srcDir)).filter((f) => !f.startsWith('.'))
  for (const f of files) {
    await copyFile(join(srcDir, f), join(dstDir, f))
  }
  return files.length
}

export async function runSyncGlobal(rootArg?: string, dryRun = false) {
  const cwd = process.cwd()
  const root = rootArg ? resolve(cwd, rootArg) : await resolveAssistantsRoot(cwd)
  const gp = globalPaths()

  // Claude
  const cSrc = join(root, 'claude')
  if (await exists(cSrc)) {
    if (dryRun) console.log(`[dry-run] claude -> ${gp.claude.root}`)
    else {
      await ensureDir(gp.claude.commands); await ensureDir(gp.claude.agents)
      await syncDir(join(cSrc, 'commands'), gp.claude.commands)
      await syncDir(join(cSrc, 'agents'), gp.claude.agents)
      if (await exists(join(cSrc, 'CLAUDE.md'))) await copyFile(join(cSrc,'CLAUDE.md'), gp.claude.files.CLAUDE)
      if (await exists(join(cSrc, 'settings.json'))) {
        const local = await readJsonc(join(cSrc,'settings.json'))
        const existing = await readJsonc(gp.claude.files.settings)
        const merged = mergeClaudeSettings(existing, local)
        await writeJsonWithBackup(gp.claude.files.settings, merged)
      }
    }
  }

  // Codex
  const xSrc = join(root, 'codex')
  if (await exists(xSrc)) {
    if (dryRun) console.log(`[dry-run] codex -> ${gp.codex.root}`)
    else {
      await ensureDir(gp.codex.prompts)
      await syncDir(join(xSrc, 'prompts'), gp.codex.prompts)
      if (await exists(join(xSrc, 'AGENTS.md'))) await copyFile(join(xSrc,'AGENTS.md'), gp.codex.files.AGENTS)
      if (await exists(join(xSrc, 'config.toml'))) await mergeCodexToml(gp.codex.files.config, join(xSrc,'config.toml'))
    }
  }

  // Gemini
  const gSrc = join(root, 'gemini')
  if (await exists(gSrc)) {
    if (dryRun) console.log(`[dry-run] gemini -> ${gp.gemini.root}`)
    else {
      await ensureDir(gp.gemini.commands)
      await syncDir(join(gSrc, 'commands'), gp.gemini.commands)
      if (await exists(join(gSrc, 'GEMINI.md'))) await copyFile(join(gSrc,'GEMINI.md'), gp.gemini.files.GEMINI)
      if (await exists(join(gSrc, 'settings.json'))) {
        const local = await readJsonc(join(gSrc,'settings.json'))
        const existing = await readJsonc(gp.gemini.files.settings)
        const merged = mergeGeminiSettings(existing, local)
        await writeJsonWithBackup(gp.gemini.files.settings, merged)
      }
    }
  }

  // OpenCode
  const oSrc = join(root, 'opencode')
  if (await exists(oSrc)) {
    if (dryRun) console.log(`[dry-run] opencode -> ${gp.opencode.root}`)
    else {
      await ensureDir(gp.opencode.commands); await ensureDir(gp.opencode.agents)
      await syncDir(join(oSrc, 'commands'), gp.opencode.commands)
      await syncDir(join(oSrc, 'agent'), gp.opencode.agents)
      // Merge opencode.jsonc configuration
      const localJsonc = join(oSrc, 'opencode.jsonc')
      const destJson = join(gp.opencode.root, 'opencode.json')
      const destJsonc = gp.opencode.files.confJsonc
      const dest = (await exists(destJsonc)) ? destJsonc : (await exists(destJson)) ? destJson : destJsonc
      const localPath = (await exists(localJsonc)) ? localJsonc : ''
      if (localPath) {
        const existing = await readJsonc(dest)
        const merged = mergeOpenCodeConfig(existing)
        await writeJsonWithBackup(dest, merged)
      }
      if (await exists(join(oSrc, 'global_instructions.md'))) await copyFile(join(oSrc,'global_instructions.md'), gp.opencode.files.global)
    }
  }
  console.log('Synced to globals')
}

