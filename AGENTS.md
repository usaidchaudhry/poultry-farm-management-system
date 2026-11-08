# Repository guidance

## Project
- Poultry Management System is a React 18 + Vite frontend using JavaScript modules and plain CSS.
- The product requirements live in `Poultry_Management_System_PRD_React_Frontend_Plan.md`; check the relevant phase and `PROGRESS.md` before implementing a feature.
- `PROGRESS.md` is the phase checklist and records design decisions. Preserve existing user edits in it.

## Commands
- `npm run dev` starts the local Vite server.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves the production bundle.
- `npm test` runs the Node service workflow checks.

## Architecture
- Routes are derived from `src/config/modules.js`; built pages are registered in `PAGE_REGISTRY` in `src/app/routes.jsx`.
- Keep permission identifiers in `src/config/permissions.js` and role grants in `src/config/roles.js`. UI checks permission codes through `useAuth()` or `<Can>`; do not branch on role names in UI components.
- Keep UI-facing service calls behind facade modules in `src/services/` (for example, `organizationService.js`). Mock implementations belong under `src/services/mock/`.
- Organization and active farm context are provided by `src/context/FarmContext.jsx`; use `useFarm()` for farm scope and selection.
- Shared controls live in `src/components/`. Follow the existing plain CSS and design-token conventions; keep component/page styles beside their implementation where practical.
- Use the existing `ApiError`, toast, loading, empty, and error patterns for service-backed interactions.

## Change workflow
- Read nearby components and their service/config dependencies before changing behavior.
- Update `PROGRESS.md` when completing or materially changing a phase chunk.
- Avoid adding dependencies unless the feature needs them and the existing stack cannot reasonably support it.
- Do not overwrite unrelated workspace changes. The workspace may contain user edits and untracked source documents.
- Add or run tests when the user requests testing or when completing the PRD's Phase 10 checks.
