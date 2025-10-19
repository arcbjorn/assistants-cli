// Write a single Markdown validation prompt into assistants/docs/assistants-sync-check.md
// Usage: bun run update-agent.ts [--root <assistants-dir>]

import { promises as fs } from 'fs'
import { join, resolve } from 'path'

export function prompt(): string {
  return `# Assistants Sync Validation Prompt\n\nUse the official docs below to verify that assistants/source has been correctly transformed into per‑assistant outputs. Check file paths, formats, and required metadata exactly as documented. Report mismatches and propose minimal fixes.\n\n## Documentation Links\n\n### Global Settings\n- Claude: https://docs.anthropic.com/en/docs/claude-code/settings\n- Codex: https://github.com/openai/codex/blob/main/docs/config.md\n- Gemini: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md\n- OpenCode: https://opencode.ai/docs/config\n\n### Global Memory Files\n- Claude: https://docs.anthropic.com/en/docs/claude-code/memory#determine-memory-type\n- Codex: https://github.com/openai/codex/blob/main/docs/getting-started.md#memory-with-agentsmd\n- Gemini: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md\n- OpenCode: https://opencode.ai/docs/config#global\n\n### Commands/Prompts\n- Claude: https://docs.claude.com/en/docs/claude-code/slash-commands\n- Codex: https://github.com/openai/codex/blob/main/docs/prompts.md\n- Gemini: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md\n- OpenCode: https://opencode.ai/docs/commands/\n\n### Sub‑agents\n- Claude: https://docs.claude.com/en/docs/claude-code/sub-agents\n- OpenCode: https://opencode.ai/docs/agents/\n\n## Expected Mapping\n- Codex: prompts/<slug>.md (+YAML), AGENTS.md, config.toml\n- Gemini: commands/<slug>.toml (prompt, description), GEMINI.md, settings.json; map $ARGUMENTS -> {{args}}\n- OpenCode: commands/<slug>.md (+YAML description), agent/<slug>.md, global_instructions.md + opencode.jsonc/jsonrc\n- Claude: commands/<slug>.md, agents/<slug>.md, CLAUDE.md, settings.json\n\n## Checklist\n- Verify paths/extensions per assistant\n- Confirm formats (MD/TOML + required front matter)\n- Check $ARGUMENTS -> {{args}} for Gemini\n- Ensure global files/configs exist per assistant\n- Propose minimal diffs to fix mismatches\n`
}

function getArg(names: string[]): string | undefined {
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    for (const n of names) {
      if (a.startsWith(n + '=')) return a.slice(n.length + 1)
      if (a === n && i + 1 < argv.length) return argv[i + 1]
    }
  }
  return undefined
}

export async function writePrompt(rootDir: string) {
  const out = join(rootDir, 'docs', 'assistants-sync-check.md')
  await fs.mkdir(join(rootDir, 'docs'), { recursive: true })
  await fs.writeFile(out, prompt())
  return out
}

async function main() {
  const cwd = process.cwd()
  const rootArg = getArg(['--root'])
  const root = rootArg ? resolve(cwd, rootArg) : resolve(cwd, '..', '..', 'assistants')
  const out = await writePrompt(root)
  console.log(`Wrote ${out}`)
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
