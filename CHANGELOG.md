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

### Changed

- Repository layout now mirrors the three surfaces: `frontend/` (Next.js
  dashboard), `backend/` (`core`, `server`, `cli`), and `mcp/` (MCP stdio
  server). Package names are unchanged, so `pnpm --filter` commands still work.
- The root workspace links `@intentguard/mcp-server`, so the generated
  `npx @intentguard/mcp-server` config resolves to the local build instead of
  the npm registry.
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
