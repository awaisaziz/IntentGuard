# IntentGuard

**Any agent. Clear intent. Proven changes.**

> Request → Intent → Code → Proof → Commit

IntentGuard is a **local intent layer** for AI coding agents (IBM Bob 2.0, Claude Code, Cursor, Codex). It doesn't replace your coding agent — it plugs into it through a **CLI + MCP server + Web Dashboard**, so that before the agent writes code, the intent is clear, and after it writes code, the result is verified against that intent.

---

## Quick Start: Running IntentGuard

### 1. Prerequisites
- **Node.js**: `>= 20.0.0`
- **Package Manager**: `pnpm` (Install via `npm install -g pnpm`)

### 2. Install & Build Monorepo

```bash
# Clone the repository
git clone https://github.com/awaisaziz/IntentGuard.git
cd IntentGuard

# Install dependencies across all packages (also enables the pre-commit PII/secret scan)
pnpm install

# Build all packages (@intentguard/core, server, mcp-server, cli, web)
pnpm run build

# Wire IntentGuard into your AI coding agents (Claude Code, Cursor, Codex, IBM Bob)
pnpm run agents:setup
```

> **Run `agents:setup` after every fresh clone.** Agent MCP configs (`.mcp.json`, `.cursor/`, `.codex/`, `.bob/`) are generated from one shared definition and are git-ignored, so they are not in the repository. See [Configuring AI Agents](#configuring-ai-agents).

### 3. Project Docs

- [PRD.md](PRD.md): product requirements, scope, and milestones
- [INTENT.md](INTENT.md): the IntentSpec, readiness gates, scope fence, and proof report
- [AGENTS.md](AGENTS.md): guide and rules for any AI agent working in this repo ([CLAUDE.md](CLAUDE.md) imports it)

---

## Running the Backend API

`@intentguard/server` is a local REST API over the IntentGuard engine. It binds to `localhost` only.

```bash
# Development (reloads on change)
pnpm run dev:server

# Production build
pnpm run start:server
```

The API is served at **http://localhost:3848/api**. Set `INTENTGUARD_API_PORT` to change the port, and `INTENT_ROOT` to point it at another repository.

| Method | Endpoint | Action |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/config` | `.intent/config.json` with defaults applied |
| `GET` | `/api/agents` | Which agents have IntentGuard MCP config and rules installed |
| `GET` | `/api/specs` | All specs, newest first, with readiness score and active flag |
| `POST` | `/api/specs` | Draft a spec from `{ "request": "..." }` and make it active |
| `GET` | `/api/specs/active` | The active spec |
| `GET` | `/api/specs/:id` | One spec |
| `POST` | `/api/specs/:id/activate` | Make a spec active |
| `GET` | `/api/specs/:id/readiness` | 6-gate readiness score and blockers |
| `GET` | `/api/specs/:id/questions` | Open questions for missing sections |
| `POST` | `/api/specs/:id/scope-check` | Check `{ "filePath": "..." }` against the scope fence |
| `POST` | `/api/specs/:id/verify` | Verify the git diff and save a proof report |
| `GET` | `/api/specs/:id/report` | The latest saved proof report |

---

## Running the Web Dashboard (Frontend)

IntentGuard includes an interactive, real-time web dashboard built with **Next.js 15 App Router**, **React 19**, and **Tailwind CSS**.

```bash
# Start the web dashboard in development mode
pnpm run dev:web

# Or start directly with the web filter
pnpm --filter @intentguard/web dev
```

Open your browser at **[http://localhost:3847](http://localhost:3847)** (or default port).

### Dashboard Capabilities
- **Overview (`/`)**: Displays the 5-step `IntentFlow` pipeline visualizer (Request → Intent → Code → Proof → Commit), active spec readiness score, and quick metrics.
- **Spec Inventory (`/specs`)**: Search, filter, and inspect all repository IntentSpecs by status (`draft`, `approved`, `shipped`, `verified`).
- **8-Part Spec Detail (`/specs/[id]`)**: Deep-dive into each section:
  1. *Objective & Problem Severity*
  2. *Measurable Outcomes* (with test mappings)
  3. *Evidence Board* (with trust tiers: `high`, `medium`, `low` and signal excerpts)
  4. *Constraints*
  5. *Scope Fence* (interactive in-scope vs. out-of-scope boundaries)
  6. *Edge Cases*
  7. *Health Metrics*
  8. *Verification Plan*
- **Readiness Gate Audit (`/specs/[id]/readiness`)**: Live scorecard evaluating the 6 readiness gates and highlighting any blocking issues before coding starts.
- **Proof Report (`/specs/[id]/report`)**: Inspection view verifying git diff against scope and automated test passes for commit readiness.
- **Settings & Integrations (`/settings`)**: Monitor detected coding agents (IBM Bob, Claude Code, Cursor, Codex) and LLM providers (IBM watsonx Granite / local Ollama).

---

## Running the CLI

You can execute the CLI binary directly or through the root npm script:

```bash
# Via npm script
pnpm run cli -- <command>

# Or directly using Node
node backend/cli/dist/index.js <command>
```

### CLI Command Reference

| Command | Action |
|---|---|
| `pnpm run cli -- init` | Initializes `.intent/` directory and detects project metadata |
| `pnpm run cli -- new "<request>"` | Drafts a new IntentSpec using LLM with interactive refinement |
| `pnpm run cli -- check [specId]` | Runs the 6 readiness gates; outputs score (0-100%) and blockers |
| `pnpm run cli -- verify [specId]` | Evaluates git diff against the scope fence and runs mapped tests |
| `pnpm run cli -- report [specId]` | Formats and outputs the complete proof report |
| `pnpm run cli -- commit [specId]` | Enforces verification before creating git commit with `[intent:{id}]` |
| `pnpm run cli -- agents setup [--agent <id>]` | Writes MCP config and rules for all agents, or one (`claude`, `cursor`, `codex`, `bob`) |
| `pnpm run cli -- mcp setup [--agent <id>]` | Writes MCP config only |
| `pnpm run cli -- rules generate [--agent <id>]` | Refreshes the managed rule block in `AGENTS.md`, `CLAUDE.md`, `.bob/rules.md` |

### Try It Now: Verify the Demo Specs

```bash
# Check the sample IBM Galaxium Travels spec (approved, score: 100%)
pnpm run cli -- check intent-demo-galaxium

# Check an intentionally vague request (blocked, score: 20%)
pnpm run cli -- check intent-vague-request

# Print the proof report for the active spec
pnpm run cli -- report intent-demo-galaxium
```

---

## Configuring AI Agents

The Model Context Protocol (MCP) server allows AI agents (IBM Bob 2.0, Claude Code, Cursor, Codex) to invoke IntentGuard tools natively via `stdio`.

### 1. Auto-configure Agents (Recommended)

```bash
pnpm run agents:setup
```

Each agent only reads MCP config from its own fixed location, so the files cannot share one folder. Instead, every agent is defined once in `backend/core/src/agents/`, and `agents:setup` generates the files each agent expects:

| Agent | MCP config (generated, git-ignored) | Rules |
|---|---|---|
| **Claude Code** | `.mcp.json` | `CLAUDE.md` (imports `AGENTS.md`) |
| **Cursor** | `.cursor/mcp.json` | `AGENTS.md` |
| **OpenAI Codex** | `.codex/config.toml` | `AGENTS.md` |
| **IBM Bob 2.0** | `.bob/mcp.json` | `AGENTS.md` + `.bob/rules.md` |

Setup is safe to re-run. It merges into existing MCP configs without removing your other servers. In rule files it only rewrites the block between the `<!-- intentguard:start -->` and `<!-- intentguard:end -->` markers, so hand-written content is kept.

Agents launch the local build with `node mcp/dist/index.js`, so run `pnpm build` before starting an agent, and start the agent from the repository root (the path is relative to it). IntentGuard is local-only and is not published to npm. The configs call `node` directly rather than `npx` because agents on Windows start MCP servers without a shell, and `npx` fails there with `ENOENT`.

### 2. Manual Agent Configuration Example

```json
{
  "mcpServers": {
    "intentguard": {
      "command": "node",
      "args": ["mcp/dist/index.js"]
    }
  }
}
```

### Available MCP Tools

| Tool | Trigger | Action |
|---|---|---|
| `intent_create` | New user request | Creates structured IntentSpec draft |
| `intent_gather_evidence` | Before planning | Extracts affected files, tests, and documentation |
| `intent_questions` | When gaps exist | Surfaces questions the codebase cannot answer |
| `intent_readiness` | Before editing | **Blocks coding** if readiness score < 70% |
| `intent_get_spec` | While coding | Retrieves approved spec as working brief |
| `intent_check_scope` | Before file edit | **Blocks file edits** outside `inScope` or within `outOfScope` |
| `intent_verify` | After coding | Verifies diff against scope and runs mapped test suite |
| `intent_report` | Before commit | Generates human-readable and commit-ready proof report |

---

## Running Automated Tests

Run the Vitest test suites for `@intentguard/core` and `@intentguard/server`:

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode
pnpm --filter @intentguard/core run test:watch
```

---

## Privacy and Secrets

IntentSpecs, proof reports, and rule files are committed and end up in pull requests, so the repository is set up to never carry personal data or credentials:

| Layer | What it does |
|---|---|
| `.gitignore` | Excludes `.env*` (except `.env.example`), private keys, `.intent/active.json`, and generated agent configs |
| `scripts/check-pii.mjs` | Dependency-free tripwire: refuses forbidden files and scans text for emails, phone numbers, API tokens, private keys, card numbers, and local user paths |
| `.githooks/pre-commit` | Runs the tripwire on staged lines. Enabled by `pnpm install`; re-run `pnpm hooks:setup` if needed |
| GitHub Actions | Runs the tripwire on every tracked file, then builds and tests on Node 20 and 22 |
| `@intentguard/core` privacy module | Redacts every spec and proof report on save and rewrites absolute paths as `<repo>` or `~`. Switches live under `privacy` in `.intent/config.json` |

```bash
# Scan everything tracked (what CI runs)
pnpm check:pii

# Scan what you are about to commit (what the hook runs)
pnpm check:pii:staged
```

Mark a deliberate false positive with `pii:allow` on the same line. See [SECURITY.md](SECURITY.md) and [CONTRIBUTING.md](CONTRIBUTING.md) for the full rules.

---

## Project Structure

```
IntentGuard/
├── frontend/          # Next.js 15 App Router dashboard, @intentguard/web (port 3847)
├── backend/
│   ├── core/          # IntentSpec engine, readiness gates, scope fence, verifier, privacy, agent registry
│   ├── server/        # REST API over core, @intentguard/server (port 3848)
│   └── cli/           # The `intent` command, @intentguard/cli
├── mcp/               # MCP stdio server exposing the 8 intent_* tools, @intentguard/mcp-server
├── scripts/           # check-pii.mjs (PII/secret tripwire), setup-hooks.mjs
├── .githooks/         # Versioned git hooks (pre-commit runs the tripwire)
├── .github/           # CI workflow
├── .intent/           # Committed intent store: specs, proof reports, config.json
├── AGENTS.md          # Guide and IntentGuard rules for every AI agent
├── CLAUDE.md          # Claude Code entry point (imports AGENTS.md)
├── INTENT.md          # Intent methodology: IntentSpec, gates, scope fence, proof
├── PRD.md             # Product requirements
├── CONTRIBUTING.md    # Setup, change flow, privacy rules
└── SECURITY.md        # What stays local, guarantees, incident steps
```

Agent MCP configs (`.mcp.json`, `.cursor/`, `.codex/`, `.bob/`) are generated by `pnpm run agents:setup` and are not committed.

## The Three Engineering Layers

| Layer | Question | Example tool | IntentGuard's Role |
|---|---|---|---|
| **Prompt** | What did the developer ask? | The agent itself | Captures raw request |
| **Context** | What does the code look like? | CodeAtlas, repo indexers, LSP | Gathers repo evidence |
| **Intent** | **Is this the right change, and did it work?** | **IntentGuard** | Structure, Gate, Scope, Proof |

> Context tools tell the agent *what the code looks like*. IntentGuard tells the agent *what should change, what must not, and how to prove it*.

---

## License

MIT © Awais Aziz
