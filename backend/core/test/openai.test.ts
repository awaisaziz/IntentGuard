import { describe, it, expect } from 'vitest';
import {
  OpenAIChatModel,
  OpenAIConfigError,
  DEFAULT_OPENAI_MODEL,
  hasOpenAICredentials,
  isReasoningModel,
  openaiConfigFromEnv,
} from '../src/llm/openai-client.js';
import { OpenAIProvider } from '../src/llm/openai.js';
import { createChatModel, detectChatProvider, UnknownProviderError } from '../src/llm/resolve.js';
import { resolveProvider } from '../src/llm/provider.js';
import { WatsonxChatModel } from '../src/llm/watsonx-client.js';
import type { IntentConfig } from '../src/schema/intentspec.js';

// Assembled at runtime so the repository's own secret scan never trips on this file.
const KEY = ['unit', 'test', 'value'].join('-');
const openaiEnv = { OPENAI_API_KEY: KEY };
const watsonxEnv = { WATSONX_API_KEY: KEY, WATSONX_PROJECT_ID: 'proj-1' };

function fakeFetch(body: unknown, status = 200) {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { impl, requests };
}

const tools = [
  { type: 'function' as const, function: { name: 'list_files', description: 'd', parameters: { type: 'object', properties: {} } } },
];

describe('openaiConfigFromEnv', () => {
  it('names the missing variable', () => {
    expect(() => openaiConfigFromEnv({})).toThrow(OpenAIConfigError);
    expect(() => openaiConfigFromEnv({})).toThrow(/OPENAI_API_KEY/);
  });

  it('treats the placeholder from .env.example as unset', () => {
    const env = { OPENAI_API_KEY: 'your-openai-api-key' };
    expect(hasOpenAICredentials(env)).toBe(false);
    expect(() => openaiConfigFromEnv(env)).toThrow(OpenAIConfigError);
  });

  it('applies defaults and reads overrides', () => {
    const defaults = openaiConfigFromEnv(openaiEnv);
    expect(defaults.model).toBe(DEFAULT_OPENAI_MODEL);
    expect(defaults.baseUrl).toBe('https://api.openai.com/v1');
    const custom = openaiConfigFromEnv({ ...openaiEnv, OPENAI_MODEL: 'gpt-4o-mini', OPENAI_BASE_URL: 'https://proxy.test/v1/' });
    expect(custom.model).toBe('gpt-4o-mini');
    expect(custom.baseUrl).toBe('https://proxy.test/v1');
  });
});

