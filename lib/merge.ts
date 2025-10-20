import { promises as fs } from 'fs'
import { ensureDir, backup } from './fsutil'

export function mergeClaudeSettings(existing: any, incoming: any) {
  const out = { ...existing }
  if (incoming && typeof incoming === 'object') {
    if (out.includeCoAuthoredBy === undefined && incoming.includeCoAuthoredBy !== undefined) out.includeCoAuthoredBy = incoming.includeCoAuthoredBy
    if (out.alwaysThinkingEnabled === undefined && incoming.alwaysThinkingEnabled !== undefined) out.alwaysThinkingEnabled = incoming.alwaysThinkingEnabled
  }
  return out
}

export function mergeGeminiSettings(existing: any, incoming: any) {
  const out = { ...existing }
  const ctx = out.context ?? {}
  const inCtx = incoming?.context ?? {}
  const names = Array.from(new Set([...(ctx.fileName ?? []), ...(inCtx.fileName ?? [])]))
  out.context = { ...ctx, fileName: names }
  return out
}

export function mergeOpenCodeConfig(existing: any) {
  const out = { ...existing }
  if (!out.$schema) out.$schema = 'https://opencode.ai/config.json'
  const instr: string[] = Array.isArray(out.instructions) ? out.instructions : []
  const ref = './global_instructions.md'
  if (!instr.includes(ref)) instr.push(ref)
  out.instructions = instr
  return out
}

// Allow optional leading whitespace so indented keys/sections are detected.
// This prevents duplicate appends when users format their TOML with indentation
// or when files contain a BOM (\ufeff) at the start of the line.
function hasTomlKey(toml: string, key: string): boolean {
  // Allow optional BOM at start of line and any indentation
  const pattern = `^[\\uFEFF\\s]*${key}\\s*=`
  return new RegExp(pattern, 'm').test(toml)
}
function hasTomlSection(toml: string, section: string): boolean {
  // Escape all regex special chars in section id; allow BOM/indent
  const esc = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pat = `^[\\uFEFF\\s]*\\[${esc}\\]`
  return new RegExp(pat, 'm').test(toml)
}

// (No cleanup/dedupe of existing global configs; we only append if missing)
function appendTomlIfMissing(existing: string, snippet: string, check: () => boolean): string {
  if (check()) return existing
  const sep = existing.endsWith('\n') ? '' : '\n'
  return existing + sep + '\n' + snippet.trim() + '\n'
}

export async function mergeCodexToml(destPath: string, localPath: string) {
  const local = await fs.readFile(localPath, 'utf8').catch(() => '')
  let dest = await fs.readFile(destPath, 'utf8').catch(() => '')
  if (!dest) {
    await ensureDir(destPath.substring(0, destPath.lastIndexOf('/')))
    await fs.writeFile(destPath, local)
    return
  }
  // Append defaults only if missing (no modifications otherwise)
  await backup(destPath)
  if (!hasTomlKey(dest, 'model')) {
    const modelLine = (local.match(/^model\s*=.*$/m) || ['model = "o3"'])[0]
    dest = appendTomlIfMissing(dest, modelLine, () => hasTomlKey(dest, 'model'))
  }
  if (!hasTomlKey(dest, 'approval_policy')) {
    const ap = (local.match(/^approval_policy\s*=.*$/m) || ['approval_policy = "on-request"'])[0]
    dest = appendTomlIfMissing(dest, ap, () => hasTomlKey(dest, 'approval_policy'))
  }
  await fs.writeFile(destPath, dest)
}
