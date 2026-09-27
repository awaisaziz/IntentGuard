/**
 * Frontend API client — calls the IntentGuard backend server.
 *
 * On the server side (RSC / route handlers) we call the backend directly.
 * On the client side the Next.js rewrite proxies /api/* → backend.
 */

const IS_SERVER = typeof window === 'undefined';
const BACKEND_URL = process.env.INTENTGUARD_API_URL ?? 'http://localhost:3848';

/** Build an absolute URL that works both on the server and in the browser. */
function apiUrl(path: string): string {
  if (IS_SERVER) return `${BACKEND_URL}/api${path}`;
  // In the browser, use the Next.js rewrite proxy so CORS is not an issue
  return `/api${path}`;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  return res;
}

export interface SpecScope {
  inScope: string[];
  outOfScope: string[];
}

export interface SpecEvidence {
  type: string;
  excerpt: string;
  source?: string;
  trust?: string;
  /** Alias for excerpt — kept for component compatibility */
  description?: string;
  /** Alias for trust — kept for component compatibility */
  trustTier?: string;
}

export interface Spec {
  id: string;
  status: 'draft' | 'validated' | 'approved' | 'shipped' | 'verified';
  objective: string;
  outcomes: string[];
  evidence?: SpecEvidence[];
  constraints?: string[];
  scope?: SpecScope;
  edgeCases?: { scenario: string; expectedBehavior: string }[];
  healthMetrics?: string[];
  verification?: string[];
  problemSeverity?: string;
  userGoal?: string;
  createdAt?: number;
  updatedAt?: number;
  readinessScore?: number;
  active?: boolean;
}

