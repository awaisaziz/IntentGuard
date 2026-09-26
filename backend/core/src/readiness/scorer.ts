import type { IntentSpec, ReadinessScore, ReadinessGate } from '../schema/intentspec.js';
import {
  checkObjectiveClarity,
  checkOutcomeMeasurability,
  checkEvidencePresence,
  checkScopeDefinition,
  checkEdgeCaseCoverage,
  checkVerificationCriteria
} from './gates.js';

/**
 * Computes the readiness score for a given IntentSpec.
 * @param spec The IntentSpec to score
 * @param threshold The passing score threshold (default 70)
 * @returns The readiness score, ready status, and details
 */
export function computeReadiness(spec: IntentSpec, threshold: number = 70): ReadinessScore {
  const gates: ReadinessGate[] = [
    checkObjectiveClarity(spec),
    checkOutcomeMeasurability(spec),
    checkEvidencePresence(spec),
    checkScopeDefinition(spec),
    checkEdgeCaseCoverage(spec),
    checkVerificationCriteria(spec),
  ];

  let score = 0;
  const blockers: string[] = [];

  for (const gate of gates) {
    if (gate.status === 'pass') {
      score += gate.weight;
    } else if (gate.status === 'warn') {
      score += gate.weight / 2;
    } else {
      blockers.push(`${gate.name}: ${gate.message}`);
    }
  }

  return {
    score,
    ready: score >= threshold,
    gates,
    blockers,
  };
}
