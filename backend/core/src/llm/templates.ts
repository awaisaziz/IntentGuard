import type { IntentSpec, GatheredEvidence } from '../schema/intentspec.js';

export function buildDraftPrompt(request: string, evidence: GatheredEvidence): string {
  return `
You are an expert AI software architect. Based on the user request and gathered evidence, draft an IntentSpec.
An IntentSpec is a JSON structure defining the exact intent for an AI coding agent.

User Request:
${request}

Evidence Context:
Affected files: ${evidence.affectedFiles.join(', ')}
Related tests: ${evidence.relatedTests.join(', ')}

Output valid JSON matching the IntentSpec schema exactly.
  `;
}

export function buildQuestionsPrompt(spec: IntentSpec): string {
  return `
Analyze the following IntentSpec and ask insightful questions to clarify vague areas or missing edge cases.
Spec:
${JSON.stringify(spec, null, 2)}
  `;
}