export interface ReadinessGate {
  name: string;
  weight?: number;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export interface ReadinessResult {
  score: number;
  ready: boolean;
  gates: ReadinessGate[];
}

function normaliseEvidence(spec: Spec): Spec {
  if (spec.evidence) {
    spec.evidence = spec.evidence.map(e => ({
      ...e,
      description: e.description ?? e.excerpt,
      trustTier: e.trustTier ?? e.trust ?? 'unreviewed',
    }));
  }
  return spec;
}

export async function getProjectRoot(): Promise<string> {
  try {
    const res = await apiFetch('/config');
    const data = (await res.json()) as { rootDir?: string };
    return data.rootDir ?? '.';
  } catch {
    return '.';
  }
}

export async function getAllSpecs(): Promise<Spec[]> {
  try {
    const res = await apiFetch('/specs');
    if (!res.ok) return [];
    const specs = (await res.json()) as Spec[];
    return specs.map(normaliseEvidence);
  } catch {
    return [];
  }
}

export async function getSpecById(id: string): Promise<Spec | null> {
  try {
    const res = await apiFetch(`/specs/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return normaliseEvidence((await res.json()) as Spec);
  } catch {
    return null;
  }
}

export async function activateSpec(id: string): Promise<{ activeSpecId: string }> {
  const res = await apiFetch(`/specs/${encodeURIComponent(id)}/activate`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Failed to activate spec (${res.status})`);
  }
  return res.json();
}

export async function createSpec(request: string): Promise<Spec> {
  const res = await apiFetch('/specs', {
    method: 'POST',
    body: JSON.stringify({ request }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Failed to create spec (${res.status})`);
  }
  return (await res.json()) as Spec;
}

export interface SpecQuestion {
  id: string;
  section: string;
  severity: 'critical' | 'important' | 'nice-to-have';
  question: string;
  context?: string;
}

export async function getSpecQuestions(id: string): Promise<SpecQuestion[]> {
  const res = await apiFetch(`/specs/${encodeURIComponent(id)}/questions`);
  if (!res.ok) return [];
  return (await res.json()) as SpecQuestion[];
}

export async function updateSpecAnswers(id: string, answers: Record<string, unknown>): Promise<Spec> {
  const res = await apiFetch(`/specs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(answers),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Failed to update spec (${res.status})`);
  }
  return normaliseEvidence((await res.json()) as Spec);
}

export async function deleteSpec(id: string): Promise<void> {
  const res = await apiFetch(`/specs/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Failed to delete spec (${res.status})`);
  }
}

export async function getActiveSpec(): Promise<Spec | null> {
  try {
    const res = await apiFetch('/specs/active');
    if (!res.ok) return null;
    return normaliseEvidence((await res.json()) as Spec);
  } catch {
    return null;
  }
}

export async function getSpecReadiness(id: string): Promise<ReadinessResult | null> {
  try {
    const res = await apiFetch(`/specs/${encodeURIComponent(id)}/readiness`);
    if (!res.ok) return null;
    return (await res.json()) as ReadinessResult;
  } catch {
    return null;
  }
}

export async function getProofReport(id: string): Promise<unknown> {
  try {
    const res = await apiFetch(`/specs/${encodeURIComponent(id)}/report`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export interface AgentStatus {
  id: string;
  name: string;
  mcpConfigPath: string;
  mcpConfigured: boolean;
  rulesInstalled: boolean;
}

export interface IntentConfig {
  rootDir?: string;
  projectName?: string;
  llmProvider?: string;
  readinessThreshold?: number;
  specDir?: string;
  reportDir?: string;
  commands?: Record<string, string>;
  privacy?: Record<string, boolean>;
}

export async function getConfig(): Promise<IntentConfig> {
  try {
    const res = await apiFetch('/config');
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

export async function getAgentStatuses(): Promise<AgentStatus[]> {
  try {
    const res = await apiFetch('/agents');
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ─── Verify ──────────────────────────────────────────────────────────────────

export async function runVerify(id: string): Promise<unknown> {
  const res = await apiFetch(`/specs/${encodeURIComponent(id)}/verify`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Verification failed (${res.status})`);
  }
  return res.json();
}

// ─── Commit ───────────────────────────────────────────────────────────────────

export interface CommitResult {
  hash: string;
  spec: Spec;
  defaultMessage: string;
}

export async function commitSpec(id: string, message?: string): Promise<CommitResult> {
  const res = await apiFetch(`/specs/${encodeURIComponent(id)}/commit`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Commit failed (${res.status})`);
  }
  return res.json();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export interface InitResult {
  rootDir: string;
  projectName: string | null;
}

export async function initRepo(): Promise<InitResult> {
  const res = await apiFetch('/init', { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Init failed (${res.status})`);
  }
  return res.json();
}

// ─── Connect ──────────────────────────────────────────────────────────────────

export interface ConnectResult {
  root: string;
  initialized: boolean;
  commands: Record<string, string>;
  mcpConfigs: string[];
  rules: string[];
  excluded: string[];
  trackedWarnings: string[];
}

export async function connectRepo(agent?: string, mcpOnly?: boolean, rulesOnly?: boolean): Promise<ConnectResult> {
  const res = await apiFetch('/connect', {
    method: 'POST',
    body: JSON.stringify({ agent, mcpOnly, rulesOnly }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Connect failed (${res.status})`);
  }
  return res.json();
}

// ─── Scope check ─────────────────────────────────────────────────────────────

export interface ScopeCheckResult {
  allowed: boolean;
  reason: string;
  matchedRule?: string;
}

export async function checkFileScope(specId: string, filePath: string): Promise<ScopeCheckResult> {
  const res = await apiFetch(`/specs/${encodeURIComponent(specId)}/scope-check`, {
    method: 'POST',
    body: JSON.stringify({ filePath }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `Scope check failed (${res.status})`);
  }
  return res.json();
}

// ─── Chat models ─────────────────────────────────────────────────────────────

export async function listChatModels(): Promise<string[]> {
  const res = await apiFetch('/chat/models');
  if (!res.ok) return [];
  const data = await res.json() as { models: string[] };
  return data.models ?? [];
}
