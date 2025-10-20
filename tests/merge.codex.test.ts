import { test, expect } from "bun:test";
import { join } from "path";
import { mkTempAssistantsRoot, write, read, cleanupTempDir, count } from "./utils";
import { mergeCodexToml } from "../lib/merge";

test("mergeCodexToml does not duplicate indented keys/sections", async () => {
  const root = await mkTempAssistantsRoot("merge-codex-");
  const dest = join(root, "config.toml");
  const local = join(root, "local.toml");
  try {
    // Existing destination uses indentation (and could include BOM/whitespace)
    const existing = [
      "  model = \"o3\"",
      "  approval_policy = \"on-request\"",
      "",
      "  [model_providers.openai]",
      "  name = \"OpenAI\"",
      "  base_url = \"https://api.openai.com/v1\"",
      "  env_key = \"OPENAI_API_KEY\"",
      "",
    ].join("\n");
    const incoming = [
      'model = "o3"',
      'approval_policy = "on-request"',
      '',
      '[model_providers.openai]',
      'name = "OpenAI"',
      'base_url = "https://api.openai.com/v1"',
      'env_key = "OPENAI_API_KEY"',
      '',
    ].join("\n");
    await write(dest, existing);
    await write(local, incoming);

    // Sanity check our regex assumption before merge
    const reModel = new RegExp('^\\s*model\\s*=', 'm');
    const reAp = new RegExp('^\\s*approval_policy\\s*=', 'm');
    if (!reModel.test(existing) || !reAp.test(existing)) {
      throw new Error('Test setup regex check failed');
    }

    await mergeCodexToml(dest, local);

    const merged = await read(dest);
    // Ensure no duplicate top-level keys were appended
    expect(count(merged, "model = ")).toBe(1);
    expect(count(merged, "approval_policy = ")).toBe(1);
    // Ensure the provider section was not duplicated
    expect(count(merged, "model_providers.openai")).toBe(1);
  } finally {
    await cleanupTempDir(root);
  }
});
