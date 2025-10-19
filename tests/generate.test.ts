import { test, expect } from "bun:test";
import { join } from "path";
import { mkTempAssistantsRoot, write, exists, read } from "./utils";
import { generateAll } from "../index.ts";

test("end-to-end generation for all assistants", async () => {
  const root = await mkTempAssistantsRoot();
  const src = join(root, "source");
  await write(join(src, "commands", "c1.md"), `# Test Command 1\n\nThis is description line.\n\nDo something with $ARGUMENTS`);
  await write(join(src, "commands", "c2.md"), `# Command Two\n\nBody without arguments`);
  await write(join(src, "agents", "a1.md"), `# Sample Agent\n\nYou are a helpful agent.`);
  await write(join(src, "global_instructions.md"), "GLOBAL INSTRUCTIONS");

  await generateAll(["codex", "gemini", "opencode", "claude"], root);

  expect(await exists(join(root, "codex", "prompts", "c1.md"))).toBeTrue();
  expect(await read(join(root, "codex", "prompts", "c1.md"))).toContain("This is description");
  expect(await exists(join(root, "codex", "AGENTS.md"))).toBeTrue();
  expect(await exists(join(root, "codex", "config.toml"))).toBeTrue();

  expect(await exists(join(root, "gemini", "commands", "c1.toml"))).toBeTrue();
  const g1 = await read(join(root, "gemini", "commands", "c1.toml"));
  expect(g1).toContain('prompt = """');
  expect(g1).toContain("{{args}}");
  expect(await exists(join(root, "gemini", "GEMINI.md"))).toBeTrue();
  expect(await exists(join(root, "gemini", "settings.json"))).toBeTrue();

  expect(await exists(join(root, "opencode", "commands", "c1.md"))).toBeTrue();
  const oc1 = await read(join(root, "opencode", "commands", "c1.md"));
  expect(oc1).toContain("---");
  expect(oc1).toContain("description:");
  const oc2 = await read(join(root, "opencode", "commands", "c2.md"));
  expect(oc2).toContain("$ARGUMENTS");
  expect(await exists(join(root, "opencode", "agent", "a1.md"))).toBeTrue();
  expect(await exists(join(root, "opencode", "global_instructions.md"))).toBeTrue();
  expect(await exists(join(root, "opencode", "opencode.jsonc"))).toBeTrue();

  expect(await exists(join(root, "claude", "commands", "c1.md"))).toBeTrue();
  expect(await exists(join(root, "claude", "agents", "a1.md"))).toBeTrue();
  expect(await exists(join(root, "claude", "CLAUDE.md"))).toBeTrue();
  expect(await exists(join(root, "claude", "settings.json"))).toBeTrue();
});
