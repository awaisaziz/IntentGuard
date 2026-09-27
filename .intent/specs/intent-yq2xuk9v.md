# IntentSpec: intent-yq2xuk9v
Status: **approved**

## Objective
Enable multi-provider LLM support for IntentGuard, configuring Google Gemini API calls (defaulting to gemini-2.5-pro for coding tasks) alongside IBM Bob / watsonx API calls for the frontend chat bot, spec drafting, and CLI commands without hardcoded keys.

## Outcomes
- GeminiChatModel is implemented and executes chat and tool calling via direct Gemini API calls using GEMINI_API_KEY.
- Default coding model is set to gemini-2.5-pro, with configurable GEMINI_MODEL environment variable.
- GeminiProvider is implemented for IntentSpec drafting and wired into resolveProvider.
- IBM Bob / watsonx API client remains fully supported and functional via BOB_API_KEY or WATSONX_API_KEY.
- Server, CLI, and MCP automatically resolve Gemini or Bob/watsonx based on available environment credentials.
- Unit tests for GeminiChatModel, GeminiProvider, and multi-provider resolution pass.

## Scope
**In Scope:**
- backend/core/src/llm/**
- backend/core/src/index.ts
- backend/core/src/privacy/patterns.ts
- backend/core/test/**
- backend/server/src/**
- backend/cli/src/**
- frontend/src/app/chat/**
- .env.example
- scripts/check-pii.mjs

**Out of Scope:**
- frontend/src/app/specs/**
- frontend/src/app/settings/**
- backend/core/src/readiness/**
- backend/core/src/scope/**
- backend/core/src/verify/**
- backend/core/src/store/**

## Edge Cases
- **Neither GEMINI_API_KEY nor WATSONX_API_KEY / BOB_API_KEY is configured in the environment**: Show a clear, actionable error message prompting the developer to set GEMINI_API_KEY or WATSONX_API_KEY in .env
- **Gemini or Bob/watsonx API call returns an authentication or quota error**: Catch and surface HTTP error message cleanly without leaking the API key in error text or logs
- **Model generates structured tool calls**: Convert functionCalls / tool_calls into standard ChatToolCall objects so agent harness executes tools properly
