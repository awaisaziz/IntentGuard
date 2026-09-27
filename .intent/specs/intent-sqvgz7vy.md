# IntentSpec: intent-sqvgz7vy
Status: **approved**

## Objective
The dashboard cannot be demoed: every page except chat renders hardcoded mock specs, fake readiness gates and a fake proof report, and the chat page offers models whose API keys are not configured, so it fails on load. Connect every dashboard page to the local IntentGuard HTTP API so it shows the repository's real specs, readiness, reports, agents and providers.

## Outcomes
- The overview, specs list, spec detail, readiness and report pages render data fetched from the API on port 3848, with 0 hardcoded mock specs left in frontend/src
- The readiness page shows the 6 real gates and score returned by GET /api/specs/:id/readiness
- The report page shows the saved proof report, or a clear 'no report yet' state when the API answers 404
- GET /api/providers lists each chat provider with configured true or false, and the chat page disables models whose provider is not configured and starts on the first configured one
- The specs page search box and status filters change which specs are listed
- When the backend is not running, each page shows a message with the command to start it instead of crashing
- pnpm build and pnpm test pass

## Scope
**In Scope:**
- frontend/src/**
- backend/server/src/app.ts
- backend/server/test/**
- README.md

**Out of Scope:**
- mcp/**
- backend/core/**
- backend/cli/**
- scripts/**
- .github/**
- frontend/package.json

## Edge Cases
- **The backend is not running**: Pages render a notice telling the user to run pnpm dev:server
- **A spec id in the URL does not exist**: The page shows Next.js not-found
- **A spec has no proof report yet**: The report page says so and explains how to create one
- **No provider key is configured**: The chat page names the variable to set in .env and creates no session
- **There is no active spec or no specs at all**: Empty states instead of errors
