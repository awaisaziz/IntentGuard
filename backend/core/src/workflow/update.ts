import type { EdgeCase, Evidence, EvidenceType, IntentSpec, ReadinessScore } from '../schema/intentspec.js';
import { SpecStore } from '../store/spec-store.js';
import { loadConfig } from '../store/config.js';
import { computeReadiness } from '../readiness/scorer.js';
import { generateTimestamp } from '../utils/id.js';

export const EVIDENCE_TYPES: EvidenceType[] = ['friction', 'quote', 'observation', 'metric', 'request'];

const APPROVED_STATUSES = new Set(['approved', 'shipped', 'verified']);
export const isApproved = (spec: IntentSpec) => APPROVED_STATUSES.has(spec.status);

export interface SpecUpdateResult {
  spec: IntentSpec;
  changed: string[];
  readiness: ReadinessScore;
  threshold: number;
  /** True when the spec had been approved and the change sent it back to draft. */
  approvalReset: boolean;
}

const strings = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map(s => s.trim()) : undefined;

/**
 * Applies developer answers and repository findings to a spec. Lists replace the existing
 * section; evidence is appended. Any change to an approved spec sends it back to draft, so a
 * spec cannot be widened after approval without being approved again.
 * @param rootDir Repository root
 * @param input Untrusted fields (from a model or an MCP client); malformed entries are dropped
 * @param specId Spec to update (default: the active spec)
 * @throws When there is no such spec or no valid field was provided
 */
export async function updateSpec(rootDir: string, input: Record<string, unknown>, specId?: string): Promise<SpecUpdateResult> {
  const store = new SpecStore(rootDir);
  const spec = specId ? await store.load(specId).catch(() => null) : await store.loadActive();
  if (!spec) {
    throw new Error(specId ? `Spec ${specId} not found.` : 'There is no active IntentSpec. Create one first (intent_create).');
  }

  const wasApproved = isApproved(spec);
  const changed: string[] = [];
  for (const key of ['objective', 'userGoal'] as const) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      spec[key] = value.trim();
      changed.push(key);
    }
  }
  for (const key of ['outcomes', 'constraints', 'healthMetrics', 'verification'] as const) {
    const list = strings(input[key]);
    if (list) {
      spec[key] = list;
      changed.push(key);
    }
  }
  const inScope = strings(input.inScope);
  const outOfScope = strings(input.outOfScope);
  if (inScope || outOfScope) {
    spec.scope = {
      inScope: inScope ?? spec.scope?.inScope ?? [],
      outOfScope: outOfScope ?? spec.scope?.outOfScope ?? [],
    };
    changed.push('scope');
  }
  if (Array.isArray(input.edgeCases)) {
    spec.edgeCases = (input.edgeCases as EdgeCase[]).filter(
      e => typeof e?.scenario === 'string' && typeof e?.expectedBehavior === 'string'
    );
    changed.push('edgeCases');
  }
  if (Array.isArray(input.evidence)) {
    const added: Evidence[] = (input.evidence as Evidence[])
      .filter(e => EVIDENCE_TYPES.includes(e?.type) && typeof e?.excerpt === 'string' && e.excerpt.trim())
      .map((e, i) => ({
        id: `ev-${Date.now().toString(36)}-${i}`,
        type: e.type,
        excerpt: e.excerpt.trim(),
        ...(typeof e.source === 'string' && e.source.trim() ? { source: e.source.trim() } : {}),
      }));
    if (added.length) {
      spec.evidence = [...(spec.evidence ?? []), ...added];
      changed.push('evidence');
    }
  }
  if (changed.length === 0) throw new Error('No valid spec fields were provided.');

  if (wasApproved) spec.status = 'draft';
  spec.updatedAt = generateTimestamp();
  const { spec: saved } = await store.save(spec);
  const { readinessThreshold } = await loadConfig(rootDir);
  return {
    spec: saved,
    changed,
    readiness: computeReadiness(saved, readinessThreshold),
    threshold: readinessThreshold,
    approvalReset: wasApproved,
  };
}
