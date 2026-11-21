# Build progress

Project: Poultry Management System, React frontend. Source of truth: the PRD file.
Rule: finish a chunk, tick it here, then continue. Use this file and `ASSUMPTIONS.md` to resume remaining integration or browser QA work.

## Done phases
- [x] Phase 5: organization hierarchy, selectors, lists and user scope assignment (see below)
- [x] Phase 4: login, auth context, mock services, user management (see below)
- [x] Phase 3: app shell, navigation, routing, route guard (see below)
- [x] Phase 1: setup and foundation
- [x] Phase 2: design system and shared components (see /design-system)

## Phase 3: layout, navigation, routing  (COMPLETE)
Design decisions
- One source of truth for pages: `src/config/modules.js` (label, path, icon, permission, phase, capabilities).
  The sidebar (`config/navigation.js`) and the route table (`app/routes.jsx`) are both generated from it.
- Permissions are codes in `src/config/permissions.js`. Role -> permissions map is in `src/config/roles.js`.
  Components never check role names. They call `hasPermission(code)` from `useAuth()`.
- Phase 3 ships a TEMPORARY AuthContext + role picker on /login so protected routes can be tested.
  Phase 4 replaces them with a real login form, validation and a mock auth service.
- Real pages replace placeholders by registering in the `PAGE_REGISTRY` object in `app/routes.jsx`.

Chunks
- [x] A. config (permissions, roles, modules, navigation), AuthContext, demo users, ProtectedRoute, route-meta helper, new icons
- [x] B. layout components (Sidebar, Topbar, UserMenu, Breadcrumbs, PageHeader, BrandLogo) + AuthLayout + DashboardLayout + CSS
- [x] C. pages (Login, NotFound, AccessDenied, ModulePlaceholder, DashboardHome) + routes wiring + README + final check

Assumptions to confirm (role -> module access is not fully specified in the PRD)
- Production Manager: view of all operational modules and finance, no user management or audit log.
- Farm Manager: daily reports, mortality, medication, bird parameters, feed formulas, organization view.
- Operation Manager: inventory, feed formulas, egg production, sales, finance, reports.
- Doctor: clinical, medication (view), bird parameters, organization view.
- Everyone signed in sees Dashboard and Notifications.
- Only the Owner can manage organization data and users, and see the audit log.
Change any of these in `src/config/roles.js`.

## Phase 4: authentication and user access  (COMPLETE)
Design decisions
- Mock backend lives in `src/services/mock/` (store, auth service, user service) with seed data in `src/mock/seedUsers.js`.
  UI never imports from `services/mock/` directly. It imports `services/authService.js` and `services/userService.js`
  (thin facades). Swapping to real Axios calls later only changes those two files.
- Services throw `ApiError` (`services/apiError.js`) with `code`, `message`, optional `fieldErrors`. The UI maps these to messages.
- Session = `{ userId, token }` in sessionStorage. AuthContext restores the user on page load via `getCurrentUser`
  (shows a loading screen meanwhile). A failed restore sets a "session ended" notice on the login page.
- One role per user (PRD allows several only if approved). A user with no role is "unassigned" and sees /pending-access.
- Mock safeguards (a real backend must enforce them too): you cannot deactivate yourself or change your own role,
  and the last active Owner cannot be deactivated or demoted.
- Passwords are plain text in mock seed data only. Demo password for all seed users: `Poultry@123`.
- Login is by email + password (the PRD says email/username depending on the backend contract).
- New users: the admin sets a temporary password in the create form (real invite flow depends on the backend).

Chunks
- [x] A. ApiError, validators, mock seed + store + auth/user services, facades, AuthContext rewrite, ProtectedRoute, Alert, Can; service logic tested in node
- [x] B. LoginPage (validation, errors, demo account helper), PendingAccessPage, UserMenu logout update, routes
- [x] C. Users feature (list, filters, create/edit, role assignment, activate/deactivate), Profile page, registry, README, final check

## Phase 5: organization and farm management  (COMPLETE — frontend with mock service)
Design decisions
- Hierarchy: Company > Site > Farm > House > Flock. Stored FLAT and normalized (each record has its parent id:
  farm.siteId, house.farmId, flock.houseId, plus status 'active' | 'archived'). This maps directly to MongoDB collections.
  Company is a single root record (no company screens).
- Mock backend: `src/mock/seedOrganization.js`, `src/services/mock/mockOrgStore.js`, `src/services/mock/mockOrganizationService.js`.
  UI imports only `src/services/organizationService.js` (facade, same pattern as authService/userService).
