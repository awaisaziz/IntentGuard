#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getRepoRoot, loadIntentGuardEnv } from '@intentguard/core';
import { createIntentGuardServer } from './server.js';

async function main() {
  // Keys (e.g. WATSONX_API_KEY for spec drafting) live in the IntentGuard checkout's .env
  loadIntentGuardEnv();
  const rootDir = process.env.INTENT_ROOT || await getRepoRoot();

  if (!rootDir) {
    console.error('[intentguard] Could not determine repository root.');
    process.exit(1);
  }

  const server = createIntentGuardServer(rootDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[intentguard] MCP Server started and connected via stdio.');
}

main().catch((error) => {
  console.error('[intentguard] Fatal error:', error);
  process.exit(1);
});
