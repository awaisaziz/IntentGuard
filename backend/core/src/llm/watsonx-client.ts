import {
  extractInlineToolCalls,
  type ChatMessage,
  type ChatModel,
  type ChatOptions,
  type ChatResponse,
  type ChatTool,
  type ChatToolCall,
} from './chat.js';

export interface WatsonxConfig {
  apiKey: string;
  projectId?: string;
  spaceId?: string;
  /** Regional endpoint, e.g. https://us-south.ml.cloud.ibm.com */
  url: string;
  modelId: string;
  version: string;
  iamUrl: string;
}

export const DEFAULT_WATSONX_URL = 'https://us-south.ml.cloud.ibm.com';
/** Granite 4.0 hybrid "small": the watsonx Granite model tuned for tool calling. Override with WATSONX_MODEL_ID. */
export const DEFAULT_WATSONX_MODEL = 'ibm/granite-4-h-small';
const DEFAULT_VERSION = '2024-10-08';
const DEFAULT_IAM_URL = 'https://iam.cloud.ibm.com/identity/token';

export class WatsonxConfigError extends Error {}

/** A value copied unchanged from .env.example ("your-...") counts as unset. */
const setting = (value: string | undefined) => (value && !/^your[-_]/i.test(value.trim()) ? value.trim() : undefined);

/** True when watsonx credentials are configured (placeholders from .env.example do not count). */
export function hasWatsonxCredentials(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!setting(env.WATSONX_API_KEY) && !!(setting(env.WATSONX_PROJECT_ID) || setting(env.WATSONX_SPACE_ID));
}

/**
 * Reads watsonx settings from the environment.
 * @throws WatsonxConfigError naming the missing variables
 */
export function watsonxConfigFromEnv(env: NodeJS.ProcessEnv = process.env): WatsonxConfig {
  const missing: string[] = [];
  if (!setting(env.WATSONX_API_KEY)) missing.push('WATSONX_API_KEY');
  if (!setting(env.WATSONX_PROJECT_ID) && !setting(env.WATSONX_SPACE_ID)) missing.push('WATSONX_PROJECT_ID (or WATSONX_SPACE_ID)');
  if (missing.length) {
    throw new WatsonxConfigError(
      `IBM watsonx is not configured: set ${missing.join(' and ')} in the IntentGuard .env file (see .env.example).`
    );
  }
  const projectId = setting(env.WATSONX_PROJECT_ID);
  return {
    apiKey: setting(env.WATSONX_API_KEY)!,
    projectId,
    spaceId: projectId ? undefined : setting(env.WATSONX_SPACE_ID),
    url: (setting(env.WATSONX_URL) || DEFAULT_WATSONX_URL).replace(/\/+$/, ''),
    modelId: setting(env.WATSONX_MODEL_ID) || DEFAULT_WATSONX_MODEL,
    version: setting(env.WATSONX_API_VERSION) || DEFAULT_VERSION,
    iamUrl: setting(env.WATSONX_IAM_URL) || DEFAULT_IAM_URL,
  };
}

type FetchLike = typeof fetch;

async function errorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const body = JSON.parse(text);
    const detail = body?.errors?.[0]?.message ?? body?.errorMessage ?? body?.message;
    if (detail) return `${res.status} ${detail}`;
  } catch {
    // Not JSON
  }
  return `${res.status} ${text.slice(0, 300) || res.statusText}`;
}

/** Chat client for IBM watsonx.ai (`/ml/v1/text/chat`) with IAM API-key authentication. */
export class WatsonxChatModel implements ChatModel {
  private token?: { value: string; expiresAt: number };

  constructor(
    readonly config: WatsonxConfig,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): WatsonxChatModel {
    return new WatsonxChatModel(watsonxConfigFromEnv(env));
  }

  get id(): string {
    return this.config.modelId;
  }

  /** Exchanges the API key for an IAM bearer token, cached until a minute before expiry. */
  private async bearer(signal?: AbortSignal): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - 60_000) return this.token.value;
    const res = await this.fetchImpl(this.config.iamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: `grant_type=${encodeURIComponent('urn:ibm:params:oauth:grant-type:apikey')}&apikey=${encodeURIComponent(this.config.apiKey)}`,
      signal,
    });
    if (!res.ok) throw new Error(`watsonx authentication failed: ${await errorMessage(res)}`);
    const body = (await res.json()) as { access_token: string; expiration?: number; expires_in?: number };
    const expiresAt = body.expiration ? body.expiration * 1000 : Date.now() + (body.expires_in ?? 3600) * 1000;
    this.token = { value: body.access_token, expiresAt };
    return body.access_token;
  }

  async chat(messages: ChatMessage[], tools?: ChatTool[], options: ChatOptions = {}): Promise<ChatResponse> {
    const token = await this.bearer(options.signal);
    const body: Record<string, unknown> = {
      model_id: this.config.modelId,
      messages,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0,
    };
    if (this.config.projectId) body.project_id = this.config.projectId;
    else body.space_id = this.config.spaceId;
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice_option = 'auto';
    }

    const signal = options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(180_000)])
      : AbortSignal.timeout(180_000);
    const res = await this.fetchImpl(`${this.config.url}/ml/v1/text/chat?version=${this.config.version}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw new Error(`watsonx chat request failed: ${await errorMessage(res)}`);

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
          ? toolCalls.map((c, i) => ({ ...c, id: c.id || `call_${Date.now().toString(36)}_${i}`, type: 'function' }))
          : undefined,
      },
      finishReason: choice?.finish_reason,
      usage: data.usage
        ? { promptTokens: data.usage.prompt_tokens ?? 0, completionTokens: data.usage.completion_tokens ?? 0 }
        : undefined,
    };
  }

  /** Lists models in this region that support tool calling (falls back to all chat models). */
  async listToolModels(): Promise<string[]> {
    const list = async (filters: string) => {
      const res = await this.fetchImpl(
        `${this.config.url}/ml/v1/foundation_model_specs?version=2024-12-10&limit=200&filters=${encodeURIComponent(filters)}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) throw new Error(`watsonx model listing failed: ${await errorMessage(res)}`);
      const body = (await res.json()) as { resources?: Array<{ model_id: string }> };
      return (body.resources ?? []).map(r => r.model_id).sort();
    };
    const toolModels = await list('task_function_calling').catch(() => [] as string[]);
    return toolModels.length ? toolModels : list('function_text_chat');
  }
}
