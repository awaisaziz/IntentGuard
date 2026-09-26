import path from 'node:path';
import type { ReadinessScore } from '../schema/intentspec.js';
import { SpecStore } from '../store/spec-store.js';
import { loadConfig } from '../store/config.js';
import { computeReadiness } from '../readiness/scorer.js';
import { checkScope } from './checker.js';
import { toPosixPath } from '../utils/home.js';

export type EditDecisionCode = 'allowed' | 'outside-repo' | 'intent-state' | 'no-spec' | 'not-ready' | 'out-of-scope';

export interface EditDecision {
  allowed: boolean;
  code: EditDecisionCode;
  /** Repository-relative POSIX path (or the input when it is outside the repository). */
  file: string;
  reason: string;
  specId?: string;
  readiness?: ReadinessScore;
}

/**
 * Converts an absolute or relative path to a repository-relative POSIX path.
 * Agents such as Claude Code pass absolute paths, which would never match scope globs.
 * @returns The relative path, or null when the file is outside the repository
 */
export function repoRelativePath(rootDir: string, file: string): string | null {
  const abs = path.resolve(rootDir, file);
  const rel = path.relative(path.resolve(rootDir), abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return toPosixPath(rel);
}

/**
 * The intent gate for a single file edit, shared by every enforcement point: the file must be
 * inside the repository, the active spec must pass the readiness gate, and the file must be
 * inside the spec's scope. IntentGuard's own state is only changed through its tools.
 */
export async function checkEditAllowed(rootDir: string, filePath: string, options: { specId?: string } = {}): Promise<EditDecision> {
  const rel = repoRelativePath(rootDir, filePath);
  if (!rel) {
    return { allowed: false, code: 'outside-repo', file: filePath, reason: 'The file is outside the repository IntentGuard is guarding.' };
  }
  if (rel.startsWith('.intent/')) {
    return {
      allowed: false,
      code: 'intent-state',
      file: rel,
      reason: 'IntentGuard state (.intent/) is changed only through the intent_* tools, e.g. intent_update_spec.',
    };
  }

  const store = new SpecStore(rootDir);
  const spec = options.specId ? await store.load(options.specId).catch(() => null) : await store.loadActive();
  if (!spec) {
    return { allowed: false, code: 'no-spec', file: rel, reason: 'There is no active IntentSpec. Call intent_create with the developer\'s request first.' };
  }

  const { readinessThreshold } = await loadConfig(rootDir);
  const readiness = computeReadiness(spec, readinessThreshold);
  if (!readiness.ready) {
    return {
      allowed: false,
      code: 'not-ready',
      file: rel,
      specId: spec.id,
      readiness,
      reason: `Spec ${spec.id} scores ${readiness.score}/100, below the ${readinessThreshold} readiness threshold. Ask the developer about: ${readiness.blockers.join('; ')}`,
    };
  }

  const scope = checkScope(rel, spec.scope ?? { inScope: [], outOfScope: [] });
  if (!scope.allowed) {
    return {
      allowed: false,
      code: 'out-of-scope',
      file: rel,
      specId: spec.id,
      readiness,
      reason: `${rel} is outside the scope of ${spec.id} (${scope.reason}${scope.matchedRule ? `: ${scope.matchedRule}` : ''}). Do not edit it. If it is really needed, explain why and ask the developer to widen the scope.`,
    };
  }

  return { allowed: true, code: 'allowed', file: rel, specId: spec.id, readiness, reason: `${scope.reason}${scope.matchedRule ? `: ${scope.matchedRule}` : ''}` };
}
