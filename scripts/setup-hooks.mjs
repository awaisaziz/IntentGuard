#!/usr/bin/env node
/**
 * Points git at the repo's versioned hooks (.githooks) so the PII/secret
 * pre-commit check runs for every clone. Safe to re-run; silent outside git.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
if (!existsSync(join(root, '.git')) || !existsSync(join(root, '.githooks'))) process.exit(0);
if (process.env.INTENTGUARD_SKIP_HOOKS === '1' || process.env.CI) process.exit(0);

try {
  const current = execFileSync('git', ['config', '--get', 'core.hooksPath'], { cwd: root, encoding: 'utf8' }).trim();
  if (current === '.githooks') process.exit(0);
} catch {
  // not set yet
}

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: root, stdio: 'ignore' });
  console.log('[intentguard] git hooks enabled (.githooks/pre-commit runs the PII and secret scan).');
} catch (err) {
  console.warn(`[intentguard] could not enable git hooks: ${err instanceof Error ? err.message : err}`);
}
