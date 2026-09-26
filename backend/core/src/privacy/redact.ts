import os from 'node:os';
import type { IntentSpec, ProofReport } from '../schema/intentspec.js';
import { PII_PATTERNS, type PiiKind, type PiiPattern } from './patterns.js';

export interface PiiMatch {
  kind: PiiKind;
  label: string;
  /** The matched text, masked so logs and reports never repeat the value itself. */
  masked: string;
  /** Character offset in the scanned text. */
  index: number;
  /** Location inside a structured object, for example `evidence[0].excerpt`. */
  path?: string;
}

export interface RedactResult {
  text: string;
  matches: PiiMatch[];
}

/** Keeps the first three and last two characters so a finding can be recognised but not reused. */
export function maskValue(value: string): string {
  const v = value.trim();
  if (v.length <= 6) return '*'.repeat(v.length);
  return `${v.slice(0, 3)}${'*'.repeat(Math.min(v.length - 5, 12))}${v.slice(-2)}`;
}

function fresh(pattern: PiiPattern): RegExp {
  const flags = pattern.regex.flags.includes('g') ? pattern.regex.flags : `${pattern.regex.flags}g`;
  return new RegExp(pattern.regex.source, flags);
}

/**
 * Finds personal data and credentials in a piece of text without changing it.
 * @param text Text to scan
 * @param patterns Detectors to apply (defaults to the built-in set)
 * @returns Matches ordered by position, with masked values
 */
export function findPii(text: string, patterns: PiiPattern[] = PII_PATTERNS): PiiMatch[] {
  const matches: PiiMatch[] = [];
  for (const pattern of patterns) {
    const re = fresh(pattern);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      if (pattern.ignore?.(m[0], m.slice(1))) continue;
      matches.push({ kind: pattern.kind, label: pattern.label, masked: maskValue(m[0]), index: m.index });
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

/**
 * Replaces personal data and credentials in text with neutral markers.
 * Detectors run in order, so the reported matches follow pattern order.
 * @param text Text to redact
 * @param patterns Detectors to apply (defaults to the built-in set)
 */
export function redactText(text: string, patterns: PiiPattern[] = PII_PATTERNS): RedactResult {
  const matches: PiiMatch[] = [];
  let out = text;
  for (const pattern of patterns) {
    out = out.replace(fresh(pattern), (...args: unknown[]) => {
      // args: match, ...groups, offset, input[, namedGroups]
      const tail = typeof args[args.length - 1] === 'object' ? 3 : 2;
      const match = args[0] as string;
      const groups = args.slice(1, args.length - tail) as string[];
      const offset = args[args.length - tail] as number;
      if (pattern.ignore?.(match, groups)) return match;
      matches.push({ kind: pattern.kind, label: pattern.label, masked: maskValue(match), index: offset });
      return typeof pattern.replace === 'function' ? pattern.replace(match, groups) : pattern.replace;
    });
  }
  return { text: out, matches };
}

function pathVariants(p: string): string[] {
  const forward = p.replace(/\\/g, '/').replace(/\/+$/, '');
  if (!forward) return [];
  const back = forward.replace(/\//g, '\\');
  const escaped = back.replace(/\\/g, '\\\\');
  const fileUrl = `file:///${forward.replace(/^\//, '')}`;
  return Array.from(new Set([escaped, back, forward, fileUrl])).sort((a, b) => b.length - a.length);
}

function replaceLiteral(text: string, literal: string, replacement: string): string {
  const re = new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return text.replace(re, replacement);
}

/**
 * Rewrites machine-specific absolute paths so committed artifacts stay portable
 * and never reveal an account name: the repository root becomes `<repo>` and the
 * home directory becomes `~`. Both slash styles, JSON-escaped backslashes, and
 * `file:///` URLs are handled.
 * @param text Text that may contain absolute paths (test output, stack traces)
 * @param rootDir Repository root to collapse to `<repo>`
 */
export function normalizeLocalPaths(text: string, rootDir?: string): string {
  let out = text;
  if (rootDir) {
    for (const variant of pathVariants(rootDir)) out = replaceLiteral(out, variant, '<repo>');
  }
  const home = os.homedir();
  if (home && home !== '/' && !/^[A-Za-z]:[\\/]?$/.test(home)) {
    for (const variant of pathVariants(home)) out = replaceLiteral(out, variant, '~');
  }
  return out;
}

function walk(value: unknown, path: string, rootDir: string | undefined, matches: PiiMatch[]): unknown {
  if (typeof value === 'string') {
    // Collapse known roots first so a path under the home directory becomes `~/...`
    // rather than being reported as someone else's account name.
    const { text, matches: found } = redactText(normalizeLocalPaths(value, rootDir));
    for (const f of found) matches.push({ ...f, path });
    return text;
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => walk(item, `${path}[${i}]`, rootDir, matches));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = walk(item, path ? `${path}.${key}` : key, rootDir, matches);
    }
    return out;
  }
  return value;
}

/**
 * Deep-copies any JSON-like value with every string field path-normalised and
 * redacted. The input is never mutated.
 */
export function redactObject<T>(value: T, rootDir?: string): { value: T; matches: PiiMatch[] } {
  const matches: PiiMatch[] = [];
  return { value: walk(value, '', rootDir, matches) as T, matches };
}

/** Redacts an IntentSpec before it is written to `.intent/specs`. */
export function redactSpec(spec: IntentSpec, rootDir?: string): { spec: IntentSpec; matches: PiiMatch[] } {
  const { value, matches } = redactObject(spec, rootDir);
  return { spec: value, matches };
}

/** Redacts a proof report before it is written to `.intent/reports`. */
export function redactReport(report: ProofReport, rootDir?: string): { report: ProofReport; matches: PiiMatch[] } {
  const { value, matches } = redactObject(report, rootDir);
  return { report: value, matches };
}