- `src/context/FarmContext.jsx` (`FarmProvider`, `useFarm()`): loads the hierarchy the signed-in user may see, and holds the
  ACTIVE site/farm/house/flock selection (saved per user in localStorage). Later phases reuse `useFarm()`.
- Scope: `ROLE_SCOPE` in `src/config/roles.js`. Owner and Production Manager are company-wide. Farm Manager, Operation Manager
  and Doctor see only sites/farms assigned to them (assigned site = all its farms). The scoped hierarchy is computed by the
  service. UI never filters by role name.
- One generic form modal (`EntityFormModal`) driven by field configs in `features/organization/entityConfig.js`.
  `useOrgCrud` holds create/edit/view/archive/restore logic shared by the four list pages.

Assumptions to confirm (the PRD leaves these open, section 17 item 3)
- Fields: Site (name, location), Farm (name), House (name, capacity optional), Flock (name, placement date, initial count, bird type optional).
- Names must be unique within the same parent.
- Archive, not delete. A parent with active children cannot be archived. A child cannot be restored while its parent is archived.
- The parent of a record cannot be changed after creation (no flock transfer or moving houses until the rules are confirmed).
- No limit on active flocks per house (occupancy rule not enforced).
- Only the Owner has `organization.manage`. Everyone else with `organization.view` is read-only.

Chunks
- [x] A. ROLE_SCOPE, seed org data, mock store, mock organization service, facade; service logic tested in node
- [x] B. FarmContext (+ active selection), selection button/modal in top bar, generic form/details modals, useOrgCrud, shared list pieces
- [x] C. Sites/Farms/Houses/Flocks pages, Organization tree page, user scope assignment (Users page), registry, README, final check

Phase 5 assumptions and API boundary are documented in `ASSUMPTIONS.md`.

## Phases 6–9: operational frontend (mock-backed)
- [x] Phase 6: daily report draft/submit/return workflow, egg and bird calculations, mortality and post-mortem view, bird weight entry.
- [x] Phase 7: clinical visits, prescription entry/editing, medication tasks, administration outcome and prescriber restriction.
- [x] Phase 8: stock items and movements, feed formulas and costing, egg production and sales, expense entry and financial summary.
- [x] Phase 9: notifications, role-aware dashboard metrics, scoped analytics and charts.

## Phase 10: final frontend work
- [x] Read-only audit log with before/after detail for mock service mutations.
- [x] Production build and service workflow tests.
- [ ] Browser visual, responsive, and accessibility pass, plus screenshots. The browser access host was unavailable during this session.

The frontend phase entries above describe the original browser-persisted mock implementation. Live MERN progress is tracked separately below. Attachment uploads, server exports, and operational API date restrictions remain later-phase work. See `ASSUMPTIONS.md` for the historical frontend assumptions.

## MERN implementation — LayerFlow (20 November 2026)

Plan: `LayerFlow_MERN_PRD.md`. Detailed implementation log, data dictionary, decisions, contracts, setup, and verification: `docs/MERN_PHASE_0_2_IMPLEMENTATION.md`. These phase numbers do not replace the historical frontend phases above.

- [x] MERN Phase 0: baseline/service inventory, adopted demonstration defaults, initial data dictionary, role/permission matrix, date/API conventions, and database/deployment choice.
- [x] MERN Phase 1: Express/Mongoose foundation, configuration, safe errors/logging, MongoDB sessions, CSRF/origin protection, validation, login throttling, security headers, transaction/policy/idempotency helpers, repeatable indexes/migration, and persistent development replica-set helper.
- [x] MERN Phase 2: environment-driven one-time Owner bootstrap, hashed passwords, mandatory password change, login/logout/me, versioned user administration, separate role assignment, activation/reset/session revocation, dynamic role/permission editor, protected recovery controls, grant-subset safeguards, and server audit events.
- [x] Live authentication/Users/Roles/Profile integrated with existing React components; API mode is default and later modules show integration-pending views.
- [x] Historical mock mode remains explicit; operational mock implementation moved under `src/services/mock/` and live facades prohibit fallback.
- [x] Actual MongoDB/API checks include transaction rollback, immediate revocation, concurrent administrator safeguards, and disk-backed database/session persistence across MongoDB restart.
- [x] Headless clean-browser checks cover forced password change, API restart/session restoration, role/user administration, pending access, permission revocation, logout, and a phone-width user list.
- [x] Final verification: 17 backend checks, 9 original mock checks, browser workflow, production build, documentation links, and 39 server-file syntax checks passed. Local screenshots were reviewed; details and commands are in the implementation log.
- [x] MERN Phase 3: persistent organization hierarchy, archive/occupancy rules, user site/farm assignment, and live farm selection. See `docs/MERN_PHASE_3_IMPLEMENTATION.md` for the implementation steps, schema/API, decisions, optional two-farm demo seed, and verification.

