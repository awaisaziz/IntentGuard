import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SpecStore, checkScope, type ScopeCheckResult } from '@intentguard/core';

/**
 * Registers the intent_check_scope tool on the MCP server.
 * @param server The MCP server instance
 * @param rootDir The default project root directory
 */
export function registerCheckScopeTool(server: McpServer, rootDir: string): void {
  server.tool(
    'intent_check_scope',
    'Check if a file is within the allowed Scope before editing. Returns ALLOWED or BLOCKED. The agent MUST call this before editing any file and MUST NOT edit BLOCKED files.',
    {
      filePath: z.string().describe('Relative path to the file the agent wants to edit'),
      specId: z.string().optional().describe('Spec ID (uses active spec if omitted)')
    },
    async ({ filePath, specId }) => {
      try {
        const store = new SpecStore(rootDir);
        await store.init();

        const spec = specId ? await store.load(specId) : await store.loadActive();
        if (!spec) {
          throw new Error(`Spec ${specId ? `with ID ${specId}` : '(active)'} not found.`);
        }

        let scopeResult: ScopeCheckResult;
        if (spec.scope) {
          scopeResult = checkScope(filePath, spec.scope);
        } else {
          scopeResult = { allowed: true, filePath, reason: 'No scope defined in the spec.' };
        }

        const resultText = scopeResult.allowed ? 'ALLOWED' : 'BLOCKED';
        const responseText = `${resultText}: ${scopeResult.reason}`;

        return {
          content: [{ type: 'text', text: responseText }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[intentguard] intent_check_scope error: ${message}`);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true
        };
      }
    }
  );
}
