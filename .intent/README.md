# .intent/

The committed record of what each change was meant to do, and the proof that
it did it. IntentGuard's CLI, HTTP API, and MCP server all read and write here.

| Path | Purpose | Committed |
|---|---|---|
| `config.json` | Project settings: LLM provider, readiness threshold, spec and report dirs, privacy switches | Yes |
| `specs/<id>.json` | An eight-part IntentSpec (plus `<id>.md`, a readable rendering) | Yes |
| `reports/<id>-report.json` | Proof report from the last `intent_verify` / `intent verify` run | Yes |
| `active.json` | Which spec the CLI and MCP tools use when no ID is given | No (local state) |

## Privacy

Specs and reports end up in pull requests, so they are redacted on save:
emails, phone numbers, credentials, private keys, card numbers, and local user
paths become neutral markers, and absolute paths become `<repo>` or `~`.

Write evidence so it needs no redaction: cite a ticket number, dashboard, or
file path instead of quoting a person's contact details. Turn redaction off
only for a private repository, with `"privacy": { "redactSpecs": false }`.

## Demo specs

- `intent-demo-galaxium`: a complete, approved spec (readiness 100).
- `intent-vague-request`: a request too vague to start coding (readiness 20).
