import chalk from 'chalk';
import type { 
  ReadinessScore, 
  ScopeCheckResult, 
  VerificationResult, 
  IntentSpec 
} from '@intentguard/core';

/**
 * Formats a ReadinessScore into a colorful string.
 * @param score The readiness score to format
 * @returns Formatted readiness string
 */
export function formatReadiness(score: ReadinessScore): string {
  let output = '';
  
  if (score.ready) {
    output += chalk.green(`✓ Spec is ready for implementation (${score.score}%)\n`);
  } else {
    output += chalk.red(`✗ Spec is NOT ready for implementation (${score.score}%)\n`);
  }

  output += chalk.bold('\nGates:\n');
  for (const gate of score.gates) {
    if (gate.status === 'pass') {
      output += chalk.green(`  ✓ ${gate.name} (+${gate.weight}%) — ${gate.message}\n`);
    } else if (gate.status === 'warn') {
      output += chalk.yellow(`  ⚠ ${gate.name} (${Math.round(gate.weight / 2)}%) — ${gate.message}\n`);
    } else {
      output += chalk.red(`  ✗ ${gate.name} (0%) — ${gate.message}\n`);
    }
  }

  if (score.blockers.length > 0) {
    output += chalk.bold('\nBlockers:\n');
    for (const blocker of score.blockers) {
      output += chalk.red(`  - ${blocker}\n`);
    }
  }

  return output;
}

/**
 * Formats a ScopeCheckResult into a colorful string.
 * @param result The scope check result to format
 * @returns Formatted scope check string
 */
export function formatScopeCheck(result: ScopeCheckResult): string {
  let output = `File: ${result.filePath}\n`;
  if (result.allowed) {
    output += chalk.green(`✓ Within scope (${result.reason})\n`);
  } else {
    output += chalk.red(`✗ Out of scope: ${result.reason}\n`);
  }

  if (result.matchedRule) {
    output += chalk.gray(`  Rule: ${result.matchedRule}\n`);
  }
  return output;
}

/**
 * Formats a VerificationResult into a colorful string.
 * @param result The verification result to format
 * @returns Formatted verification string
 */
export function formatVerification(result: VerificationResult): string {
  let output = '';
  if (result.passed) {
    output += chalk.green('✓ All checks passed\n');
  } else {
    output += chalk.red('✗ Verification failed\n');
  }

  if (result.scopeViolations.length > 0) {
    output += chalk.bold('\nScope Violations:\n');
    for (const file of result.scopeViolations) {
      output += chalk.red(`  ✗ Out-of-scope file modified: ${file}\n`);
    }
  }

  if (result.outcomesChecked.length > 0) {
    output += chalk.bold('\nOutcomes:\n');
    for (const check of result.outcomesChecked) {
      if (check.status === 'pass') {
        output += chalk.green(`  ✓ ${check.outcome}${check.testFile ? ` (${check.testFile})` : ''}\n`);
      } else if (check.status === 'fail') {
        output += chalk.red(`  ✗ ${check.outcome}${check.testFile ? ` (${check.testFile})` : ''}\n`);
      } else {
        output += chalk.yellow(`  ○ ${check.outcome} (untested)\n`);
      }
    }
  }

  if (result.healthMetricsChecked.length > 0) {
    output += chalk.bold('\nHealth Metrics:\n');
    for (const check of result.healthMetricsChecked) {
      if (check.status === 'pass') {
        output += chalk.green(`  ✓ ${check.metric}\n`);
      } else {
        output += chalk.yellow(`  ⚠ ${check.metric} (${check.status})\n`);
      }
    }
  }

  return output;
}

/**
 * Formats a summary of an IntentSpec.
 * @param spec The intent spec to format
 * @returns Formatted summary string
 */
export function formatSpecSummary(spec: IntentSpec): string {
  return `
${chalk.bold('ID:')} ${spec.id}
${chalk.bold('Status:')} ${spec.status}
${chalk.bold('Objective:')} ${spec.objective}
`.trim();
}

/**
 * Returns a formatted header string.
 * @param text The header text
 * @returns Formatted header
 */
export function header(text: string): string {
  return chalk.bold.blue(`\n=== ${text} ===\n`);
}

/**
 * Returns a formatted success string.
 * @param text The success text
 * @returns Formatted success message
 */
export function success(text: string): string {
  return chalk.green(`✓ ${text}`);
}

/**
 * Returns a formatted warning string.
 * @param text The warning text
 * @returns Formatted warning message
 */
export function warning(text: string): string {
  return chalk.yellow(`⚠ ${text}`);
}

/**
 * Returns a formatted error string.
 * @param text The error text
 * @returns Formatted error message
 */
export function error(text: string): string {
  return chalk.red(`✗ ${text}`);
}
