#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { getRepoRoot, hasWatsonxCredentials, loadIntentGuardEnv } from '@intentguard/core';
import { createApp, DEFAULT_ALLOWED_ORIGINS } from './app.js';

/** `--repo <path>` wins over INTENT_ROOT; relative paths are taken from where the command was typed. */
function repoArg(): string | undefined {
  const i = process.argv.indexOf('--repo');
  const value = i !== -1 ? process.argv[i + 1] : undefined;
  return value ? path.resolve(process.env.INIT_CWD || process.cwd(), value) : undefined;
}

async function main() {
  loadIntentGuardEnv();
  const target = repoArg() || process.env.INTENT_ROOT || process.cwd();
  if (!existsSync(target)) throw new Error(`Repository not found: ${target}`);
  const rootDir = await getRepoRoot(target);
  const port = Number(process.env.INTENTGUARD_API_PORT) || 3848;
  const extraOrigins = (process.env.INTENTGUARD_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const app = createApp(rootDir, { allowedOrigins: [...DEFAULT_ALLOWED_ORIGINS, ...extraOrigins] });
  serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, info => {
    console.log(`[intentguard-server] API listening on http://localhost:${info.port}/api`);
    console.log(`[intentguard-server] Guarding ${rootDir}`);
    if (!hasWatsonxCredentials()) {
      console.log('[intentguard-server] watsonx is not configured: chat is disabled until WATSONX_API_KEY and WATSONX_PROJECT_ID are in .env');
    }
  });
}

main().catch(error => {
  console.error('[intentguard-server] Fatal error:', error);
  process.exit(1);
});
