#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { newCommand } from './commands/new.js';
import { checkCommand } from './commands/check.js';
import { verifyCommand } from './commands/verify.js';
import { reportCommand } from './commands/report.js';
import { commitCommand } from './commands/commit.js';
import { mcpSetupCommand } from './commands/mcp-setup.js';
import { rulesGenerateCommand } from './commands/rules-generate.js';
import { connectCommand } from './commands/connect.js';
import { chatCommand } from './commands/chat.js';

const program = new Command();

program
  .name('intent')
  .description('CLI for IntentGuard - the intent layer for AI coding agents')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize IntentGuard in the current project')
  .action(initCommand);

program
  .command('new <request>')
  .description('Draft a new IntentSpec from a request')
  .action(newCommand);

program
  .command('check [specId]')
  .description('Run readiness gate on a spec')
  .action(checkCommand);

program
  .command('verify [specId]')
  .description('Verify current changes against a spec')
  .action(verifyCommand);

program
  .command('report [specId]')
  .description('Print proof report for a spec')
  .action(reportCommand);

program
  .command('commit [specId]')
  .description('Commit changes with spec reference')
  .action(commitCommand);

const AGENT_IDS = 'claude, bob, codex, gemini, antigravity, cursor';

program
  .command('connect [repo]')
  .description('Connect IntentGuard to a repository: MCP config and rules for every agent, plus .intent/ setup')
  .option('--agent <name>', `Connect a single agent (${AGENT_IDS})`)
  .action(connectCommand);

program
  .command('chat')
  .description('Chat with an IBM watsonx coding agent that works through the intent layer')
  .option('--repo <path>', 'Repository to work in (default: current)')
  .option('--no-harness', 'Run the baseline agent without the intent layer, for A/B comparisons')
  .option('--model <id>', 'watsonx model id (default: WATSONX_MODEL_ID or ibm/granite-4-h-small)')
  .option('--list-models', 'List watsonx models in your region that support tool calling')
  .action(chatCommand);

const mcp = program.command('mcp').description('Manage MCP settings');
mcp
  .command('setup')
  .description('Configure MCP for agents in this repository')
  .option('--all', 'Configure for all known agents')
  .option('--agent <name>', `Configure for specific agent (${AGENT_IDS})`)
  .action(mcpSetupCommand);

const rules = program.command('rules').description('Manage agent rules');
rules
  .command('generate')
  .description('Generate agent rule files')
  .option('--agent <name>', 'Generate rules for specific agent')
  .action(rulesGenerateCommand);

const agents = program.command('agents').description('Manage AI coding agent integrations');
agents
  .command('setup')
  .description('Connect this repository (same as `intent connect` with no path)')
  .option('--agent <name>', `Set up a single agent (${AGENT_IDS})`)
  .action((options: { agent?: string }) => connectCommand(undefined, options));

program.parse(process.argv);
