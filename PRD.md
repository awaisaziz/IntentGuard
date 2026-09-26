# IntentGuard: Product Requirements Document

**Status:** Draft · **Stage:** Backend + MCP connector · **Context:** IBM Bob 2.0 Hackathon

> **From vague ticket to verified PR, with proof it solved the right problem.**

## 1. Summary

IntentGuard adds an **intent-engineering layer** to the issue-to-PR maintenance workflow. Before code is written, it turns a vague request into a repo-grounded **IntentSpec** and blocks execution until the spec is ready. Before code is merged, it checks the change against that spec and produces a **proof report**.

IntentGuard is not another coding assistant. It plugs into the agents developers already use (IBM Bob 2.0, Claude Code, Codex, Gemini CLI, Cursor) through MCP, a CLI, and an HTTP API, and ships a watsonx chat agent that can run with or without the intent layer to show the difference.

## 2. Problem

- Tickets are vague ("improve search", "fix booking flow") and written for people who share context.
- AI coding agents fill the gaps with assumptions, touch files outside scope, and miss edge cases.
- Reviewers have no contract to check the PR against, so review turns into rediscovering intent.
- The result is extra review rounds, regressions, and rework that cancel out the speed gained from AI coding.

## 3. Users

| User | Need |
|---|---|
| **Developer** driving an AI agent | Turn a ticket into a clear brief, and keep the agent inside it |
| **AI coding agent** | Machine-readable scope, readiness, and verification it can call as tools |
| **Reviewer / maintainer** | A contract to review the PR against, plus proof the outcomes were met |

## 4. Goals and Non-Goals

**Goals**

1. Capture every change as an eight-part IntentSpec grounded in repository evidence.
2. Block coding until the spec clears the readiness gate (score ≥ threshold, default 70).
3. Stop out-of-scope edits at the moment they are attempted.
4. Produce a proof report that maps outcomes and health metrics to checks.
5. Work with any MCP-capable agent from one shared definition, in any local repository.
6. Show the improvement: run the same request with and without the intent layer and compare the results.

**Non-goals (this stage)**

- Dashboard work beyond the chat page. The other `frontend/` pages stay as-is on mock data.
- Hosting, deployment, multi-user access, or authentication. IntentGuard runs and is tested locally against one repo.
- Publishing packages to npm or any other registry. Everything runs from the local workspace build.
- Replacing the coding agent or the repo's own test runner.

## 5. Functional Requirements

### 5.1 IntentSpec engine (`backend/core`)

| ID | Requirement | Status |
|---|---|---|
| C-1 | Eight-part IntentSpec schema with validation | Done |
| C-2 | Spec store under `.intent/` (specs, reports, active spec, config) | Done |
| C-3 | Draft a spec from a raw request using watsonx, Ollama, or a rule-based fallback | Done |
| C-4 | Six-gate readiness scorer with configurable threshold | Done |
| C-5 | Open-question generator for missing sections | Done |
| C-6 | Glob-based scope fence (`outOfScope` wins over `inScope`) | Done |
| C-7 | Verifier that checks the git diff (including new, untracked files) against scope and maps outcomes to tests | Partial: tests are found by name (next to the file or in `test/`, `tests/`, `__tests__/`, `spec/`); the chat agent also runs the configured `test` check, but outcomes are not yet mapped to individual tests |
| C-8 | Health metric checks | Not started: reported as `unknown` |
| C-9 | Repo evidence gathering: changed files, related tests, docs, current behavior | Partial: docs and behavior are placeholders |

### 5.2 MCP connector (`mcp/`)

| ID | Requirement | Status |
|---|---|---|
| M-1 | Stdio MCP server exposing `intent_create`, `intent_gather_evidence`, `intent_questions`, `intent_update_spec`, `intent_readiness`, `intent_get_spec`, `intent_check_scope`, `intent_verify`, `intent_report`, plus server instructions describing the lifecycle | Done |
| M-4 | Clarify loop over MCP: spec-specific questions, answers recorded with `intent_update_spec`, readiness re-scored | Done |
| M-5 | `intent_check_scope` gates on readiness as well as scope, and accepts absolute paths | Done |
| M-2 | Resolve the project root from `INTENT_ROOT` or the git top level | Done |
| M-3 | Agents launch the local build with `node <IntentGuard>/mcp/dist/index.js` and `INTENT_ROOT`, which works on Windows (no shell) and in IDE agents that do not start servers in the project folder | Done |

### 5.3 Agent integrations (`backend/core/src/agents`, CLI)

| ID | Requirement | Status |
|---|---|---|
| A-1 | Single registry defining each agent's MCP config path, format, and rule files | Done |
| A-2 | Configs for Claude Code (`.mcp.json`), IBM Bob IDE and Bob Shell (`.bob/mcp.json`, rules in `.bob/rules/`), Codex (`.codex/config.toml`), Gemini CLI (`.gemini/settings.json`, `GEMINI.md`), Google Antigravity (`.agents/mcp_config.json`), and Cursor (`.cursor/mcp.json`) | Done |
| A-3 | Rule files update only a managed block and keep hand-written content | Done |
| A-4 | Machine-specific configs never reach git: git-ignored here, listed in `.git/info/exclude` in connected repos, and a warning when one is already tracked | Done |
| A-5 | `intent connect <repo>` wires any local repository: `.intent/` setup with detected checks, MCP configs, rules | Done |
| A-6 | Hard enforcement through agent hooks (Claude Code and Bob `PreToolUse` blocking out-of-scope edits) | Not started |

