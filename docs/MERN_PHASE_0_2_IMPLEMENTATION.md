# LayerFlow implementation log — MERN Phases 0–2

Date: 20 November 2026 (Asia/Karachi).

Scope: implement the foundation, identity, staff administration, and permission management described in [the MERN PRD](../LayerFlow_MERN_PRD.md). Organization persistence and farm assignments remain Phase 3. The original source PRDs and existing frontend progress history are preserved.

## 1. Implementation status

| Phase | Implemented work | Verification |
| --- | --- | --- |
| 0 — Baseline and decisions | Inspected existing components/services/configuration; adopted demonstration defaults; documented service inventory, data dictionary, permissions, API contracts, and dependency order | See Sections 2–5 and the generated access matrix |
| 1 — Backend foundation | Express application, transaction-capable MongoDB setup, configuration, sessions, validation, CSRF/origin protection, safe errors/logging, policy helpers, indexes/migrations, local database helper | Passed actual transaction, API-restart, and disk-backed MongoDB-restart verification |
| 2 — Identity and permissions | Bootstrap Owner, password hashing, login/logout/me, mandatory password change, users, roles, granular grants, revocation, protected administrator safeguards, audit attribution, integrated React screens | Passed 17 backend checks and the clean-browser administration workflow |

This log distinguishes implemented endpoints from future scaffolding. It does not mark organization hierarchy, farm scope assignment, clinical/inventory workflows, or live analytics as delivered.

## 2. Phase 0 analysis and adopted decisions

### Starting point

- React 18 + Vite with JavaScript modules, React Router, Axios, Context, and plain CSS.
- Existing components, navigation generated from `src/config/modules.js`, and `PAGE_REGISTRY` retained.
- Authentication/users/organization had mock service facades. Operational `workService.js` combined browser storage and business logic.
- Existing workflow checks covered browser mocks only. Browser responsive/accessibility verification was previously pending.
- No Express server or MongoDB models existed at the beginning of this implementation.

### Adopted demonstration defaults

- LayerFlow is a university course project with a responsive web frontend and one modular backend application.
- Follow feature-organized MVC with a service layer: routes → middleware/validation → controller → service/policy → Mongoose model → MongoDB. React is the view.
- Retain the root frontend; add a separate `server/package.json`. The server imports the shared permission identifiers from the repository, so deploy from the repository root rather than copying `server/` alone.
- One organization, PKR currency, `Asia/Karachi` business timezone, one role per user, five seeded default roles, and no public signup.
- Owner has protected recovery access. Production Manager has company-wide business scope without default user/role administration or history. Other operational roles use assigned scope.
- The PRD Section 12 defaults are adopted for later phases as demonstration decisions, not claimed supervisor approvals: one active flock per house, fixed parents, one report per flock/date with revisions, explicit saleable categories, 360 eggs/Peti, 50 kg default formula bags, simple scheduled prescriptions, images/in-app alerts, and no official ROI until defined.
- The historical mock occupancy and production-entry assumptions will be reconciled in their respective live phases; existing browser records were not migrated or deleted.
- Staff accounts always start unassigned. Role assignment is a separate administrative action. A temporary password must be changed before any non-session API is available.
- Use server-side MongoDB sessions and an HttpOnly cookie, not browser-stored live tokens. Passwords use Node's asynchronous scrypt implementation with random salts.
- API mode is the default. Historical mock mode is explicitly selected with `VITE_DATA_MODE=mock`; API errors never fall back to browser records.
- Prefer one public frontend/API origin, with Vite proxying `/api` in development. The current local API binds to loopback; production hosting is a later delivery task.
- A local persistent single-node replica set is provided for development. Atlas is an alternative. A standalone MongoDB server is rejected because critical writes require transactions.
- User/role administration requires company scope as well as its action permissions. Farm assignments will be implemented in Phase 3 rather than inventing unvalidated scope IDs now.

The first connected story is server login → scoped farm hierarchy. Login and account administration are delivered through Phase 2; its hierarchy half is intentionally the next phase.

### Service/caller migration inventory

