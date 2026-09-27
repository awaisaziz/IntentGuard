# IntentSpec: intent-sy15if4z
Status: **approved**

## Objective
The dashboard can only show the one folder the API server was started in, and its pages look like a prototype, so it cannot be demoed on a real project. Let the user paste a GitHub URL in the dashboard: IntentGuard clones that repository into a git-ignored workspaces folder inside the IntentGuard checkout, initialises the intent layer in it, and switches the whole dashboard (specs, readiness, reports, chat agent) to that repository. Improve the landing page and the other pages so progress is visible at a glance.

## Outcomes
- POST /api/workspaces with a https://github.com/owner/repo URL clones it into workspaces/owner__repo, creates .intent/config.json there, makes it the active repository and returns its name, branch and spec count
- After switching, GET /api/specs, /api/config and new chat sessions read from the cloned repository, and switching back to the IntentGuard repository restores its specs
- The workspaces folder is git-ignored: git status in IntentGuard shows 0 files from a cloned repository
- The landing page shows the active repository, a connect form, the list of cloned repositories, and progress: spec counts per status and average readiness
- The spec detail page shows all 8 IntentSpec sections
- The navbar shows the active repository and highlights the current page
- The active repository survives a restart of the API server
- pnpm build, pnpm test and pnpm check:pii pass

## Scope
**In Scope:**
- frontend/src/**
- backend/core/src/workflow/workspaces.ts
- backend/core/src/index.ts
- backend/core/test/workspaces.test.ts
- backend/server/src/app.ts
- backend/server/src/index.ts
- backend/server/test/**
- .gitignore
- README.md
- CHANGELOG.md
- package.json

**Out of Scope:**
- mcp/**
- backend/cli/**
- backend/core/src/agent/**
- backend/core/src/llm/**
- backend/core/src/privacy/**
- scripts/**
- .github/**
- frontend/package.json

## Edge Cases
- **The URL is not a GitHub repository URL, or carries extra path segments or shell characters**: 400 with a message showing the expected format; nothing is cloned
- **The repository was already cloned**: It is updated with a fast-forward pull when possible and activated; local changes are never discarded
- **The repository does not exist or is private without stored credentials**: 502 with git's error message, and no half-cloned folder is left behind
- **A chat session is running when the repository is switched**: The switch is refused with 409 until the agent stops
- **The saved active workspace folder was deleted**: The server falls back to its start folder