describe('OpenAIChatModel', () => {
  it('posts to /chat/completions with a bearer key and tools in OpenAI format', async () => {
    const { impl, requests } = fakeFetch({
      choices: [
        {
          message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'list_files', arguments: '{}' } }] },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    });
    const model = new OpenAIChatModel(openaiConfigFromEnv(openaiEnv), impl);
    const res = await model.chat([{ role: 'user', content: 'hi' }], tools);

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://api.openai.com/v1/chat/completions');
    expect((requests[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(requests[0].init.body as string);
    expect(body).toMatchObject({ model: DEFAULT_OPENAI_MODEL, tool_choice: 'auto', temperature: 0, max_tokens: 4096 });
    expect(body.tools).toEqual(tools);
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);

    expect(res.message.tool_calls).toEqual([{ id: 't1', type: 'function', function: { name: 'list_files', arguments: '{}' } }]);
    expect(res.message.content).toBeUndefined();
    expect(res.finishReason).toBe('tool_calls');
    expect(res.usage).toEqual({ promptTokens: 12, completionTokens: 3 });
  });

  it('sends max_completion_tokens and no temperature to reasoning models', async () => {
    expect(isReasoningModel('gpt-5-mini')).toBe(true);
    expect(isReasoningModel('o4-mini')).toBe(true);
    expect(isReasoningModel('gpt-4.1')).toBe(false);
    expect(isReasoningModel('gpt-4o')).toBe(false);

    const { impl, requests } = fakeFetch({ choices: [{ message: { content: 'ok' } }] });
    const model = new OpenAIChatModel({ ...openaiConfigFromEnv(openaiEnv), model: 'gpt-5-mini' }, impl);
    await model.chat([{ role: 'user', content: 'hi' }], undefined, { maxTokens: 500, temperature: 0.3 });
    const body = JSON.parse(requests[0].init.body as string);
    expect(body.max_completion_tokens).toBe(500);
    expect(body).not.toHaveProperty('max_tokens');
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('tools');
  });

  it('sends organization and project headers only when configured', async () => {
    const { impl, requests } = fakeFetch({ choices: [{ message: { content: 'ok' } }] });
    const env = { ...openaiEnv, OPENAI_ORG_ID: 'org-1', OPENAI_PROJECT_ID: 'proj-9' };
    await new OpenAIChatModel(openaiConfigFromEnv(env), impl).chat([{ role: 'user', content: 'hi' }]);
    await new OpenAIChatModel(openaiConfigFromEnv(openaiEnv), impl).chat([{ role: 'user', content: 'hi' }]);
    const [withIds, without] = requests.map(r => r.init.headers as Record<string, string>);
    expect(withIds['OpenAI-Organization']).toBe('org-1');
    expect(withIds['OpenAI-Project']).toBe('proj-9');
    expect(without).not.toHaveProperty('OpenAI-Organization');
  });

  it('reports the status and API message on failure, never the key', async () => {
    const { impl } = fakeFetch({ error: { message: 'Incorrect API key provided', type: 'invalid_request_error' } }, 401);
    const model = new OpenAIChatModel(openaiConfigFromEnv(openaiEnv), impl);
    const failure = await model.chat([{ role: 'user', content: 'hi' }]).catch(e => e as Error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('OpenAI chat request failed: 401 Incorrect API key provided');
    expect((failure as Error).message).not.toContain(KEY);
  });

  it('lists chat models and leaves out audio, image, and embedding models', async () => {
    const { impl, requests } = fakeFetch({
      data: [{ id: 'gpt-4.1' }, { id: 'text-embedding-3-small' }, { id: 'gpt-4o-audio-preview' }, { id: 'o4-mini' }, { id: 'dall-e-3' }],
    });
    const models = await new OpenAIChatModel(openaiConfigFromEnv(openaiEnv), impl).listToolModels();
    expect(requests[0].url).toBe('https://api.openai.com/v1/models');
    expect(models).toEqual(['gpt-4.1', 'o4-mini']);
  });
});

describe('createChatModel', () => {
  it('uses OpenAI when only an OpenAI key is set', () => {
    expect(detectChatProvider(openaiEnv)).toBe('openai');
    const model = createChatModel({}, openaiEnv);
    expect(model).toBeInstanceOf(OpenAIChatModel);
    expect(model.id).toBe(DEFAULT_OPENAI_MODEL);
  });

  it('prefers OpenAI when both providers are configured, unless one is named', () => {
    const both = { ...openaiEnv, ...watsonxEnv };
    expect(createChatModel({}, both)).toBeInstanceOf(OpenAIChatModel);
    expect(createChatModel({ provider: 'watsonx' }, both)).toBeInstanceOf(WatsonxChatModel);
    expect(createChatModel({}, watsonxEnv)).toBeInstanceOf(WatsonxChatModel);
  });

  it('applies the model override to the chosen provider', () => {
    expect(createChatModel({ model: 'gpt-4o-mini' }, openaiEnv).id).toBe('gpt-4o-mini');
    expect(createChatModel({ provider: 'watsonx', model: 'ibm/granite-3-8b-instruct' }, watsonxEnv).id).toBe('ibm/granite-3-8b-instruct');
  });

  it('names OPENAI_API_KEY when nothing is configured', () => {
    expect(detectChatProvider({})).toBeUndefined();
    const failure = (() => {
      try {
        createChatModel({}, {});
      } catch (e) {
        return e;
      }
    })();
    expect(failure).toBeInstanceOf(OpenAIConfigError);
    expect((failure as Error).message).toMatch(/OPENAI_API_KEY/);
  });

  it('rejects providers it does not know, including the removed Gemini one', () => {
    expect(() => createChatModel({ provider: 'gemini' }, openaiEnv)).toThrow(UnknownProviderError);
  });
});

describe('resolveProvider', () => {
  const config = (llmProvider: string): IntentConfig => ({
    llmProvider,
    readinessThreshold: 70,
    specDir: '.intent/specs',
    reportDir: '.intent/reports',
  });

  it('drafts with OpenAI when asked to, or on auto with an OpenAI key', () => {
    expect(resolveProvider(config('openai'), {})).toBeInstanceOf(OpenAIProvider);
    expect(resolveProvider(config('auto'), openaiEnv).name).toBe('openai');
    expect(resolveProvider(config('auto'), { ...openaiEnv, ...watsonxEnv }).name).toBe('openai');
  });

  it('keeps watsonx, ollama, and the rule-based fallback', () => {
    expect(resolveProvider(config('watsonx'), openaiEnv).name).toBe('watsonx');
    expect(resolveProvider(config('auto'), watsonxEnv).name).toBe('watsonx');
    expect(resolveProvider(config('ollama'), openaiEnv).name).toBe('ollama');
    expect(resolveProvider(config('auto'), {}).name).toBe('fallback');
  });
});