| Facade or caller | Previous behavior | Current boundary |
| --- | --- | --- |
| `authService.login/getCurrentUser/logout` | Mock identity and sessionStorage token | Live cookie session; explicit mock adapter retained |
| `AuthContext` | Restored identity using a browser-stored user ID | Restores `/auth/me`; server determines identity and grants; live mode removes only the obsolete mock session key |
| `userService` / `useUsers` / Users page | Mock list and local pagination | Live paginated/filterable list, asynchronous mutations, versions, and errors |
| Role assignment/preview | Hardcoded role options and labels | Server-provided role definitions; custom roles work without UI role-name branches |
| `roleService` / Roles page | No live equivalent | Create/list/edit templates and permission checkboxes; protected role is read-only |
| `organizationService` / `FarmContext` | Browser-backed hierarchy and assignments | Historical mock mode retained; live mode does not read mock hierarchy and reports Phase 3 as pending |
| `workService` | Browser storage/business rules in a UI-facing module | Moved implementation to `services/mock/mockWorkService.js`; facade rejects live calls until relevant APIs exist |
| `WorkPage` | Synchronous list/create/update/transition | Retained in explicit mock mode; requires asynchronous per-feature integration in Phases 4 onward |
| Medication/formula/inventory/sales/finance/notifications/analytics pages | Synchronous mock reads, some during rendering | Live routes show integration-pending views; original mock pages remain available in mock mode |
| Dashboard/Topbar | Render-time mock metric/notification reads | Live account dashboard and no mock counts/selector; operational summary integration deferred |
| Mock service checks | Imported the former work facade | Import the relocated mock implementation, preserving the same behavior checks |

## 3. Architecture and file ownership

```text
server/src/
  app.js                         middleware and route assembly
  server.js                      validated startup and graceful shutdown
  config/                        environment and database/transaction setup
  lib/                           errors, validation, pagination, decimal, idempotency
  middleware/                    authentication, administration grants, CSRF
  policies/                      scope, business dates, separation of duties
  modules/
    access/                      identity models, seed catalog, serialization,
                                 transactional access guard, audit writer
    auth/                        password utility, routes, controller, service
    users/                       routes, controller, service
    roles/                       routes, controller, service
  scripts/                       migration, bootstrap, transaction probe
server/scripts/                  persistent development DB, browser verification,
                                 generated permission documentation
server/tests/                    API/database/security integration checks
```

Controllers contain HTTP request/response handling. Services decide business behavior. Route schemas reject unknown fields, query operators, invalid IDs, and unsupported grants before a service uses them. No raw request object becomes a MongoDB filter/update.

### Changed file inventory

| Files/area | Change |
| --- | --- |
| Root/server `package.json` and lockfiles | LayerFlow naming, separate backend dependencies, reproducible installs, root/server/database/test/documentation commands |
| Root/server `.env.example`, `.gitignore`, `vite.config.js` | Public versus private configuration, explicit API/mock mode, ignored local database/cache/storage, development API proxy |
| `server/src/app.js`, `server.js`, `config/*` | Express lifecycle, session store, middleware, route assembly, environment validation, connection/topology checks, graceful shutdown |
| `server/src/lib/*`, `middleware/*`, `policies/*` | Shared validation/errors, pagination, exact decimals, idempotency, session/grant/CSRF handling, date/scope/separation rules |
| `server/src/modules/access/*` | Mongoose identity schemas, default permission catalog, public serialization, transactional administrator guard, audit writer |
| `server/src/modules/{auth,users,roles}/*` | Feature routes/controllers/services, salted scrypt hashes with stored work factors, all implemented identity actions |
| `server/src/scripts/*`, `server/scripts/*` | Numbered migration/index application, one-time Owner bootstrap, transaction probe, persistent database helper, browser verification, generated role matrix |
| `server/tests/*`, `tests/workService.test.mjs` | Actual API/security/persistence checks; original mock checks follow the moved mock module without behavior changes |
| `src/services/{api,authService,userService,roleService}.js` | Credentialed/CSRF-aware API transport, live feature facades, normalized errors and explicit mock adapters |
| `src/services/{organizationService,workService}.js`, `services/mock/*` | Guarded live boundaries; operational browser implementation relocated to `mockWorkService.js`; mock services import the mock audit writer directly |
| `src/context/{AuthContext,FarmContext}.jsx`, `app/{ProtectedRoute,routes}.jsx` | Cookie-session restoration, grant refresh, forced-password routing, new pages, no live mock hierarchy, later-module route boundary |
| `src/config/{permissions,roles,modules,integration}.js`, `utils/config.js` | Shared permission identifiers, server-backed role semantics, new Roles route, live phase availability, LayerFlow defaults |
| `src/features/users/*`, `pages/users/UsersPage.jsx` | Asynchronous pagination/mutations, server role definitions/previews, separate assignment, version conflicts, password reset, scope action deferred in live mode |
| `pages/auth/{LoginPage,PendingAccessPage,ChangePasswordPage}.jsx` | Real login, mandatory/change-password workflow, pending-role account, mock-only demo helper |
| `pages/roles/*`, `pages/dashboard/LiveDashboardPage.jsx`, `pages/common/IntegrationPendingPage.jsx` | Permission editor and live account dashboard/pending module views |
| `pages/profile/ProfilePage.jsx`, `components/layout/{BrandLogo,Topbar,UserMenu}.jsx`, `index.html` | Password link, dynamic role labels, LayerFlow branding, safe logout handling, no mock top-bar data in live mode |
| `README.md`, `AGENTS.md`, `PROGRESS.md`, `docs/*` | Run/setup documentation, architecture guidance, separate MERN checklist, complete implementation/verification record and generated access matrix |

