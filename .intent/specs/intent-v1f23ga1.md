# IntentSpec: intent-v1f23ga1
Status: **draft**

## Objective
Users have no way to delete specs, causing draft clutter and no cleanup path. Adds a delete method to SpecStore, a DELETE endpoint on the server, a delete button per spec card, and a bulk-delete-drafts action on the specs page.

## Outcomes
- DELETE /specs/:id removes the spec JSON, MD, and report files; returns 204
- Deleting the active spec returns 409 with a clear error message
- Each spec card shows a trash icon button; clicking it shows a confirm dialog then calls DELETE
- The specs page has a 'Clear all drafts' button that bulk-deletes all draft specs with a confirm dialog
- After deletion the spec disappears from the list without a full page reload

## Scope
**In Scope:**
- backend/core/src/store/spec-store.ts
- backend/server/src/app.ts
- frontend/src/lib/api.ts
- frontend/src/app/specs/page.tsx
- frontend/src/components/spec-card.tsx

**Out of Scope:**
- frontend/src/app/page.tsx
- frontend/src/app/settings/page.tsx
- frontend/src/app/specs/[id]/page.tsx
- backend/core/src/agent/**
- mcp/src/**

## Edge Cases
- **User tries to delete the active spec**: Server returns 409; UI shows error toast; spec is not deleted
- **User clicks Delete then cancels the confirm dialog**: Nothing is deleted; card stays in place
- **No draft specs exist when bulk-delete is clicked**: Button is disabled or shows 'No drafts to delete'
- **DELETE request fails mid-bulk-delete**: Successfully deleted specs are removed from the list; failed ones stay with an error banner
