import { test, expect } from "bun:test";
import { join } from "path";
import { generateAll } from "../index.ts";
import { mkTempAssistantsRoot, write, read, exists, count } from "./utils";

test("comprehensive generation: front matter, placeholders, configs, idempotency", async () => {
  const root = await mkTempAssistantsRoot();
  const src = join(root, "source");

  // Source commands
  await write(join(src, "commands", "with_args.md"), `# With Args\n\nRun with $ARGUMENTS here.`);
  await write(join(src, "commands", "without_args.md"), `# Without Args\n\nThis command has no args line.`);

  // Source agent
  await write(join(src, "agents", "agent1.md"), `# Agent One\n\nYou are an agent for tests.`);

  // Global instructions
  const globalText = "GLOBAL CHECK";
  await write(join(src, "global_instructions.md"), globalText);

  await generateAll(["codex", "gemini", "opencode", "claude"], root);

  // OpenCode: YAML front matter and $ARGUMENTS handling
  const ocWith = await read(join(root, "opencode", "commands", "with_args.md"));
  expect(ocWith.startsWith("---\n")).toBeTrue();
  expect(ocWith).toContain("description:");
  expect(count(ocWith, "$ARGUMENTS")).toBe(1); // not duplicated

  const ocWithout = await read(join(root, "opencode", "commands", "without_args.md"));
  expect(ocWithout.startsWith("---\n")).toBeTrue();
  expect(ocWithout).toContain("description:");
  expect(count(ocWithout, "$ARGUMENTS")).toBe(1); // auto-appended once

  // Codex: prompts with optional YAML description
  const cx = await read(join(root, "codex", "prompts", "with_args.md"));
  expect(cx.startsWith("---\n")).toBeTrue();
  expect(cx).toContain("description:");
  expect(cx).toContain("Run with $ARGUMENTS here."); // no mapping for codex
  expect(await read(join(root, "codex", "AGENTS.md"))).toBe(globalText);
  const codexToml = await read(join(root, "codex", "config.toml"));
  expect(codexToml).toContain("model = ");
  expect(codexToml).toContain("approval_policy");
  expect(codexToml).toContain("[model_providers.openai]");

  // Gemini: TOML + mapping
  const gm = await read(join(root, "gemini", "commands", "with_args.toml"));
  expect(gm).toContain('prompt = """');
  expect(gm).toContain("{{args}}");
  expect(gm).not.toContain("$ARGUMENTS");
  const gmNo = await read(join(root, "gemini", "commands", "without_args.toml"));
  expect(gmNo).not.toContain("{{args}}");
  expect(gmNo).not.toContain("$ARGUMENTS");
  const geminiSettings = JSON.parse(await read(join(root, "gemini", "settings.json")));
  expect(Array.isArray(geminiSettings.context.fileName)).toBeTrue();
  expect(geminiSettings.context.fileName.join(" ")).toContain("GEMINI.md");
  expect(await read(join(root, "gemini", "GEMINI.md"))).toBe(globalText);

  // Agents emitted where supported
  const ocAgent = await read(join(root, "opencode", "agent", "agent1.md"));
  expect(ocAgent.startsWith("# Agent One\n")).toBeTrue();
  const clAgent = await read(join(root, "claude", "agents", "agent1.md"));
  expect(clAgent.startsWith("# Agent One\n")).toBeTrue();
  expect(await read(join(root, "claude", "CLAUDE.md"))).toBe(globalText);
  const claudeSettings = JSON.parse(await read(join(root, "claude", "settings.json")));
  expect(typeof claudeSettings.includeCoAuthoredBy).toBe("boolean");
  expect(typeof claudeSettings.alwaysThinkingEnabled).toBe("boolean");

  // OpenCode config
  const ocConfig = JSON.parse(await read(join(root, "opencode", "opencode.jsonc")));
  expect(ocConfig.$schema).toContain("opencode.ai/config.json");
  expect(ocConfig.instructions[0]).toBe("./global_instructions.md");

  // Idempotency: running again should not duplicate $ARGUMENTS or change files
  const beforeAgain = ocWithout;
  await generateAll(["codex", "gemini", "opencode", "claude"], root);
  const afterAgain = await read(join(root, "opencode", "commands", "without_args.md"));
  expect(afterAgain).toBe(beforeAgain);
  expect(count(afterAgain, "$ARGUMENTS")).toBe(1);
});

test("no global_instructions.md -> no global files", async () => {
  const root = await mkTempAssistantsRoot();
  const src = join(root, "source");
  await write(join(src, "commands", "c.md"), `# C\n\nBody`);
  await write(join(src, "agents", "a.md"), `# A\n\nSystem`);

  await generateAll(["codex", "gemini", "opencode", "claude"], root);

  expect(await exists(join(root, "codex", "AGENTS.md"))).toBeFalse();
  expect(await exists(join(root, "gemini", "GEMINI.md"))).toBeFalse();
  expect(await exists(join(root, "opencode", "global_instructions.md"))).toBeFalse();
  expect(await exists(join(root, "claude", "CLAUDE.md"))).toBeFalse();
});