The two PRDs already present as untracked source documents were preserved and included with the implementation so documentation links remain valid. No production deployment was performed.

### Repository delivery

The user subsequently requested publishing this work to `https://github.com/usaidchaudhry/poultry-farm-management-system`, on the existing `main` branch. The remote already matched the requested repository. Its newer README-only commit (`dafd5b5`) identified this as a Web Programming project; that classification is retained in the new README. The implementation is committed after integrating that remote history, and the final push result is verified against `origin/main` at handoff. Private environment files, local databases, package caches, generated screenshots, and dependency directories remain ignored. A publication-candidate scan found no private keys, GitHub tokens, or credential-bearing MongoDB URIs.

## 4. Initial data dictionary and integrity rules

| Collection | Fields and purpose | Integrity/indexes |
| --- | --- | --- |
| `organizations` | Single organization name/key, timezone, currency | Unique singleton key |
| `roles` | Organization, stable code, name, description, permission strings, company/assigned scope, protected flag, version | Unique organization/code and case-insensitive organization/name |
| `users` | Organization, name, normalized email, password hash, nullable role, active/temporary-password flags, auth version, edit version, future scope ID arrays, last login | Unique organization/email; password hash/auth version excluded from normal model selection |
| `sessions` | Express session data, user ID/auth version, CSRF token, expiry | MongoDB session store and expiry cleanup; not a business endpoint |
| `securityguards` | A single access-control revision document | Serializes all access changes and bootstrap, preventing concurrent removal of every administrator |
| `migrations` | Applied migration IDs/timestamps | Unique migration ID; migration 001 seeds organization/roles exactly once |
| `auditevents` | Actor/organization, action, target, redacted changes, server request ID, timestamp | Organization/time index; no ordinary create/update/delete API |
| `idempotencyrecords` | Actor, operation, key, request fingerprint, committed result, expiry | Unique actor/operation/key plus expiry index; reusable transaction helper for future business modules |

Roles are queried again on each protected request. Disabling/resetting a user or changing its assigned role increments `authVersion`; old sessions then fail even if MongoDB's background expiry cleanup has not removed them. Editing role permissions takes effect without waiting for cookie expiry.

Administrative writes use a MongoDB transaction, lock the access-control guard, reload the acting user/grants inside that transaction, apply version checks, write an audit event, and verify an effective administrator remains. A qualifying administrator is active, has company scope, and holds user/role view/manage recovery permissions. The bootstrap recovery role cannot be edited through the API. Protected account/role assignment additionally requires a protected administrator. Self-demotion/deactivation and granting access beyond the actor's own grants are denied.

