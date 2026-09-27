import {
  extractInlineToolCalls,
  type ChatMessage,
  type ChatModel,
  type ChatOptions,
  type ChatResponse,
  type ChatTool,
  type ChatToolCall,
} from './chat.js';

export interface DeepSeekConfig {
  apiKey: string;
  model: string;
  /** API root. Default: https://api.deepseek.com/v1 */
  baseUrl: string;
}

export const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
/** The chat model used when no override is given. */
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';

export class DeepSeekConfigError extends Error {}

/** A value copied unchanged from .env.example ("your-...") counts as unset. */
const setting = (value: string | undefined) => (value && !/^your[-_]/i.test(value.trim()) ? value.trim() : undefined);

/** True when a DeepSeek API key is configured (placeholders do not count). */
export function hasDeepSeekCredentials(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!setting(env.DEEPSEEK_API_KEY);
}

/**
 * Reads DeepSeek settings from the environment.
 * @throws DeepSeekConfigError when DEEPSEEK_API_KEY is not set
 */
export function deepseekConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DeepSeekConfig {
  const apiKey = setting(env.DEEPSEEK_API_KEY);
  if (!apiKey) {
    throw new DeepSeekConfigError(
      'DeepSeek is not configured: set DEEPSEEK_API_KEY in the IntentGuard .env file (see .env.example).'
    );
  }
  return {
    apiKey,
    model: setting(env.DEEPSEEK_MODEL) || DEFAULT_DEEPSEEK_MODEL,
    baseUrl: (setting(env.DEEPSEEK_BASE_URL) || DEFAULT_DEEPSEEK_BASE_URL).replace(/\/+$/, ''),
  };
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

/**
 * Chat client for the DeepSeek Chat Completions API.
 * DeepSeek is OpenAI-compatible so the wire format is identical.
 */
export class DeepSeekChatModel implements ChatModel {
  constructor(
    readonly config: DeepSeekConfig,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): DeepSeekChatModel {
    return new DeepSeekChatModel(deepseekConfigFromEnv(env));
  }

  get id(): string {
    return this.config.model;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async chat(messages: ChatMessage[], tools?: ChatTool[], options: ChatOptions = {}): Promise<ChatResponse> {
    const maxTokens = options.maxTokens ?? 4096;
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      max_tokens: maxTokens,
      temperature: options.temperature ?? 0,
    };
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
    if (!res.ok) throw new Error(`DeepSeek chat request failed: ${await errorMessage(res)}`);

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
}
