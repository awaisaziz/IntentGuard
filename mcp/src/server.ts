import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerCreateTool } from './tools/create.js';
import { registerGatherEvidenceTool } from './tools/gather-evidence.js';
import { registerQuestionsTool } from './tools/questions.js';
import { registerReadinessTool } from './tools/readiness.js';
import { registerGetSpecTool } from './tools/get-spec.js';
import { registerCheckScopeTool } from './tools/check-scope.js';
import { registerVerifyTool } from './tools/verify.js';
import { registerReportTool } from './tools/report.js';
import { registerUpdateSpecTool } from './tools/update-spec.js';

/**
 * Sent to the client at connect time; clients that support server instructions show them to
 * the model, so the lifecycle applies even where no rules file is loaded.
 */
export const SERVER_INSTRUCTIONS = `IntentGuard is the intent layer for this repository. For every change request:
1. intent_create with the developer's request, then intent_gather_evidence and read the relevant code.
2. intent_questions: ask the developer the open questions and wait for answers. Never fill gaps with assumptions.
3. intent_update_spec: record the answers and your findings (measurable outcomes, scope globs, edge cases, verification).
4. intent_readiness must return ready: true before any code is written.
5. intent_check_scope before editing each file; never edit a BLOCKED file.
6. intent_verify and intent_report before calling the work done.`;

/**
 * Builds the IntentGuard MCP server for one repository.
 * @param rootDir Repository the server guards
 */
export function createIntentGuardServer(rootDir: string): McpServer {
  const server = new McpServer(
    {
      name: 'intentguard',
      version: '0.1.0',
    },
    { instructions: SERVER_INSTRUCTIONS }
  );

  registerCreateTool(server, rootDir);
  registerGatherEvidenceTool(server, rootDir);
  registerQuestionsTool(server, rootDir);
  registerUpdateSpecTool(server, rootDir);
  registerReadinessTool(server, rootDir);
  registerGetSpecTool(server, rootDir);
  registerCheckScopeTool(server, rootDir);
  registerVerifyTool(server, rootDir);
  registerReportTool(server, rootDir);
  return server;
}
