/**
 * Detectors for personal data and credentials that must never be written into
 * a committed IntentSpec or proof report.
 *
 * The standalone repository tripwire (`scripts/check-pii.mjs`) carries an
 * equivalent list because it has to run before anything is built. Keep the
 * two in step when you add a detector here.
 */

export type PiiKind = 'email' | 'phone' | 'secret' | 'private-key' | 'local-path' | 'card-number';

export interface PiiPattern {
  kind: PiiKind;
  label: string;
  /** Global regex. A fresh copy is created per scan so `lastIndex` never leaks between calls. */
  regex: RegExp;
  /** Return true to skip a match (placeholders, documentation domains, and so on). */
  ignore?: (match: string, groups: string[]) => boolean;
  /** Replacement text, or a function building it from the match and its capture groups. */
  replace: string | ((match: string, groups: string[]) => string);
}

const PLACEHOLDER_VALUE =
  /^(?:<[^>]*>|\$\{[^}]*\}|\$[A-Z_][A-Z0-9_]*|process\.env\.[A-Za-z_]+|env\.[A-Za-z_]+|your[-_][a-z0-9_-]+|x{3,}|\*{3,}|change[-_]?me|placeholder|example[a-z0-9_-]*|redacted|dummy|sample|test[-_]?(?:key|token|secret)|[a-z]+-goes-here|todo|tbd|null|undefined|none)$/i;

/** True for values that are obviously not real credentials (templates, env lookups, docs). */
export function isPlaceholder(value: string): boolean {
  const v = value.trim().replace(/^['"`]|['"`]$/g, '');
  return PLACEHOLDER_VALUE.test(v) || /(?:example|placeholder|redacted|your[-_])/i.test(v);
}

const SAFE_EMAIL =
  /^(?:no-?reply@|.+@(?:example\.(?:com|org|net)|users\.noreply\.github\.com|localhost|[a-z0-9.-]+\.(?:test|invalid|example|local)))/i;

/** True for addresses reserved for documentation or that identify no person. */
export function isSafeEmail(email: string): boolean {
  return SAFE_EMAIL.test(email);
}

/** Luhn checksum, used to keep card-number detection from firing on ordinary long numbers. */
export function luhnValid(candidate: string): boolean {
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

/** Windows and POSIX home-directory shapes; the capture group is the account name. */
export const LOCAL_USER_PATH = /(?:[A-Za-z]:[\\/]+Users[\\/]+|\/Users\/|\/home\/)([^\\/\s"'<>|:*?]+)/g;

const GENERIC_LOCAL_USER = /^(?:<[^>]*>|~|\$\w+|\{\w+\}|\[\w+\]|user(?:name)?|you|me|runner|public|default|all users)$/i;

/**
 * Ordered detectors. Order matters when redacting: card numbers run before
 * phone numbers so a 16-digit card is never reported as several phone fragments.
 */
export const PII_PATTERNS: PiiPattern[] = [
  {
    kind: 'private-key',
    label: 'Private key block',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g,
    replace: '[private key redacted]',
  },
  {
    kind: 'secret',
    label: 'Provider API token',
    regex:
      /\b(?:sk-(?:ant-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|glpat-[A-Za-z0-9_-]{20,})\b/g,
    replace: '[secret redacted]',
  },
  {
    kind: 'secret',
    label: 'JSON Web Token',
    regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replace: '[jwt redacted]',
  },
  {
    kind: 'secret',
    label: 'Credential assignment',
    // `WATSONX_API_KEY=...`, `password: "..."`, `_authToken=...`; placeholders and env lookups are skipped
    regex:
      /((?:api[_-]?key|apikey|secret(?:[_-]?key)?|access[_-]?token|auth[_-]?token|token|password|passwd|_authToken)["']?\s*[:=]\s*)(['"`]?)([A-Za-z0-9_\-./+=@!#%^&*~$]{12,})\2/gi,
    ignore: (_match, groups) => isPlaceholder(groups[2]),
    replace: (_match, groups) => `${groups[0]}${groups[1]}[secret redacted]${groups[1]}`,
  },
  {
    kind: 'email',
    label: 'Email address',
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    ignore: match => isSafeEmail(match),
    replace: '[email redacted]',
  },
  {
    kind: 'card-number',
    label: 'Payment card number',
    regex: /\b(?:\d[ -]?){12,18}\d\b/g,
    ignore: match => !luhnValid(match),
    replace: '[card number redacted]',
  },
  {
    kind: 'phone',
    label: 'Phone number',
    // Requires a country code, parentheses, or separators so versions, dates, and timestamps never match
    regex:
      /(?<![\w./-])(?:\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\(\d{3}\)\s?\d{3}[\s.-]\d{4}|\d{3}[\s.-]\d{3}[\s.-]\d{4}|\+\d{9,14})(?![\w./-])/g,
    replace: '[phone redacted]',
  },
  {
    kind: 'local-path',
    label: 'Local user path',
    regex: LOCAL_USER_PATH,
    ignore: (_match, groups) => GENERIC_LOCAL_USER.test(groups[0]),
    replace: (match, groups) => match.replace(groups[0], '<user>'),
  },
];
