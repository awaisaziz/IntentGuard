# IntentSpec: intent-mvao1vs2
Status: **approved**

## Objective
A developer who clones or pulls IntentGuard cannot easily tell which commands to run, and in which folder, to connect the IntentGuard MCP server to another repository. The README spreads this across several sections and never shows how to run `intent` from inside the target repo. If nothing changes, users keep running commands in the wrong folder, skip the build, or end up with MCP configs that don't work.

## Outcomes
- README 'Connect Any Repository' states plainly that `pnpm connect` runs from the IntentGuard root folder and takes the path to the other repo, and shows a concrete example: a full path in quotes, plus the relative `../my-app` form with an explanation of `..`.
- The README documents the easier way from inside the target repo: one-time setup (`pnpm setup`, new terminal, `pnpm link --global` in IntentGuard/backend/cli), then `intent connect` with no path. It also shows the fallback that needs no global setup: `node <IntentGuard>/backend/cli/dist/index.js connect`.
- The README says how to tell that connect worked (the 'IntentGuard connected: <path>' line) and what the common errors mean (not a git repo, wrong path, not built).
- The README covers updating after `git pull` (pnpm install + pnpm build; re-run connect only when the IntentGuard folder moves or new agents are added).

## Scope
**In Scope:**
- README.md

**Out of Scope:**
- backend/**
- mcp/**
- frontend/**
- CONTRIBUTING.md
- AGENTS.md
- CLAUDE.md
- GEMINI.md
- package.json
- .env.example

## Edge Cases
- **The user has never configured a pnpm global bin directory**: The README tells them to run `pnpm setup` once and open a new terminal before `pnpm link --global`.
- **The user runs connect before building**: The README puts `pnpm build` before connect and says connect fails with 'MCP server is not built' otherwise.
- **The user moves or renames the IntentGuard folder**: The README says to re-run connect in every connected repo, because the configs store absolute paths.
- **The user passes a relative path to `pnpm connect`**: The README states it resolves from the folder where the command was typed (INIT_CWD).
