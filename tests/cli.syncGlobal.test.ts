import { test, expect } from "bun:test";
import { join } from "path";
import { mkTempAssistantsRoot, write, read, exists, cleanupTempDir } from "./utils";
import { runGen, runSyncGlobal } from "../cli.ts";

function withFakeHome<T>(home: string, fn: () => Promise<T>) {
  const oldHome = process.env.HOME;
  process.env.HOME = home;
  return fn().finally(() => { if (oldHome !== undefined) process.env.HOME = oldHome; });
}

test("assistants-cli sync-global merges settings with backups", async () => {
  const home = await mkTempAssistantsRoot("home-");
  const root = await mkTempAssistantsRoot();
  const src = join(root, "source");

  try {
    await write(join(src, "commands", "c.md"), `# C\n\nBody`);
    await write(join(src, "agents", "a.md"), `# A\n\nSys`);
    await write(join(src, "global_instructions.md"), "GLOBAL");
    await runGen("all", root);

    await withFakeHome(home, async () => {
      await runSyncGlobal(root);
      // spot check globals
      expect(await exists(join(home, ".claude", "CLAUDE.md"))).toBeTrue();
      expect(await exists(join(home, ".codex", "AGENTS.md"))).toBeTrue();
      expect(await exists(join(home, ".gemini", "GEMINI.md"))).toBeTrue();
      expect(await exists(join(home, ".config", "opencode", "global_instructions.md"))).toBeTrue();
    });
  } finally {
    await cleanupTempDir(home);
    await cleanupTempDir(root);
  }
});