Boundary: no public signup or default live account password. Configure private server environment values and run the bootstrap command described in README. Site/farm data is now live; daily reports and measurements are now live; clinical visits and medication are also live; remaining operational modules start at Phase 6; their historical mock completion does not mean full-stack completion.


### MERN Phase 3 completion (20 November 2026)

- [x] Site/farm/house/flock MongoDB models, derived ancestors, immutable parents/placement baseline, required site location, optional strain/age, unique names, and one active flock per house.
- [x] Authorized scoped hierarchy/list/detail and versioned create/edit/archive/restore, capacity checks, transactional audit, and repeatable index migration.
- [x] Versioned staff site/farm assignments, grant safeguards, active-reference validation, empty assignment behavior, and immediate session invalidation.
- [x] Live organization facade, existing screens/dialogs, custom-role scope metadata, top-bar selector, saved preference validation, and stale response cleanup.
- [x] Explicit development demo command creates two farms with separately assigned managers; no default password and no overwrite/reset.
- [x] Extended MongoDB/API, restart persistence, and browser verification; original mock checks retained.
- [x] Final Phase 3 checks: 23 backend checks, 9 mock checks, clean-browser workflow, production build, 44 server syntax checks, documentation links, and whitespace checks passed. Desktop organization and mobile scope screenshots were reviewed.
- [x] MERN Phase 4: daily reports, mortality, bird measurements, population movements and corrections. Completed at the PRD interim gate; actual stock posting remains for Phases 6/8. See `docs/MERN_PHASE_4_IMPLEMENTATION.md`.

The earlier frontend Phase 5 assumptions are historical. Live MERN Phase 3 supersedes its concurrent-flock assumption with one active flock per house, requires site location, and freezes placement data. Report-draft and unresolved-task archive checks will be added when those live modules exist.


### MERN Phase 4 completion (20 November 2026)

- [x] Report, immutable revision, bird movement, measurement, and deferred publication-intent schemas; unique flock/date and source keys.
- [x] Opening movement migration/backfill and new-flock initialization; approved placements, signed adjustments, counted-opening reconciliation, missing-day gaps, and server-derived totals.
- [x] Draft/submit/return/resubmit with optimistic versions, required numeric values at submission, correction reasons, preserved effective published snapshots, delta mortality effects, and transactional audit.
- [x] Farm/ancestor and today/yesterday/history policies on list/detail/revision/write paths; dependent population changes and backdated first submissions protected.
- [x] Live asynchronous report form/detail/list/revision screens, repeatable samples/medicine/vaccine rows, published mortality, and read-only calculated population.
- [x] Timestamped bird samples, g/kg normalization, weighted summaries, preceding comparison, optional report links, and unavailable standards.
- [x] Draft/returned report archive protection, active-context guards, current-bird capacity checks, and readable invalidated drafts.
- [x] MongoDB/API/concurrency/migration/restart checks and clean-browser Owner/assigned-manager reporting workflow, including phone-width pages.
- [x] Final Phase 4 verification: 32 backend checks, 9 mock checks, browser workflow, production build, 49 server syntax checks, documentation links, and whitespace checks passed. Report and mobile screenshots were reviewed.
- [x] MERN Phase 5: clinical visits, prescriptions, medication tasks, and independent administration. See `docs/MERN_PHASE_5_IMPLEMENTATION.md`.

Publication boundary: every submitted report revision records one deferred egg/feed intent. Inventory references are interim text identifiers; actual inventory/egg ledger posting and negative-stock corrections belong to Phases 6/8. Visit/prescription links and image attachments remain Phase 5/9 dependencies. The full contract and verification evidence are in the Phase 4 log.


### MERN Phase 5 completion (20 November 2026)

