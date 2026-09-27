import type { WorkspaceState } from '@/lib/api';
import { API_URL } from '@/lib/chat-client';

async function post(path: string, body: unknown): Promise<WorkspaceState> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Cannot reach the IntentGuard backend at ${API_URL}. Start it with: pnpm dev:app`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as WorkspaceState;
}

/** Clones a GitHub repository into the git-ignored workspaces folder and makes it active. */
export function connectRepository(url: string): Promise<WorkspaceState & { cloned: boolean; updated: boolean }> {
  return post('/workspaces', { url }) as Promise<WorkspaceState & { cloned: boolean; updated: boolean }>;
}

/** Switches the dashboard to a cloned repository, or back to the start repository with `null`. */
export function activateWorkspace(name: string | null): Promise<WorkspaceState> {
  return post('/workspaces/activate', { name });
}
