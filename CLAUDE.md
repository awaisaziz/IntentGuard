# CLAUDE.md

Claude Code instructions for this repository. The shared agent guide and IntentGuard rules live in AGENTS.md and are imported below.

- Product requirements: [PRD.md](PRD.md). Read it when a task touches scope or priorities.
- Intent methodology: [INTENT.md](INTENT.md). Read it before creating or reviewing an IntentSpec.

## Claude-specific Notes

- The `intent_*` MCP tools come from the project `.mcp.json`. If they are missing, run `pnpm build && pnpm agents:setup`, then restart the session.
- On Windows, prefer forward slashes in paths passed to `intent_check_scope`. The scope checker normalizes them, but specs are written with POSIX globs.

<!-- intentguard:start (managed by `intent connect`, edits inside are overwritten) -->
@AGENTS.md
<!-- intentguard:end -->
