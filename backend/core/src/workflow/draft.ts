import type { IntentSpec } from '../schema/intentspec.js';
import { SpecStore } from '../store/spec-store.js';
import { loadConfig } from '../store/config.js';
import { gatherEvidence } from '../evidence/gatherer.js';
import { resolveProvider } from '../llm/provider.js';
import { generateSpecId, generateTimestamp } from '../utils/id.js';

/**
 * Drafts an IntentSpec from a raw request, saves it, and marks it active.
 * Shared by the CLI, the MCP server, and the HTTP API so every entry point
 * produces the same spec shape.
 * @param rootDir Project root directory
 * @param request The raw developer request
 * @returns The saved spec
 */
export async function draftSpec(rootDir: string, request: string): Promise<IntentSpec> {
  const store = new SpecStore(rootDir);
  await store.init();

  const evidence = await gatherEvidence(rootDir, request);
  const config = await loadConfig(rootDir);

  let draft: Partial<IntentSpec> = {};
  try {
    draft = await resolveProvider(config).draft(request, evidence);
  } catch (err) {
    console.error('[intentguard] provider.draft error:', err);
  }

  const now = generateTimestamp();
  const spec: IntentSpec = {
    id: generateSpecId(),
    status: 'draft',
    objective: draft.objective || request,
    outcomes: draft.outcomes || [],
    evidence: draft.evidence || [
      { id: 'ev-1', type: 'request', excerpt: request, anchors: ['objective'] },
      ...evidence.affectedFiles.map((f, i) => ({
        id: `ev-file-${i}`,
        type: 'observation' as const,
        excerpt: `Gathered file evidence: ${f}`,
        anchors: ['objective'],
      })),
    ],
    scope: draft.scope || { inScope: evidence.affectedFiles, outOfScope: [] },
    edgeCases: draft.edgeCases || [],
    constraints: draft.constraints || [],
    healthMetrics: draft.healthMetrics || [],
    verification: draft.verification || [],
    createdAt: now,
    updatedAt: now,
    rawRequest: request,
  };

  const { spec: saved, redactions } = await store.save(spec);
  if (redactions.length > 0) {
    const where = redactions.map(r => `${r.path} (${r.label})`).join(', ');
    console.error(`[intentguard] Redacted ${redactions.length} personal/secret value(s) before saving ${saved.id}: ${where}`);
  }
  await store.setActive(saved.id);
  return saved;
}
