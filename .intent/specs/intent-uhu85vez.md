# IntentSpec: intent-uhu85vez
Status: **draft**

## Objective
Add DeepSeek as a third LLM provider alongside OpenAI and IBM Bob. Add a model selector in the frontend chat interface so the user can pick which model/provider to use (OpenAI, IBM Bob, or DeepSeek). Validate the API key for the selected model before sending. Use the model 'deepseek-flash' for DeepSeek with its own API key (DEEPSEEK_API_KEY). Wire up the backend to route to the correct provider based on the selected model.

## Outcomes


## Scope
**In Scope:**
- .env.example
- CHANGELOG.md
- CONTRIBUTING.md
- INTENT.md
- PRD.md
- README.md
- SECURITY.md
- backend/cli/src/commands/chat.ts
- backend/cli/src/index.ts
- backend/core/src/index.ts
- backend/core/src/llm/provider.ts
- backend/server/src/app.ts
- backend/server/src/index.ts
- frontend/src/app/chat/page.tsx
- backend/core/src/llm/openai-client.ts
- backend/core/src/llm/openai.ts
- backend/core/src/llm/resolve.ts
- backend/core/test/openai.test.ts

**Out of Scope:**
None defined

## Edge Cases
None defined
