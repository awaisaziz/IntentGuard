import type { ChatModel } from './chat.js';
import { OpenAIChatModel, hasOpenAICredentials, openaiConfigFromEnv } from './openai-client.js';
import { WatsonxChatModel, hasWatsonxCredentials, watsonxConfigFromEnv } from './watsonx-client.js';
import { DeepSeekChatModel, hasDeepSeekCredentials, deepseekConfigFromEnv } from './deepseek-client.js';

/**
 * Providers that can run the chat agent and draft specs. OpenAI is the default.
 * IBM Bob is not listed: it is a coding agent that connects to IntentGuard over
 * MCP (`intent connect`), not a model API.
 */
export type ChatProviderId = 'openai' | 'watsonx' | 'deepseek';

export const CHAT_PROVIDERS: ChatProviderId[] = ['openai', 'watsonx', 'deepseek'];

export class UnknownProviderError extends Error {}

export interface ChatModelOptions {
  /** Force a provider. Default: OpenAI when its key is set, otherwise watsonx when configured. */
  provider?: string;
  /** Model ID override for this session. */
  model?: string;
}

/** The provider that would be used with no explicit choice, or undefined when none is configured. */
export function detectChatProvider(env: NodeJS.ProcessEnv = process.env): ChatProviderId | undefined {
  if (hasOpenAICredentials(env)) return 'openai';
  if (hasWatsonxCredentials(env)) return 'watsonx';
  if (hasDeepSeekCredentials(env)) return 'deepseek';
  return undefined;
}

/**
 * Creates the chat model for a session. Shared by the CLI and the HTTP API so
 * both pick the same provider for the same environment.
 * @throws UnknownProviderError for an unsupported provider name
 * @throws OpenAIConfigError / WatsonxConfigError / DeepSeekConfigError when credentials are missing
 */
export function createChatModel(options: ChatModelOptions = {}, env: NodeJS.ProcessEnv = process.env): ChatModel {
  const requested = options.provider?.trim().toLowerCase();
  if (requested && !CHAT_PROVIDERS.includes(requested as ChatProviderId)) {
    throw new UnknownProviderError(
      `Unknown provider "${options.provider}". Supported: ${CHAT_PROVIDERS.join(', ')}.` +
        (requested === 'bob' ? ' IBM Bob connects through MCP instead: run `intent connect --agent bob`.' : '')
    );
  }
  // With nothing configured, fall through to OpenAI so the error names OPENAI_API_KEY
  const provider = (requested as ChatProviderId | undefined) ?? detectChatProvider(env) ?? 'openai';

  if (provider === 'watsonx') {
    const config = watsonxConfigFromEnv(env);
    if (options.model) config.modelId = options.model;
    return new WatsonxChatModel(config);
  }
  if (provider === 'deepseek') {
    const config = deepseekConfigFromEnv(env);
    if (options.model) config.model = options.model;
    return new DeepSeekChatModel(config);
  }
  const config = openaiConfigFromEnv(env);
  if (options.model) config.model = options.model;
  return new OpenAIChatModel(config);
}
