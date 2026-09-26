export * from './schema/intentspec.js';
export * from './schema/validator.js';

export * from './readiness/scorer.js';
// Omit raw gates if prefer not to export, or export selectively:
export * from './readiness/gates.js';

export * from './store/spec-store.js';
export * from './store/config.js';

export * from './scope/checker.js';
export * from './scope/gate.js';

export * from './verify/verifier.js';
export * from './verify/diff-parser.js';
export * from './verify/test-mapper.js';

export * from './evidence/gatherer.js';

export * from './questions/generator.js';

export * from './llm/provider.js';
// Avoid exposing templates directly if not needed, but prompt asks to export them if possible
export * from './llm/templates.js';

export * from './llm/chat.js';
export * from './llm/watsonx-client.js';

export * from './workflow/draft.js';
export * from './workflow/checks.js';
export * from './workflow/connect.js';
export * from './workflow/update.js';

export * from './agents/registry.js';
export * from './agents/rules.js';

export * from './agent/types.js';
export * from './agent/workspace.js';
export { IntentAgent, type IntentAgentOptions } from './agent/agent.js';
export { specSnapshot, toolDefinitions } from './agent/tools.js';

export * from './utils/home.js';

export * from './utils/git.js';
export * from './utils/id.js';
export * from './utils/markdown.js';

export * from './privacy/patterns.js';
export * from './privacy/redact.js';
