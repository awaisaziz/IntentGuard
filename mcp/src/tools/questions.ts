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
    "Analyze the spec and return only the questions the codebase can't answer. These are gaps that need human input before implementation can begin.",
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

        return {
          content: [{ type: 'text', text: JSON.stringify(questions, null, 2) }]
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
