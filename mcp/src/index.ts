#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getRepoRoot } from '@intentguard/core';

import { registerCreateTool } from './tools/create.js';
import { registerGatherEvidenceTool } from './tools/gather-evidence.js';
import { registerQuestionsTool } from './tools/questions.js';
import { registerReadinessTool } from './tools/readiness.js';
import { registerGetSpecTool } from './tools/get-spec.js';
import { registerCheckScopeTool } from './tools/check-scope.js';
import { registerVerifyTool } from './tools/verify.js';
import { registerReportTool } from './tools/report.js';

async function main() {
  const rootDir = process.env.INTENT_ROOT || await getRepoRoot();
  
  if (!rootDir) {
    console.error('[intentguard] Could not determine repository root.');
    process.exit(1);
  }

  const server = new McpServer({
    name: 'intentguard',
    version: '0.1.0',
    description: 'IntentGuard — the intent layer for AI coding agents. Structure, gate, and verify every change.',
  });

  registerCreateTool(server, rootDir);
  registerGatherEvidenceTool(server, rootDir);
  registerQuestionsTool(server, rootDir);
  registerReadinessTool(server, rootDir);
  registerGetSpecTool(server, rootDir);
  registerCheckScopeTool(server, rootDir);
  registerVerifyTool(server, rootDir);
  registerReportTool(server, rootDir);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('[intentguard] MCP Server started and connected via stdio.');
}

main().catch((error) => {
  console.error('[intentguard] Fatal error:', error);
  process.exit(1);
});
