/**
 * Agent rule content. AGENTS.md is the shared rules file: Codex, Cursor, IBM Bob, and Antigravity
 * read it natively, and CLAUDE.md and GEMINI.md import it, so the lifecycle is written down once.
 */

export const AGENTS_RULES = `
# IntentGuard Agent Rules

You are working in a repository protected by IntentGuard — the local intent layer for AI coding agents.
The \`intent_*\` tools come from the "intentguard" MCP server.

> **Execution Lifecycle:**
> Request → Evidence → Clarify → IntentSpec → Readiness Gate → Code → Scope Check → Verify → Commit

## 1. Before Writing Code (Intent Engineering)
- For every change request, call \`intent_create\` with the developer's request, word for word, to start the IntentSpec.
- Call \`intent_gather_evidence\`, then read the relevant code yourself to find which files really need to change.
- Call \`intent_questions\`. Ask the developer the open questions (you may make them more specific using what you found in the code) and wait for the answers. **Never fill a gap with an assumption.**
- Record the answers and your findings with \`intent_update_spec\`: a concrete objective, measurable outcomes, scope as glob patterns relative to the repo root (\`inScope\` for files you will change, \`outOfScope\` for nearby areas that must not change), edge cases, constraints, health metrics, verification steps, and evidence.
- Call \`intent_readiness\` to run the 6 readiness gates.
  - **CRITICAL GATE**: If it does not return \`ready: true\`, you are **BLOCKED** from writing code. Ask about the blockers and update the spec again.
- Before coding, show the developer a short summary of the spec (objective, outcomes, scope) so they can correct it.

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

/** Gemini CLI loads GEMINI.md and expands `@./file.md` imports, so it shares AGENTS.md the same way. */
export const GEMINI_RULES = `
@./AGENTS.md
`;

export const BOB_RULES = `
# IBM Bob 2.0 + IntentGuard Integration Rules

You are IBM Bob 2.0 operating with the IntentGuard local intent layer. Follow the lifecycle in AGENTS.md, and use your parallel subagent architecture to execute it with maximum rigor.

## Subagent Role Matrix
- **Repo Scout**: Call \`intent_gather_evidence\` in parallel across affected modules.
- **Docs Reader**: Inspect API docs and READMEs for constraints to anchor in the IntentSpec.
- **Risk Critic**: Call \`intent_questions\`, ask the developer the open questions, and record the answers with \`intent_update_spec\`.
- **Judge Subagent**: Call \`intent_readiness\` and verify all 6 gates pass before triggering Builder.
- **Builder Subagent**: Guard each file change with \`intent_check_scope\`. Fenced by Scope.
- **Verifier Subagent**: Call \`intent_verify\` and \`intent_report\` to generate the Proof Report.

## Mandatory Pipeline
1. Draft: \`intent_create\`
2. Evidence: \`intent_gather_evidence\`
3. Clarify: \`intent_questions\` → ask the developer → \`intent_update_spec\`
4. Gate: \`intent_readiness\` (must return ready: true)
5. Build: \`intent_check_scope\` on every file
6. Proof: \`intent_verify\` & \`intent_report\`

MCP tools are available in Bob's **Advanced** mode.
`;
