import { promises as fs } from 'fs'

export async function ensureDir(p: string) { await fs.mkdir(p, { recursive: true } as any) }
export async function writeFile(path: string, content: string | Uint8Array) {
  await ensureDir(path.substring(0, Math.max(0, path.lastIndexOf('/'))))
  await fs.writeFile(path, content)
}
export async function exists(path: string) { try { await fs.stat(path); return true } catch { return false } }
export async function copyFile(src: string, dst: string) { await fs.copyFile(src, dst) }

export async function copyDir(srcDir: string, destDir: string) {
  try {
    const entries = await fs.readdir(srcDir, { withFileTypes: true } as any)
    await ensureDir(destDir)
    for (const e of entries as any[]) {
      const src = `${srcDir}/${e.name}`
      const dst = `${destDir}/${e.name}`
      if (e.isDirectory()) await copyDir(src, dst)
      else if (e.isFile()) {
        const data = await fs.readFile(src)
        await writeFile(dst, data)
      }
    }
  } catch {}
}

export function timestamp(): string { return new Date().toISOString().replace(/[:.]/g, '-') }
export async function backup(path: string) {
  if (!(await exists(path))) return
  const bak = `${path}.bak.${timestamp()}`
  await fs.copyFile(path, bak)
}

function stripJsonComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
}
export async function readJsonc(path: string): Promise<any> {
  try {
    const raw = await fs.readFile(path, 'utf8')
    try { return JSON.parse(raw) } catch { return JSON.parse(stripJsonComments(raw)) }
  } catch { return {} }
}
export async function writeJsonWithBackup(path: string, data: any) {
  await backup(path)
  await writeFile(path, JSON.stringify(data, null, 2) + '\n')
}