### 5.4 HTTP API (`backend/server`)

| ID | Requirement | Status |
|---|---|---|
| S-1 | REST endpoints for specs, readiness, questions, scope checks, verification, reports, config, and agent status | Done |
| S-2 | Bind to localhost only, and reject path-like spec IDs | Done |
| S-4 | Chat sessions with server-sent events; only localhost hosts, the dashboard origin, and JSON posts are accepted | Done |
| S-3 | Spec editing (`PATCH /api/specs/:id`) and status transitions | Not started |

### 5.5 CLI (`backend/cli`)

| ID | Requirement | Status |
|---|---|---|
| L-1 | `init`, `new`, `check`, `verify`, `report`, `commit` | Done |
| L-2 | `commit` refuses to commit unless verification passes, and tags the message with `[intent:<id>]` | Done |

### 5.6 Privacy and repository hygiene (`backend/core/src/privacy`, `scripts/`, `.githooks/`, `.github/`)

| ID | Requirement | Status |
|---|---|---|
| P-1 | Local state, env files, private keys, and generated agent configs are git-ignored | Done |
| P-2 | A dependency-free tripwire refuses forbidden files and scans for emails, phone numbers, credentials, private keys, card numbers, and local user paths; it runs as a pre-commit hook and in CI | Done |
| P-3 | Specs and proof reports are redacted on save, and absolute paths are rewritten as `<repo>` or `~`; switches live under `privacy` in `.intent/config.json` | Done |
| P-4 | CI builds and tests on Node 20 and 22, checks the demo spec's readiness gate, and verifies generated agent configs stay clean | Done |

### 5.7 Chat agent (`backend/core/src/agent`, CLI, `frontend/` chat page)

| ID | Requirement | Status |
|---|---|---|
| H-1 | watsonx chat client with IAM auth and tool calling (default `ibm/granite-4-h-small`), recovering Granite's inline tool calls | Done |
| H-2 | Coding agent loop with repo tools (list, search, read, edit, write, run configured checks) and intent tools | Done |
| H-3 | Harness: edits need an active spec, readiness ≥ threshold, developer approval (no model tool can approve), and an in-scope path; changing the spec resets approval | Done |
| H-4 | Baseline mode (harness off) with the same model and tools, recording out-of-scope drift against the active spec | Done |
| H-5 | Workspace safety in both modes: no paths outside the repo, no secrets files, no direct edits to `.git/`, `node_modules/`, `.intent/` | Done |
| H-6 | Terminal chat (`intent chat`) and web chat (`/chat`) over a streaming API, with per-session metrics and local run logs | Done |
| H-7 | A/B scorecard command that compares two runs or branches and prints the demo table | Not started |

## 6. Agent Roles (IBM Bob 2.0 Mapping)

| Step | Bob feature | Role | IntentGuard tool |
|---|---|---|---|
| Evidence | Parallel subagents | **Repo Scout**, **Docs Reader**, **Test Mapper** | `intent_gather_evidence` |
| Evidence | Subagent | **Risk & Edge-Case Critic** | `intent_questions` |
| Judgment | Subagent | **Judge** (scores readiness, blocks execution) | `intent_readiness` |
| Implementation | Agent mode | **Builder** (fenced by Scope and Constraints) | `intent_get_spec`, `intent_check_scope` |
| Review | Subagent | **Intent Reviewer** (PR vs. IntentSpec) | `intent_verify` |
| Proof | Agent mode | **Verifier** (outcomes and health metrics to checks) | `intent_report` |

## 7. Success Metrics

The demo runs the same vague request on **IBM Galaxium Travels** twice: plain Bob (Run A) and Bob with IntentGuard (Run B).

| Metric | Target for Run B vs. Run A |
|---|---|
| Unstated assumptions made | Fewer |
| Files changed out of scope | Zero |
| Edge cases missed | Fewer |
| Tests broken (regressions) | Zero |
| Review / rework rounds | Fewer |
| Time to accepted PR | Lower, or equal with fewer defects |

## 8. Demo Script

1. Subagents gather evidence in parallel.
2. The Judge flags missing decisions and blocks execution until they are resolved.
3. The completed eight-part IntentSpec is shown.
4. Bob implements within Scope, and a blocked edit is refused.
5. The Intent Reviewer catches any drift.
6. The Verifier's proof report is shown.

## 9. Next Milestones

1. Hook-based hard enforcement for Claude Code and IBM Bob (A-6), so external agents cannot skip the scope check.
2. A/B scorecard over run logs and branches for the demo table (H-7).
3. Map outcomes to specific tests (C-7).
4. Real evidence gathering from docs and code structure (C-9).
5. Health metric checks backed by commands defined in the spec (C-8).
6. Spec editing and status transitions over the API (S-3).
7. After that: connect the remaining dashboard pages to the API.

## 10. Open Questions

- Should the readiness threshold be enforced by default in CI (for example `intent check` failing the build)?
- Where do health metric checks come from: spec-defined commands, repo scripts, or both?
- Should IntentGuard read GitHub issues directly as the raw request source?
