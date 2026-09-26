import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SpecStore, generateQuestions } from '@intentguard/core';

/**
 * Registers the intent_questions tool on the MCP server.
 * @param server The MCP server instance
 * @param rootDir The default project root directory
 */
export function registerQuestionsTool(server: McpServer, rootDir: string): void {
  server.tool(
    'intent_questions',
    "Find what the spec is still missing and return it as questions for the developer, most critical first. Ask the developer (you may make each question more specific using what you found in the code), wait for the answers, then record them with intent_update_spec. Never answer them with your own assumptions.",
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

        const questions = generateQuestions(spec);
        const text = questions.length
          ? [
              `Open questions for ${spec.id}. Ask the developer these before writing any code, then record the answers with intent_update_spec:`,
              ...questions.map((q, i) => `${i + 1}. [${q.severity}] (${q.section}) ${q.question}${q.context ? `\n   Context: ${q.context}` : ''}`),
            ].join('\n')
          : `No open questions for ${spec.id}. Call intent_readiness.`;

        return {
          content: [{ type: 'text', text }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[intentguard] intent_questions error: ${message}`);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true
        };
      }
    }
  );
}
