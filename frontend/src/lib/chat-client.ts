import type { AgentEvent, AgentMetrics, SpecSnapshot } from '@intentguard/core';

export type { AgentEvent, AgentMetrics, SpecSnapshot };

/** The backend (backend/server). It allows this dashboard's origin via CORS. */
export const API_URL = process.env.NEXT_PUBLIC_INTENTGUARD_API_URL ?? 'http://localhost:3848';

export interface ChatSession {
  id: string;
  harness: boolean;
  model: string;
  spec: SpecSnapshot | null;
}

async function post(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new Error(`Cannot reach the IntentGuard backend at ${API_URL}. Start it with: pnpm dev:server`);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return res;
}

export interface ModelChoice {
  /** Provider id: 'openai' | 'watsonx' | 'deepseek' */
  provider: string;
  /** Model name to pass to the provider (e.g. 'deepseek-flash', 'gpt-4.1'). */
  model: string;
}

export interface ProviderStatus {
  id: string;
  name: string;
  configured: boolean;
  envVar: string;
}

/** Which providers have a key configured on the backend. Keys themselves never leave the server. */
export async function getProviders(): Promise<{ default: string | null; providers: ProviderStatus[] }> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/providers`, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error(`Cannot reach the IntentGuard backend at ${API_URL}. Start it with: pnpm dev:server`);
  }
  if (!res.ok) throw new Error(`Could not read providers (${res.status})`);
  return res.json();
}

export async function createSession(harness: boolean, modelChoice?: ModelChoice): Promise<ChatSession> {
  return (await post('/chat', { harness, provider: modelChoice?.provider, model: modelChoice?.model })).json();
}

export async function approveSpec(sessionId: string): Promise<SpecSnapshot> {
  return (await (await post(`/chat/${encodeURIComponent(sessionId)}/approve`, {})).json()).spec;
}

/**
 * Sends a message and calls `onEvent` for each server-sent event until the agent is done.
 * Aborting the signal stops the agent on the server too.
 */
export async function sendMessage(
  sessionId: string,
  message: string,
  onEvent: (event: AgentEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await post(`/chat/${encodeURIComponent(sessionId)}/messages`, { message }, signal);
  if (!res.body) throw new Error('The backend returned no event stream.');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = block
        .split('\n')
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())
        .join('\n');
      if (data) onEvent(JSON.parse(data) as AgentEvent);
    }
  }
}
