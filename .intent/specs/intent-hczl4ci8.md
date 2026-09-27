# IntentSpec: intent-hczl4ci8
Status: **draft**

## Objective
The frontend spec creation flow is missing CLI parity (no sequential wizard, no readiness loop), the dashboard home page shows stale/static data, and the UI looks like a generic LLM tool instead of a demo-worthy product that can be recorded as a compelling video.

## Outcomes
- QuestionsStep becomes a one-question-at-a-time stepper: shows current question index (e.g. 2/5), Back/Next buttons, answer persists as user navigates
- After submitting the last answer, the modal calls GET /specs/:id/readiness — if ready:true it navigates to the spec; if not it re-fetches GET /specs/:id/questions and shows the remaining questions for another round
- The loop continues until readiness returns ready:true or the user explicitly clicks Skip
- Dashboard home page fetches live data: total spec count, approved count, verified count, active spec with live readiness score — no hardcoded numbers
- All new UI elements use the existing dark-first design system (brand-teal, dark slate backgrounds) with CSS transitions on state changes (opacity, translate) — no new animation libraries
- The spec wizard modal shows a readiness score progress bar that animates upward after each answer round

## Scope
**In Scope:**
- frontend/src/app/specs/page.tsx
- frontend/src/app/page.tsx
- frontend/src/app/settings/page.tsx
- frontend/src/lib/api.ts
- frontend/src/components/readiness-gauge.tsx
- frontend/src/components/spec-card.tsx
- frontend/src/components/intent-flow.tsx
- frontend/src/components/navbar.tsx
- frontend/src/app/specs/**

**Out of Scope:**
- backend/core/src/**
- mcp/src/**
- frontend/src/app/specs/[id]/readiness/page.tsx
- frontend/src/app/specs/[id]/report/page.tsx

## Edge Cases
- **All questions answered but readiness still below threshold**: Show remaining blockers clearly and re-render the next round of questions
- **GET /specs/:id/readiness fails mid-loop**: Show inline error, keep modal open with a Retry button
- **No specs exist on the dashboard**: Show zero-state with a CTA to create the first spec
- **Backend is unreachable when dashboard loads**: Show 0 for all counters, no crash
