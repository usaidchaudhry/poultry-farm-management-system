# Repository guidance

## Project
- Poultry Management System is a React 18 + Vite frontend using JavaScript modules and plain CSS.
- The application is now named LayerFlow. Full-stack requirements are in `LayerFlow_MERN_PRD.md`; MERN Phases 0-10 implement the Express/Mongoose API in `server/`. The original frontend phase numbers remain historical.
- Read `docs/MERN_PHASE_10_IMPLEMENTATION.md` for published-source aggregation, source permissions, date/scope filters, CSV/print and read-only redacted audit.
- Read `docs/MERN_PHASE_11_IMPLEMENTATION.md`, `docs/ACCEPTANCE_RESULTS.md` and `docs/BACKUP_RESTORE.md` for localhost delivery, relative-date demo, recovery and verification. The user approved localhost only: skip public deployment and features requiring external services, third-party APIs or cloud. `docs/DEPLOYMENT.md` is optional reference; the local Express API/MongoDB remain required.
- Read `docs/MERN_PHASE_9_IMPLEMENTATION.md` for private persistent uploads, parent access/locks, sealed report images, recipient routing, alert lifecycle, and source-deduplicated reminder scans.
- Read `docs/MERN_PHASE_8_IMPLEMENTATION.md` for frozen egg policy, legacy initialization, report deltas, sale/dispatch/cancellation, expense source claims, and financial aggregation.
- Read `docs/MERN_PHASE_7_IMPLEMENTATION.md` for formula states, stable rows, decimal costing, price redaction, pending handoffs, and immutable revision snapshots.
- Read `docs/MERN_PHASE_6_IMPLEMENTATION.md` for canonical units, locations, immutable stock movements, retry keys, historical running balances, report-feed publication, and legacy cutover.
- Read `docs/MERN_PHASE_0_2_IMPLEMENTATION.md` for adopted defaults, live/mock boundaries, setup, and API contracts before continuing backend work.
- Read `docs/MERN_PHASE_5_IMPLEMENTATION.md` for prescription recurrence, original-prescriber separation, clinical history, cancellation/replacement, outcome correction, and report evidence links.
- Read `docs/MERN_PHASE_4_IMPLEMENTATION.md` for report revisions, population integrity, measurements, date windows, and deferred stock publication.
- Read `docs/MERN_PHASE_3_IMPLEMENTATION.md` for hierarchy constraints, assignment scope, demo seeding, and the live organization API contract.
- The product requirements live in `Poultry_Management_System_PRD_React_Frontend_Plan.md`; check the relevant phase and `PROGRESS.md` before implementing a feature.
- `PROGRESS.md` is the phase checklist and records design decisions. Preserve existing user edits in it.

## Commands
- `npm run dev` starts the local Vite server.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves the production bundle.
- `npm test` runs the Node service workflow checks.
- `npm run dev:server` starts the API; `npm run db:dev` starts a persistent local MongoDB replica set.
- `npm run test:server` runs actual API/database checks; `npm run test:browser` verifies the implemented administration workflow in headless Edge.
- `npm run test:release` verifies the production API/SPA through local HTTPS with all roles and paired backup recovery; it does not publish a public deployment.
- `npm run db:demo:full` adds a relative-date local sample scenario. `npm run docs:api` regenerates the route/validator-based OpenAPI specification.
- The localhost demo picker uses `LOCAL_DEMO_LOGIN=true` with `DEMO_PASSWORD` and the full seed (including a separate demo Owner). It fills normal login credentials without bypassing password change or permissions; changed credentials are preserved. `npm run test:demo-login` verifies all six accounts/five roles. The helper must remain non-production and loopback-only.

## Architecture
- Routes are derived from `src/config/modules.js`; built pages are registered in `PAGE_REGISTRY` in `src/app/routes.jsx`.
- Keep permission identifiers in `src/config/permissions.js` and role grants in `src/config/roles.js`. UI checks permission codes through `useAuth()` or `<Can>`; do not branch on role names in UI components.
- Keep UI-facing service calls behind facade modules in `src/services/` (for example, `organizationService.js`). Mock implementations belong under `src/services/mock/`.
- API mode is the default. Hierarchy, staff scope, reports, mortality, population movements, measurements, clinical visits, prescriptions, medication outcomes, inventory, feed issues/formulas, egg stock, sales, expenses and recorded financial results are live; later-phase workflows must not read browser mocks for live accounts. Explicit `VITE_DATA_MODE=mock` preserves the historical frontend demo.
- Backend features use routes → middleware/validation → controllers → services/policies → Mongoose models. Identity/access mutations use the transaction guard and audit writer; never authorize using a client actor or role.
- Organization and active farm context are provided by `src/context/FarmContext.jsx`; use `useFarm()` for farm scope and selection.
- Shared controls live in `src/components/`. Follow the existing plain CSS and design-token conventions; keep component/page styles beside their implementation where practical.
- Use the existing `ApiError`, toast, loading, empty, and error patterns for service-backed interactions.

## Change workflow
- Read nearby components and their service/config dependencies before changing behavior.
- Update `PROGRESS.md` when completing or materially changing a phase chunk.
- Avoid adding dependencies unless the feature needs them and the existing stack cannot reasonably support it.
- Do not overwrite unrelated workspace changes. The workspace may contain user edits and untracked source documents.
- Add or run tests when the user requests testing or when completing the PRD's Phase 10 checks.
