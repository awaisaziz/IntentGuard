import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { IntentAgent } from '../src/agent/agent.js';
import type { AgentEvent } from '../src/agent/types.js';
import type { ChatMessage, ChatModel, ChatResponse, ChatTool } from '../src/llm/chat.js';
import { SpecStore } from '../src/store/spec-store.js';
import type { IntentSpec } from '../src/schema/intentspec.js';

type Step = ChatResponse | ((messages: ChatMessage[]) => ChatResponse);

/** Plays back scripted model turns and records what the agent sent. */
class ScriptedModel implements ChatModel {
  readonly id = 'fake/scripted';
  calls: Array<{ messages: ChatMessage[]; tools?: ChatTool[] }> = [];
  constructor(private steps: Step[]) {}
  push(...steps: Step[]) {
    this.steps.push(...steps);
  }
  async chat(messages: ChatMessage[], tools?: ChatTool[]): Promise<ChatResponse> {
    this.calls.push({ messages: structuredClone(messages), tools });
    const step = this.steps.shift();
    if (!step) return { message: { content: 'done' } };
    return typeof step === 'function' ? step(messages) : step;
  }
}

let n = 0;
const call = (name: string, args: Record<string, unknown>): ChatResponse => ({
  message: { tool_calls: [{ id: `c${++n}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] },
  usage: { promptTokens: 100, completionTokens: 10 },
});
const say = (content: string): ChatResponse => ({ message: { content } });

async function collect(gen: AsyncGenerator<AgentEvent>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}
const results = (events: AgentEvent[]) => events.filter(e => e.type === 'tool_result') as Extract<AgentEvent, { type: 'tool_result' }>[];

const READY_SPEC: IntentSpec = {
  id: 'intent-seats1',
  status: 'draft',
  objective: 'Let travellers pick a cabin seat before paying for the booking.',
  outcomes: ['Seat map lists every free seat for the chosen flight'],
  evidence: [{ id: 'ev-1', type: 'request', excerpt: 'add seat selection' }],
  scope: { inScope: ['src/booking/**'], outOfScope: ['src/billing/**'] },
  edgeCases: [{ scenario: 'Seat taken meanwhile', expectedBehavior: 'Show an error and refresh the map' }],
  verification: ['Unit tests for seat locking'],
};

describe('IntentAgent', () => {
  let root: string;
  const savedKey = process.env.WATSONX_API_KEY;

  beforeEach(async () => {
    delete process.env.WATSONX_API_KEY;
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'intentguard-agent-'));
    await fs.mkdir(path.join(root, 'src', 'booking'), { recursive: true });
    await fs.mkdir(path.join(root, 'src', 'billing'), { recursive: true });
    await fs.writeFile(path.join(root, 'src', 'booking', 'seats.ts'), 'export const seats = [];\n');
    await fs.writeFile(path.join(root, 'src', 'billing', 'pay.ts'), 'export const pay = () => 0;\n');
    await fs.writeFile(path.join(root, '.env'), 'SECRET=value\n');
    await fs.mkdir(path.join(root, '.intent'), { recursive: true });
    await fs.writeFile(
      path.join(root, '.intent', 'config.json'),
      JSON.stringify({ readinessThreshold: 70, commands: { test: 'node -e "process.exit(0)"' } })
    );
    const git = simpleGit(root);
    await git.init();
    await git.addConfig('user.name', 'Test');
    await git.addConfig('user.email', 'test@example.com');
    await git.add('.');
    await git.commit('init');
  });

  afterEach(async () => {
    if (savedKey !== undefined) process.env.WATSONX_API_KEY = savedKey;
    await fs.rm(root, { recursive: true, force: true });
  });

  async function activateSpec(spec: IntentSpec = READY_SPEC) {
    const store = new SpecStore(root);
    await store.save(structuredClone(spec));
    await store.setActive(spec.id);
  }

  it('blocks edits until a spec exists, is ready, and is approved, then fences scope', async () => {
    const model = new ScriptedModel([call('write_file', { path: 'src/booking/seats.ts', content: 'x' }), say('blocked')]);
    const agent = await IntentAgent.create({ rootDir: root, model, logRuns: false });

    let r = results(await collect(agent.send('add seat selection')));
    expect(r[0].blocked).toBe('no-spec');

    await activateSpec({ ...READY_SPEC, verification: [] , edgeCases: [], evidence: [] });
    model.push(call('edit_file', { path: 'src/booking/seats.ts', old_string: '[]', new_string: '[1]' }), say('blocked'));
    r = results(await collect(agent.send('try again')));
    expect(r[0].blocked).toBe('not-ready');

    await activateSpec();
    model.push(call('edit_file', { path: 'src/booking/seats.ts', old_string: '[]', new_string: '[1]' }), say('blocked'));
    r = results(await collect(agent.send('try again')));
    expect(r[0].blocked).toBe('not-approved');

    await agent.approve();
    model.push(
      call('edit_file', { path: 'src/booking/seats.ts', old_string: '[]', new_string: '[1]' }),
      call('write_file', { path: 'src/billing/pay.ts', content: 'hacked' }),
      say('done')
    );
    r = results(await collect(agent.send('go')));
    expect(r[0]).toMatchObject({ ok: true, name: 'edit_file' });
    expect(r[1].blocked).toBe('out-of-scope');

    expect(await fs.readFile(path.join(root, 'src', 'booking', 'seats.ts'), 'utf8')).toContain('[1]');
    expect(await fs.readFile(path.join(root, 'src', 'billing', 'pay.ts'), 'utf8')).not.toContain('hacked');
    const m = agent.getMetrics();
    expect(m.blocked).toEqual({ 'no-spec': 1, 'not-ready': 1, 'not-approved': 1, 'out-of-scope': 1 });
    expect(m.filesWritten).toEqual(['src/booking/seats.ts']);
    expect(m.outOfScopeWrites).toEqual([]);
  });

  it('delivers the approval note with the next message instead of a separate user turn', async () => {
    await activateSpec();
    const model = new ScriptedModel([say('ok')]);
    const agent = await IntentAgent.create({ rootDir: root, model, logRuns: false });
    await agent.approve();
    await collect(agent.send('go ahead'));
    const users = model.calls[0].messages.filter(m => m.role === 'user');
    expect(users).toHaveLength(1);
    expect((users[0] as { content: string }).content).toMatch(/approved IntentSpec intent-seats1[\s\S]*go ahead/);
  });

  it('refuses to approve a spec that has not passed the readiness gate', async () => {
    await activateSpec({ ...READY_SPEC, outcomes: [], verification: [], edgeCases: [] });
    const agent = await IntentAgent.create({ rootDir: root, model: new ScriptedModel([]), logRuns: false });
    await expect(agent.approve()).rejects.toThrow(/not ready/);
  });

  it('resets approval when the spec changes after it was approved', async () => {
    await activateSpec();
    const model = new ScriptedModel([
      call('intent_update_spec', { inScope: ['src/**'] }),
      call('write_file', { path: 'src/billing/pay.ts', content: 'x' }),
      say('waiting'),
    ]);
    const agent = await IntentAgent.create({ rootDir: root, model, logRuns: false });
    await agent.approve();
    const events = await collect(agent.send('widen it yourself'));
    const r = results(events);
    expect(r[0].summary).toMatch(/approval reset/);
    expect(r[1].blocked).toBe('not-approved');
    expect(events.some(e => e.type === 'spec' && e.spec?.approved === false)).toBe(true);
  });

  it('runs unfenced as the baseline but records out-of-scope drift', async () => {
    await activateSpec();
    const model = new ScriptedModel([call('write_file', { path: 'src/billing/pay.ts', content: 'changed' }), say('done')]);
    const agent = await IntentAgent.create({ rootDir: root, model, harness: false, logRuns: false });
    const r = results(await collect(agent.send('do it')));
    expect(r[0].ok).toBe(true);
    expect(agent.getMetrics().outOfScopeWrites).toEqual(['src/billing/pay.ts']);
    expect(model.calls[0].tools!.map(t => t.function.name)).not.toContain('intent_create_spec');
  });

  it('keeps secrets, .git, .intent, and paths outside the repo out of reach in both modes', async () => {
    const model = new ScriptedModel([
      call('read_file', { path: '.env' }),
      call('read_file', { path: '../outside.txt' }),
      call('write_file', { path: '.intent/specs/x.json', content: '{}' }),
      call('read_file', { path: '.git/config' }),
      say('done'),
    ]);
    const agent = await IntentAgent.create({ rootDir: root, model, harness: false, logRuns: false });
    const r = results(await collect(agent.send('peek')));
    expect(r.map(x => x.ok)).toEqual([false, false, false, false]);
    expect(r[0].summary).toMatch(/secrets/);
    expect(r[1].summary).toMatch(/outside the repository/);
    expect(r[2].summary).toMatch(/intent_\* tools/);
  });

  it('drafts a spec from the request and reports readiness', async () => {
    const model = new ScriptedModel([call('intent_create_spec', { request: 'add seat selection to booking' }), say('drafted')]);
    const agent = await IntentAgent.create({ rootDir: root, model, logRuns: false });
    const events = await collect(agent.send('add seat selection to booking'));
    expect(results(events)[0]).toMatchObject({ ok: true, name: 'intent_create_spec' });
    const spec = events.find(e => e.type === 'spec') as Extract<AgentEvent, { type: 'spec' }>;
    expect(spec.spec?.objective).toBe('add seat selection to booking');
    expect(spec.spec?.ready).toBe(false);
  });

  it('turns bad arguments and unknown tools into recoverable tool errors', async () => {
    const model = new ScriptedModel([
      { message: { tool_calls: [{ id: 'bad', type: 'function', function: { name: 'read_file', arguments: '{nope' } }] } },
      call('delete_everything', {}),
      say('recovered'),
    ]);
    const agent = await IntentAgent.create({ rootDir: root, model, logRuns: false });
    const events = await collect(agent.send('go'));
    const r = results(events);
    expect(r[0].summary).toBe('invalid tool arguments');
    expect(r[1].summary).toMatch(/unknown tool/);
    expect(events.some(e => e.type === 'assistant' && e.text === 'recovered')).toBe(true);
  });

  it('runs only configured checks', async () => {
    const model = new ScriptedModel([call('run_check', { name: 'test' }), call('run_check', { name: 'rm -rf /' }), say('done')]);
    const agent = await IntentAgent.create({ rootDir: root, model, harness: false, logRuns: false });
    const r = results(await collect(agent.send('test it')));
    expect(r[0]).toMatchObject({ ok: true });
    expect(r[1].ok).toBe(false);
    expect(r[1].summary).toMatch(/Unknown check/);
    expect(agent.getMetrics().checks).toEqual([{ name: 'test', passed: true }]);
  });

  it('verifies new untracked files against scope and runs the test check', async () => {
    await activateSpec();
    await fs.writeFile(path.join(root, 'src', 'billing', 'refund.ts'), 'export {};\n');
    const model = new ScriptedModel([call('intent_verify', {}), say('reported')]);
    const agent = await IntentAgent.create({ rootDir: root, model, logRuns: false });
    await agent.approve();
    const r = results(await collect(agent.send('verify')));
    const report = JSON.parse(await fs.readFile(path.join(root, '.intent', 'reports', 'intent-seats1-report.json'), 'utf8'));
    expect(report.verification.scopeViolations).toEqual(['src/billing/refund.ts']);
    expect(report.verification.testsRun[0]).toMatchObject({ passed: true });
    expect(report.commitReady).toBe(false);
    expect(r[0].summary).toMatch(/not ready/);
  });

  it('stops after the step limit and writes a local run log', async () => {
    const model = new ScriptedModel(Array.from({ length: 5 }, () => call('list_files', {})));
    const agent = await IntentAgent.create({ rootDir: root, model, maxSteps: 3 });
    const events = await collect(agent.send('loop'));
    expect(events.some(e => e.type === 'assistant' && /Paused after 3 steps/.test(e.text))).toBe(true);
    const log = JSON.parse(await fs.readFile(path.join(root, '.intent', 'runs', `${agent.id}.json`), 'utf8'));
    expect(log.metrics.toolCalls).toBe(3);
    expect(log.harness).toBe(true);
  });
});
