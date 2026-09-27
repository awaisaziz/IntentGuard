import type { IntentSpec, GatheredEvidence, IntentConfig } from '../schema/intentspec.js';
import { WatsonxProvider } from './watsonx.js';
import { OllamaProvider } from './ollama.js';
import { OpenAIProvider } from './openai.js';
import { hasWatsonxCredentials } from './watsonx-client.js';
import { hasOpenAICredentials } from './openai-client.js';

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

/** An explicit `llmProvider` wins; "auto" checks OpenAI, then watsonx credentials. */
export function resolveProvider(config: IntentConfig, env: NodeJS.ProcessEnv = process.env): LLMProvider {
  if (config.llmProvider === 'openai') return new OpenAIProvider();
  if (config.llmProvider === 'watsonx') return new WatsonxProvider();
  if (config.llmProvider === 'ollama') return new OllamaProvider();
  if (hasOpenAICredentials(env)) return new OpenAIProvider();
  if (hasWatsonxCredentials(env)) return new WatsonxProvider();
  return new FallbackProvider();
}
