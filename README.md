# IntentGuard

**Any agent. Clear intent. Proven changes.**

> Request → Intent → Code → Proof → Commit

IntentGuard is a **local intent layer** for AI coding agents (IBM Bob 2.0, Claude Code, Codex, Gemini CLI, Google Antigravity, Cursor). It doesn't replace your coding agent — it plugs into it through a **CLI + MCP server + Web Dashboard**, so that before the agent writes code, the intent is clear, and after it writes code, the result is verified against that intent.

It also ships its own **watsonx chat agent** (terminal and web) that works *through* the intent layer, with a switch to turn the layer off, so you can run the same request with and without IntentGuard and compare the results.

IntentGuard runs locally only. Nothing is published or deployed.

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

# Wire IntentGuard into your AI coding agents for this repository
pnpm run agents:setup

# ...or connect any other local repository (the one you want your agent to work on)
pnpm connect ../path/to/your-project
```

> **Run `agents:setup` (and `connect` for other repos) after every fresh clone, and again if you move the IntentGuard folder.** Agent MCP configs hold absolute paths to this checkout, so they are generated per machine and never committed. See [Connect Any Repository](#connect-any-repository).

### 3. Project Docs

- [PRD.md](PRD.md): product requirements, scope, and milestones
- [INTENT.md](INTENT.md): the IntentSpec, readiness gates, scope fence, and proof report
- [AGENTS.md](AGENTS.md): guide and rules for any AI agent working in this repo ([CLAUDE.md](CLAUDE.md) imports it)

---

## Connect Any Repository

Point IntentGuard at the project your agent will work on:

```bash
pnpm connect ../path/to/your-project            # every agent
pnpm connect ../path/to/your-project --agent bob # just one
```

`connect` does four things in that repository:

1. Creates `.intent/config.json` if missing, detecting test/lint/build commands (the only commands the chat agent may run).
2. Writes the MCP config each agent reads, launching this checkout's MCP server with `node <IntentGuard>/mcp/dist/index.js` and `INTENT_ROOT=<your repo>`.
3. Adds the IntentGuard rules block to `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `.bob/rules/intentguard.md`, keeping any existing content.
4. Lists the machine-specific files in the repo's `.git/info/exclude` (a local, never-committed ignore list), so your paths cannot end up in its history.

Then open that repository in your agent (next steps are printed per agent). Relative paths are resolved from the folder you run the command in.

### Test It in Each Agent

Run `pnpm build` once, then `pnpm connect <your-project>`. Always open the **connected project folder** (not the IntentGuard folder) in the agent.

| Agent | Turn it on | Check it is connected |
|---|---|---|
| **IBM Bob (IDE)** | Open the folder, switch to **Advanced** mode (MCP tools need it), refresh the MCP tab | MCP tab lists `intentguard` (project) |
| **IBM Bob Shell** | `bob --chat-mode advanced` in the folder | `bob mcp list` shows `✓ intentguard … Connected` |
| **Claude Code** | Run `claude` in the folder and approve the `intentguard` project server when asked | `claude mcp get intentguard` or `/mcp` |
| **Codex CLI** | Run `codex` in the folder and trust the project (project config loads only for trusted projects) | `codex mcp list` or `/mcp` |
| **Gemini CLI** | Run `gemini` in the folder and trust the folder (MCP is disabled in untrusted folders) | `gemini mcp list` or `/mcp` |
| **Google Antigravity** | Open the folder, then Agent panel > … > MCP Servers > refresh | `intentguard` is listed from `.agents/mcp_config.json` |

Then give the agent a vague request such as *"improve the booking flow"*. It should draft a spec with `intent_create`, ask you the open questions from `intent_questions`, record your answers with `intent_update_spec`, and only start editing once `intent_readiness` says READY, checking each file with `intent_check_scope`.

If Codex Desktop ignores the project config (a known Codex issue), register the server globally instead, using the command and `INTENT_ROOT` from the generated `.codex/config.toml`:

```bash
codex mcp add intentguard --env INTENT_ROOT=<path-to-your-project> -- node <path-to-IntentGuard>/mcp/dist/index.js
```

> Over MCP, IntentGuard is a guide the agent consults, not a lock: the tools answer BLOCKED, and the rules tell the agent to stop, but the agent's own edit tool is not intercepted. The built-in [chat agent](#chat-agent-ibm-watsonx) enforces the gate in code.

---

## Chat Agent (IBM watsonx)

A coding agent powered by IBM watsonx (default model `ibm/granite-4-h-small`) whose only way to touch the repository is through IntentGuard. With the **intent layer on**, it:

1. drafts an IntentSpec from your request and fills it in from repository evidence;
2. asks you about gaps instead of assuming;
3. waits for **you** to approve the spec (it has no way to approve it itself) once readiness reaches 70;
4. edits only files inside the approved scope (every other edit is **BLOCKED**, and changing the spec resets approval);
5. runs your configured checks and finishes with a proof report.

With the **intent layer off** (baseline), the same model and file tools run unfenced. Both modes record metrics (tool calls, blocked edits, files written, out-of-scope writes, checks, tokens, time) and write a local run log to `.intent/runs/`.

### Setup

Copy `.env.example` to `.env` in the IntentGuard folder and set `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` (plus `WATSONX_URL` if your project is not in `us-south`). The chat, the API server, and the MCP server load this file automatically; keys never go into connected repositories.

```bash
# List the tool-calling models available to your project's region
pnpm chat --list-models
```

### Terminal

```bash
pnpm chat --repo ../path/to/your-project               # intent layer on
pnpm chat --repo ../path/to/your-project --no-harness  # baseline for comparison
```

Commands inside the chat: `/approve`, `/spec`, `/metrics`, `/help`, `/exit`. Ctrl+C stops the agent mid-task.

### Web

```bash
pnpm dev:server --repo ../path/to/your-project   # API on http://localhost:3848
pnpm dev:web                                     # dashboard on http://localhost:3847
```

Open **http://localhost:3847/chat**. Toggle **Intent layer ON / Baseline (OFF)**, approve specs with the **Approve spec** button, and watch blocked edits and metrics live.

### Running an A/B Comparison

1. On a fresh branch, run the request with the intent layer on. Approve the spec when the agent asks.
2. Reset the code (for example a second branch from the same commit), keep the approved spec active, and run the same request with the layer off.
3. Compare the session metrics and `.intent/runs/*.json`. With the spec active, the baseline's **out-of-scope writes** show exactly the drift the harness blocked.

The same comparison works with an external agent: run it once in a plain checkout and once in a connected one.

---

## Running the Backend API

`@intentguard/server` is a local REST API over the IntentGuard engine. It binds to `localhost` only.

```bash
# Development (reloads on change)
pnpm run dev:server

# Production build
pnpm run start:server
```

The API is served at **http://localhost:3848/api**. Set `INTENTGUARD_API_PORT` to change the port, and pass `--repo <path>` (or set `INTENT_ROOT`) to point it at another repository.

Because the chat agent can edit files, the API only accepts requests addressed to `localhost`, from the local dashboard's origin (add more with `INTENTGUARD_ALLOWED_ORIGINS`), and with a JSON body on every `POST`.

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
| `POST` | `/api/chat` | Start a chat session, `{ "harness": true \| false }` |
| `GET` | `/api/chat/:id` | Session state: model, metrics, active spec |
| `POST` | `/api/chat/:id/messages` | Send `{ "message": "..." }`; streams agent events as server-sent events |
| `POST` | `/api/chat/:id/approve` | Developer approval of the active spec (intent layer on only) |

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
- **Agent Chat (`/chat`)**: The watsonx chat agent, live against the backend: intent layer on/off toggle, spec panel with readiness and approval, blocked edits, and session metrics. The pages below still use mock data.
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
| `pnpm connect [repo] [--agent <id>]` | Connects a repository: `.intent/` setup, MCP config and rules for all agents or one (`claude`, `bob`, `codex`, `gemini`, `cursor`) |
| `pnpm chat [--repo <path>] [--no-harness] [--model <id>]` | Chat with the watsonx coding agent, with or without the intent layer |
| `pnpm run cli -- agents setup [--agent <id>]` | Connects this repository (same as `connect` with no path) |
| `pnpm run cli -- mcp setup [--agent <id>]` | Writes MCP config only |
| `pnpm run cli -- rules generate [--agent <id>]` | Refreshes the managed rule block in `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.bob/rules/intentguard.md` |

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

The Model Context Protocol (MCP) server allows AI agents (IBM Bob 2.0, Claude Code, Codex, Gemini CLI, Google Antigravity, Cursor) to invoke IntentGuard tools natively via `stdio`.

### 1. Auto-configure Agents (Recommended)

```bash
pnpm run agents:setup                  # this repository
pnpm connect ../path/to/your-project   # any other repository
```

Each agent only reads MCP config from its own fixed location, so the files cannot share one folder. Instead, every agent is defined once in `backend/core/src/agents/`, and setup generates the files each agent expects:

