import { describe, it, expect } from 'vitest';
import {
  WatsonxChatModel,
  watsonxConfigFromEnv,
  WatsonxConfigError,
  DEFAULT_WATSONX_MODEL,
  hasWatsonxCredentials,
} from '../src/llm/watsonx-client.js';
import { extractInlineToolCalls } from '../src/llm/chat.js';
import { parseJsonObject, sanitizeDraft } from '../src/llm/watsonx.js';

const config = watsonxConfigFromEnv({ WATSONX_API_KEY: 'k-123', WATSONX_PROJECT_ID: 'proj-1' });

function fakeFetch(chatBody: unknown) {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    if (url.includes('identity/token')) {
      return new Response(JSON.stringify({ access_token: 'tok', expiration: Math.floor(Date.now() / 1000) + 3600 }), { status: 200 });
    }
    return new Response(JSON.stringify(chatBody), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, requests };
}

describe('watsonxConfigFromEnv', () => {
  it('names every missing variable', () => {
    expect(() => watsonxConfigFromEnv({})).toThrow(WatsonxConfigError);
    expect(() => watsonxConfigFromEnv({})).toThrow(/WATSONX_API_KEY and WATSONX_PROJECT_ID/);
  });

  it('treats values copied unchanged from .env.example as unset', () => {
    const env = { WATSONX_API_KEY: 'your-watsonx-api-key', WATSONX_PROJECT_ID: 'your-watsonx-project-id' };
    expect(hasWatsonxCredentials(env)).toBe(false);
    expect(() => watsonxConfigFromEnv(env)).toThrow(WatsonxConfigError);
    expect(hasWatsonxCredentials({ WATSONX_API_KEY: 'k', WATSONX_SPACE_ID: 's' })).toBe(true);
  });

  it('defaults to the us-south endpoint and the Granite tool-calling model', () => {
    expect(config.url).toBe('https://us-south.ml.cloud.ibm.com');
    expect(config.modelId).toBe(DEFAULT_WATSONX_MODEL);
  });
});

describe('WatsonxChatModel', () => {
  it('authenticates once and sends tools in the chat API format', async () => {
    const { impl, requests } = fakeFetch({
      choices: [{ message: { role: 'assistant', tool_calls: [{ id: 't1', type: 'function', function: { name: 'list_files', arguments: '{}' } }] }, finish_reason: 'tool_calls' }],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    });
    const model = new WatsonxChatModel(config, impl);
    const tools = [{ type: 'function' as const, function: { name: 'list_files', description: 'd', parameters: { type: 'object', properties: {} } } }];
    const res = await model.chat([{ role: 'user', content: 'hi' }], tools);
    await model.chat([{ role: 'user', content: 'again' }], tools);

    expect(requests.filter(r => r.url.includes('identity/token'))).toHaveLength(1);
    const chat = requests.find(r => r.url.includes('/ml/v1/text/chat'))!;
    expect(chat.url).toMatch(/^https:\/\/us-south\.ml\.cloud\.ibm\.com\/ml\/v1\/text\/chat\?version=/);
    expect((chat.init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    const body = JSON.parse(chat.init.body as string);
    expect(body).toMatchObject({ model_id: DEFAULT_WATSONX_MODEL, project_id: 'proj-1', tool_choice_option: 'auto' });
    expect(body.tools[0].function.name).toBe('list_files');
    expect(res.message.tool_calls?.[0].function.name).toBe('list_files');
    expect(res.usage).toEqual({ promptTokens: 12, completionTokens: 3 });
  });

  it('recovers tool calls that Granite writes into the message text', async () => {
    const { impl } = fakeFetch({
      choices: [{ message: { content: '<tool_call>[{"name": "read_file", "arguments": {"path": "a.ts"}}]' } }],
    });
    const res = await new WatsonxChatModel(config, impl).chat([{ role: 'user', content: 'x' }], []);
    expect(res.message.tool_calls?.[0].function).toEqual({ name: 'read_file', arguments: '{"path":"a.ts"}' });
    expect(res.message.content).toBeUndefined();
  });

  it('surfaces the watsonx error message without leaking the API key', async () => {
    const impl = (async (url: string) =>
      url.includes('identity/token')
        ? new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }))
        : new Response(JSON.stringify({ errors: [{ code: 'model_not_supported', message: 'Model not found' }] }), { status: 404 })) as unknown as typeof fetch;
    const err = await new WatsonxChatModel(config, impl).chat([{ role: 'user', content: 'x' }]).catch(e => e as Error);
    expect(err.message).toMatch(/404 Model not found/);
    expect(err.message).not.toContain('k-123');
  });
});

describe('inline tool calls and JSON drafts', () => {
  it('ignores ordinary prose', () => {
    expect(extractInlineToolCalls('I will read the file next.')).toBeNull();
  });

  it('parses a bare JSON array of calls', () => {
    const r = extractInlineToolCalls('[{"name": "list_files", "arguments": {}}]');
    expect(r?.calls[0].function.name).toBe('list_files');
  });

  it('keeps only well-formed spec fields from a model draft', () => {
    const raw = parseJsonObject('```json\n{"objective": "Add seat maps", "outcomes": ["Map renders", 3], "scope": {"inScope": ["src/**"]}, "edgeCases": ["Seat taken"], "bogus": 1}\n```');
    const draft = sanitizeDraft(raw!);
    expect(draft).toEqual({
      objective: 'Add seat maps',
      outcomes: ['Map renders'],
      scope: { inScope: ['src/**'], outOfScope: [] },
      edgeCases: [{ scenario: 'Seat taken', expectedBehavior: 'To be defined' }],
    });
  });
});
