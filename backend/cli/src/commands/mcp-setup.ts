import {
  AGENT_INTEGRATIONS,
  getAgent,
  getRepoRoot,
  writeAgentMcpConfig,
  type AgentIntegration,
} from '@intentguard/core';
import { success, error, warning } from '../ui/formatters.js';

interface McpSetupOptions {
  all?: boolean;
  agent?: string;
}

/**
 * Resolves which agents a command targets from --all / --agent.
 * @returns The selected agents, or null if the agent name is unknown
 */
export function selectAgents(options: McpSetupOptions): AgentIntegration[] | null {
  if (options.all || !options.agent || options.agent === 'all') return AGENT_INTEGRATIONS;
  const agent = getAgent(options.agent);
  return agent ? [agent] : null;
}

/**
 * Writes the IntentGuard MCP server entry into each selected agent's config.
 * @param options Options for the mcp-setup command
 */
export async function mcpSetupCommand(options: McpSetupOptions): Promise<void> {
  try {
    const agents = selectAgents(options);
    if (!agents) {
      const known = AGENT_INTEGRATIONS.map(a => a.id).join(', ');
      console.log(warning(`Unknown agent "${options.agent}". Known agents: ${known}`));
      process.exit(1);
    }

    const repoRoot = await getRepoRoot();
    for (const agent of agents) {
      const written = await writeAgentMcpConfig(repoRoot, agent);
      console.log(success(`Configured ${agent.name} MCP (${written}).`));
    }
  } catch (err: any) {
    console.error(error(`MCP setup failed: ${err.message}`));
    process.exit(1);
  }
}
