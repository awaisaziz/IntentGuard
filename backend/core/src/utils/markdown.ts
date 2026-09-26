import type { IntentSpec, ReadinessScore, ProofReport } from '../schema/intentspec.js';

export function specToMarkdown(spec: IntentSpec): string {
  return `# IntentSpec: ${spec.id}
Status: **${spec.status}**

## Objective
${spec.objective}

## Outcomes
${spec.outcomes.map(o => `- ${o}`).join('\n')}

## Scope
**In Scope:**
${spec.scope?.inScope?.map(s => `- ${s}`).join('\n') || 'None defined'}

**Out of Scope:**
${spec.scope?.outOfScope?.map(s => `- ${s}`).join('\n') || 'None defined'}

## Edge Cases
${spec.edgeCases?.map(e => `- **${e.scenario}**: ${e.expectedBehavior}`).join('\n') || 'None defined'}
`;
}

export function readinessToMarkdown(score: ReadinessScore): string {
  return `## Readiness Score: ${score.score}
Ready: ${score.ready ? 'Yes' : 'No'}

### Gates:
${score.gates.map(g => `- [${g.status.toUpperCase()}] ${g.name}: ${g.message}`).join('\n')}
`;
}

export function proofReportToMarkdown(report: ProofReport): string {
  return `# Proof Report for ${report.specId}
Status: ${report.commitReady ? 'Ready for Commit' : 'Verification Failed'}
Summary: ${report.summary}

## Scope Violations
${report.verification.scopeViolations.map(v => `- ${v}`).join('\n') || 'None'}
`;
}
