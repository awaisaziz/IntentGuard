# IntentSpec: intent-41ybyvkb
Status: **approved**

## Objective
Replace the hardcoded mock spec data in `frontend/src/lib/api.ts` with real reads from the `.intent/specs/` directory on disk, so the /specs page (and detail pages) show actual IntentSpec data. The existing page layout, components, and routes must remain unchanged.

## Outcomes
- getAllSpecs() reads all .json files from .intent/specs/, parses them as IntentSpec, and returns them sorted by createdAt descending
- getSpecById(id) reads .intent/specs/<id>.json and returns the parsed spec, or null if not found
- getActiveSpec() reads .intent/active.json then loads the referenced spec, or returns null
- The Spec interface in api.ts aligns with the real IntentSpec shape (evidence uses the correct Evidence type with excerpt/type/source fields)
- The /specs page displays the 4 real specs from .intent/specs/ with correct objective, outcomes, and status
- No existing page design, component, or route changes

## Scope
**In Scope:**
- frontend/src/lib/api.ts
- frontend/src/components/evidence-panel.tsx

**Out of Scope:**
- frontend/src/app/**
- frontend/src/components/**
- backend/**
- mcp/**

## Edge Cases
- **A .json file in .intent/specs/ is malformed**: That file is silently skipped (Promise settles to null, filtered out) so the page still loads
- **The .intent/specs/ directory does not exist**: getAllSpecs() returns an empty array
- **getSpecById is called with a spec ID that has no matching file**: Returns null; the detail page calls notFound()
- **active.json references a spec ID whose file has been deleted**: getActiveSpec() returns null gracefully
