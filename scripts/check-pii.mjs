#!/usr/bin/env node
/**
 * IntentGuard PII and secret tripwire.
 *
 * Refuses files that must never reach the repository (env files, private keys,
 * local IntentGuard state, generated agent configs) and scans text for personal
 * data and credentials: email addresses, phone numbers, API tokens, private key
 * blocks, payment card numbers, and local user paths.
 *
 * Usage:
 *   node scripts/check-pii.mjs --staged        what `git commit` would include (pre-commit hook)
 *   node scripts/check-pii.mjs --all           every tracked file (CI)
 *   node scripts/check-pii.mjs <file> [...]    content scan of specific files, for example
 *                                              generated agent configs that are never committed
 *
 * The forbidden-file rules apply to what is entering git (--staged, --all).
 * Explicitly named files are scanned for content only.
 *
 * A deliberate false positive is allowed by putting `pii:allow` on the same line.
 * Runs with no dependencies and nothing built, so it works on a fresh clone.
 * Detectors mirror backend/core/src/privacy/patterns.ts; keep the two in step.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOW_MARKER = /pii[:-]allow/i;

const FORBIDDEN_FILES = [
  { re: /(^|\/)\.env(?:\.(?!example$|sample$|template$)[^/]+)?$/, why: 'environment file: copy .env.example and keep real values local' },
  { re: /\.(pem|key|p12|pfx|jks|keystore)$/i, why: 'private key or certificate store' },
  { re: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/, why: 'SSH private key' },
  { re: /^\.intent\/active\.json$/, why: 'local IntentGuard state (git-ignored on purpose)' },
  { re: /^(\.mcp\.json|\.cursor\/|\.codex\/|\.bob\/)/, why: 'generated agent config: run `pnpm agents:setup` on each clone instead' },
  { re: /(^|\/)\.claude\/settings\.local\.json$/, why: 'personal Claude Code settings' },
  { re: /(^|\/)(secrets?|credentials?)\//i, why: 'secrets directory' },
  { re: /(^|\/)\.(netrc|pypirc)$/, why: 'credential file' },
];

const SKIP_CONTENT =
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$|\.(min\.[cm]?js|map|png|jpe?g|gif|webp|ico|svg|woff2?|ttf|eot|pdf|zip|gz|tgz|zst|tar|exe|dll|wasm)$/i;

const PLACEHOLDER_VALUE =
  /^(?:<[^>]*>|\$\{[^}]*\}|\$[A-Z_][A-Z0-9_]*|process\.env\.[A-Za-z_]+|env\.[A-Za-z_]+|your[-_][a-z0-9_-]+|x{3,}|\*{3,}|change[-_]?me|placeholder|example[a-z0-9_-]*|redacted|dummy|sample|test[-_]?(?:key|token|secret)|[a-z]+-goes-here|todo|tbd|null|undefined|none)$/i;
const isPlaceholder = v => {
  const s = v.trim().replace(/^['"`]|['"`]$/g, '');
  return PLACEHOLDER_VALUE.test(s) || /(?:example|placeholder|redacted|your[-_])/i.test(s);
};
const SAFE_EMAIL =
  /^(?:no-?reply@|.+@(?:example\.(?:com|org|net)|users\.noreply\.github\.com|localhost|[a-z0-9.-]+\.(?:test|invalid|example|local)))/i;
const GENERIC_LOCAL_USER = /^(?:<[^>]*>|~|\$\w+|\{\w+\}|\[\w+\]|user(?:name)?|you|me|runner|public|default|all users)$/i;

function luhnValid(candidate) {
  const digits = candidate.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const PATTERNS = [
  {
    kind: 'private-key',
    label: 'Private key block',
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g,
  },
  {
    kind: 'secret',
    label: 'Provider API token',
    re: /\b(?:sk-(?:ant-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|glpat-[A-Za-z0-9_-]{20,})\b/g,
  },
  { kind: 'secret', label: 'JSON Web Token', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  {
    kind: 'secret',
    label: 'Credential assignment',
    re: /((?:api[_-]?key|apikey|secret(?:[_-]?key)?|access[_-]?token|auth[_-]?token|token|password|passwd|_authToken)["']?\s*[:=]\s*)(['"`]?)([A-Za-z0-9_\-./+=@!#%^&*~$]{12,})\2/gi,
    ignore: (_m, g) => isPlaceholder(g[2]),
  },
  { kind: 'email', label: 'Email address', re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, ignore: m => SAFE_EMAIL.test(m) },
  { kind: 'card-number', label: 'Payment card number', re: /\b(?:\d[ -]?){12,18}\d\b/g, ignore: m => !luhnValid(m) },
  {
    kind: 'phone',
    label: 'Phone number',
    re: /(?<![\w./-])(?:\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\(\d{3}\)\s?\d{3}[\s.-]\d{4}|\d{3}[\s.-]\d{3}[\s.-]\d{4}|\+\d{9,14})(?![\w./-])/g,
  },
  {
    kind: 'local-path',
    label: 'Local user path',
    re: /(?:[A-Za-z]:[\\/]+Users[\\/]+|\/Users\/|\/home\/)([^\\/\s"'<>|:*?]+)/g,
    ignore: (_m, g) => GENERIC_LOCAL_USER.test(g[0]),
  },
];

function mask(value) {
  const v = value.trim();
  if (v.length <= 6) return '*'.repeat(v.length);
  return `${v.slice(0, 3)}${'*'.repeat(Math.min(v.length - 5, 12))}${v.slice(-2)}`;
}

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
}

function splitZ(out) {
  return out.split('\0').filter(Boolean);
}

function isBinary(buf) {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/** Added lines from a unified diff, with their line numbers in the new file. */
function addedLines(diff) {
  const lines = [];
  let lineNo = 0;
  let inHunk = false;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('@@')) {
      const m = /\+(\d+)/.exec(raw);
      lineNo = m ? Number(m[1]) : 0;
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (raw.startsWith('+')) {
      lines.push({ n: lineNo, text: raw.slice(1) });
      lineNo++;
    } else if (raw.startsWith(' ')) {
      lineNo++;
    }
  }
  return lines;
}

