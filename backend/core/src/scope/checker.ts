import { minimatch } from 'minimatch';
import type { Scope, ScopeCheckResult } from '../schema/intentspec.js';

function normalizePath(p: string): string {
  let normalized = p.replace(/\\/g, '/');
  if (normalized.startsWith('./')) {
    normalized = normalized.substring(2);
  }
  return normalized;
}

export function checkScope(filePath: string, scope: Scope): ScopeCheckResult {
  const normalized = normalizePath(filePath);

  for (const pattern of scope.outOfScope || []) {
    if (minimatch(normalized, pattern)) {
      return { allowed: false, filePath: normalized, reason: 'Matched outOfScope rule', matchedRule: pattern };
    }
  }

  if (!scope.inScope || scope.inScope.length === 0) {
    return { allowed: true, filePath: normalized, reason: 'No inScope rules defined' };
  }

  for (const pattern of scope.inScope) {
    if (minimatch(normalized, pattern)) {
      return { allowed: true, filePath: normalized, reason: 'Matched inScope rule', matchedRule: pattern };
    }
  }

  return { allowed: false, filePath: normalized, reason: 'Did not match any inScope rules' };
}

export function checkScopeMultiple(filePaths: string[], scope: Scope): ScopeCheckResult[] {
  return filePaths.map(p => checkScope(p, scope));
}
