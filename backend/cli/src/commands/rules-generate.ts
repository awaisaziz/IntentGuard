import { AGENT_INTEGRATIONS, getRepoRoot, writeAgentRules } from '@intentguard/core';
import { success, error, warning } from '../ui/formatters.js';
import { selectAgents } from './mcp-setup.js';

interface RulesGenerateOptions {
  agent?: string;
}

/**
 * Generates agent rule files from the shared agent registry.
 * @param options Options for the rules-generate command
 */
export async function rulesGenerateCommand(options: RulesGenerateOptions): Promise<void> {
  try {
    const agents = selectAgents(options);
    if (!agents) {
      const known = AGENT_INTEGRATIONS.map(a => a.id).join(', ');
      console.log(warning(`Unknown agent "${options.agent}". Known agents: ${known}`));
      process.exit(1);
    }

    const repoRoot = await getRepoRoot();
    const written = new Set<string>();
    for (const agent of agents) {
      for (const file of await writeAgentRules(repoRoot, agent)) written.add(file);
    }
    for (const file of written) {
      console.log(success(`Generated rule file: ${file}`));
    }
  } catch (err: any) {
    console.error(error(`Rules generation failed: ${err.message}`));
    process.exit(1);
  }
}
