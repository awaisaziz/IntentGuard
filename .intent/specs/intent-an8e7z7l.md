# IntentSpec: intent-an8e7z7l
Status: **draft**

## Objective
Developers creating a spec in the frontend get stuck in Draft forever because the UI never shows the clarification questions that the backend generates. Without those questions, the user doesn't know what's missing and the spec can never reach 'approved'.

## Outcomes
- After 'Create Spec' succeeds, the modal transitions to a step-2 that fetches and displays all questions from GET /specs/:id/questions
- Each question renders with a labelled textarea for the user's answer
- Clicking 'Submit Answers' sends a PATCH /specs/:id request with the mapped answers and shows a loading state
- On success the modal closes and the browser navigates to /specs/:id
- If /questions returns an empty array the modal closes immediately (no questions step)
- The spec detail page at /specs/:id shows a 'Pending Questions' banner when questions remain unanswered (status === draft and questions exist)

## Scope
**In Scope:**
- frontend/src/app/specs/page.tsx
- frontend/src/lib/api.ts
- frontend/src/app/specs/**
- backend/server/src/app.ts

**Out of Scope:**
- frontend/src/app/settings/page.tsx
- frontend/src/app/page.tsx
- frontend/src/components/chat/transcript.tsx
- frontend/src/components/gate-checklist.tsx
- frontend/src/components/proof-report-view.tsx
- backend/core/src/**
- mcp/src/**

## Edge Cases
- **GET /specs/:id/questions returns an empty array**: Skip the questions step entirely and close the modal immediately
- **GET /specs/:id/questions request fails**: Show an error message in the modal with a retry option; do not close
- **User submits answers with all fields blank**: Disable the Submit button unless at least one answer has text
- **PATCH /specs/:id fails**: Show error inline in the modal, keep it open so the user can retry
- **User closes the modal during the questions step**: Modal closes; spec remains in draft; user can re-open questions from the spec detail page
