import readline from 'node:readline/promises';
import chalk from 'chalk';
import {
  IntentAgent,
  createChatModel,
  loadIntentGuardEnv,
  type ChatModel,
  type AgentEvent,
  type AgentMetrics,
  type SpecSnapshot,
} from '@intentguard/core';
import { error } from '../ui/formatters.js';
import { resolveRepo } from './mcp-setup.js';

interface ChatOptions {
  repo?: string;
  harness: boolean;
  provider?: string;
  model?: string;
  listModels?: boolean;
}

const BLOCK_LABEL: Record<string, string> = {
  'no-spec': 'no IntentSpec',
  'not-ready': 'readiness gate',
  'not-approved': 'awaiting approval',
  'out-of-scope': 'out of scope',
};

function argSummary(args: Record<string, unknown>): string {
  const value = args.path ?? args.query ?? args.name ?? args.request ?? '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

function formatSpec(spec: SpecSnapshot | null): string {
  if (!spec) return chalk.dim('  No active IntentSpec.');
  const state = spec.approved
    ? chalk.green('approved')
    : spec.ready
      ? chalk.yellow('ready: type /approve to approve it')
      : chalk.red(`blocked below ${spec.threshold}`);
  const lines = [
    `  ${chalk.bold(spec.id)} · readiness ${spec.readinessScore}/100 · ${state}`,
    `  ${spec.objective}`,
  ];
  if (spec.inScope.length) lines.push(chalk.green(`  in scope: ${spec.inScope.join(', ')}`));
  if (spec.outOfScope.length) lines.push(chalk.red(`  out of scope: ${spec.outOfScope.join(', ')}`));
  if (!spec.ready) for (const b of spec.blockers) lines.push(chalk.dim(`  · ${b}`));
  return lines.join('\n');
}

export function formatMetrics(m: AgentMetrics): string {
  const blocked = Object.values(m.blocked).reduce((a, b) => a + b, 0);
  const parts = [
    `${m.toolCalls} tool calls`,
    `${m.llmCalls} model calls`,
    `${blocked} blocked`,
    `${m.filesWritten.length} files written`,
    `${m.outOfScopeWrites.length} out-of-scope`,
    `${((m.promptTokens + m.completionTokens) / 1000).toFixed(1)}k tokens`,
    `${Math.round(m.elapsedMs / 1000)}s`,
  ];
  return parts.join(' · ');
}

function render(event: AgentEvent): void {
  switch (event.type) {
    case 'assistant':
      console.log(`\n${chalk.cyan('agent ›')} ${event.text}\n`);
      break;
    case 'tool_call':
      console.log(chalk.dim(`  → ${event.name} ${argSummary(event.args)}`));
      break;
    case 'tool_result':
      if (event.blocked) console.log(chalk.red(`  ✖ BLOCKED (${BLOCK_LABEL[event.blocked]}): ${event.summary}`));
      else if (!event.ok) console.log(chalk.yellow(`  ! ${event.summary}`));
      else console.log(chalk.dim(`  ✓ ${event.summary}`));
      break;
    case 'spec':
      console.log(formatSpec(event.spec));
      break;
    case 'metrics':
      console.log(chalk.dim(`  [${formatMetrics(event.metrics)}]`));
      break;
    case 'error':
      console.log(chalk.red(`  error: ${event.message}`));
      break;
  }
}

/**
 * Interactive chat with an AI-powered coding agent (OpenAI by default) that works through IntentGuard.
 */
export async function chatCommand(options: ChatOptions): Promise<void> {
  loadIntentGuardEnv();
  let model: ChatModel;
  try {
    model = createChatModel({ provider: options.provider, model: options.model });
  } catch (err: any) {
    console.error(error(err.message));
    process.exit(1);
  }

  if (options.listModels) {
    try {
      const models = typeof (model as any).listToolModels === 'function' ? await (model as any).listToolModels() : [];
      console.log(models.length ? models.join('\n') : 'No models returned.');
    } catch (err: any) {
      console.error(error(err.message));
      process.exit(1);
    }
    return;
  }

  let root: string;
  let agent: IntentAgent;
  try {
    root = await resolveRepo(options.repo);
    agent = await IntentAgent.create({ rootDir: root, model, harness: options.harness });
  } catch (err: any) {
    console.error(error(err.message));
    process.exit(1);
  }

  console.log(chalk.bold(`\nIntentGuard chat · ${root}`));
  console.log(
    `model ${chalk.cyan(model.id)} · harness ${options.harness ? chalk.green('ON (intent layer enforced)') : chalk.yellow('OFF (baseline agent)')}`
  );
  console.log(chalk.dim('Commands: /approve  /spec  /metrics  /help  /exit   (Ctrl+C stops the agent mid-task)\n'));
  if (options.harness) console.log(formatSpec(await agent.snapshot()), '\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let running: AbortController | null = null;
  rl.on('SIGINT', () => {
    if (running) {
      running.abort();
      console.log(chalk.yellow('\n  stopping…'));
    } else {
      rl.close();
    }
  });
  rl.on('close', () => {
    console.log(chalk.dim(`\n${formatMetrics(agent.getMetrics())}`));
    process.exit(0);
  });

  const run = async (text: string) => {
    running = new AbortController();
    try {
      for await (const event of agent.send(text, { signal: running.signal })) render(event);
    } finally {
      running = null;
    }
  };

  for (;;) {
    const line = (await rl.question(chalk.bold('you › '))).trim();
    if (!line) continue;
    if (line.startsWith('/')) {
      const [cmd] = line.slice(1).split(/\s+/);
      if (cmd === 'exit' || cmd === 'quit') {
        rl.close();
        return;
      }
      if (cmd === 'help') {
        console.log(chalk.dim('  /approve  approve the active spec so the agent may edit in-scope files\n  /spec     show the active spec\n  /metrics  show this session\'s metrics\n  /exit     quit'));
      } else if (cmd === 'spec') {
        console.log(formatSpec(await agent.snapshot()));
      } else if (cmd === 'metrics') {
        console.log(`  ${formatMetrics(agent.getMetrics())}`);
      } else if (cmd === 'approve') {
        if (!options.harness) {
          console.log(chalk.yellow('  The baseline agent has no approval step (harness is off).'));
          continue;
        }
        try {
          const spec = await agent.approve();
          console.log(chalk.green(`  ✓ Approved ${spec.id}.`));
          await run('Approved. Go ahead and implement the spec, then verify it.');
        } catch (err: any) {
          console.log(chalk.red(`  ${err.message}`));
        }
      } else {
        console.log(chalk.yellow(`  Unknown command /${cmd}. Try /help.`));
      }
      continue;
    }
    await run(line);
  }
}
