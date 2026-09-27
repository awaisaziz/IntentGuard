import { connectRepo, getRepoRoot } from '@intentguard/core';
import { success, error } from '../ui/formatters.js';
import { selectAgentsOrExit, formatCommandError } from './mcp-setup.js';

interface RulesGenerateOptions {
  agent?: string;
}

/**
 * Generates agent rule files from the shared agent registry.
 * @param options Options for the rules-generate command
 */
export async function rulesGenerateCommand(options: RulesGenerateOptions): Promise<void> {
  try {
    const agents = selectAgentsOrExit(options);
    const result = await connectRepo(await getRepoRoot(), { agents, mcp: false });
    for (const file of result.rules) {
      console.log(success(`Generated rule file: ${file}`));
    }
  } catch (err) {
    console.error(error(`Rules generation failed: ${formatCommandError(err)}`));
    process.exit(1);
  }
}
