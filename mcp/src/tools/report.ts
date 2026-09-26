import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SpecStore, verify, generateProofReport, proofReportToMarkdown } from '@intentguard/core';

/**
 * Registers the intent_report tool on the MCP server.
 * @param server The MCP server instance
 * @param rootDir The default project root directory
 */
export function registerReportTool(server: McpServer, rootDir: string): void {
  server.tool(
    'intent_report',
    'Generate a proof report showing each outcome met, scope respected, nothing broken. Suitable for commit messages and PR descriptions.',
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

        let proofReport = await store.loadReport(spec.id);
        if (!proofReport) {
          const verificationResult = await verify(rootDir, spec);
          proofReport = (await store.saveReport(generateProofReport(spec.id, verificationResult))).report;
        }

        const markdown = proofReportToMarkdown(proofReport);

        return {
          content: [{ type: 'text', text: markdown }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[intentguard] intent_report error: ${message}`);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true
        };
      }
    }
  );
}
