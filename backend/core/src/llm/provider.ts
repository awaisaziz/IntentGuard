import type { IntentSpec, GatheredEvidence, IntentConfig } from '../schema/intentspec.js';
import { WatsonxProvider } from './watsonx.js';
import { OllamaProvider } from './ollama.js';

export interface LLMProvider {
  name: string;
  draft(request: string, context: GatheredEvidence): Promise<Partial<IntentSpec>>;
}

class FallbackProvider implements LLMProvider {
  name = 'fallback';
  async draft(request: string, context: GatheredEvidence): Promise<Partial<IntentSpec>> {
    return {
      objective: request,
      status: 'draft',
      outcomes: [],
      scope: { inScope: context.affectedFiles, outOfScope: [] },
    };
  }
}

export function resolveProvider(config: IntentConfig): LLMProvider {
  if (config.llmProvider === 'watsonx' || process.env.WATSONX_API_KEY) {
    return new WatsonxProvider();
  }
  if (config.llmProvider === 'ollama') {
    return new OllamaProvider();
  }
  return new FallbackProvider();
}