Delegated administrators also cannot reset/edit/reassign a non-protected account whose existing role grants exceed their own; password reset or email editing must not become an indirect account-takeover path. Generic permission middleware is kept separate from company-scope middleware so future assigned-farm business routes can reuse it correctly.

Migration/index commands are repeatable and preserve edited default roles. They do not reset passwords. Bootstrap refuses to create/reset an Owner after any user already exists. Password change keeps a rotated current session and invalidates other sessions; administrator reset forces a new first-password change.

See [the generated exact access matrix](ACCESS_MATRIX.md) for every seeded permission. All new permission identifiers are in `src/config/permissions.js`; the backend seed catalog imports them rather than maintaining different strings.

### Date, scope, decimal, concurrency foundations

- UTC event timestamps; `YYYY-MM-DD` business dates computed in the configured timezone.
- Restricted operational default window is today/previous calendar day. Example: 19 November 2026 permits 18–19 November, denies 17 November. Historical ranges remain bounded to 90 days.
- `clinical.history.view` is a clinical-only exception; it does not unlock non-clinical history.
- Invalid dates and future/inverted ranges are rejected. Zero/missing denominators will be handled in the later calculation services.
- Scope helpers verify organization and assigned site/farm context, returning not-found for inaccessible resources. The future organization service must validate hierarchy ancestors; these helpers alone are not a complete Phase 3 implementation.
- `assertIndependentAdministrator` supplies the future prescriber/outcome restriction.
- Decimal helpers use decimal arithmetic and half-up rounding. Counts/stock/formula rules remain later business-module work.
- Editable identity records use an expected numeric version and return `409 VERSION_CONFLICT` on stale writes.
- The idempotency helper fingerprints canonical validated inputs, executes database-only work in the supplied transaction, replays the committed result, and rejects reuse with a different payload. Future business endpoints must also implement their source uniqueness rules. Identity creation already has unique email/code constraints; it does not claim to implement later report/sale idempotency.

## 5. Implemented API contracts

Base: `/api/v1`. Requests/responses are JSON; the browser sends credentials and `X-CSRF-Token` for writes. Successful objects use `{ "data": ... }`. User lists also include `{ "meta": { "page", "pageSize", "total", "totalPages" } }`.

| Method/path | Input or result | Authorization |
| --- | --- | --- |
| `GET /health`, `/ready` | Minimal process/database state | Public; no secrets |
| `GET /auth/csrf` | Creates/restores anonymous session and returns CSRF token | Public |
| `POST /auth/login` | Email/password → current user and rotated CSRF token | Valid CSRF/origin; rate-limited |
| `GET /auth/me` | Identity, current permissions, role metadata, password-change flag | Active session, including temporary/unassigned accounts |
| `POST /auth/logout` | Destroy session and clear cookie; 204 | Valid CSRF; works without a business role |
| `POST /auth/change-password` | Current/new password → updated user, rotated session/token | Active session; allowed before first-password change |
| `GET /users` | Server-paginated user summaries | `users.view` and company scope |
| `POST /users` | Name, email, password, optional `isActive` → unassigned user; 201 | `users.manage` and company scope |
| `PATCH /users/:id` | Name, email, expected version | User management plus protected-account rules |
| `PUT /users/:id/role` | Role ID or null, expected version | User management; grant-subset/protected/self-change checks |
| `PATCH /users/:id/status` | Active flag, expected version | User management; administrator/self-change safeguards |
| `POST /users/:id/reset-password` | New temporary password, expected version | User management; protected/self-reset restrictions |
| `GET /roles` | Role definitions | Any of `roles.view`, `users.view`, `users.manage`, with company scope |
| `POST /roles` | Stable code, name, description, permissions, scope mode; 201 | `roles.manage`, company scope, grant-subset check |
| `PATCH /roles/:id` | Editable role fields, expected version | Same plus protected-role/version checks |
| `GET /permissions` | Live permission-code catalog | `roles.view` or `roles.manage`, company scope |
| `/organization/*`, `/users/:id/scope` | Explicit 501 Phase 3 boundary | Active session after password change; no mock fallback |

