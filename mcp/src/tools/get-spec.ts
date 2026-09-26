import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SpecStore, specToMarkdown } from '@intentguard/core';

/**
 * Registers the intent_get_spec tool on the MCP server.
 * @param server The MCP server instance
 * @param rootDir The default project root directory
 */
export function registerGetSpecTool(server: McpServer, rootDir: string): void {
  server.tool(
    'intent_get_spec',
    'Get the approved IntentSpec as the working brief for implementation. Returns all 8 sections in a structured format the agent should follow.',
    {
      specId: z.string().optional().describe('Spec ID (uses active spec if omitted)')
    },
    async ({ specId }) => {
      try {
        const store = new SpecStore(rootDir);
        await store.init();

        const spec = specId ? await store.load(specId) : await store.loadActive();
        if (!spec) {
          throw new Error(`Spec ${specId ? `with ID ${specId}` : '(active)'} not found.`);
        }

        const markdown = specToMarkdown(spec);

        return {
          content: [{ type: 'text', text: markdown }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[intentguard] intent_get_spec error: ${message}`);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true
        };
      }
    }
  );
}
