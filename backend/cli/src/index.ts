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

const mcp = program.command('mcp').description('Manage MCP settings');
mcp
  .command('setup')
  .description('Configure MCP for detected agents')
  .option('--all', 'Configure for all known agents')
  .option('--agent <name>', 'Configure for specific agent (claude, cursor, codex, bob)')
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
  .description('Write MCP config and rule files for every supported agent (or one with --agent)')
  .option('--agent <name>', 'Set up a single agent (claude, cursor, codex, bob)')
  .action(async (options: { agent?: string }) => {
    await mcpSetupCommand(options);
    await rulesGenerateCommand(options);
  });

program.parse(process.argv);
