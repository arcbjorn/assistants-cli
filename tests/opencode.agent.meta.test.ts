import { test, expect } from "bun:test";
import { join } from "path";
import { mkTempAssistantsRoot, write, read, cleanupTempDir } from "./utils";
import { runGen } from "../cli.ts";

function parseFrontMatter(md: string): Record<string, string> {
  if (!md.startsWith("---")) return {};
  const end = md.indexOf("---", 3);
  if (end === -1) return {};
  const fm = md.slice(3, end).trim();
  const out: Record<string, string> = {};
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

test("opencode agent has name and description in frontmatter", async () => {
  const root = await mkTempAssistantsRoot();
  const src = join(root, "source");
  try {
    // Agent with markdown title, no frontmatter
    await write(join(src, "agents", "arch.md"), `# Coding Architect\n\nCoding Architecture Agent for Solo Full-Stack Development\n`);

    // Minimal command and global to satisfy generator
    await write(join(src, "commands", "noop.md"), `# Noop\n\nDoes nothing.`);
    await write(join(src, "global_instructions.md"), "GLOBAL");

    await runGen("opencode", root);

    const out = await read(join(root, "opencode", "agent", "arch.md"));
    const fm = parseFrontMatter(out);

    // name fallback: random 8-letter string
    expect(/^[a-z]{8}$/.test(fm["name"] || "")).toBeTrue();
    expect(fm["mode"]).toBe("primary");
    // description fallback: title
    expect(fm["description"]).toBe("Coding Architect");
  } finally {
    await cleanupTempDir(root);
  }
});
