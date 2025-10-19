# Assistants Sync (Bun)

Single source of truth in `assistants/source` → generate per‑assistant configs.

Usage
- Build binary: `bun run build:bin`
- Generate all: `dist/assistants-sync gen all --root /path/to/assistants`
- Generate one: `dist/assistants-sync gen codex --root /path/to/assistants`

Source of truth (inside assistants/)
- `source/agents/*.md`
- `source/commands/*.md`
- `source/global_instructions.md`
- `source/config/<assistant>/*` (optional overrides)

Outputs
- Codex: `codex/prompts/*.md`, `codex/AGENTS.md`, `codex/config.toml`
- Gemini: `gemini/commands/*.toml`, `gemini/GEMINI.md`, `gemini/settings.json`
- OpenCode: `opencode/agent/*.md`, `opencode/commands/*.md`, `opencode/global_instructions.md`, `opencode.jsonc`
- Claude: `claude/agents/*.md`, `claude/commands/*.md`, `claude/CLAUDE.md`, `claude/settings.json`

Validation prompt
- See `docs/assistants-sync-check.md` in the assistants repo for a single Markdown prompt to verify outputs.
