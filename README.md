# IntentGuard

**Any agent. Clear intent. Proven changes.**

> Request → Intent → Code → Proof → Commit

IntentGuard is a **local intent layer** for AI coding agents (IBM Bob 2.0, Claude Code, Codex, Gemini CLI, Google Antigravity, Cursor). It doesn't replace your coding agent — it plugs into it through a **CLI + MCP server + Web Dashboard**, so that before the agent writes code, the intent is clear, and after it writes code, the result is verified against that intent.

It also ships its own **chat agent** (OpenAI, DeepSeek, or IBM watsonx — your choice) that works *through* the intent layer, with a switch to turn the layer off for A/B comparison.

IntentGuard runs locally only. Nothing is published or deployed.

---

## Getting Started

Follow these steps in order. Each one builds on the previous.

---

### Step 1 — Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| **Git** | any recent | [git-scm.com](https://git-scm.com) |
| **Node.js** | 20.0.0 | [nodejs.org](https://nodejs.org) |
| **pnpm** | 8.0.0 | `npm install -g pnpm` |

Verify:

```bash
git --version    # git version 2.x.x
node --version   # v20.x.x or higher
pnpm --version   # 8.x.x or higher
```

---

### Step 2 — Clone and build IntentGuard

IntentGuard lives in its own folder, separate from any project you apply it to.

```bash
git clone https://github.com/awaisaziz/IntentGuard.git
cd IntentGuard
pnpm install   # installs all packages and enables the pre-commit PII scan hook
pnpm build     # compiles core → server → mcp-server → cli → web
```

> **Why build?** Everything runs from compiled `dist/` output — the MCP server, CLI, and API server all need it. Nothing works until this completes.

Expected finish:
```
Tasks:    5 successful, 5 total
```

If a package fails, run `pnpm build` again — the first run can race on a cold cache.

---

### Step 3 — Configure your API keys

```bash
cp .env.example .env   # git-ignored; never committed
```

Open `.env` and set at least one provider key:

| Provider | Variable(s) | Get a key |
|---|---|---|
| **OpenAI** (default) | `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| **DeepSeek** | `DEEPSEEK_API_KEY` | [platform.deepseek.com](https://platform.deepseek.com) |
| **IBM watsonx** | `WATSONX_API_KEY` + `WATSONX_PROJECT_ID` | IBM Cloud console |

One key is enough to start. IBM Bob connects over MCP and needs no key here. Keys stay in the IntentGuard folder — they are never written into any connected project.

Optional overrides: `OPENAI_MODEL`, `DEEPSEEK_MODEL`, `WATSONX_URL`, `WATSONX_MODEL_ID`. See `.env.example` for the full list.

---

### Step 4 — Connect a project repository

"Connecting" writes the MCP config and agent rules into a project so any agent opened there gets the IntentGuard tools. Run this once per project, from inside the IntentGuard folder:

```bash
# Project already on your machine:
pnpm connect /path/to/your-project
pnpm connect ../your-project          # relative path works too

# Project on GitHub — clone it first, then connect:
git clone https://github.com/your-org/your-repo.git ../your-repo
pnpm connect ../your-repo
```

**Optional: connect from inside any project without typing a path**

Install the CLI globally once (after `pnpm build`). Run this from the **IntentGuard root folder**:

```bash
# pnpm 9+ uses `add --global` with an absolute path instead of `link --global`
pnpm add --global "$(pwd)/backend/cli"   # macOS / Linux
pnpm add --global "$pwd\backend\cli"     # Windows PowerShell
```

Close and reopen your terminal, then verify:

```bash
intent --help
# Should print: "CLI for IntentGuard - the intent layer for AI coding agents"
```

After that, `cd` into any project and run `intent connect` — no path needed. When you update IntentGuard (`git pull` + `pnpm build`), the global `intent` command picks up the new build automatically because it links to the same folder.

#### What a successful connect looks like

```
IntentGuard connected: /path/to/your-project
✓ Created .intent/config.json
✓ MCP config: .mcp.json
✓ MCP config: .bob/mcp.json
✓ Rules: CLAUDE.md
✓ Kept out of git via .git/info/exclude: .mcp.json, .bob/mcp.json, ...

Next steps
  • Claude Code: start a new session in the repo ...
  • IBM Bob: open the repo folder, switch to Advanced mode ...
```

| Output | Meaning |
|---|---|
| `IntentGuard connected: ...` | Done — open the project in your agent |
| `Repository not found: ...` | Path is wrong; check spelling and wrap spaces in quotes |
| `The IntentGuard MCP server is not built` | Run `pnpm build`, then connect again |
| `No test/lint commands detected` | Warning only — add commands in `.intent/config.json` |
| `connect --- simple relaying command via proxy` | You ran `pnpm connect` outside the IntentGuard folder; `cd IntentGuard` first |

> **What connect does:** creates `.intent/config.json`, writes the MCP server entry for each agent, injects the IntentGuard rules block into `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` / `.bob/rules/intentguard.md`, and adds machine-specific files to `.git/info/exclude` so they are never committed. Safe to re-run.

By default all six agents are set up. To set up only one: `pnpm connect ../your-project --agent claude` (valid ids: `claude`, `bob`, `codex`, `gemini`, `antigravity`, `cursor`).

---

### Step 5 — Start using it

**Option A — Web dashboard (recommended for first use)**

Open two terminal tabs, both in the IntentGuard folder:

```bash
# Tab 1 — API server
pnpm dev:server --repo ../your-project   # http://localhost:3848/api

# Tab 2 — dashboard
pnpm dev:web                             # http://localhost:3847
```

Open **http://localhost:3847/chat**. Pick a model from the dropdown (OpenAI, DeepSeek, or watsonx), toggle the intent layer on or off, and describe a change.

**Option B — Terminal chat agent**

```bash
pnpm chat --repo ../your-project               # intent layer on
pnpm chat --repo ../your-project --no-harness  # baseline (layer off)
```

Commands inside the chat: `/approve`, `/spec`, `/metrics`, `/help`, `/exit`. Ctrl+C stops the agent.

**Option C — Your own agent (Claude Code, IBM Bob, Cursor, etc.)**

Open the **connected project folder** in your agent. The `intent_*` tools are available immediately.

| Agent | How to verify it's connected |
|---|---|
| **IBM Bob (IDE)** | Switch to **Advanced** mode → MCP tab lists `intentguard` |
| **IBM Bob Shell** | `bob mcp list` shows `✓ intentguard … Connected` |
| **Claude Code** | `/mcp` in a session, or `claude mcp list` |
| **Codex CLI** | `/mcp` after trusting the project folder |
| **Gemini CLI** | `gemini mcp list` after trusting the folder |
| **Google Antigravity** | Agent panel → MCP Servers → refresh; `intentguard` appears |
| **Cursor** | Settings → MCP → `intentguard` shows as enabled |

Give the agent a vague request such as *"improve the booking flow"*. It drafts a spec with `intent_create`, asks open questions, and only edits files after `intent_readiness` clears and you approve.

> Over MCP, IntentGuard is a guide the agent consults, not a lock: the tools answer BLOCKED, and the rules tell the agent to stop, but the agent's own edit tool is not intercepted. The built-in [chat agent](#chat-agent-openai--deepseek--watsonx) enforces the gate in code.

---

### Keeping IntentGuard up to date

```bash
cd IntentGuard
git pull
pnpm install
pnpm build
```

Connected projects pick up the new build automatically. Re-run `pnpm connect` only if you move the IntentGuard folder or want to add an agent you skipped.

---

### Pushing changes back to GitHub

IntentGuard writes only local, never-committed files. Your GitHub remote is untouched. After an agent makes changes, push as normal:

```bash
cd your-project
git add -p                  # review the diff
git commit -m "feat: ..."   # or: pnpm run cli -- commit  (enforces proof first)
git push origin main
```

---

## Chat Agent (OpenAI · DeepSeek · watsonx)

A coding agent whose only way to touch the repository is through IntentGuard. With the **intent layer on**, it:

1. drafts an IntentSpec from your request and fills it in from repository evidence;
2. asks you about gaps instead of assuming;
3. waits for **you** to approve the spec once readiness reaches 70;
4. edits only files inside the approved scope — every other edit is **BLOCKED**;
5. runs your configured checks and finishes with a proof report.

With the **intent layer off** (baseline), the same model and file tools run unfenced. Both modes record metrics (tool calls, blocked edits, files written, tokens, time) and write a local run log to `.intent/runs/`.

API key setup and model selection are covered in [Step 3](#step-3--configure-your-api-keys). Start the chat agent as shown in [Step 5](#step-5--start-using-it).

### Running an A/B Comparison

1. On a fresh branch, run the request with the intent layer on. Approve the spec when the agent asks.
2. On a second branch from the same commit, run the same request with the layer off.
3. Compare the session metrics and `.intent/runs/*.json`. The baseline's **out-of-scope writes** show exactly the drift the harness blocked.

---

## Running the Backend API

`@intentguard/server` is a local REST API over the IntentGuard engine. It binds to `localhost` only.

```bash
pnpm dev:server            # development, reloads on change — http://localhost:3848/api
pnpm run start:server      # production build
```

Pass `--repo <path>` (or set `INTENT_ROOT`) to point it at a repository. Set `INTENTGUARD_API_PORT` to change the port.

Because the chat agent can edit files, the API only accepts requests addressed to `localhost`, from the local dashboard's origin, and with a JSON `Content-Type` on every `POST`.

| Method | Endpoint | Action |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/config` | `.intent/config.json` with defaults applied |
| `GET` | `/api/agents` | Which agents have MCP config and rules installed |
| `GET` | `/api/specs` | All specs, newest first, with readiness score and active flag |
| `POST` | `/api/specs` | Draft a spec from `{ "request": "..." }` |
| `GET` | `/api/specs/active` | The active spec |
| `GET` | `/api/specs/:id` | One spec |
| `POST` | `/api/specs/:id/activate` | Make a spec active |
| `GET` | `/api/specs/:id/readiness` | 6-gate readiness score and blockers |
| `GET` | `/api/specs/:id/questions` | Open questions for missing sections |
| `POST` | `/api/specs/:id/scope-check` | Check `{ "filePath": "..." }` against the scope fence |
| `POST` | `/api/specs/:id/verify` | Verify the git diff and save a proof report |
| `GET` | `/api/specs/:id/report` | The latest saved proof report |
| `POST` | `/api/chat` | Start a chat session — `{ "harness": true \| false, "provider": "...", "model": "..." }` |
| `GET` | `/api/chat/:id` | Session state: model, metrics, active spec |
| `POST` | `/api/chat/:id/messages` | Send `{ "message": "..." }`; streams agent events as SSE |
| `POST` | `/api/chat/:id/approve` | Developer approval of the active spec (intent layer on only) |

---

## Running the Web Dashboard (Frontend)

Built with **Next.js 15 App Router**, **React 19**, and **Tailwind CSS**. Start it as described in [Step 5 Option A](#step-5--start-using-it). Port notes: API defaults to `3848`, dashboard to `3847`. To change the API port, also set `NEXT_PUBLIC_INTENTGUARD_API_URL=http://localhost:<port>` in `frontend/.env.local`.

### Chat page (`/chat`)

1. **Pick a model** from the dropdown — OpenAI (gpt-4.1, o4-mini), DeepSeek (deepseek-flash), or watsonx (Granite 4).
2. **Toggle the mode** — Intent layer ON or Baseline (OFF).
3. **Describe a change.** The agent drafts a spec, gathers evidence, and asks open questions before touching any file.
4. **Approve the spec** when readiness reaches 70 — the button appears in the right panel.
5. **Watch it build** — blocked edits, tool calls, and metrics update live.

### All pages

| Page | What it shows |
|---|---|
| `/chat` | Live chat agent with model selector, spec panel, blocked-edit log, and metrics |
| `/` | IntentFlow pipeline visualizer, active spec readiness, quick metrics |
| `/specs` | All specs — search, filter by status (`draft`, `approved`, `shipped`, `verified`) |
| `/specs/[id]` | 8-section spec detail: Objective, Outcomes, Evidence, Constraints, Scope, Edge Cases, Health Metrics, Verification |
| `/specs/[id]/readiness` | Live 6-gate readiness scorecard |
| `/specs/[id]/report` | Proof report — diff vs scope, test results |
| `/settings` | Detected agents and configured LLM providers |

---

## Running the CLI

```bash
pnpm run cli -- <command>              # via workspace script
node backend/cli/dist/index.js <cmd>  # directly
intent <command>                       # if linked globally (see Step 4)
```

| Command | Action |
|---|---|
| `intent init` | Initialise `.intent/` and detect test/lint/build commands |
| `intent new "<request>"` | Draft a new IntentSpec with LLM assistance |
| `intent check [specId]` | Run the 6 readiness gates; output score and blockers |
| `intent verify [specId]` | Evaluate git diff against the scope fence and run mapped tests |
| `intent report [specId]` | Print the proof report |
| `intent commit [specId]` | Enforce verification, then commit with `[intent:{id}]` tag |
| `pnpm connect [path] [--agent <id>]` | Connect a repository (see [Step 4](#step-4--connect-a-project-repository)) |
| `pnpm chat [--repo <path>] [--no-harness] [--provider <p>] [--model <m>]` | Start the chat agent |
| `intent agents setup [--agent <id>]` | Re-run connect for this repository |
| `intent mcp setup [--agent <id>]` | Write MCP config only |
| `intent rules generate [--agent <id>]` | Refresh the managed rule blocks |

### Try the demo specs

```bash
intent check intent-demo-galaxium   # approved spec, score 100%
intent check intent-vague-request   # intentionally vague, score 20% — blocked
intent report intent-demo-galaxium  # print the proof report
```

---

## Running the MCP Server

The MCP server exposes the 8 `intent_*` tools over stdio. **You never start it manually** — `intent connect` writes a config and each agent launches it automatically.

When an agent calls a tool, it spawns:
```bash
node /absolute/path/to/IntentGuard/mcp/dist/index.js
```
with `INTENT_ROOT` set to the connected repository.

**Debugging:** run it directly to verify it loads:

```bash
INTENT_ROOT=/path/to/your-project node mcp/dist/index.js
# JSON-RPC handshake appears on stdout; Ctrl+C to stop

# Or use the MCP Inspector:
npx @modelcontextprotocol/inspector node mcp/dist/index.js
```

**Troubleshooting:**

| Symptom | Fix |
|---|---|
| Agent shows `intentguard: not connected` | Run `pnpm build`, then `pnpm connect <path>` |
| `ENOENT node` on Windows | Re-run `pnpm connect` to regenerate configs with the correct absolute path |
| `INTENT_ROOT not set` | The MCP config is missing the `env` block; re-run `pnpm connect` |
| Tools available but always error | `.intent/config.json` missing; run `intent init` inside the project |
| `Cannot find module` on startup | `mcp/dist/index.js` missing; run `pnpm build` |

---

## Configuring AI Agents

`pnpm connect` handles everything automatically (see [Step 4](#step-4--connect-a-project-repository)). This section documents what it writes and how to configure an agent manually if needed.

Each agent reads MCP config only from its own fixed location:

| Agent | MCP config | Rules file |
|---|---|---|
| **Claude Code** | `.mcp.json` | `CLAUDE.md` (imports `AGENTS.md`) |
| **IBM Bob 2.0** | `.bob/mcp.json` | `AGENTS.md` + `.bob/rules/intentguard.md` |
| **OpenAI Codex** | `.codex/config.toml` | `AGENTS.md` |
| **Gemini CLI** | `.gemini/settings.json` | `GEMINI.md` (imports `AGENTS.md`) |
| **Google Antigravity** | `.agents/mcp_config.json` | `AGENTS.md` + `GEMINI.md` |
| **Cursor** | `.cursor/mcp.json` | `AGENTS.md` |

All configs are machine-specific and never committed. Setup merges into existing MCP configs without removing other servers.

**Manual config example** (if you prefer not to use `connect`):

```json
{
  "mcpServers": {
    "intentguard": {
      "command": "node",
      "args": ["/absolute/path/to/IntentGuard/mcp/dist/index.js"],
      "env": { "INTENT_ROOT": "/absolute/path/to/your-project" }
    }
  }
}
```

> Configs use `node` directly (not `npx`) because IDE agents on Windows start MCP servers without a shell, where `npx` fails with `ENOENT`. IntentGuard is not published to npm.

If Codex Desktop ignores the project config (a known Codex issue), register globally:

```bash
codex mcp add intentguard --env INTENT_ROOT=<path-to-your-project> -- node <path-to-IntentGuard>/mcp/dist/index.js
```

### Available MCP Tools

| Tool | When called | What it does |
|---|---|---|
| `intent_create` | New request | Drafts a structured IntentSpec |
| `intent_gather_evidence` | Before planning | Extracts affected files, tests, and docs |
| `intent_questions` | Gaps found | Turns missing spec sections into questions for the developer |
| `intent_update_spec` | After answers | Records answers; resets approval if spec was already approved |
| `intent_readiness` | Before editing | **Blocks coding** until score ≥ threshold (default 70) |
| `intent_get_spec` | While coding | Returns the approved spec as the working brief |
| `intent_check_scope` | Before each file edit | **Blocks the edit** if the file is out of scope |
| `intent_verify` | After coding | Verifies diff against scope and runs mapped tests |
| `intent_report` | Before commit | Generates the proof report |

---

## Running Automated Tests

```bash
pnpm test                                          # all packages
pnpm --filter @intentguard/core run test:watch     # watch mode
```

---

## Privacy and Secrets

IntentSpecs and proof reports are committed, so the project is hardened against leaking credentials or personal data:

| Layer | What it does |
|---|---|
| `.gitignore` | Excludes `.env*`, private keys, `.intent/active.json`, `.intent/runs/`, and generated agent configs |
| `.git/info/exclude` (connected repos) | `intent connect` keeps machine-specific files out of the connected repo without touching its `.gitignore` |
| Chat agent workspace | Agent cannot read `.env` files, cannot leave the repository, cannot edit `.git/`, `node_modules/`, or `.intent/` directly |
| `scripts/check-pii.mjs` | Scans for emails, phone numbers, API tokens, private keys, card numbers, and local user paths |
| `.githooks/pre-commit` | Runs the scan on staged lines — enabled by `pnpm install` |
| GitHub Actions | Runs the scan on every tracked file, then builds and tests on Node 20 and 22 |
| `@intentguard/core` privacy module | Redacts specs and proof reports on save; rewrites absolute paths as `<repo>` or `~` |

```bash
pnpm check:pii          # scan all tracked files (what CI runs)
pnpm check:pii:staged   # scan staged lines (what the hook runs)
```

Mark a deliberate false positive with `pii:allow` on the same line. See [SECURITY.md](SECURITY.md) and [CONTRIBUTING.md](CONTRIBUTING.md) for the full rules.

---

## Project Structure

```
IntentGuard/
├── frontend/          # Next.js 15 dashboard (@intentguard/web, port 3847)
├── backend/
│   ├── core/          # Domain logic: IntentSpec engine, gates, scope fence, verifier,
│   │                  # privacy, agent registry, LLM providers, fenced chat agent
│   ├── server/        # REST + streaming API over core (@intentguard/server, port 3848)
│   └── cli/           # `intent` command: connect, chat, check, verify... (@intentguard/cli)
├── mcp/               # MCP stdio server — 8 intent_* tools (@intentguard/mcp-server)
├── scripts/           # check-pii.mjs, setup-hooks.mjs
├── .githooks/         # Versioned git hooks (pre-commit runs the PII scan)
├── .github/           # CI workflow
├── .intent/           # Specs, proof reports, config.json (committed)
├── AGENTS.md          # Agent guide and IntentGuard rules
├── CLAUDE.md          # Claude Code entry point (imports AGENTS.md)
├── GEMINI.md          # Gemini CLI entry point (imports AGENTS.md)
├── INTENT.md          # IntentSpec methodology, gates, scope fence, proof
├── PRD.md             # Product requirements
├── CONTRIBUTING.md    # Setup, change flow, privacy rules
└── SECURITY.md        # Local-only guarantees, incident steps
```

Agent MCP configs (`.mcp.json`, `.cursor/`, `.codex/`, `.bob/`, `.gemini/`) are generated and never committed.

---

## The Three Engineering Layers

| Layer | Question | IntentGuard's role |
|---|---|---|
| **Prompt** | What did the developer ask? | Captures the raw request |
| **Context** | What does the code look like? | Gathers repo evidence |
| **Intent** | Is this the right change, and did it work? | Structure → Gate → Scope → Proof |

> Context tools tell the agent *what the code looks like*. IntentGuard tells the agent *what should change, what must not, and how to prove it*.

---

## Reference Docs

- [PRD.md](PRD.md) — product requirements, scope, milestones
- [INTENT.md](INTENT.md) — IntentSpec, readiness gates, scope fence, proof report
- [AGENTS.md](AGENTS.md) — guide and rules for every AI agent working in this repo
- [CONTRIBUTING.md](CONTRIBUTING.md) — setup, change flow, privacy rules
- [SECURITY.md](SECURITY.md) — what stays local, guarantees, incident steps

---

## License

MIT © Awais Aziz
