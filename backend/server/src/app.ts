import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
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
  type IntentSpec,
} from '@intentguard/core';

// Spec IDs become file names under .intent/specs, so reject anything path-like
const SPEC_ID = /^[A-Za-z0-9_-]+$/;

/**
 * Builds the IntentGuard HTTP API over a project root.
 * @param rootDir Project root containing the .intent directory
 */
export function createApp(rootDir: string): Hono {
  const store = new SpecStore(rootDir);
  const app = new Hono().basePath('/api');

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

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    console.error('[intentguard-server]', err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  app.notFound(c => c.json({ error: 'Not found' }, 404));

  return app;
}
