# INTENT.md: How IntentGuard Captures, Gates, and Proves Intent

IntentGuard follows the **judgment-under-evidence** view of intent engineering (credit: Pathmode's framework and its eight-part IntentSpec). Before code is written it asks:

- Are we solving the right problem?
- What evidence supports the change?
- What assumptions and trade-offs are being made?
- What outcomes must improve?
- What must not get worse?

The answers are recorded as an **IntentSpec**. The spec is both the **execution brief** for the coding agent and the **review contract** for the pull request.

## Lifecycle

```
Request → Evidence → Clarify → IntentSpec → Readiness Gate → Code → Scope Check → Verify → Commit
```

| Step | MCP tool | HTTP API | CLI |
|---|---|---|---|
| Draft a spec from the raw request | `intent_create` | `POST /api/specs` | `intent new "<request>"` |
| Gather repo evidence | `intent_gather_evidence` | (included in draft) | (included in `new`) |
| Surface open questions | `intent_questions` | `GET /api/specs/:id/questions` | |
| Record the developer's answers | `intent_update_spec` | | |
| Score readiness | `intent_readiness` | `GET /api/specs/:id/readiness` | `intent check [id]` |
| Read the working brief | `intent_get_spec` | `GET /api/specs/:id` | |
| Check a file before editing | `intent_check_scope` | `POST /api/specs/:id/scope-check` | |
| Verify the diff | `intent_verify` | `POST /api/specs/:id/verify` | `intent verify [id]` |
| Produce the proof report | `intent_report` | `GET /api/specs/:id/report` | `intent report [id]` |
| Commit with a spec reference | | | `intent commit [id]` |

When no spec ID is given, the **active spec** (`.intent/active.json`) is used. Drafting a spec makes it active.

External agents (Claude Code, IBM Bob, Codex, Gemini CLI, Cursor) reach these steps through the MCP tools after `intent connect`. The built-in chat agent follows the same lifecycle with the fence enforced in code; see [The Chat Agent Harness](#the-chat-agent-harness).

## The Eight-Part IntentSpec

| # | Section | Field | Question it answers |
|---|---|---|---|
| 1 | Objective | `objective` | What problem are we solving, and why does it matter? |
| 2 | Outcomes | `outcomes[]` | What observable, testable changes should happen? |
| 3 | Evidence | `evidence[]` | What user signals, metrics, docs, or repo facts support the decision? |
| 4 | Constraints | `constraints[]` | What hard boundaries must be respected? |
| 5 | Scope | `scope.inScope[]`, `scope.outOfScope[]` | What may change, and what must stay untouched? (glob patterns) |
| 6 | Edge Cases | `edgeCases[]` (`scenario`, `expectedBehavior`) | Which boundary conditions and failures must be handled? |
| 7 | Health Metrics | `healthMetrics[]` | What must not degrade because of the change? |
| 8 | Verification | `verification[]` | How will we prove the outcome was achieved? |

The full schema is in `backend/core/src/schema/intentspec.ts`. Specs are stored as `.intent/specs/<id>.json`, with a Markdown rendering alongside.

Evidence items carry a `type` (`friction`, `quote`, `observation`, `metric`, `request`) and an optional `trust` level (`high`, `medium`, `low`).

**Status progression:** `draft` → `validated` → `approved` → `shipped` → `verified`.

## Readiness Gate

Six weighted gates produce a score from 0 to 100. A gate that passes adds its full weight, a warning adds half, and a failure adds nothing and is listed as a blocker.

| Gate | Weight | Pass | Warn |
|---|---|---|---|
| Objective Clarity | 20 | Objective longer than 20 characters | Objective present but short |
| Outcome Measurability | 20 | Every outcome is specific (over 10 characters) | Only some outcomes are specific |
| Evidence Presence | 15 | At least one evidence item | |
| Scope Definition | 15 | Both in-scope and out-of-scope patterns set | Only one side set |
| Edge Case Coverage | 15 | At least one edge case | |
| Verification Criteria | 15 | At least one verification step | |

**Coding is blocked while the score is below the threshold** (`readinessThreshold` in `.intent/config.json`, default `70`).

## Scope Fence

Before editing any file, the agent calls `intent_check_scope` with the path (absolute or repo-relative). It answers **BLOCKED** when the file is outside the repository, is IntentGuard state (`.intent/`), there is no active spec, or the spec has not passed the readiness gate. Otherwise the scope rules decide:

1. A match against any `outOfScope` glob → **BLOCKED**, whatever `inScope` says.
2. No `inScope` patterns defined → allowed.
3. A match against an `inScope` glob → allowed.
4. Otherwise → **BLOCKED**.

The agent must not edit a blocked file. If a blocked file genuinely needs to change, the spec's scope is updated first, with the developer's agreement.

## Clarifying Questions

`intent_questions` turns whatever the spec is missing into questions for the developer, most critical first, and quotes the spec's own weak spots. Examples: an objective that only restates the request, outcomes with nothing observable to test, a scope that allows files but protects nothing, or files the evidence points at. The agent asks them (making them more specific from what it read in the code), waits for the answers, and records them with `intent_update_spec`. Readiness is re-scored after every update, and changing an approved spec sends it back to draft.

Over MCP this is cooperative: the tools answer BLOCKED and the rules tell the agent to stop, but the agent's own edit tool is not intercepted. The chat agent enforces the same gate in code (see below), adding a required developer approval.

## Verification and Proof

`intent_verify` compares every changed file (staged, modified, and new untracked files) against the scope fence, finds related tests, maps outcomes to them, and lists health metrics. IntentGuard's own files (`.intent/`, generated agent configs and rules) never count as changes. It writes a **Proof Report** to `.intent/reports/<id>-report.json`. The report is `commitReady` only when there are no scope violations and every outcome maps to a passing check.

In the chat agent, verification also runs the repository's configured `test` check (`commands.test` in `.intent/config.json`). A failing run makes the report not commit-ready and marks mapped outcomes as failed.

Current limitations, which the proof report should not hide:

- Related tests are found by file name (`name.test.ts`, `name.spec.ts`, `test_name.py`, next to the file, in `__tests__/`, or in a top-level `test/`, `tests/`, `spec/` folder). Only the chat agent executes tests.
- Outcomes are mapped to tests heuristically.
- Health metrics are reported as `unknown` and need manual review.

## The Chat Agent Harness

`intent chat` and the dashboard's `/chat` page run a watsonx coding agent whose only access to the repository is through IntentGuard's tools. The lifecycle above is enforced in code, not left to the prompt. Every `edit_file` / `write_file` passes this fence, in order:

1. **An active spec exists**, otherwise `BLOCKED (no-spec)`.
2. **Readiness ≥ threshold**, otherwise `BLOCKED (not-ready)` with the failing gates.
3. **The developer approved the spec** with `/approve` or the Approve button, otherwise `BLOCKED (not-approved)`. The model has no tool that approves, and any `intent_update_spec` after approval resets the spec to `draft`, so widening its own scope sends the agent back to the developer.
4. **The file is inside the approved scope**, otherwise `BLOCKED (out-of-scope)`.

In both modes, the agent cannot read `.env` files or keys, leave the repository, or edit `.git/`, `node_modules/`, or `.intent/` directly. It can only run checks listed by name under `commands` in `.intent/config.json`.

**Baseline mode** (`--no-harness`, or Baseline in the web UI) keeps the same model and file tools but removes the fence and the intent tools. It still measures every write against the active spec, so its *out-of-scope writes* metric shows the drift the harness would have blocked. Each session writes metrics to `.intent/runs/<run>.json` (local, never committed) for A/B comparison.

## Privacy

Specs and proof reports are committed, so they must never carry personal data or credentials. On save, the spec store (`backend/core/src/privacy/`) replaces email addresses, phone numbers, API tokens, private keys, payment card numbers, and local user paths with neutral markers, and rewrites the repository root and home directory as `<repo>` and `~`. Evidence should cite a source by identifier (ticket number, dashboard, file path) rather than quote a person's contact details. The switches are `privacy.redactSpecs` and `privacy.redactReports` in `.intent/config.json`, both on by default.

## Rules for Agents

- Never write code before `intent_readiness` reports `ready: true`.
- Call `intent_check_scope` before every file edit, and respect **BLOCKED**.
- Never declare work complete without a passing proof report from `intent_report`.
- Ask the developer when `intent_questions` returns critical gaps. Do not fill them with assumptions.
