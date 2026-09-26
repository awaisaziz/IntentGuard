import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkEditAllowed } from '@intentguard/core';

/**
 * Registers the intent_check_scope tool on the MCP server.
 * @param server The MCP server instance
 * @param rootDir The default project root directory
 */
export function registerCheckScopeTool(server: McpServer, rootDir: string): void {
  server.tool(
    'intent_check_scope',
    'Check whether a file may be edited, before every edit. Returns ALLOWED only when the active IntentSpec has passed the readiness gate and the file is inside its scope; otherwise BLOCKED with the reason. The agent MUST call this before editing any file and MUST NOT edit a BLOCKED file.',
    {
      filePath: z.string().describe('Path of the file to edit (absolute, or relative to the repo root)'),
      specId: z.string().optional().describe('Spec ID (uses active spec if omitted)')
    },
    async ({ filePath, specId }) => {
      try {
        const decision = await checkEditAllowed(rootDir, filePath, { specId });
        return {
          content: [{ type: 'text', text: `${decision.allowed ? 'ALLOWED' : 'BLOCKED'}: ${decision.file}: ${decision.reason}` }]
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
