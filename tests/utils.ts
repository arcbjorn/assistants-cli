import { promises as fs } from "fs";
import { join, sep } from "path";
import { tmpdir } from "os";
import { mkdtemp, rm } from "fs/promises";

export async function mkTempAssistantsRoot(prefix = "assistants-") {
  return await mkdtemp(`${tmpdir()}${sep}${prefix}`);
}

export async function cleanupTempDir(dir: string) {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

export async function mkdirp(p: string) {
  await fs.mkdir(p, { recursive: true } as any);
}

export async function write(path: string, content: string) {
  const parts = path.split(sep);
  parts.pop();
  await mkdirp(parts.join(sep));
  await fs.writeFile(path, content);
}

export async function read(path: string) {
  return await fs.readFile(path, "utf8");
}

export async function exists(path: string) {
  try {
    await fs.stat(path);
    return true;
  } catch {
    return false;
  }
}

export function count(hay: string, needle: string): number {
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  return (hay.match(re) ?? []).length;
}

export function pJoin(...parts: string[]) { return join(...parts); }