| Agent | MCP config (machine-specific, never committed) | Rules |
|---|---|---|
| **Claude Code** | `.mcp.json` | `CLAUDE.md` (imports `AGENTS.md`) |
| **IBM Bob 2.0** | `.bob/mcp.json` | `AGENTS.md` + `.bob/rules/intentguard.md` |
| **OpenAI Codex** | `.codex/config.toml` (loaded for trusted projects) | `AGENTS.md` |
| **Gemini CLI** | `.gemini/settings.json` | `GEMINI.md` (imports `AGENTS.md`) |
| **Google Antigravity** | `.agents/mcp_config.json` (workspace config, Antigravity 2.0) | `AGENTS.md` + `GEMINI.md` |
| **Cursor** | `.cursor/mcp.json` | `AGENTS.md` |

Setup is safe to re-run. It merges into existing MCP configs without removing your other servers or settings. In rule files it only rewrites the block between the `<!-- intentguard:start -->` and `<!-- intentguard:end -->` markers, so hand-written content is kept.

Agents launch the built server with `node` and absolute paths, so run `pnpm build` first. Absolute paths are needed because IDE-based agents such as Bob and Cursor do not start MCP servers in the project folder, and `INTENT_ROOT` tells the server which repository to guard. The configs call `node` directly rather than `npx` because agents on Windows start MCP servers without a shell, where `npx` fails with `ENOENT`. IntentGuard is local-only and is not published to npm.

### 2. Manual Agent Configuration Example

```json
{
  "mcpServers": {
    "intentguard": {
      "command": "node",
      "args": ["<path-to-IntentGuard>/mcp/dist/index.js"],
      "env": { "INTENT_ROOT": "<path-to-your-project>" }
    }
  }
}
```

### Available MCP Tools

| Tool | Trigger | Action |
|---|---|---|
| `intent_create` | New user request | Creates structured IntentSpec draft |
| `intent_gather_evidence` | Before planning | Extracts affected files, tests, and documentation |
| `intent_questions` | When gaps exist | Turns what the spec is missing into questions for the developer, quoting its vague outcomes and one-sided scope |
| `intent_update_spec` | After the developer answers | Records answers and findings in the spec; changing an approved spec sends it back to draft |
| `intent_readiness` | Before editing | **Blocks coding** until the readiness score reaches the threshold (default 70) |
| `intent_get_spec` | While coding | Retrieves approved spec as working brief |
| `intent_check_scope` | Before file edit | **Blocks file edits** unless the spec is ready and the file is in scope (accepts absolute or relative paths) |
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
| `.gitignore` | Excludes `.env*` (except `.env.example`), private keys, `.intent/active.json`, `.intent/runs/`, and generated agent configs |
| `.git/info/exclude` (connected repos) | `intent connect` keeps machine-specific configs and local state out of the connected repo's commits without touching its `.gitignore` |
| Chat agent workspace | The agent cannot read `.env` files or keys, cannot leave the repository, and cannot edit `.git/`, `node_modules/`, or `.intent/` directly |
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
│   ├── core/          # IntentSpec engine, gates, scope fence, verifier, privacy, agent registry,
│   │                  # connect workflow, watsonx client, and the fenced chat agent (src/agent)
│   ├── server/        # REST + streaming chat API over core, @intentguard/server (port 3848)
│   └── cli/           # The `intent` command (connect, chat, check, verify...), @intentguard/cli
├── mcp/               # MCP stdio server exposing the 8 intent_* tools, @intentguard/mcp-server
├── scripts/           # check-pii.mjs (PII/secret tripwire), setup-hooks.mjs
├── .githooks/         # Versioned git hooks (pre-commit runs the tripwire)
├── .github/           # CI workflow
├── .intent/           # Committed intent store: specs, proof reports, config.json
├── AGENTS.md          # Guide and IntentGuard rules for every AI agent
├── CLAUDE.md          # Claude Code entry point (imports AGENTS.md)
├── GEMINI.md          # Gemini CLI entry point (imports AGENTS.md)
├── INTENT.md          # Intent methodology: IntentSpec, gates, scope fence, proof
├── PRD.md             # Product requirements
├── CONTRIBUTING.md    # Setup, change flow, privacy rules
└── SECURITY.md        # What stays local, guarantees, incident steps
```

Agent MCP configs (`.mcp.json`, `.cursor/`, `.codex/`, `.bob/`, `.gemini/`) are generated by `pnpm run agents:setup` and are not committed.

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
