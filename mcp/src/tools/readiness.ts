import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SpecStore, computeReadiness, generateTimestamp } from '@intentguard/core';

/**
 * Registers the intent_readiness tool on the MCP server.
 * @param server The MCP server instance
 * @param rootDir The default project root directory
 */
export function registerReadinessTool(server: McpServer, rootDir: string): void {
  server.tool(
    'intent_readiness',
    'Score the spec against 6 readiness gates. Returns a score (0-100) and BLOCKS coding if critical gaps remain. The agent MUST NOT write code until this returns ready: true.',
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

        const readiness = computeReadiness(spec);

        if (readiness.ready) {
          spec.status = 'approved';
          spec.readinessScore = readiness.score;
          spec.updatedAt = generateTimestamp();
          await store.save(spec);
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(readiness, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[intentguard] intent_readiness error: ${message}`);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true
        };
      }
    }
  );
}
