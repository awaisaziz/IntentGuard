/**
 * Provider-neutral chat types for tool-calling models (OpenAI-style, as used by the
 * watsonx.ai chat API). The chat agent depends only on `ChatModel`, so tests can
 * script a fake model and other providers can be added later.
 */

export interface ChatToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content?: string; tool_calls?: ChatToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

export interface ChatTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatResponse {
  message: { content?: string; tool_calls?: ChatToolCall[] };
  finishReason?: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface ChatOptions {
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatModel {
  /** Model identifier shown to the user, e.g. "ibm/granite-4-h-small". */
  readonly id: string;
  chat(messages: ChatMessage[], tools?: ChatTool[], options?: ChatOptions): Promise<ChatResponse>;
}

const INLINE_TOOL_CALL = /<\|?tool_call\|?>\s*([\s\S]*?)(?:<\/tool_call>|$)/;

/**
 * Some models (Granite in particular) occasionally answer with tool calls written into the
 * message text, e.g. `<tool_call>[{"name": ..., "arguments": {...}}]`, instead of the
 * structured `tool_calls` field. Recovers those calls so the agent loop still works.
 * @returns The recovered calls and the remaining text, or null when there are none
 */
export function extractInlineToolCalls(content: string): { calls: ChatToolCall[]; text: string } | null {
  const match = INLINE_TOOL_CALL.exec(content);
  let json = match?.[1]?.trim();
  let text = match ? content.replace(match[0], '').trim() : content;
  if (!json) {
    const trimmed = content.trim();
    if (!/^\[\s*\{[\s\S]*"name"/.test(trimmed)) return null;
    json = trimmed;
    text = '';
  }
  try {
    const parsed = JSON.parse(json);
    const list = (Array.isArray(parsed) ? parsed : [parsed]) as Array<Record<string, unknown>>;
    const calls = list
      .filter(c => typeof c?.name === 'string')
      .map((c, i) => ({
        id: `call_inline_${Date.now().toString(36)}_${i}`,
        type: 'function' as const,
        function: {
          name: c.name as string,
          arguments: JSON.stringify(c.arguments ?? c.parameters ?? {}),
        },
      }));
    return calls.length ? { calls, text } : null;
  } catch {
    return null;
  }
}
