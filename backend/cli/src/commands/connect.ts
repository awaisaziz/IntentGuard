import chalk from 'chalk';
import { connectRepo, type AgentId } from '@intentguard/core';
import { header, success, error, warning } from '../ui/formatters.js';
import { resolveRepo, selectAgentsOrExit, formatCommandError } from './mcp-setup.js';

interface ConnectOptions {
  agent?: string;
}

const NEXT_STEPS: Record<AgentId, string> = {
  claude: 'Claude Code: start a new session in the repo and approve the "intentguard" server when asked (check: `claude mcp list`, or /mcp in a session).',
  bob: 'IBM Bob: open the repo folder, switch to Advanced mode (MCP tools need it), and refresh the MCP tab; Bob Shell: `bob mcp list`.',
  codex: 'Codex: run `codex` in the repo and trust the project when asked (project .codex/config.toml loads only for trusted projects); check with /mcp.',
  gemini: 'Gemini CLI: run `gemini` in the repo and trust the folder if asked (check: `gemini mcp list`, or /mcp in a session).',
  antigravity: 'Antigravity: open the repo folder, then Agent panel > … > MCP Servers > refresh; "intentguard" comes from .agents/mcp_config.json.',
  cursor: 'Cursor: open the repo and enable "intentguard" under Settings > MCP.',
};

/**
 * Connects IntentGuard to a repository so any supported agent working there uses the intent layer.
 * @param repo Path to the repository (default: the current one)
 */
export async function connectCommand(repo: string | undefined, options: ConnectOptions): Promise<void> {
  try {
    const agents = selectAgentsOrExit(options);
    const result = await connectRepo(await resolveRepo(repo), { agents });

    console.log(header(`IntentGuard connected: ${result.root}`));
    console.log(result.initialized ? success('Created .intent/config.json') : success('Using existing .intent/config.json'));
    const checks = Object.entries(result.commands);
    console.log(
      checks.length
        ? success(`Checks the chat agent may run: ${checks.map(([k, v]) => `${k} (${v})`).join(', ')}`)
        : warning('No test/lint commands detected. Add them under "commands" in .intent/config.json so the agent can run them.')
    );
    for (const file of result.mcpConfigs) console.log(success(`MCP config: ${file}`));
    for (const file of result.rules) console.log(success(`Rules: ${file}`));
    if (result.excluded.length) {
      console.log(success(`Kept out of git via .git/info/exclude: ${result.excluded.join(', ')}`));
    }
    for (const file of result.trackedWarnings) {
      console.log(warning(`${file} is tracked by git and now holds machine-specific paths. Do not commit it.`));
    }

    console.log(chalk.bold('\nNext steps'));
    for (const agent of agents) console.log(`  • ${NEXT_STEPS[agent.id]}`);
    console.log(`  • Chat agent (IBM watsonx): pnpm chat --repo "${result.root}"`);
  } catch (err) {
    console.error(error(`Connect failed: ${formatCommandError(err)}`));
    process.exit(1);
  }
}
