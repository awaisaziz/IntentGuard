import type { IntentSpec, GatheredEvidence, IntentConfig } from '../schema/intentspec.js';
import { WatsonxProvider } from './watsonx.js';
import { OllamaProvider } from './ollama.js';
import { hasWatsonxCredentials } from './watsonx-client.js';

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

/** An explicit `llmProvider` wins; "auto" uses watsonx when credentials are configured. */
export function resolveProvider(config: IntentConfig): LLMProvider {
  if (config.llmProvider === 'watsonx') return new WatsonxProvider();
  if (config.llmProvider === 'ollama') return new OllamaProvider();
  if (hasWatsonxCredentials()) return new WatsonxProvider();
  return new FallbackProvider();
}
