#!/usr/bin/env node
import { serve } from '@hono/node-server';
import { getRepoRoot } from '@intentguard/core';
import { createApp } from './app.js';

async function main() {
  const rootDir = process.env.INTENT_ROOT || (await getRepoRoot());
  const port = Number(process.env.INTENTGUARD_API_PORT) || 3848;

  const app = createApp(rootDir);
  serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, info => {
    console.log(`[intentguard-server] API listening on http://localhost:${info.port}/api`);
  });
}

main().catch(error => {
  console.error('[intentguard-server] Fatal error:', error);
  process.exit(1);
});
