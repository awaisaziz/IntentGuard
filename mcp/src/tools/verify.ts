import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SpecStore, verify, generateProofReport } from '@intentguard/core';

/**
 * Registers the intent_verify tool on the MCP server.
 * @param server The MCP server instance
 * @param rootDir The default project root directory
 */
export function registerVerifyTool(server: McpServer, rootDir: string): void {
  server.tool(
    'intent_verify',
    'Verify the current git diff against the spec. Checks scope violations, maps outcomes to test results, and checks health metrics. Call this after implementation is complete.',
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

        const verificationResult = await verify(rootDir, spec);
        const proofReport = generateProofReport(spec.id, verificationResult);
        
        const { report: savedReport } = await store.saveReport(proofReport);

        return {
          content: [{ type: 'text', text: JSON.stringify(savedReport.verification, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[intentguard] intent_verify error: ${message}`);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true
        };
      }
    }
  );
}
