/**
 * Agent rule content. AGENTS.md is the shared rules file: Codex and Cursor read it
 * natively, and CLAUDE.md imports it, so the lifecycle is written down exactly once.
 */

export const AGENTS_RULES = `
# IntentGuard Agent Rules

You are working in a repository protected by IntentGuard — the local intent layer for AI coding agents.

> **Execution Lifecycle:**
> Request → Evidence → Clarify → IntentSpec → Readiness Gate → Code → Scope Check → Verify → Commit

## 1. Before Writing Code (Intent Engineering)
- Call \`intent_create\` with the raw developer request to initialize the IntentSpec.
- Call \`intent_gather_evidence\` to inspect affected files, related tests, and docs.
- Call \`intent_questions\` to identify any missing specifications or ambiguities.
- Call \`intent_readiness\` to run the 6 readiness gates.
  - **CRITICAL GATE**: If readiness score < 70, you are **BLOCKED** from writing code. Address the blockers first.

## 2. While Coding (Scope Fence)
- Before editing ANY file, call \`intent_check_scope\` with the file path.
- If \`intent_check_scope\` returns **BLOCKED**, you **MUST NOT** edit that file. Respect the Scope fence.

## 3. After Coding (Proof & Verification)
- Call \`intent_verify\` to evaluate git diff against Scope and run tests mapped to Outcomes and Health Metrics.
- Call \`intent_report\` to generate the formal Proof Report.
- Never declare work complete without a passing IntentGuard proof report.
`;

/** Claude Code does not read AGENTS.md on its own, so CLAUDE.md just imports it. */
export const CLAUDE_RULES = `
@AGENTS.md
`;

export const BOB_RULES = `
# IBM Bob 2.0 + IntentGuard Integration Rules

You are IBM Bob 2.0 operating with the IntentGuard local intent layer. Follow the lifecycle in AGENTS.md, and use your parallel subagent architecture to execute it with maximum rigor.

## Subagent Role Matrix
- **Repo Scout**: Call \`intent_gather_evidence\` in parallel across affected modules.
- **Docs Reader**: Inspect API docs and READMEs for constraints to anchor in the IntentSpec.
- **Risk Critic**: Call \`intent_questions\` to challenge assumptions and surface edge cases.
- **Judge Subagent**: Call \`intent_readiness\` and verify all 6 gates pass before triggering Builder.
- **Builder Subagent**: Guard each file change with \`intent_check_scope\`. Fenced by Scope.
- **Verifier Subagent**: Call \`intent_verify\` and \`intent_report\` to generate the Proof Report.

## Mandatory Pipeline
1. Draft: \`intent_create\`
2. Evidence: \`intent_gather_evidence\`
3. Gate: \`intent_readiness\` (Must score >= 70)
4. Build: \`intent_check_scope\` on every file
5. Proof: \`intent_verify\` & \`intent_report\`
`;
