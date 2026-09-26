# Contributing to IntentGuard

Thanks for helping build the intent layer for AI coding agents. This guide
covers setup, the layout, how a change flows through IntentGuard itself, and
the privacy rules every contribution must respect.

## Getting started

```bash
git clone https://github.com/awaisaziz/IntentGuard.git
cd IntentGuard
pnpm install          # also enables the pre-commit PII/secret scan
pnpm build            # core builds first; the MCP server and CLI depend on it
pnpm test             # vitest for core and server
pnpm agents:setup     # generate MCP config and rules for your coding agent
```

Optional: copy `.env.example` to `.env` and export the values you need. Nothing
reads `.env` automatically; use `node --env-file=.env ...` or your shell.

## Layout

```
frontend/      Next.js dashboard (@intentguard/web), still on mock data
backend/
  core/        All domain logic (@intentguard/core)
  server/      Local HTTP API over core (@intentguard/server)
  cli/         The `intent` command (@intentguard/cli)
mcp/           MCP stdio server exposing the intent_* tools (@intentguard/mcp-server)
scripts/       Repo tooling: PII tripwire, hook installer
.githooks/     Versioned git hooks (pre-commit)
.intent/       Committed specs, proof reports, and config
```

Logic lives in `backend/core`. The server, MCP server, and CLI are thin
wrappers, so every entry point behaves the same. See [AGENTS.md](AGENTS.md)
for the conventions coding agents follow here; they apply to people too.

## How a change flows

IntentGuard is used on its own repository:

1. **Spec it.** `pnpm run cli -- new "<request>"` drafts an IntentSpec into
   `.intent/specs/`, or let your agent call `intent_create`.
2. **Gate it.** `pnpm run cli -- check` must report a readiness score of 70 or
   more before any code is written. Fill the blockers it lists; do not guess.
3. **Stay in scope.** Edit only files matched by `scope.inScope` and never
   files matched by `scope.outOfScope`. Agents call `intent_check_scope` per
   file; you can widen the scope in the spec if a change genuinely needs it.
4. **Prove it.** `pnpm run cli -- verify` checks the diff against the scope
   fence and writes a proof report to `.intent/reports/`.
5. **Commit it.** `pnpm run cli -- commit` refuses to commit unless verification
   passes and tags the message with `[intent:<id>]`.

Commit the spec and its report together with the code.

## Development guidelines

- ESM throughout. Relative imports in TypeScript use the `.js` suffix.
- Add or update Vitest tests next to the package you change
  (`backend/<pkg>/test`).
- Agent integrations are defined once in `backend/core/src/agents/`. Never
  hand-edit `.mcp.json`, `.cursor/`, `.codex/`, `.bob/`, `.gemini/`, or `.agents/mcp_config.json`; they
  are generated per machine by `pnpm agents:setup` / `pnpm connect`.
- Do not change `frontend/` unless the task is explicitly about the dashboard
  (the chat page is the only live part).
- Configuration comes from environment variables (`WATSONX_API_KEY`,
  `WATSONX_PROJECT_ID`, `INTENT_ROOT`, `INTENTGUARD_API_PORT`), never from
  committed files.

## Privacy and secrets

Specs, reports, and rule files are committed and end up in pull requests, so
the repository must never carry personal data or credentials.

- **Never commit** `.env` files, private keys, tokens, `.intent/active.json`,
  `.intent/runs/`, or generated agent configs. `.gitignore` excludes them and
  `scripts/check-pii.mjs` refuses them even if force-added.
- **The pre-commit hook** runs `node scripts/check-pii.mjs --staged` on the
  lines you are adding. CI runs `--all` on every tracked file. Fix the finding
  rather than bypassing it. If it is a genuine false positive, put `pii:allow`
  on that line.
- **Write evidence without personal data.** Cite a ticket ID, a dashboard, or
  a file path rather than quoting someone's email, phone, or name. The spec
  store redacts what it can (see `backend/core/src/privacy/`), but it cannot
  recognise every name.
- **No absolute local paths** in anything committed: code, docs, specs, or
  rule files. Use paths relative to the repo root. (Generated MCP configs hold
  absolute paths to your checkout by design; that is why they are never
  committed.)
- Test fixtures that need a realistic secret or address should assemble it at
  runtime (for example `['sk', 'live', 'x'.repeat(20)].join('-')`) so the
  scanner does not trip on the test file.

## Commits and pull requests

- Use conventional commit messages: `feat:`, `fix:`, `docs:`, `chore:`,
  `refactor:`, `test:`. Keep the `[intent:<id>]` tag that `intent commit` adds.
- A pull request should include the IntentSpec, its proof report, tests for
  the change, and a green CI run (build, tests, privacy scan).
- Keep pull requests to one spec. If the work grows, split the spec.
