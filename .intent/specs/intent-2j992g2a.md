# IntentSpec: intent-2j992g2a
Status: **approved**

## Objective
The developer has only an OpenAI API key (no Gemini key, no watsonx project), so the built-in chat agent and spec drafting cannot run today. Make OpenAI the model provider for the chat agent (CLI and HTTP API) and for spec drafting, and remove the Gemini API provider code that was added but cannot be used.

## Outcomes
- With only OPENAI_API_KEY set, the CLI chat and POST /api/chat create an OpenAI chat model that posts to {OPENAI_BASE_URL}/chat/completions with a Bearer key and tools in OpenAI format
- resolveProvider returns the OpenAI drafting provider when llmProvider is "openai", or "auto" with an OpenAI key present
- Zero references to GEMINI_API_KEY, GeminiChatModel or GeminiProvider remain in backend/, .env.example and README.md; gemini-client.ts, gemini.ts and gemini.test.ts are deleted
- With no provider configured, chat fails with a message naming OPENAI_API_KEY and the API answers 503
- pnpm build and pnpm test pass, and pnpm check:pii reports 0 findings

## Scope
**In Scope:**
- backend/core/src/llm/**
- backend/core/src/index.ts
- backend/core/test/openai.test.ts
- backend/core/test/gemini.test.ts
- backend/cli/src/commands/chat.ts
- backend/cli/src/commands/connect.ts
- backend/cli/src/index.ts
- backend/server/src/app.ts
- backend/server/src/index.ts
- backend/server/test/chat.test.ts
- .env.example
- README.md
- SECURITY.md
- CHANGELOG.md
- CONTRIBUTING.md

**Out of Scope:**
- backend/core/src/agents/**
- backend/core/src/agent/**
- backend/core/src/privacy/**
- mcp/**
- frontend/**
- scripts/**
- .github/**

## Edge Cases
- **OPENAI_API_KEY is missing or still the your-... placeholder from .env.example**: Treated as unset; OpenAIConfigError names OPENAI_API_KEY
- **OpenAI returns a non-2xx response such as 401 or 429**: An error carrying the status and the API's error message, without the key
- **The chosen model is a reasoning model (gpt-5 or o-series) that rejects temperature and max_tokens**: The client sends max_completion_tokens and omits temperature for those models
- **Both OpenAI and watsonx credentials are set with llmProvider auto**: OpenAI is used; an explicit provider choice still wins
