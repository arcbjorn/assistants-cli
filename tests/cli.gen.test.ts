import { test, expect } from "bun:test";
import { join } from "path";
import { mkTempAssistantsRoot, write, exists, cleanupTempDir } from "./utils";
import { runGen } from "../cli.ts";

test("assistants-cli gen produces expected outputs", async () => {
  const root = await mkTempAssistantsRoot();
  const src = join(root, "source");

  try {
    await write(join(src, "commands", "hello.md"), `# Hello\n\nSay $ARGUMENTS`);
    await write(join(src, "agents", "agent.md"), `# Agent\n\nYou help.`);
    await write(join(src, "global_instructions.md"), "GLOBAL");

    await runGen("all", root);

    expect(await exists(join(root, "codex", "prompts", "hello.md"))).toBeTrue();
    expect(await exists(join(root, "gemini", "commands", "hello.toml"))).toBeTrue();
    expect(await exists(join(root, "opencode", "commands", "hello.md"))).toBeTrue();
    expect(await exists(join(root, "claude", "agents", "agent.md"))).toBeTrue();
  } finally {
    await cleanupTempDir(root);
  }
});

