import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { findPii, redactText, redactSpec, redactObject, normalizeLocalPaths, maskValue } from '../src/privacy/redact.js';
import { luhnValid, isPlaceholder, isSafeEmail } from '../src/privacy/patterns.js';
import { SpecStore } from '../src/store/spec-store.js';
import { loadConfig } from '../src/store/config.js';
import type { IntentSpec, ProofReport } from '../src/schema/intentspec.js';

// Fixtures are assembled at runtime so the repository's own PII scan never trips on this file.
const email = ['jane.doe', 'corp-mail.io'].join('@');
const phone = ['+1', '555', '010', '9999'].join(' ');
const token = ['sk', 'live', 'A'.repeat(24)].join('-');
const card = ['4111', '1111', '1111', '1111'].join(' ');
const passwordLine = ['password', '"hunter2hunter2"'].join(': ');
const winPath = ['C:', 'Users', 'jane', 'projects', 'app', 'src', 'x.ts'].join('\\');
const posixPath = ['', 'home', 'jane', 'projects', 'app'].join('/');

const kinds = (text: string) => findPii(text).map(m => m.kind);

describe('findPii', () => {
  it('finds email addresses but ignores documentation and no-reply addresses', () => {
    expect(kinds(`contact ${email} for access`)).toEqual(['email']);
    expect(kinds('docs use someone@example.com and noreply@github.com')).toEqual([]);
    expect(isSafeEmail('bot@users.noreply.github.com')).toBe(true);
  });

  it('finds phone numbers without flagging versions, dates, IPs, or timestamps', () => {
    expect(kinds(`call ${phone} today`)).toEqual(['phone']);
    expect(kinds(['(555)', '010-9999'].join(' '))).toEqual(['phone']);
    expect(kinds(['+92', '300', '1234567'].join(' '))).toEqual(['phone']);
    expect(kinds('released 2026-09-26 as v10.15.0 on 192.168.1.1 at 1727325000')).toEqual([]);
    expect(kinds('renders within 300ms of step 2; p95 below 250ms')).toEqual([]);
  });

  it('finds provider tokens, JWTs, and credential assignments', () => {
    expect(kinds(`Authorization: ${token}`)).toEqual(['secret']);
    const jwt = ['eyJ' + 'a'.repeat(10), 'b'.repeat(12), 'c'.repeat(12)].join('.');
    expect(kinds(jwt)).toEqual(['secret']);
    expect(kinds(passwordLine)).toEqual(['secret']);
    expect(kinds(['WATSONX_API_KEY', 'q'.repeat(30)].join('='))).toEqual(['secret']);
    expect(kinds('//registry.example.org/:_authToken=npm_' + 'z'.repeat(30))).toEqual(['secret']);
  });

  it('ignores placeholders and environment lookups', () => {
    expect(kinds('const apiKey = process.env.WATSONX_API_KEY;')).toEqual([]);
    expect(kinds('WATSONX_API_KEY=your-watsonx-api-key')).toEqual([]);
    expect(kinds('token: <paste-token-here>')).toEqual([]);
    expect(kinds('password: z.string().min(8)')).toEqual([]);
    expect(kinds('request: z.string().describe("The raw developer request")')).toEqual([]);
    expect(isPlaceholder('${SECRET}')).toBe(true);
    expect(isPlaceholder('changeme')).toBe(true);
  });

  it('finds private key blocks', () => {
    expect(kinds(['-----BEGIN', 'RSA PRIVATE KEY-----'].join(' '))).toEqual(['private-key']);
  });

  it('finds payment card numbers only when the Luhn check passes', () => {
    expect(luhnValid(card)).toBe(true);
    expect(kinds(`card ${card} on file`)).toEqual(['card-number']);
    expect(kinds(`ref ${card.slice(0, -1)}2`)).toEqual([]);
  });

  it('finds local user paths but not generic ones', () => {
    expect(kinds(`see ${winPath}`)).toEqual(['local-path']);
    expect(kinds(`see ${posixPath}`)).toEqual(['local-path']);
    expect(kinds('/home/runner/work and C:\\Users\\<user>\\x')).toEqual([]);
  });

  it('masks values so findings never repeat them', () => {
    const [m] = findPii(`mail ${email}`);
    expect(m.masked).not.toContain('jane.doe');
    expect(m.masked.startsWith('jan')).toBe(true);
    expect(maskValue('short')).toBe('*****');
  });
});

describe('redactText', () => {
  it('replaces every kind with a neutral marker and reports what it replaced', () => {
    const input = `${email} / ${phone} / ${token} / ${card} / ${winPath}`;
    const { text, matches } = redactText(input);
    expect(text).toBe(
      '[email redacted] / [phone redacted] / [secret redacted] / [card number redacted] / ' +
        winPath.replace('jane', '<user>')
    );
    expect(matches.map(m => m.kind)).toEqual(['secret', 'email', 'card-number', 'phone', 'local-path']);
  });

  it('keeps the key and quotes of a credential assignment', () => {
    expect(redactText(passwordLine).text).toBe('password: "[secret redacted]"');
  });

  it('leaves clean text untouched', () => {
    const clean = 'Interactive cabin seat map renders within 300ms of booking step 2';
    expect(redactText(clean)).toEqual({ text: clean, matches: [] });
  });
});