User list supports `page` (1–10000), `pageSize` (1–100, default 20), `sort` (`name`, `email`, `createdAt`, with optional `-`), escaped literal `search`, role code/unassigned, and active/inactive status. Unknown query/body fields are rejected. Decimal payload conventions are prepared for later APIs; identity APIs do not accept fabricated computed values or actor IDs.

Example creation:

```json
{
  "name": "Staff Member",
  "email": "staff@example.test",
  "password": "<administrator-chosen-temporary-password>",
  "isActive": true
}
```

Role assignment is a separate request:

```json
{
  "roleId": "<role-object-id-or-null>",
  "version": 1
}
```

Example safe validation response:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Check the highlighted fields.",
  "fieldErrors": { "password": "Use at least 12 characters." },
  "requestId": "<server-generated-request-id>"
}
```

Statuses: 400 malformed JSON, 401 invalid/expired identity, 403 permission/CSRF/protected-action denial, 404 missing record/endpoint, 409 duplicate/version/last-administrator conflict, 413 body too large, 422 input validation, 429 throttled attempts, 501 later-phase boundary. Internal errors are generic 500 responses. Logs contain request ID, method, status, and duration, never request bodies, passwords, or cookies.

## 6. Frontend changes

- API transport uses credentials, synchronizer CSRF tokens, normalized `ApiError`, and centralized session-expiry/access-change events. It never automatically retries mutations or falls back to mock data.
- Auth restoration always asks the server in API mode. No live token or user-ID proof is stored in sessionStorage/localStorage. Background access refresh runs on visibility change and once per minute; server checks remain immediate.
- A forced change-password page is checked before role/permission routing. Unassigned users can change the temporary password and then reach pending access.
- Users list now performs server pagination/search/filtering and includes optimistic edit versions, dynamic role definitions, activation/deactivation, and reset-password dialog.
- New accounts cannot choose role/privilege fields on the live creation form; role assignment remains a separate action.
- Roles page lists templates and includes grouped permission checkboxes, scope selection, custom role creation/editing, and protected-role indication.
- Custom role labels come from API metadata. Existing mock labels remain presentation fallbacks, not authorization branches.
- Live dashboard reports connected/pending modules without rendering fabricated metrics. The top bar does not read mock notifications or hierarchy for real users.
- Organization and operational facades explicitly reject live calls until later phases; original demo remains available in mock mode.
- Visible product branding and the HTML title use LayerFlow. Developer-only routes are omitted from production routing.
- Existing forms, table, modal, toast, token-based CSS, and permission-code components are reused. No new frontend dependency was added.

## 7. Dependencies and configuration

Runtime server dependencies: Express, Mongoose, express-session, connect-mongo, CORS, Helmet, express-rate-limit, Zod, decimal.js. The password hasher uses Node's built-in crypto rather than adding another library.

Password records contain the algorithm, scrypt work factor, r/p parameters, random salt, and derived key. New hashes use N=32768, r=8, p=1, a 16-byte salt, and a 64-byte key. Stored parameters are bounded during verification and are never returned through the API or written to audit changes.

Verification/development dependencies: Supertest, mongodb-memory-server, playwright-core. The database helper runs a real MongoDB replica set, not a fake database adapter. Browser verification uses an installed Edge browser; it does not download another browser.

The server has its own lockfile. Root `npm test` explicitly selects the existing mock `.mjs` checks; it no longer accidentally discovers backend tests using the wrong working directory. Separate scripts invoke backend and browser verification.

Frontend environment: `VITE_DATA_MODE`, `VITE_API_BASE_URL`, `VITE_APP_NAME`. Server environment: MongoDB URI, port, allowed frontend origin, random session secret, cookie/expiry/proxy settings, timezone, future upload path, and optional one-time bootstrap fields. See [setup instructions](../README.md) and both `.env.example` files.

Local persistent data and downloaded MongoDB binaries live under ignored `.data/`. Test databases use independent temporary paths. No real account credentials were seeded into the repository, and no existing browser business data was imported or cleared.

## 8. Verification record

Final verification on 20 November 2026 used Node.js 24.18.0, MongoDB 8.2.6, and headless Microsoft Edge. Dependency versions are locked in the package lockfiles.

| Check | Result |
| --- | --- |
| `npm test` | Passed: 9 existing mock workflow checks, zero failures |
| `npm run test:server` | Passed: 17 backend/database/security/policy checks, zero failures; includes disk persistence across full MongoDB restart |
| `npm run build` | Passed: production Vite bundle, 233 modules transformed |
| `npm run test:browser` | Passed: clean-browser login/change/restore, API restart, dynamic role create/edit, staff creation/assignment, pending access, revocation, logout, phone-width read-only user list; no browser runtime errors |
| Screenshot inspection | Reviewed the completed role list at 1440 px and user list at 390 px; no page-level horizontal overflow in the phone check |
| `git diff --check` | Passed; only the repository's normal LF/CRLF notices were emitted |
| Static documentation/source checks | Passed: local Markdown links, balanced code fences, matching package/lock metadata, and syntax validation of all 39 server JavaScript files |

Local generated screenshots: `.data/verification/roles-desktop.png` and `.data/verification/users-mobile.png`. They use temporary test accounts and are ignored rather than committed. Re-run the browser command to regenerate them. Verification processes stop after the run; no test account is installed in your normal development database.

Backend coverage: safe health/readiness, repeatable seed/index migration, one-time bootstrap, hashed passwords, transaction rollback, CSRF/origin/cookie behavior, forced password change, unassigned blocking, injection/duplicate/stale input, server pagination, role restrictions, current-session grant revocation, password-reset/role/deactivation session invalidation, other-session password invalidation, protected recovery role, self-change restrictions, delegated grant escalation prevention, concurrent administrator mutation, redacted audit, idempotency replay/conflict, business-date boundaries, separation/scope helpers, decimal rounding, rate limiting, and explicit Phase 3 boundary.

Development issues resolved during implementation:

1. Registry access was blocked in the restricted environment; dependency download succeeded through the available reviewed network execution path. Workspace-local npm cache avoids relying on restricted user cache writes.
2. Docker is installed but its engine is not running. The supplied MongoDB development/test helper avoids requiring Docker or user cloud credentials.
3. The initial test helper assumed every POST returned 200. It was corrected to expect 201 for user/role creation; API behavior was already correct.
4. Vite's config loader could not inspect a parent directory inside the restricted view. The production build succeeded when run through the reviewed execution path.
5. Browser verification needed the helper's initial MongoDB binary download. Later runs reuse the workspace cache.
6. Browser locators were corrected to include the existing required-field label markers and the application's actual access-denied heading. The final run waits for save dialogs to close before capturing screenshots.
7. Final security review tightened delegated account administration and recorded password work factors before the complete passing verification run.

This implementation does not claim final-project responsive/accessibility certification or deployment. Browser checks here focus on the implemented identity/admin slice; the complete product pass remains Phase 11.

## 9. Next phase and boundaries

MERN Phase 3 should add site/farm/house/flock models, hierarchy APIs, archive/restore and occupancy constraints, persistent staff assignments, ancestor validation, and live `FarmContext` selection. Existing mock pages are references, not a substitute for those services.

Before integrating operational pages, replace their synchronous work facade calls with asynchronous module hooks and apply the existing server policies to every list/detail/write/export. Later phases must complete report/egg single-source posting, per-location stock, recurring medication schedules, media, notifications, analytics, and audit read APIs.

No external email/SMS or production deployment was performed. Bootstrap credentials are supplied by the developer running the application; there is no universal live demo password.

## 10. Documentation consulted

- [Express session middleware](https://expressjs.com/en/resources/middleware/session/) — session rotation, persistence, cookie configuration.
- [Mongoose transaction guidance](https://mongoosejs.com/docs/transactions.html) — transaction boundaries and sequential database work.
- [MongoDB development helper replica sets](https://typegoose.github.io/mongodb-memory-server/docs/api/classes/mongo-memory-replset/) and [instance options](https://typegoose.github.io/mongodb-memory-server/docs/api/interfaces/mongo-memory-replset-opts/) — actual replica-set verification and persistent development paths.
