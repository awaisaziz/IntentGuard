import type { IntentSpec, GatheredEvidence } from '../schema/intentspec.js';
import type { LLMProvider } from './provider.js';
import { buildDraftPrompt } from './templates.js';
import { OpenAIChatModel } from './openai-client.js';
import { parseJsonObject, sanitizeDraft } from './watsonx.js';

/** Drafts IntentSpecs with OpenAI. */
export class OpenAIProvider implements LLMProvider {
  name = 'openai';

  async draft(request: string, context: GatheredEvidence): Promise<Partial<IntentSpec>> {
    const model = OpenAIChatModel.fromEnv();
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
      { maxTokens: 2000 }
    );
    const parsed = parseJsonObject(res.message.content ?? '');
    if (!parsed) throw new Error('OpenAI returned no JSON draft');
    return sanitizeDraft(parsed);
  }
}
