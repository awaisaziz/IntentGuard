import {
  extractInlineToolCalls,
  type ChatMessage,
  type ChatModel,
  type ChatOptions,
  type ChatResponse,
  type ChatTool,
  type ChatToolCall,
} from './chat.js';

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  /** API root including the version segment, e.g. https://api.openai.com/v1 */
  baseUrl: string;
  organization?: string;
  project?: string;
}

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
/** A tool-calling model that accepts `temperature`. Override with OPENAI_MODEL. */
export const DEFAULT_OPENAI_MODEL = 'gpt-4.1';

export class OpenAIConfigError extends Error {}

/** A value copied unchanged from .env.example ("your-...") counts as unset. */
const setting = (value: string | undefined) => (value && !/^your[-_]/i.test(value.trim()) ? value.trim() : undefined);

/** True when an OpenAI API key is configured (placeholders from .env.example do not count). */
export function hasOpenAICredentials(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!setting(env.OPENAI_API_KEY);
}

/**
 * Reads OpenAI settings from the environment.
 * @throws OpenAIConfigError when OPENAI_API_KEY is not set
 */
export function openaiConfigFromEnv(env: NodeJS.ProcessEnv = process.env): OpenAIConfig {
  const apiKey = setting(env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new OpenAIConfigError(
      'OpenAI is not configured: set OPENAI_API_KEY in the IntentGuard .env file (see .env.example).'
    );
  }
  return {
    apiKey,
    model: setting(env.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL,
    baseUrl: (setting(env.OPENAI_BASE_URL) || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, ''),
    organization: setting(env.OPENAI_ORG_ID),
    project: setting(env.OPENAI_PROJECT_ID),
  };
}

/**
 * Reasoning models (o-series, gpt-5 family) reject `temperature` and `max_tokens`;
 * they take `max_completion_tokens` instead.
 */
export function isReasoningModel(model: string): boolean {
  return /^(?:o\d|gpt-5)/i.test(model);
}

type FetchLike = typeof fetch;

async function errorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const body = JSON.parse(text);
    const detail = body?.error?.message ?? body?.message;
    if (detail) return `${res.status} ${detail}`;
  } catch {
    // Not JSON
  }
  return `${res.status} ${text.slice(0, 300) || res.statusText}`;
}

/** Chat client for the OpenAI Chat Completions API (`/chat/completions`) with tool calling. */
export class OpenAIChatModel implements ChatModel {
  constructor(
    readonly config: OpenAIConfig,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): OpenAIChatModel {
    return new OpenAIChatModel(openaiConfigFromEnv(env));
  }

  get id(): string {
    return this.config.model;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.config.organization) headers['OpenAI-Organization'] = this.config.organization;
    if (this.config.project) headers['OpenAI-Project'] = this.config.project;
    return headers;
  }

  async chat(messages: ChatMessage[], tools?: ChatTool[], options: ChatOptions = {}): Promise<ChatResponse> {
    const maxTokens = options.maxTokens ?? 4096;
    const body: Record<string, unknown> = { model: this.config.model, messages };
    if (isReasoningModel(this.config.model)) {
      body.max_completion_tokens = maxTokens;
    } else {
      body.max_tokens = maxTokens;
      body.temperature = options.temperature ?? 0;
    }
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const signal = options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(180_000)])
      : AbortSignal.timeout(180_000);
    const res = await this.fetchImpl(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw new Error(`OpenAI chat request failed: ${await errorMessage(res)}`);

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: ChatToolCall[] }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const choice = data.choices?.[0];
    let content = choice?.message?.content ?? undefined;
    let toolCalls = choice?.message?.tool_calls?.filter(c => c?.function?.name);
    if (!toolCalls?.length && content) {
      const inline = extractInlineToolCalls(content);
      if (inline) {
        toolCalls = inline.calls;
        content = inline.text || undefined;
      }
    }
    return {
      message: {
        content: content || undefined,
        tool_calls: toolCalls?.length
          ? toolCalls.map((c, i) => ({
              id: c.id || `call_${Date.now().toString(36)}_${i}`,
              type: 'function' as const,
              function: { name: c.function.name, arguments: c.function.arguments ?? '{}' },
            }))
          : undefined,
      },
      finishReason: choice?.finish_reason,
      usage: data.usage
        ? { promptTokens: data.usage.prompt_tokens ?? 0, completionTokens: data.usage.completion_tokens ?? 0 }
        : undefined,
    };
  }

  /** Lists the chat models this API key can use. */
  async listToolModels(): Promise<string[]> {
    const res = await this.fetchImpl(`${this.config.baseUrl}/models`, { headers: this.headers() });
    if (!res.ok) throw new Error(`OpenAI model listing failed: ${await errorMessage(res)}`);
    const body = (await res.json()) as { data?: Array<{ id: string }> };
    return (body.data ?? [])
      .map(m => m.id)
      .filter(id => /^(?:gpt-|o\d|chatgpt-)/i.test(id) && !/(?:audio|realtime|tts|transcribe|image|search|embedding)/i.test(id))
      .sort();
  }
}
