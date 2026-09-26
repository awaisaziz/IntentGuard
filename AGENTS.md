# AGENTS.md

Guide for any AI coding agent (Claude Code, Cursor, Codex, IBM Bob) working in this repository.

- **What we are building:** see [PRD.md](PRD.md).
- **How intent is captured, gated, and proved:** see [INTENT.md](INTENT.md).
- **Setup, change flow, and privacy rules for contributors:** see [CONTRIBUTING.md](CONTRIBUTING.md).

## Current Focus

This stage covers the **backend and the MCP connector** only: `backend/core`, `backend/server`, `backend/cli`, and `mcp`.
**Do not change `frontend/`** (dashboard UI) unless the developer explicitly asks for it. It still runs on mock data.

## Repository Layout

| Path | Purpose |
|---|---|
| `frontend/` | Next.js dashboard, `@intentguard/web` (out of scope for now) |
| `backend/core` | All domain logic: IntentSpec schema, readiness gates, scope fence, verifier, spec store, privacy redactor, LLM providers, agent registry |
| `backend/server` | HTTP API (Hono) over `core`, default port `3848` |
| `backend/cli` | The `intent` command |
| `mcp/` | MCP stdio server exposing the 8 `intent_*` tools, `@intentguard/mcp-server` |
| `scripts/` | `check-pii.mjs` (PII/secret tripwire) and `setup-hooks.mjs` |
| `.githooks/` | Versioned git hooks; `pre-commit` runs the tripwire on staged lines |
| `.github/` | CI: privacy scan, build, tests |
| `.intent/` | Specs, proof reports, and `config.json` (`active.json` is local state and git-ignored) |

## Commands

```bash
pnpm install          # install workspace dependencies and enable git hooks
pnpm build            # build every package (core builds first)
pnpm test             # vitest for core and server
pnpm dev:server       # run the API with reload on http://localhost:3848/api
pnpm agents:setup     # regenerate agent MCP configs and rule blocks
pnpm check:pii        # scan every tracked file for PII, secrets, and forbidden files
```

## Conventions

- ESM throughout. Relative imports in TypeScript use the `.js` suffix (`import { x } from './y.js'`).
- Logic belongs in `core`. The server, MCP server, and CLI stay thin wrappers that call `core`, so every entry point behaves the same (for example `draftSpec` is shared by all three).
- Add or update Vitest tests next to the package you change (`backend/<pkg>/test`).
- Agent integrations are defined once in `backend/core/src/agents/`. Never hand-edit `.mcp.json`, `.cursor/`, `.codex/`, or `.bob/`: they are generated and git-ignored.
- Never commit secrets, absolute local paths, or personal data. Configuration comes from environment variables (`WATSONX_API_KEY`, `INTENT_ROOT`, `INTENTGUARD_API_PORT`). The pre-commit hook and CI run `scripts/check-pii.mjs`; fix a finding rather than bypassing it, and mark a genuine false positive with `pii:allow` on that line.
- Specs and proof reports are redacted on save by `backend/core/src/privacy/`. Write evidence that cites a ticket ID or file rather than a person's contact details.

<!-- intentguard:start (managed by `intent agents setup`, edits inside are overwritten) -->
# IntentGuard Agent Rules

You are working in a repository protected by IntentGuard — the local intent layer for AI coding agents.

> **Execution Lifecycle:**
> Request → Evidence → Clarify → IntentSpec → Readiness Gate → Code → Scope Check → Verify → Commit

## 1. Before Writing Code (Intent Engineering)
- Call `intent_create` with the raw developer request to initialize the IntentSpec.
- Call `intent_gather_evidence` to inspect affected files, related tests, and docs.
- Call `intent_questions` to identify any missing specifications or ambiguities.
- Call `intent_readiness` to run the 6 readiness gates.
  - **CRITICAL GATE**: If readiness score < 70, you are **BLOCKED** from writing code. Address the blockers first.

## 2. While Coding (Scope Fence)
- Before editing ANY file, call `intent_check_scope` with the file path.
- If `intent_check_scope` returns **BLOCKED**, you **MUST NOT** edit that file. Respect the Scope fence.

## 3. After Coding (Proof & Verification)
- Call `intent_verify` to evaluate git diff against Scope and run tests mapped to Outcomes and Health Metrics.
- Call `intent_report` to generate the formal Proof Report.
- Never declare work complete without a passing IntentGuard proof report.
<!-- intentguard:end -->
