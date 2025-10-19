# Assistants Sync Validation Prompt

Use the official docs below to verify that assistants/source has been correctly transformed into per‑assistant outputs. Check file paths, formats, and required metadata exactly as documented. Report any mismatches and propose minimal, targeted fixes (show the exact file path and a minimal diff for each fix).

## Documentation Links

### Global Settings
- Claude: https://docs.anthropic.com/en/docs/claude-code/settings
- Codex: https://github.com/openai/codex/blob/main/docs/config.md
- Gemini: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md
- OpenCode: https://opencode.ai/docs/config

### Global Memory Files
- Claude: https://docs.anthropic.com/en/docs/claude-code/memory#determine-memory-type
- Codex: https://github.com/openai/codex/blob/main/docs/getting-started.md#memory-with-agentsmd
- Gemini: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/gemini-md.md
- OpenCode: https://opencode.ai/docs/config#global

### Commands/Prompts
- Claude: https://docs.claude.com/en/docs/claude-code/slash-commands
- Codex: https://github.com/openai/codex/blob/main/docs/prompts.md
- Gemini: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md
- OpenCode: https://opencode.ai/docs/commands/

### Sub‑agents
- Claude: https://docs.claude.com/en/docs/claude-code/sub-agents
- OpenCode: https://opencode.ai/docs/agents/

## Source Of Truth
- assistants/source/agents/*.md
- assistants/source/commands/*.md
- assistants/source/global_instructions.md
- assistants/source/config/<assistant>/* (optional overrides)

## Expected Mapping (Paths + Formats)

- Codex
  - Commands: assistants/codex/prompts/<slug>.md
    - Markdown body; optional YAML front matter:
      ---
      description: One‑line description
      argument-hint: NAME=<value> [OTHER=<value>]
      ---
  - Global: assistants/codex/AGENTS.md (verbatim)
  - Config: assistants/codex/config.toml (per docs/config.md)
    - Include model, approval_policy, and a [model_providers.<id>] example

- Gemini
  - Commands: assistants/gemini/commands/<slug>.toml
    - TOML fields:
      description = "..."  # optional
      prompt = """
      ... (multiline prompt)
      """
    - Placeholder mapping: $ARGUMENTS -> {{args}}
  - Global: assistants/gemini/GEMINI.md (verbatim)
  - Config: assistants/gemini/settings.json (supports context.fileName)

- OpenCode
  - Commands: assistants/opencode/commands/<slug>.md
    - YAML front matter required:
      ---
      description: One‑line description
      # agent: optional-agent-name
      # model: optional-model-id
      ---
    - Append $ARGUMENTS if missing
  - Agents: assistants/opencode/agent/<slug>.md (Markdown)
  - Global: assistants/opencode/global_instructions.md (verbatim)
  - Config: assistants/opencode/opencode.jsonc (or .jsonrc)
    {
      "$schema": "https://opencode.ai/config.json",
      "instructions": ["./global_instructions.md"]
    }

- Claude
  - Commands: assistants/claude/commands/<slug>.md (Markdown)
  - Agents: assistants/claude/agents/<slug>.md (Markdown)
  - Global: assistants/claude/CLAUDE.md (verbatim)
  - Config: assistants/claude/settings.json (e.g., { "includeCoAuthoredBy": false, "alwaysThinkingEnabled": false })

## Checklist
- Verify every expected file exists with the exact path and extension.
- Confirm formats: Codex MD (+YAML), Gemini TOML, OpenCode MD (+YAML), Claude MD.
- Confirm $ARGUMENTS -> {{args}} mapping for Gemini.
- Confirm OpenCode command front matter includes description.
- Confirm global files and assistant configs exist and match docs.
- For any mismatch, output a minimal diff and the corrected file path.
