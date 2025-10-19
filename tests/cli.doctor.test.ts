import { test, expect } from "bun:test";
import { join } from "path";
import { mkTempAssistantsRoot, write, exists, cleanupTempDir } from "./utils";
import { runDoctor, runGen } from "../cli.ts";

test("assistants-cli doctor runs without throwing", async () => {
  const root = await mkTempAssistantsRoot();
  const src = join(root, "source");

  try {
    // Create minimal source structure for gen
    await write(join(src, "commands", "hello.md"), `# Hello\n\nSay $ARGUMENTS`);
    await write(join(src, "agents", "agent.md"), `# Agent\n\nYou help.`);
    await write(join(src, "global_instructions.md"), "GLOBAL");

    // Generate the required directories first
    await runGen("all", root);

    await runDoctor(root);
    expect(true).toBeTrue();
  } finally {
    await cleanupTempDir(root);
  }
});

