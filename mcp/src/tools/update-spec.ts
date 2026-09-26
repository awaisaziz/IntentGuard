import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { EVIDENCE_TYPES, updateSpec } from '@intentguard/core';

/**
 * Registers the intent_update_spec tool on the MCP server: how the developer's answers and the
 * agent's findings get into the spec, so readiness can actually rise.
 * @param server The MCP server instance
 * @param rootDir The default project root directory
 */
export function registerUpdateSpecTool(server: McpServer, rootDir: string): void {
  server.tool(
    'intent_update_spec',
    "Record the developer's answers to intent_questions and your repository findings in the IntentSpec. Lists replace the existing section; evidence is appended. Changing an approved spec sends it back to draft, so it must pass intent_readiness again. Returns the new readiness score.",
    {
      specId: z.string().optional().describe('Spec ID (uses active spec if omitted)'),
      objective: z.string().optional().describe('What problem is being solved, for whom, and why it matters'),
      userGoal: z.string().optional().describe('What the user is trying to achieve'),
      outcomes: z.array(z.string()).optional().describe('Observable, testable results (numbers, states, responses)'),
      constraints: z.array(z.string()).optional().describe('Hard boundaries that must be respected'),
      inScope: z.array(z.string()).optional().describe('Glob patterns of files that may change, relative to the repo root, e.g. "src/booking/**"'),
      outOfScope: z.array(z.string()).optional().describe('Glob patterns of files that must not change'),
      edgeCases: z
        .array(z.object({ scenario: z.string(), expectedBehavior: z.string() }))
        .optional()
        .describe('Boundary conditions and failures with their expected behavior'),
      healthMetrics: z.array(z.string()).optional().describe('What must not get worse'),
      verification: z.array(z.string()).optional().describe('How each outcome will be proven (tests, checks, manual steps)'),
      evidence: z
        .array(
          z.object({
            type: z.enum(EVIDENCE_TYPES as [string, ...string[]]),
            excerpt: z.string(),
            source: z.string().optional().describe('File path, ticket, or other source'),
          })
        )
        .optional()
        .describe('Facts from the repository or the developer that support the change'),
    },
    async ({ specId, ...fields }) => {
      try {
        const { spec, changed, readiness, threshold, approvalReset } = await updateSpec(rootDir, fields, specId);
        const lines = [
          `Updated ${changed.join(', ')} of ${spec.id}.`,
          `Readiness: ${readiness.score}/100 (threshold ${threshold}) - ${readiness.ready ? 'READY' : 'BLOCKED'}.`,
          ...(readiness.blockers.length ? ['Blockers:', ...readiness.blockers.map(b => `- ${b}`)] : []),
          ...(approvalReset ? ['The spec was approved before this change and is back to draft: run intent_readiness again.'] : []),
          readiness.ready
            ? 'Next: call intent_readiness, then summarize the spec for the developer before coding.'
            : 'Next: call intent_questions and ask the developer about the remaining gaps.',
        ];
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[intentguard] intent_update_spec error: ${message}`);
        return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
      }
    }
  );
}
