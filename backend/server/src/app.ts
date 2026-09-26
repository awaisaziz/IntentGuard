import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import {
  SpecStore,
  loadConfig,
  computeReadiness,
  generateQuestions,
  checkScope,
  verify,
  generateProofReport,
  draftSpec,
  getAgentStatuses,
  IntentAgent,
  WatsonxChatModel,
  type ChatModel,
  type IntentSpec,
} from '@intentguard/core';

// Spec IDs become file names under .intent/specs, so reject anything path-like
const SPEC_ID = /^[A-Za-z0-9_-]+$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const MAX_CHAT_SESSIONS = 20;

export const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3847', 'http://127.0.0.1:3847'];

export interface AppOptions {
  /** Creates the model for a new chat session (default: IBM watsonx from the environment). */
  createChatModel?: () => ChatModel;
  /** Browser origins allowed to call the API (default: the local web dashboard). */
  allowedOrigins?: string[];
}

/**
 * Builds the IntentGuard HTTP API over a project root.
 * @param rootDir Project root containing the .intent directory
 */
export function createApp(rootDir: string, options: AppOptions = {}): Hono {
  const store = new SpecStore(rootDir);
  const createChatModel = options.createChatModel ?? (() => WatsonxChatModel.fromEnv());
  const allowedOrigins = options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  const sessions = new Map<string, IntentAgent>();
  const app = new Hono().basePath('/api');

  // The chat agent can edit files, so only local callers get in: requests must be addressed to
  // localhost (blocks DNS rebinding), come from an allowed origin, and send JSON (which forces
  // a CORS preflight, so other websites cannot fire simple cross-site POSTs at the API).
  app.use('*', async (c, next) => {
    if (!LOCAL_HOSTS.has(new URL(c.req.url).hostname)) return c.json({ error: 'Forbidden host' }, 403);
    await next();
  });
  app.use('*', cors({ origin: allowedOrigins, allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type'] }));
  app.use('*', async (c, next) => {
    const origin = c.req.header('origin');
    if (origin && !allowedOrigins.includes(origin)) return c.json({ error: 'Forbidden origin' }, 403);
    if (c.req.method === 'POST' && !(c.req.header('content-type') ?? '').includes('application/json')) {
      return c.json({ error: 'Content-Type must be application/json' }, 415);
    }
    await next();
  });

  async function loadSpec(id: string): Promise<IntentSpec> {
    if (!SPEC_ID.test(id)) throw new HTTPException(400, { message: `Invalid spec id: ${id}` });
    try {
      return await store.load(id);
    } catch {
      throw new HTTPException(404, { message: `Spec ${id} not found` });
    }
  }

  async function readJson<T>(req: { json(): Promise<unknown> }): Promise<Partial<T>> {
    try {
      return (await req.json()) as Partial<T>;
    } catch {
      throw new HTTPException(400, { message: 'Request body must be JSON' });
    }
  }

  app.get('/health', c => c.json({ ok: true }));

  app.get('/config', async c => c.json(await loadConfig(rootDir)));

  app.get('/agents', async c => c.json(await getAgentStatuses(rootDir)));

  app.get('/specs', async c => {
    const { readinessThreshold } = await loadConfig(rootDir);
    const ids = await store.list();
    const specs = await Promise.all(ids.map(id => store.load(id).catch(() => null)));
    const active = await store.loadActive();
    return c.json(
      specs
        .filter((s): s is IntentSpec => s !== null)
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .map(spec => ({
          ...spec,
          readinessScore: computeReadiness(spec, readinessThreshold).score,
          active: spec.id === active?.id,
        }))
    );
  });

  app.post('/specs', async c => {
    const { request } = await readJson<{ request: string }>(c.req);
    if (typeof request !== 'string' || !request.trim()) {
      throw new HTTPException(400, { message: '"request" is required' });
    }
    return c.json(await draftSpec(rootDir, request.trim()), 201);
  });

  app.get('/specs/active', async c => {
    const spec = await store.loadActive();
    if (!spec) throw new HTTPException(404, { message: 'No active spec' });
    return c.json(spec);
  });

  app.get('/specs/:id', async c => c.json(await loadSpec(c.req.param('id'))));

  app.post('/specs/:id/activate', async c => {
    const spec = await loadSpec(c.req.param('id'));
    await store.setActive(spec.id);
    return c.json({ activeSpecId: spec.id });
  });

  app.get('/specs/:id/readiness', async c => {
    const spec = await loadSpec(c.req.param('id'));
    const { readinessThreshold } = await loadConfig(rootDir);
    return c.json(computeReadiness(spec, readinessThreshold));
  });

  app.get('/specs/:id/questions', async c => {
    return c.json(generateQuestions(await loadSpec(c.req.param('id'))));
  });

  app.post('/specs/:id/scope-check', async c => {
    const spec = await loadSpec(c.req.param('id'));
    const { filePath } = await readJson<{ filePath: string }>(c.req);
    if (typeof filePath !== 'string' || !filePath) {
      throw new HTTPException(400, { message: '"filePath" is required' });
    }
    return c.json(checkScope(filePath, spec.scope ?? { inScope: [], outOfScope: [] }));
  });

  app.get('/specs/:id/report', async c => {
    const spec = await loadSpec(c.req.param('id'));
    const report = await store.loadReport(spec.id);
    if (!report) throw new HTTPException(404, { message: `No proof report for ${spec.id} yet` });
    return c.json(report);
  });

  app.post('/specs/:id/verify', async c => {
    const spec = await loadSpec(c.req.param('id'));
    const { report } = await store.saveReport(generateProofReport(spec.id, await verify(rootDir, spec)));
    return c.json(report);
  });

  // ---------- Chat: a watsonx coding agent that works through the intent layer ----------

  function chatSession(id: string): IntentAgent {
    const agent = sessions.get(id);
    if (!agent) throw new HTTPException(404, { message: `Chat session ${id} not found (the server may have restarted)` });
    return agent;
  }

  app.post('/chat', async c => {
    const { harness } = await readJson<{ harness: boolean }>(c.req);
    let model: ChatModel;
    try {
      model = createChatModel();
    } catch (err) {
      throw new HTTPException(503, { message: err instanceof Error ? err.message : String(err) });
    }
    const agent = await IntentAgent.create({ rootDir, model, harness: harness !== false });
    sessions.set(agent.id, agent);
    for (const [id, old] of sessions) {
      if (sessions.size <= MAX_CHAT_SESSIONS) break;
      if (!old.isBusy) sessions.delete(id);
    }
    return c.json({ id: agent.id, harness: agent.harness, model: agent.modelId, spec: await agent.snapshot() }, 201);
  });

  app.get('/chat/:id', async c => {
    const agent = chatSession(c.req.param('id'));
    return c.json({
      id: agent.id,
      harness: agent.harness,
      model: agent.modelId,
      busy: agent.isBusy,
      metrics: agent.getMetrics(),
      spec: await agent.snapshot(),
    });
  });

  app.post('/chat/:id/messages', async c => {
    const agent = chatSession(c.req.param('id'));
    const { message } = await readJson<{ message: string }>(c.req);
    if (typeof message !== 'string' || !message.trim()) throw new HTTPException(400, { message: '"message" is required' });
    if (agent.isBusy) throw new HTTPException(409, { message: 'The agent is still working on the previous message' });

    c.header('X-Accel-Buffering', 'no');
    return streamSSE(c, async stream => {
      const controller = new AbortController();
      stream.onAbort(() => controller.abort());
      for await (const event of agent.send(message.trim(), { signal: controller.signal })) {
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      }
    });
  });

  app.post('/chat/:id/approve', async c => {
    const agent = chatSession(c.req.param('id'));
    if (!agent.harness) throw new HTTPException(409, { message: 'The baseline agent has no approval step (harness is off)' });
    try {
      return c.json({ spec: await agent.approve() });
    } catch (err) {
      throw new HTTPException(409, { message: err instanceof Error ? err.message : String(err) });
    }
  });

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    console.error('[intentguard-server]', err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  app.notFound(c => c.json({ error: 'Not found' }, 404));

  return app;
}
