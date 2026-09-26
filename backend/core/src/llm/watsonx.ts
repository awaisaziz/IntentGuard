import type { IntentSpec, GatheredEvidence, EdgeCase } from '../schema/intentspec.js';
import type { LLMProvider } from './provider.js';
import { buildDraftPrompt } from './templates.js';
import { WatsonxChatModel } from './watsonx-client.js';

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map(s => s.trim()) : [];

/**
 * Pulls the first JSON object out of a model reply (tolerates code fences and prose).
 * @returns The parsed object, or undefined
 */
export function parseJsonObject(text: string): Record<string, unknown> | undefined {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;
  try {
    const value = JSON.parse(text.slice(start, end + 1));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Keeps only well-formed IntentSpec fields from an LLM draft. */
export function sanitizeDraft(raw: Record<string, unknown>): Partial<IntentSpec> {
  const draft: Partial<IntentSpec> = {};
  if (typeof raw.objective === 'string' && raw.objective.trim()) draft.objective = raw.objective.trim();
  if (typeof raw.userGoal === 'string' && raw.userGoal.trim()) draft.userGoal = raw.userGoal.trim();
  for (const key of ['outcomes', 'constraints', 'healthMetrics', 'verification'] as const) {
    const list = strings(raw[key]);
    if (list.length) draft[key] = list;
  }
  const scope = raw.scope as { inScope?: unknown; outOfScope?: unknown } | undefined;
  if (scope && typeof scope === 'object') {
    draft.scope = { inScope: strings(scope.inScope), outOfScope: strings(scope.outOfScope) };
  }
  if (Array.isArray(raw.edgeCases)) {
    const cases = raw.edgeCases
      .map(e => (typeof e === 'string' ? { scenario: e, expectedBehavior: 'To be defined' } : (e as EdgeCase)))
      .filter(e => e && typeof e.scenario === 'string' && typeof e.expectedBehavior === 'string');
    if (cases.length) draft.edgeCases = cases;
  }
  return draft;
}

export class WatsonxProvider implements LLMProvider {
  name = 'watsonx';

  async draft(request: string, context: GatheredEvidence): Promise<Partial<IntentSpec>> {
    const model = WatsonxChatModel.fromEnv();
    const res = await model.chat(
      [
        {
          role: 'system',
          content:
            'You draft IntentSpecs for software changes. Reply with one JSON object only, with keys: ' +
            'objective (string), outcomes (string[] of observable, testable results), constraints (string[]), ' +
            'scope ({ inScope: string[], outOfScope: string[] } as glob patterns relative to the repo root), ' +
            'edgeCases ({ scenario, expectedBehavior }[]), healthMetrics (string[]), verification (string[]). ' +
            'Never invent facts about the codebase; leave a list empty when the request does not say.',
        },
        { role: 'user', content: buildDraftPrompt(request, context) },
      ],
      undefined,
      { maxTokens: 1500 }
    );
    const parsed = parseJsonObject(res.message.content ?? '');
    if (!parsed) throw new Error('watsonx returned no JSON draft');
    return sanitizeDraft(parsed);
  }
}