describe('normalizeLocalPaths', () => {
  it('collapses the repo root in every slash style and the home directory', () => {
    const root = ['D:', 'Work', 'IntentGuard'].join('\\');
    const text = `at ${root}\\backend\\x.ts and ${root.replace(/\\/g, '/')}/y.ts and ${root.replace(/\\/g, '\\\\')}\\\\z.ts`;
    expect(normalizeLocalPaths(text, root)).toBe('at <repo>\\backend\\x.ts and <repo>/y.ts and <repo>\\\\z.ts');
    const home = os.homedir();
    expect(normalizeLocalPaths(`${home}${path.sep}notes.md`)).toBe(`~${path.sep}notes.md`);
  });
});

describe('redactSpec', () => {
  const spec: IntentSpec = {
    id: 'intent-privacy',
    status: 'draft',
    objective: 'Let support staff look up a booking by reference',
    outcomes: ['Lookup completes in under 300ms'],
    rawRequest: `customer ${email} keeps calling ${phone} about this`,
    evidence: [
      {
        type: 'quote',
        source: 'Support Ticket #1092',
        excerpt: `"${email} was assigned a bunk without being asked"`,
        trust: 'high',
      },
    ],
    scope: { inScope: ['src/booking/**'], outOfScope: ['src/billing/**'] },
    createdAt: 1727325000,
  };

  it('redacts string fields, records their paths, and leaves the input untouched', () => {
    const { spec: safe, matches } = redactSpec(spec);
    expect(safe.rawRequest).toBe('customer [email redacted] keeps calling [phone redacted] about this');
    expect(safe.evidence?.[0].excerpt).toBe('"[email redacted] was assigned a bunk without being asked"');
    expect(safe.evidence?.[0].source).toBe('Support Ticket #1092');
    expect(safe.createdAt).toBe(1727325000);
    expect(matches.map(m => m.path)).toEqual(['rawRequest', 'rawRequest', 'evidence[0].excerpt']);
    expect(spec.rawRequest).toContain('jane.doe');
  });

  it('normalises paths inside nested arrays', () => {
    const { value } = redactObject({ testsRun: [{ file: `${posixPath}/src/a.test.ts`, output: 'ok' }] }, posixPath);
    expect(value.testsRun[0].file).toBe('<repo>/src/a.test.ts');
  });
});

describe('SpecStore privacy', () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intentguard-privacy-'));
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  const spec = (): IntentSpec => ({
    id: 'intent-store',
    status: 'draft',
    objective: `ping ${email} when done`,
    outcomes: ['done'],
  });

  it('redacts specs on save by default and returns what was written', async () => {
    const store = new SpecStore(rootDir);
    await store.init();
    const { spec: saved, redactions } = await store.save(spec());
    expect(saved.objective).toBe('ping [email redacted] when done');
    expect(redactions).toHaveLength(1);
    const onDisk = await fs.readFile(path.join(rootDir, '.intent/specs/intent-store.json'), 'utf8');
    expect(onDisk).not.toContain('jane.doe');
    const md = await fs.readFile(path.join(rootDir, '.intent/specs/intent-store.md'), 'utf8');
    expect(md).not.toContain('jane.doe');
    expect(await store.load('intent-store')).toEqual(saved);
  });

  it('can be switched off per project, with the other switch keeping its default', async () => {
    await fs.mkdir(path.join(rootDir, '.intent'), { recursive: true });
    await fs.writeFile(path.join(rootDir, '.intent/config.json'), JSON.stringify({ privacy: { redactSpecs: false } }));
    const config = await loadConfig(rootDir);
    expect(config.privacy).toEqual({ redactSpecs: false, redactReports: true });
    const store = new SpecStore(rootDir);
    const { spec: saved, redactions } = await store.save(spec());
    expect(saved.objective).toContain('jane.doe');
    expect(redactions).toEqual([]);
  });

  it('normalises local paths in proof report test output', async () => {
    const store = new SpecStore(rootDir);
    await store.init();
    const report: ProofReport = {
      specId: 'intent-store',
      timestamp: 1,
      summary: 'ok',
      commitReady: true,
      verification: {
        passed: true,
        scopeViolations: [],
        outcomesChecked: [],
        healthMetricsChecked: [],
        testsRun: [{ file: 'src/a.test.ts', passed: true, output: `FAIL ${rootDir}${path.sep}src${path.sep}a.test.ts` }],
      },
    };
    const { report: saved } = await store.saveReport(report);
    expect(saved.verification.testsRun[0].output).toBe(`FAIL <repo>${path.sep}src${path.sep}a.test.ts`);
    expect(await store.loadReport('intent-store')).toEqual(saved);
  });
});
