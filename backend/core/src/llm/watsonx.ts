import type { IntentSpec, GatheredEvidence } from '../schema/intentspec.js';
import type { LLMProvider } from './provider.js';
import { buildDraftPrompt } from './templates.js';

export class WatsonxProvider implements LLMProvider {
  name = 'watsonx';

  async draft(request: string, context: GatheredEvidence): Promise<Partial<IntentSpec>> {
    const prompt = buildDraftPrompt(request, context);
    const apiKey = process.env.WATSONX_API_KEY;
    const projectId = process.env.WATSONX_PROJECT_ID;

    if (!apiKey || !projectId) {
      throw new Error('Watsonx credentials missing');
    }

    // Dummy implementation for fetch since we don't have real endpoint
    // In real app, this would use the standard watsonx API
    return {
      objective: request,
      status: 'draft',
      outcomes: ['Auto-generated outcome']
    };
  }
}
