# AGENTS.md

Guide for any AI coding agent (Claude Code, IBM Bob, Codex, Gemini CLI, Google Antigravity, Cursor) working in this repository.

- **What we are building:** see [PRD.md](PRD.md).
- **How intent is captured, gated, and proved:** see [INTENT.md](INTENT.md).
- **Setup, change flow, and privacy rules for contributors:** see [CONTRIBUTING.md](CONTRIBUTING.md).

## Current Focus

This stage covers the **backend, the MCP connector, and the chat agent**: `backend/core`, `backend/server`, `backend/cli`, and `mcp`.
In `frontend/`, only the chat page (`frontend/src/app/chat`, `frontend/src/components/chat`, `frontend/src/lib/chat-client.ts`) is live. **Do not change the other dashboard pages** unless the developer explicitly asks; they still run on mock data.
IntentGuard runs locally only: nothing is published to npm or deployed.

## Repository Layout

| Path | Purpose |
|---|---|
| `frontend/` | Next.js dashboard, `@intentguard/web`; only `/chat` talks to the backend |
| `backend/core` | All domain logic: IntentSpec schema, readiness gates, scope fence, verifier, spec store, privacy redactor, LLM providers, agent registry, `connect` workflow |
| `backend/core/src/agent` | The chat agent: tool loop, fenced workspace, harness (spec → readiness → developer approval → scope) |
| `backend/core/src/llm` | Chat clients (OpenAI by default, watsonx optional), provider selection (`resolve.ts`), and spec-drafting providers |
| `backend/server` | HTTP API (Hono) over `core`, including the streaming chat endpoints, default port `3848` |
| `backend/cli` | The `intent` command (`connect`, `chat`, `check`, `verify`, ...) |
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
pnpm dev:server       # run the API with reload on http://localhost:3848/api (--repo <path> to guard another repo)
pnpm agents:setup     # regenerate agent MCP configs and rule blocks for this repo
pnpm connect <path>   # connect another local repository
pnpm chat             # chat agent in the terminal, OpenAI by default (--repo, --no-harness)
pnpm check:pii        # scan every tracked file for PII, secrets, and forbidden files
```

## Conventions

- ESM throughout. Relative imports in TypeScript use the `.js` suffix (`import { x } from './y.js'`).
- Logic belongs in `core`. The server, MCP server, and CLI stay thin wrappers that call `core`, so every entry point behaves the same (for example `draftSpec` is shared by all three).
- Add or update Vitest tests next to the package you change (`backend/<pkg>/test`).
- Agent integrations are defined once in `backend/core/src/agents/`. Never hand-edit `.mcp.json`, `.cursor/`, `.codex/`, `.bob/`, `.gemini/`, or `.agents/mcp_config.json`: they are generated, machine-specific, and git-ignored.
- The chat agent's guarantees live in code, not prompts: path confinement and secret refusal in `agent/workspace.ts`, the edit fence in `agent/tools.ts`. Keep them covered by `backend/core/test/agent.test.ts`.
- Never commit secrets, absolute local paths, or personal data. Configuration comes from environment variables (`OPENAI_API_KEY`, `INTENT_ROOT`, `INTENTGUARD_API_PORT`). The pre-commit hook and CI run `scripts/check-pii.mjs`; fix a finding rather than bypassing it, and mark a genuine false positive with `pii:allow` on that line.
- Specs and proof reports are redacted on save by `backend/core/src/privacy/`. Write evidence that cites a ticket ID or file rather than a person's contact details.

<!-- intentguard:start (managed by `intent connect`, edits inside are overwritten) -->
# IntentGuard Agent Rules

You are working in a repository protected by IntentGuard — the local intent layer for AI coding agents.
The `intent_*` tools come from the "intentguard" MCP server.

> **Execution Lifecycle:**
> Request → Evidence → Clarify → IntentSpec → Readiness Gate → Code → Scope Check → Verify → Commit

## 1. Before Writing Code (Intent Engineering)
- For every change request, call `intent_create` with the developer's request, word for word, to start the IntentSpec.
- Call `intent_gather_evidence`, then read the relevant code yourself to find which files really need to change.
- Call `intent_questions`. Ask the developer the open questions (you may make them more specific using what you found in the code) and wait for the answers. **Never fill a gap with an assumption.**
- Record the answers and your findings with `intent_update_spec`: a concrete objective, measurable outcomes, scope as glob patterns relative to the repo root (`inScope` for files you will change, `outOfScope` for nearby areas that must not change), edge cases, constraints, health metrics, verification steps, and evidence.
- Call `intent_readiness` to run the 6 readiness gates.
  - **CRITICAL GATE**: If it does not return `ready: true`, you are **BLOCKED** from writing code. Ask about the blockers and update the spec again.
- Before coding, show the developer a short summary of the spec (objective, outcomes, scope) so they can correct it.

## 2. While Coding (Scope Fence)
- Before editing ANY file, call `intent_check_scope` with the file path.
- If `intent_check_scope` returns **BLOCKED**, you **MUST NOT** edit that file. Respect the Scope fence.

## 3. After Coding (Proof & Verification)
- Call `intent_verify` to evaluate git diff against Scope and run tests mapped to Outcomes and Health Metrics.
- Call `intent_report` to generate the formal Proof Report.
- Never declare work complete without a passing IntentGuard proof report.
<!-- intentguard:end -->
