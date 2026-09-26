import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SpecStore, gatherEvidence, generateTimestamp, type Evidence } from '@intentguard/core';

/**
 * Registers the intent_gather_evidence tool on the MCP server.
 * @param server The MCP server instance
 * @param rootDir The default project root directory
 */
export function registerGatherEvidenceTool(server: McpServer, rootDir: string): void {
  server.tool(
    'intent_gather_evidence',
    'Collect evidence from the repo: affected files, related tests, documentation, and current behavior for the active spec.',
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

        const rawRequest = spec.rawRequest || spec.evidence?.find(e => e.type === 'request')?.excerpt || spec.objective;
        const evidenceResult = await gatherEvidence(rootDir, rawRequest);

        const newEvidence: Evidence[] = evidenceResult.affectedFiles.map((file: string, idx: number) => ({
          id: `ev-gather-${Date.now()}-${idx}`,
          type: 'observation' as const,
          excerpt: `Gathered evidence: ${file}`,
          anchors: ['objective']
        }));

        spec.evidence = [...(spec.evidence || []), ...newEvidence];
        spec.updatedAt = generateTimestamp();

        await store.save(spec);

        return {
          content: [{ type: 'text', text: JSON.stringify(evidenceResult, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[intentguard] intent_gather_evidence error: ${message}`);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true
        };
      }
    }
  );
}
