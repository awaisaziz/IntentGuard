# IntentGuard: Product Requirements Document

**Status:** Draft · **Stage:** Backend + MCP connector · **Context:** IBM Bob 2.0 Hackathon

> **From vague ticket to verified PR, with proof it solved the right problem.**

## 1. Summary

IntentGuard adds an **intent-engineering layer** to the issue-to-PR maintenance workflow. Before code is written, it turns a vague request into a repo-grounded **IntentSpec** and blocks execution until the spec is ready. Before code is merged, it checks the change against that spec and produces a **proof report**.

IntentGuard is not another coding assistant. It plugs into the agents developers already use (IBM Bob 2.0, Claude Code, Cursor, Codex) through MCP, a CLI, and an HTTP API.

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
5. Work with any MCP-capable agent from one shared definition.

**Non-goals (this stage)**

- Frontend dashboard work. `frontend/` stays as-is on mock data.
- Hosting, multi-user access, or authentication. IntentGuard runs locally against one repo.
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
| C-7 | Verifier that checks the git diff against scope and maps outcomes to tests | Partial: tests are found by name but not executed |
| C-8 | Health metric checks | Not started: reported as `unknown` |
| C-9 | Repo evidence gathering: changed files, related tests, docs, current behavior | Partial: docs and behavior are placeholders |

### 5.2 MCP connector (`mcp/`)

| ID | Requirement | Status |
|---|---|---|
| M-1 | Stdio MCP server exposing `intent_create`, `intent_gather_evidence`, `intent_questions`, `intent_readiness`, `intent_get_spec`, `intent_check_scope`, `intent_verify`, `intent_report` | Done |
| M-2 | Resolve the project root from `INTENT_ROOT` or the git top level | Done |
| M-3 | Publish `@intentguard/mcp-server` so `npx` works outside this repo | Not started |

### 5.3 Agent integrations (`backend/core/src/agents`, CLI)

| ID | Requirement | Status |
|---|---|---|
| A-1 | Single registry defining each agent's MCP config path, format, and rule files | Done |
| A-2 | `intent agents setup` writes configs for Claude Code (`.mcp.json`), Cursor (`.cursor/mcp.json`), Codex (`.codex/config.toml`), and Bob (`.bob/mcp.json`) | Done |
| A-3 | Rule files update only a managed block and keep hand-written content | Done |
| A-4 | Generated configs contain no absolute paths or personal data | Done |

### 5.4 HTTP API (`backend/server`)

| ID | Requirement | Status |
|---|---|---|
| S-1 | REST endpoints for specs, readiness, questions, scope checks, verification, reports, config, and agent status | Done |
| S-2 | Bind to localhost only, and reject path-like spec IDs | Done |
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

1. Execute mapped tests during verification, and map outcomes to specific tests (C-7).
2. Real evidence gathering from docs and code structure (C-9).
3. Health metric checks backed by commands defined in the spec (C-8).
4. Spec editing and status transitions over the API (S-3).
5. Publish the MCP server and CLI packages (M-3).
6. After that: connect the web dashboard to the API.

## 10. Open Questions

- Should the readiness threshold be enforced by default in CI (for example `intent check` failing the build)?
- Where do health metric checks come from: spec-defined commands, repo scripts, or both?
- Should IntentGuard read GitHub issues directly as the raw request source?