function scanLines(file, lines, findings) {
  for (const { n, text } of lines) {
    if (ALLOW_MARKER.test(text)) continue;
    for (const p of PATTERNS) {
      const re = new RegExp(p.re.source, p.re.flags);
      let m;
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        if (p.ignore?.(m[0], m.slice(1))) continue;
        findings.push({ file, line: n, kind: p.kind, label: p.label, masked: mask(m[0]) });
      }
    }
  }
}

function checkForbidden(file, findings) {
  for (const rule of FORBIDDEN_FILES) {
    if (rule.re.test(file)) {
      findings.push({ file, kind: 'forbidden-file', label: rule.why });
      return true;
    }
  }
  return false;
}

function toLines(text) {
  return text.split('\n').map((t, i) => ({ n: i + 1, text: t }));
}

function main(argv) {
  const staged = argv.includes('--staged');
  const all = argv.includes('--all');
  const explicit = argv.filter(a => !a.startsWith('--'));
  const findings = [];
  let files = [];

  if (staged) {
    files = splitZ(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']));
  } else if (all) {
    files = splitZ(git(['ls-files', '-z']));
  } else if (explicit.length) {
    files = explicit.map(f => f.replace(/\\/g, '/'));
  } else {
    console.error('usage: check-pii.mjs --staged | --all | <file>...');
    return 2;
  }

  const enteringGit = staged || all;
  let scanned = 0;
  for (const file of files) {
    if (enteringGit && checkForbidden(file, findings)) continue;
    if (SKIP_CONTENT.test(file)) continue;

    if (staged) {
      const blob = execFileSync('git', ['show', `:${file}`], { maxBuffer: 64 * 1024 * 1024 });
      if (blob.length > MAX_BYTES || isBinary(blob)) continue;
      const diff = git(['diff', '--cached', '-U0', '--no-color', '--no-ext-diff', '--', file]);
      scanLines(file, addedLines(diff), findings);
    } else {
      let buf;
      try {
        if (statSync(file).size > MAX_BYTES) continue;
        buf = readFileSync(file);
      } catch {
        continue;
      }
      if (isBinary(buf)) continue;
      scanLines(file, toLines(buf.toString('utf8')), findings);
    }
    scanned++;
  }

  if (findings.length === 0) {
    console.log(`✓ PII and secret scan: ${scanned} file(s) clean.`);
    return 0;
  }

  const byFile = new Set(findings.map(f => f.file));
  for (const f of findings) {
    if (f.kind === 'forbidden-file') console.log(`✗ ${f.file}  forbidden file: ${f.label}`);
    else console.log(`✗ ${f.file}:${f.line}  [${f.kind}] ${f.label} — ${f.masked}`);
  }
  console.log(`\n${findings.length} problem(s) in ${byFile.size} file(s).${staged ? ' Commit blocked.' : ''}`);
  console.log('  Remove the value, or add `pii:allow` on that line if it is a deliberate false positive.');
  if (staged) console.log('  One-off bypass (not recommended): git commit --no-verify');
  return 1;
}

process.exit(main(process.argv.slice(2)));
