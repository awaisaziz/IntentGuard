import type { IntentSpec, ReadinessGate } from '../schema/intentspec.js';

export function checkObjectiveClarity(spec: IntentSpec): ReadinessGate {
  const objective = spec.objective || '';
  let status: 'pass' | 'warn' | 'fail' = 'fail';
  let message = 'Objective is empty or missing';

  if (objective.length > 20) {
    status = 'pass';
    message = 'Objective is clear and well-defined';
  } else if (objective.length > 0) {
    status = 'warn';
    message = 'Objective is too short, should be more descriptive';
  }

  return { name: 'Objective Clarity', weight: 20, status, message };
}

export function checkOutcomeMeasurability(spec: IntentSpec): ReadinessGate {
  const outcomes = spec.outcomes || [];
  let status: 'pass' | 'warn' | 'fail' = 'fail';
  let message = 'No outcomes defined';

  if (outcomes.length > 0) {
    const validOutcomes = outcomes.filter(o => o.length > 10);
    if (validOutcomes.length === outcomes.length) {
      status = 'pass';
      message = 'All outcomes are detailed';
    } else if (validOutcomes.length > 0) {
      status = 'warn';
      message = 'Some outcomes are too short or vague';
    }
  }

  return { name: 'Outcome Measurability', weight: 20, status, message };
}

export function checkEvidencePresence(spec: IntentSpec): ReadinessGate {
  const evidence = spec.evidence || [];
  let status: 'pass' | 'warn' | 'fail' = 'fail';
  let message = 'No evidence provided';

  if (evidence.length > 0) {
    status = 'pass';
    message = 'Evidence is present';
  }

  return { name: 'Evidence Presence', weight: 15, status, message };
}

export function checkScopeDefinition(spec: IntentSpec): ReadinessGate {
  const scope = spec.scope;
  let status: 'pass' | 'warn' | 'fail' = 'fail';
  let message = 'Scope is undefined';

  if (scope && scope.inScope.length > 0 && scope.outOfScope.length > 0) {
    status = 'pass';
    message = 'Scope properly defines boundaries';
  } else if (scope && (scope.inScope.length > 0 || scope.outOfScope.length > 0)) {
    status = 'warn';
    message = 'Scope is partially defined';
  }

  return { name: 'Scope Definition', weight: 15, status, message };
}

export function checkEdgeCaseCoverage(spec: IntentSpec): ReadinessGate {
  const edgeCases = spec.edgeCases || [];
  let status: 'pass' | 'warn' | 'fail' = 'fail';
  let message = 'No edge cases covered';

  if (edgeCases.length > 0) {
    status = 'pass';
    message = 'Edge cases are defined';
  }

  return { name: 'Edge Case Coverage', weight: 15, status, message };
}

export function checkVerificationCriteria(spec: IntentSpec): ReadinessGate {
  const verification = spec.verification || [];
  let status: 'pass' | 'warn' | 'fail' = 'fail';
  let message = 'No verification criteria defined';

  if (verification.length > 0) {
    status = 'pass';
    message = 'Verification criteria are present';
  }

  return { name: 'Verification Criteria', weight: 15, status, message };
}
