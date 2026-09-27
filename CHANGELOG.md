# Changelog

All notable changes to IntentGuard are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Privacy layer in `@intentguard/core` (`privacy/`): detects and redacts email
  addresses, phone numbers, API tokens, private keys, payment card numbers, and
  local user paths. Every spec and proof report is redacted on save, and the
  repository root and home directory are rewritten as `<repo>` and `~`.
  Controlled by the new `privacy` block in `.intent/config.json`.
- `scripts/check-pii.mjs`: dependency-free tripwire that refuses env files,
  private keys, local IntentGuard state, and generated agent configs, and scans
  staged or tracked text for personal data and credentials.
- Versioned git hooks under `.githooks/` (enabled automatically by
  `pnpm install`) so the tripwire runs on every commit.
- GitHub Actions CI: privacy scan, build and tests on Node 20 and 22, readiness
  gate on the demo spec, and a check that generated agent configs stay clean.
- `.env.example`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, and
  `.intent/README.md`.
- `intent connect <repo>` (`pnpm connect`): wires any local repository to this
  checkout. It creates `.intent/config.json` with detected test/lint/build
  commands, writes every agent's MCP config and rule block, and lists the
  machine-specific files in the repo's `.git/info/exclude`, warning when one is
  already tracked.
- Gemini CLI support (`.gemini/settings.json`, `GEMINI.md` importing
  `AGENTS.md`).
- Google Antigravity support through its workspace MCP config
  (`.agents/mcp_config.json`); rules load from `AGENTS.md` and `GEMINI.md`.
- `intent_update_spec` MCP tool, so an external agent can record the
  developer's answers and its findings, and readiness can actually rise over
  MCP. It shares one implementation (`updateSpec`) with the chat agent.
- MCP server instructions describing the lifecycle, and next-step hints in
  `intent_create`, `intent_questions`, and `intent_readiness` results.
- Tests for the MCP server itself (in-memory client) are now part of
  `pnpm test`.
- Chat agent powered by IBM watsonx (`ibm/granite-4-h-small` by default):
  IAM-authenticated tool-calling client, an agent loop with repository and
  intent tools, and a harness that only lets edits through with an active,
  ready, developer-approved spec and an in-scope path. Changing the spec resets
  approval. A baseline mode runs the same agent without the intent layer and
  records out-of-scope drift, for A/B comparisons.
- `intent chat` (`pnpm chat`) terminal chat with `/approve`, `/spec`,
  `/metrics`, and `--no-harness` / `--model` / `--list-models`.
- Web chat page at `/chat`, streaming from new API endpoints (`POST /api/chat`,
  `/api/chat/:id/messages` as server-sent events, `/api/chat/:id/approve`).
- Local run logs with session metrics in `.intent/runs/` (git-ignored).
- The chat agent's verify step runs the configured `test` check.

### Changed

- OpenAI is now the default model provider for the chat agent and spec
  drafting (`OPENAI_API_KEY`, default model `gpt-4.1`). One resolver in core
  (`createChatModel`) picks the provider for the CLI, the API, and drafting.
  watsonx stays available with `--provider watsonx`. IBM Bob needs no key: it
  connects over MCP.

- Generated MCP configs use absolute paths and `INTENT_ROOT`
  (`node <IntentGuard>/mcp/dist/index.js`), because IDE-based agents such as
  Bob do not start MCP servers in the project folder. They are machine-specific
  and never committed.
- IBM Bob rules move from `.bob/rules.md` to `.bob/rules/intentguard.md`, where
  Bob loads project rules.
- The API only accepts requests addressed to localhost, from allowed origins
  (the dashboard by default), and with JSON bodies on `POST`, since the chat
  agent can edit files.
- The verifier now includes new untracked files in scope checks and ignores
  IntentGuard's own files. Related tests are also found in top-level `test/`,
  `tests/`, `__tests__/`, and `spec/` folders.
- The watsonx spec-drafting provider calls watsonx for real instead of
  returning a placeholder. An explicit `llmProvider` in `.intent/config.json`
  now wins over detected credentials, and `your-...` placeholder values count
  as unset.
- IntentGuard's `.env` is loaded automatically by the chat, API server, and
  MCP server.
- `intent_questions` asks about the spec's own weak spots (an objective that
  restates the request, unmeasurable outcomes by name, one-sided scope, files
  the evidence points at) instead of fixed template text, and now covers
  constraints and health metrics.
- `intent_check_scope` also refuses edits while the spec is below the
  readiness threshold, refuses `.intent/` and paths outside the repository,
  and accepts absolute paths (as Claude Code passes them).
- `intent_readiness` uses the threshold from `.intent/config.json` instead of
  a fixed 70.
- Evidence gathering and verification work in folders that are not git
  repositories (previously `intent_create` failed there).

- Repository layout now mirrors the three surfaces: `frontend/` (Next.js
  dashboard), `backend/` (`core`, `server`, `cli`), and `mcp/` (MCP stdio
  server). Package names are unchanged, so `pnpm --filter` commands still work.
- Generated agent configs launch the local build with `node` instead of
  `npx @intentguard/mcp-server`. IntentGuard is local-only, and on Windows
  agents spawn MCP servers without a shell, where `npx` fails with `ENOENT`.
- `SpecStore.save` and `SpecStore.saveReport` return what was written along
  with the list of redactions.

## [0.1.0] - 2026-09-26

### Added

- Eight-part IntentSpec schema, six-gate readiness scorer, glob scope fence,
  verifier, spec store, question generator, and LLM providers (watsonx, Ollama,
  rule-based fallback) in `@intentguard/core`.
- MCP stdio server exposing the eight `intent_*` tools.
- Local HTTP API (Hono, port 3848) over the core engine.
- `intent` CLI: `init`, `new`, `check`, `verify`, `report`, `commit`,
  `agents setup`.
- Single agent registry generating MCP config and rule files for Claude Code,
  Cursor, OpenAI Codex, and IBM Bob 2.0.
- Next.js dashboard on mock data.
