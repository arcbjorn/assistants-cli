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

function hasTomlKey(toml: string, key: string): boolean { return new RegExp(`^${key}\s*=`, 'm').test(toml) }
function hasTomlSection(toml: string, section: string): boolean { return new RegExp(`^\[${section.replace(/[-]/g, '\-')}\]`, 'm').test(toml) }
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
  if (!hasTomlKey(dest, 'model')) {
    const modelLine = (local.match(/^model\s*=.*$/m) || ['model = "o3"'])[0]
    dest = appendTomlIfMissing(dest, modelLine, () => hasTomlKey(dest, 'model'))
  }
  if (!hasTomlKey(dest, 'approval_policy')) {
    const ap = (local.match(/^approval_policy\s*=.*$/m) || ['approval_policy = "on-request"'])[0]
    dest = appendTomlIfMissing(dest, ap, () => hasTomlKey(dest, 'approval_policy'))
  }
  if (!hasTomlSection(dest, 'model_providers.openai')) {
    const sect = local.match(/^\[model_providers\.openai[^\]]*\][\s\S]*?(?=\n\[|$)/m)?.[0]
      || ['[model_providers.openai]','name = "OpenAI"','base_url = "https://api.openai.com/v1"','env_key = "OPENAI_API_KEY"'].join('\n')
    dest = appendTomlIfMissing(dest, sect, () => hasTomlSection(dest, 'model_providers.openai'))
  }
  await backup(destPath)
  await fs.writeFile(destPath, dest)
}
