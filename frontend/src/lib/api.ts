import type { AgentStatus, IntentConfig, IntentSpec, ProofReport, ReadinessScore } from '@intentguard/core';

export type { AgentStatus, IntentConfig, ProofReport, ReadinessScore };

/** A spec as the API lists it: the stored spec plus its live readiness score and active flag. */
export type Spec = IntentSpec & { readinessScore?: number; active?: boolean };
export type Evidence = NonNullable<IntentSpec['evidence']>[number];

export interface ProviderStatus {
  id: string;
  name: string;
  configured: boolean;
  /** The variable to set in the IntentGuard .env file. */
  envVar: string;
}

export interface ProvidersResponse {
  /** Provider used when a chat session names none, or null when nothing is configured. */
  default: string | null;
  providers: ProviderStatus[];
}

/** The backend (backend/server). Pages fetch from it on the server, so no CORS is involved. */
export const API_URL = process.env.NEXT_PUBLIC_INTENTGUARD_API_URL ?? 'http://localhost:3848';

/** Thrown when the backend cannot be reached; rendered by app/error.tsx. */
export class BackendOfflineError extends Error {
  constructor() {
    super(`Cannot reach the IntentGuard backend at ${API_URL}. Start it with: pnpm dev:server`);
    this.name = 'BackendOfflineError';
  }
}

/**
 * GETs a path from the API, always fresh.
 * @returns The parsed body, or null when the API answers 404
 * @throws BackendOfflineError when the backend is not running
 */
async function get<T>(path: string): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
  } catch {
    throw new BackendOfflineError();
  }
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `The backend answered ${res.status} for ${path}`);
  }
  return (await res.json()) as T;
}

const id = (specId: string) => encodeURIComponent(specId);

export async function getAllSpecs(): Promise<Spec[]> {
  return (await get<Spec[]>('/specs')) ?? [];
}

export async function getActiveSpec(): Promise<Spec | null> {
  return get<Spec>('/specs/active');
}

export async function getSpecById(specId: string): Promise<Spec | null> {
  return get<Spec>(`/specs/${id(specId)}`);
}

export async function getReadiness(specId: string): Promise<ReadinessScore | null> {
  return get<ReadinessScore>(`/specs/${id(specId)}/readiness`);
}

/** The last saved proof report, or null when the spec has not been verified yet. */
export async function getProofReport(specId: string): Promise<ProofReport | null> {
  return get<ProofReport>(`/specs/${id(specId)}/report`);
}

export async function getConfig(): Promise<IntentConfig | null> {
  return get<IntentConfig>('/config');
}

export async function getAgents(): Promise<AgentStatus[]> {
  return (await get<AgentStatus[]>('/agents')) ?? [];
}

export async function getProviders(): Promise<ProvidersResponse> {
  return (await get<ProvidersResponse>('/providers')) ?? { default: null, providers: [] };
}