- [x] Visit, prescription, recurring task, and append-only administration-event schemas; repeatable indexes/migration and stable item/occurrence keys.
- [x] Visit entry/edit, measurement links, multiple medicine items, explicit daily clock times, bounded timezone-aware schedule preview, and atomic finalization.
- [x] Original prescriber preserved through another finalizer; server-side prescriber denial on initial outcomes and every correction, independent of role grants.
- [x] Completed/missed evidence, actual/recorded times, actual dose/unit or instruction reference, reasons, optimistic versions, append-only superseding corrections and audit.
- [x] Draft/future cancellation, linked replacement prescriptions, completed/elapsed evidence preservation, no automatic administration by elapsed duration, and archive guards.
- [x] Clinical history separate from operational report restrictions; scoped current open-work exception, restricted closed history, and direct-route farm/ancestor checks.
- [x] Live asynchronous Clinical/Medication pages, multi-item forms, schedule preview, open/history filtering, evidence details, phone-width workflow, and optional daily-report clinical links.
- [x] Actual database, concurrency, DST, restart-persistence and browser Doctor-to-Farm-Manager checks; implementation log, README, and repository guidance updated.
- [x] Final Phase 5 verification: 44 backend checks, 9 mock checks, clean-browser workflow, production build, 56 server syntax checks, documentation links, and whitespace checks passed; clinical and mobile administration screenshots reviewed.
- [x] MERN Phase 6: location-based inventory, balances, immutable movements, and daily-report feed publication. See `docs/MERN_PHASE_6_IMPLEMENTATION.md`.

Phase 5 boundaries: image uploads remain Phase 9. Medication administration does not automatically issue stock; the Phase 4 egg/feed publication intents still await the Phases 6/8 ledgers. Daily-report clinical references link existing evidence without creating another administration.

### MERN Phase 6 completion (22 November 2026)

- [x] Catalog, farm locations/default stores, cached balances, append-only movements, durable posting operations and report-feed publication schemas; repeatable migration without fabricated stock.
- [x] Opening, receipt, issue, signed adjustment, paired transfer, linked compensating reversal, canonical-unit/precision validation, thresholds and low/out-of-stock views.
- [x] Serialized access transaction, conditional balances, current and historical nonnegative stock, durable retry deduplication, scoped endpoints/history and server audit.
- [x] Report-linked feed issue/delta/refund/item-location corrections; atomic insufficient-stock rollback, Farm Manager report-only writes and source-only reversals.
- [x] Live asynchronous inventory filters/forms/pagination/reconciliation and scoped report stock selectors; preserved explicit mock demo and immutable legacy snapshots.
- [x] Actual MongoDB/API concurrency and rollback checks, restart persistence, clean-browser receipt/issue/transfer/report workflow and phone-width balance review.
- [x] Phase 6 verification: 51 backend checks, 9 mock checks, clean-browser workflow, production build, 61 server syntax checks, documentation links and whitespace checks passed.
- [x] MERN Phase 7: feed composition, versioned costing, and permission-separated handoff. See `docs/MERN_PHASE_7_IMPLEMENTATION.md`.

Phase 6 supersedes the historical feed deferral above. Egg intents remain deferred until Phase 8. Existing descriptive feed reports are not automatically charged; selecting real stock and submitting their first stock-enabled revision issues the full selected quantity. No medication-to-stock conversion or durable low-stock notification delivery was added.

### MERN Phase 7 completion (22 November 2026)

- [x] Logical formulas, numbered composition versions, stable row identities, separate confidential pricing, immutable finalized snapshots, durable request deduplication and repeatable migration.
- [x] Compose/save/submit, pending-costing queue, exact server preview, complete rate entry, separate finalization, reasoned return/reset, new unpriced draft revisions and completed-formula archive.
- [x] Decimal128 quantities/rates/money, 28-digit half-up arithmetic, summed rounded row amounts, four-place cost/kg and bag costing from the unrounded ratio.
- [x] Scope/date/context/catalog guards, optimistic versions, active-grant rechecks, strict price injection rejection, cost-redacted list/detail/version/mutation responses and price-free audit metadata.
- [x] Live asynchronous formula UI, catalog ingredient rows, price-permission controls, saved/unsaved preview states, unsaved-rate finalization guard, version history, filters and pagination; explicit mock mode preserved.
- [x] Worked example, precision, missing rates, return/resubmit, stale edits, concurrent finalization, privacy/grant revocation, retry deduplication, snapshot preservation and full database-restart checks.
- [x] Separate Farm Manager/Operation Manager browser handoff with mobile composition, preview/save/finalize, hidden prices and new draft/history navigation.
- [x] Verification: 57 backend checks, 9 mock checks, clean-browser workflow, production build, 66 server syntax checks, documentation links and whitespace checks passed; final focused formula/restart checks also passed.
- [ ] MERN Phase 8: egg stock publication, sales, and basic finance.

Phase 7 implementation and verification are complete. Formulas do not manufacture feed, consume inventory, or create expenses. Egg posting/sales remain Phase 8; durable pending-costing reminders remain Phase 9.
