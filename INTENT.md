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
| Score readiness | `intent_readiness` | `GET /api/specs/:id/readiness` | `intent check [id]` |
| Read the working brief | `intent_get_spec` | `GET /api/specs/:id` | |
| Check a file before editing | `intent_check_scope` | `POST /api/specs/:id/scope-check` | |
| Verify the diff | `intent_verify` | `POST /api/specs/:id/verify` | `intent verify [id]` |
| Produce the proof report | `intent_report` | `GET /api/specs/:id/report` | `intent report [id]` |
| Commit with a spec reference | | | `intent commit [id]` |

When no spec ID is given, the **active spec** (`.intent/active.json`) is used. Drafting a spec makes it active.

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

Before editing any file, the agent calls `intent_check_scope` with the path:

1. A match against any `outOfScope` glob → **BLOCKED**, whatever `inScope` says.
2. No `inScope` patterns defined → allowed.
3. A match against an `inScope` glob → allowed.
4. Otherwise → **BLOCKED**.

The agent must not edit a blocked file. If a blocked file genuinely needs to change, the spec's scope is updated first, with the developer's agreement.

## Verification and Proof

`intent_verify` compares staged and modified files against the scope fence, finds related tests, maps outcomes to them, and lists health metrics. It writes a **Proof Report** to `.intent/reports/<id>-report.json`. The report is `commitReady` only when there are no scope violations and every outcome maps to a passing check.

Current limitations, which the proof report should not hide:

- Related tests are found by file name only (`name.test.ts`, `name.spec.ts`, `__tests__/`), and are not executed yet.
- Outcomes are mapped to tests heuristically.
- Health metrics are reported as `unknown` and need manual review.

## Privacy

Specs and proof reports are committed, so they must never carry personal data or credentials. On save, the spec store (`backend/core/src/privacy/`) replaces email addresses, phone numbers, API tokens, private keys, payment card numbers, and local user paths with neutral markers, and rewrites the repository root and home directory as `<repo>` and `~`. Evidence should cite a source by identifier (ticket number, dashboard, file path) rather than quote a person's contact details. The switches are `privacy.redactSpecs` and `privacy.redactReports` in `.intent/config.json`, both on by default.

## Rules for Agents

- Never write code before `intent_readiness` reports `ready: true`.
- Call `intent_check_scope` before every file edit, and respect **BLOCKED**.
- Never declare work complete without a passing proof report from `intent_report`.
- Ask the developer when `intent_questions` returns critical gaps. Do not fill them with assumptions.
