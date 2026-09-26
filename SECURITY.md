# Security and Privacy

IntentGuard runs locally against one repository. It stores nothing outside
that repository's `.intent/` folder and sends nothing anywhere unless you
configure an LLM provider.

## What stays local

| Data | Where | Committed? |
|---|---|---|
| IntentSpecs and their Markdown rendering | `.intent/specs/` | Yes, after redaction |
| Proof reports | `.intent/reports/` | Yes, after redaction |
| Project config (threshold, provider, privacy switches) | `.intent/config.json` | Yes |
| Active spec pointer | `.intent/active.json` | No (git-ignored) |
| Agent MCP configs | `.mcp.json`, `.cursor/`, `.codex/`, `.bob/` | No (generated per clone) |
| Provider credentials | shell environment or `.env` | No (git-ignored) |

## Guarantees

- The HTTP API binds to `127.0.0.1` only. There is no authentication because
  there is no remote access.
- Specs and proof reports pass through the privacy redactor before they are
  written (see `backend/core/src/privacy/`). Emails, phone numbers, API tokens,
  private keys, payment card numbers, and local user paths are replaced with
  neutral markers, and absolute paths are rewritten as `<repo>` or `~`.
- Generated agent configs contain no absolute paths or personal data.
- The pre-commit hook and CI run `scripts/check-pii.mjs`, which refuses env
  files, private keys, local state, and generated configs, and scans text for
  personal data and credentials.
- There is no telemetry.

## If a secret or personal data was committed anyway

1. Treat the credential as compromised and rotate it first. Removing it from
   git does not un-leak it.
2. Rewrite history for the affected commits (for example with
   `git filter-repo`) and force-push, then ask collaborators to re-clone.
3. Add the value's shape to `scripts/check-pii.mjs` and
   `backend/core/src/privacy/patterns.ts` if the scanner should have caught it.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository rather than a
public issue. Include the affected package (`core`, `server`, `mcp`, `cli`,
`web`), reproduction steps, and the impact you see.
