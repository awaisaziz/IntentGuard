# IntentSpec: intent-agvqgxad
Status: **approved**

## Objective
Improve the CLI's error handling so that every command surfaces actionable, consistent error messages — distinguishing between expected user errors (no active spec, bad spec ID, unknown agent) and unexpected runtime failures — uses the correct output stream (stderr for errors), and exits with non-zero codes only when appropriate.

## Outcomes
- Every command prints user-facing errors to stderr (console.error) and exits with code 1 on failure — this is already the pattern, but two callsites use console.log for errors instead.
- withSpinner shows the error message on spinner.fail() instead of swallowing it silently (currently spinner.fail() shows no text and the raw throw re-surfaces as an unformatted stack if uncaught).
- Known user errors (no active spec, spec not found, unknown agent, repo not found, WatsonxConfigError) produce a short, human-readable message with no stack trace.
- Unexpected errors (filesystem permission denied, JSON parse failure, network error) include the error class/type so the developer knows it is not a usage mistake.
- process.exit(1) is only called at the top-level command boundary, not buried inside shared helpers like selectAgentsOrExit (currently selectAgentsOrExit calls process.exit, making it untestable).
- The global unhandled rejection/exception handler in index.ts catches anything that escapes a command and prints it cleanly instead of crashing with a raw Node.js stack trace.

## Scope
**In Scope:**
- backend/cli/src/index.ts
- backend/cli/src/ui/spinner.ts
- backend/cli/src/commands/check.ts
- backend/cli/src/commands/commit.ts
- backend/cli/src/commands/connect.ts
- backend/cli/src/commands/init.ts
- backend/cli/src/commands/mcp-setup.ts
- backend/cli/src/commands/new.ts
- backend/cli/src/commands/report.ts
- backend/cli/src/commands/rules-generate.ts
- backend/cli/src/commands/verify.ts

**Out of Scope:**
- backend/core/**
- backend/server/**
- mcp/**
- frontend/**
- backend/cli/src/commands/chat.ts

## Edge Cases
- **Error thrown inside withSpinner callback**: Spinner fails with the error message shown, then the command's catch block prints the formatted error and exits 1.
- **selectAgents returns null (unknown agent name)**: Returns null to caller; caller (command) logs the warning and calls process.exit(1) — process.exit is not inside the shared helper.
- **Unhandled rejection from a command that forgets try/catch**: Global handler in index.ts catches it, prints formatted error, exits 1.
- **Error object has no .message (e.g. a string is thrown)**: formatCommandError falls back to String(err) so no [object Object] output.
- **WatsonxConfigError during model init in non-chat commands**: Not applicable — only chat.ts creates the model. Out of scope.
- **Spinner is running when process receives SIGINT**: Not changed — SIGINT handling in chat.ts is out of scope; other commands do not intercept SIGINT.
