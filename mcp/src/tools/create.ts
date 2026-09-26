import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { draftSpec } from '@intentguard/core';

/**
 * Registers the intent_create tool on the MCP server.
 * @param server The MCP server instance
 * @param defaultRootDir The default project root directory
 */
export function registerCreateTool(server: McpServer, defaultRootDir: string): void {
  server.tool(
    'intent_create',
    'Create a new IntentSpec from a raw developer request. Drafts a structured spec with Objective, Outcomes, Evidence, Constraints, Scope, Edge Cases, Health Metrics, and Verification sections.',
    {
      request: z.string().describe('The raw developer request'),
      projectPath: z.string().optional().describe('Project root path override')
    },
    async ({ request, projectPath }) => {
      try {
        const spec = await draftSpec(projectPath || defaultRootDir, request);

        return {
          content: [{ type: 'text', text: JSON.stringify(spec, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[intentguard] intent_create error: ${message}`);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true
        };
      }
    }
  );
}
