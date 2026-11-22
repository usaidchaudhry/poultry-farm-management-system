# LayerFlow

A poultry-management university course project using React 18, Express, Node.js and MongoDB. **MERN Phases 0-11 are complete for the approved localhost scope**, including live dashboards, ten reports, CSV/print output, searchable audit, relative-date demo seeding, database/file recovery, verification and submission documentation. Public deployment and features requiring external services, third-party APIs or cloud are skipped by user request. The local Express API and MongoDB remain required.

- [Product requirements and phased plan](LayerFlow_MERN_PRD.md)
- [Implementation log, decisions, data dictionary, API contract, and verification](docs/MERN_PHASE_0_2_IMPLEMENTATION.md)
- [Phase 3 implementation, API contract, demo data, and verification](docs/MERN_PHASE_3_IMPLEMENTATION.md)
- [Phase 4 reports, population, measurements, and publication contract](docs/MERN_PHASE_4_IMPLEMENTATION.md)
- [Phase 5 clinical workflow, scheduling, evidence, and verification](docs/MERN_PHASE_5_IMPLEMENTATION.md)
- [Phase 6 inventory, stock controls, report-feed posting, and verification](docs/MERN_PHASE_6_IMPLEMENTATION.md)
- [Phase 7 formula composition, costing, privacy, and immutable versions](docs/MERN_PHASE_7_IMPLEMENTATION.md)
- [Phase 8 egg publication, sales, expenses, and recorded financial results](docs/MERN_PHASE_8_IMPLEMENTATION.md)
- [Phase 9 private evidence, alert lifecycle, durable reminders, and storage deployment](docs/MERN_PHASE_9_IMPLEMENTATION.md)
- [Phase 10 dashboard, reports, exports and audit](docs/MERN_PHASE_10_IMPLEMENTATION.md)
- [Phase 11 localhost completion and scope decisions](docs/MERN_PHASE_11_IMPLEMENTATION.md)
- [Acceptance results and evidence](docs/ACCEPTANCE_RESULTS.md)
- [Production deployment](docs/DEPLOYMENT.md)
- [Backup and recovery](docs/BACKUP_RESTORE.md)
- [Schema diagram](docs/SCHEMA.md) and [OpenAPI specification](docs/openapi.json)
- [Demonstration script](docs/DEMO_SCRIPT.md)
- [Configured localhost testing and demo credentials](docs/LOCAL_TESTING.md)
- [Exact default role/permission matrix](docs/ACCESS_MATRIX.md)
- [Progress checklist](PROGRESS.md)

## Requirements

- Node.js **22.12 or newer** and npm. The implementation was verified with Node 24.
- MongoDB configured as a **replica set** (local helper below) or a transaction-capable Atlas database.
- An installed Microsoft Edge browser only if running the optional browser verification command.

No cloud credentials or Docker installation are needed when using the local database helper. Its first run downloads a MongoDB binary; allow time and disk space for that download. Later runs reuse the ignored `.data/mongodb-binaries/` cache.

## Install and configure

Run these commands from the repository root:

```powershell
npm ci
npm --prefix server ci

if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
```

Edit `server/.env`. Replace the session-secret placeholder with a random value generated locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Also set `BOOTSTRAP_NAME`, `BOOTSTRAP_EMAIL`, and `BOOTSTRAP_PASSWORD` for the initial Owner. Choose your own temporary password of 12–128 characters. There is **no default live password**. Keep credentials in your ignored environment file; do not commit or share it.

The default local connection is:

```text
mongodb://127.0.0.1:27017/layerflow?replicaSet=layerflow
```

For Atlas, replace `MONGODB_URI` with your database connection string and configure database/network access in your own Atlas account. A standalone MongoDB service without replica-set support will fail startup intentionally.

## Run locally

**Terminal 1 — local database** (skip if using Atlas):

```powershell
npm run db:dev
```

This starts a single-node development replica set on loopback port 27017. Data persists in `.data/mongodb/` between restarts. Stop with Ctrl+C. It is a development database, not a production hosting configuration.

**Terminal 2 — initialize and run the API:**

```powershell
npm run db:bootstrap
npm run db:check
npm run dev:server
```

Bootstrap creates the first Owner once and refuses to replace/reset credentials if any user already exists. Indexes and initial role seeds are applied automatically and repeatably. After successful bootstrap, remove `BOOTSTRAP_PASSWORD` from `server/.env`; it is not needed to run the server.

**Terminal 3 — frontend:**

```powershell
npm run dev
```

Open **http://localhost:5173**. The Vite development proxy forwards `/api` to the API on `127.0.0.1:5000`. Sign in using your bootstrap email/password and choose a new password when prompted.

The API listens on loopback. `/api/v1/health` reports process state; `/api/v1/ready` reports database connectivity. No real database URI or secret appears in those responses.

## Using the implemented administration flow

1. Owner signs in and changes the temporary password.
2. Open **Users**, create a staff account, and share its temporary password securely.
3. A newly created account is unassigned. The staff member changes the temporary password and then sees pending access.
4. Owner assigns a seeded or custom role separately. Role assignment ends that account's existing sessions; sign in again.
5. Open **Roles and permissions** to create/edit a role and select granular permissions/scope. The bootstrap recovery role is protected.
6. Role permission edits affect existing sessions on their next protected API request. Deactivation, password reset, and role assignment invalidate previous sessions immediately.
7. Use **My profile → Change password** for your own password. Use the Users reset action for other accounts.

Open **Organization** to create Sites > Farms > Houses > Flocks. One active flock is permitted per house. In **Users**, assign sites or farms to staff with assigned-scope roles. Assignment changes end their existing sessions; sign in again. The top-bar working-area selector displays only accessible active records. Operational pages use live APIs and never display local mock records to real authenticated accounts. User/role administration requires company scope and its corresponding permissions; assigned operational roles do not gain account-administration access.

## Daily reporting and bird measurements

1. Record a flock sample under **Bird parameters** in g or kg. Weight is normalized to grams; standards remain unconfigured.
2. Open **Daily reports**, choose a flock/date, enter values, and save a draft. Drafts can be incomplete; submission requires explicit egg, mortality, feed, water, and light values, including zeros.
3. Opening birds are calculated by the API. If earlier days are missing, the Owner can record a counted-opening reconciliation with a reason from the report form.
4. Open the saved report and submit it. A reviewer can return it with a reason; the manager edits and resubmits it with a correction reason. Numbered snapshots preserve previous submissions.
5. **Mortality** shows positive mortality from the effective published revision. Health concerns with zero mortality remain in Daily reports.

Staff reads are limited to today/yesterday unless their role grants history. Older report writes additionally need correction permission and a reason. Farm scope is checked on lists, details, revisions, and writes.

**Phase 8 publication:** report submission posts feed consumption and saleable egg stock in one transaction. Returned drafts retain their last effective publication; revisions post differences. Insufficient current or historical stock blocks the whole submission. Legacy descriptive feed references require real selections; legacy egg reports need an explicitly checked stock initialization or their first stock-enabled revision. See the Phase 6/8 logs for cutover contracts.

**Phase 9 evidence and alerts:** open a saved report, visit, expense, or medical alert to attach private images/comments. Medical alerts reach assigned clinicians and authorized management, with explicit Owner fallback. Run the normal API entry point to start restart-safe reminder scanning. Keep `UPLOAD_DIR` on persistent private disk and back it up with MongoDB; it is never a public static directory. See [Phase 9 deployment and API details](docs/MERN_PHASE_9_IMPLEMENTATION.md).

## Clinical visits and medication

1. Assign a Doctor and Farm Manager to the same farm. The Doctor records a clinical visit and creates a multi-item prescription draft.
2. Enter dose/unit or explicit instructions, route, start date, duration, and daily local times. Preview the schedule, save, then finalize. Two items at two times over three days create 12 separate tasks.
3. A different authorized person opens a due task in **Medication** and records completed or missed with actual time and dose/instruction evidence. Prescribers cannot record or correct their own tasks, even with administration permissions.
4. Use **Closed outcome history** to review evidence. Authorized corrections append superseding events; old evidence is retained. Cancellation/replacement preserves recorded outcomes and, after any outcome, affects future tasks only.
5. Daily reports can optionally link existing visits, prescription versions, and administration events. These references never confirm another administration or issue inventory.

Clinical history permissions remain separate from ordinary operational date access. Open tasks remain actionable when overdue across older dates. Images are a later-phase dependency. See the Phase 5 log for action/date policies, UTC scheduling, correction rules, and the source API contracts.

## Inventory and feed stock

1. Open **Inventory and feed**. Each farm has a Main store and Egg collection room; authorized staff can add locations and catalog items.
2. Post opening stock or receipts in the declared base unit. Feed/ingredients use kg; eggs use whole counts. Every posting requires a business date and reason.
3. Post a signed adjustment, manual loss/dispatch, or paired transfer between permitted locations. Current balances include all history. Movement history follows your date permission.
4. Configure a low-stock threshold per item/location, including zero pairs before their first receipt. Inspect low stock and reconciliation; discrepancies block further posting for that pair.
5. Reverse manual errors using a linked compensating operation. Correct report-generated consumption by returning/editing/resubmitting the report. Farm Managers consume feed only through reports and cannot manually duplicate consumption.

No stock quantities are seeded automatically. Record real opening stock before submitting positive feed consumption. Configured low-stock conditions also create durable Phase 9 inbox reminders.

## Feed formulas and costing

1. Create active ingredient catalog items in kg, then let the assigned Farm Manager compose a formula with code/name/date, ingredient quantities, and bag size (default 50 kg).
2. Submit for costing. The Operation Manager uses **Pending costing queue**, enters all PKR/kg rates, previews authoritative totals, and saves rates before finalizing. A return requires a reason and clears estimates for fresh costing.
3. Finalization preserves an immutable composition/price/rounding snapshot. The composer can create a linked new draft without copied prices or archive a completed formula.
4. Farm Managers receive no price fields, including in old versions. Cost visibility, price entry, finalization, submission, and return have separate permissions. Formulas do not consume stock or book expenses.

The worked 60 kg at PKR 10/kg plus 40 kg at PKR 20/kg example yields PKR 1,400 total and PKR 700 per 50 kg bag. See the Phase 7 log for decimal rounding, history policies, API contracts, and verification.

## Egg production, sales, and recorded finance

1. Submit reports to publish saleable egg categories to the farm's collection room. Egg production reads that evidence; it has no independent production entry form. Defaults exclude Floor/Broken/Discard.
2. On Sales, select a permitted room, buyer, and category lines priced per egg or whole Peti (360 eggs). Posting deducts stock atomically and cannot oversell. Payment changes affect unpaid value, not revenue or quantity.
3. Cancel with a reason before physical dispatch to restore stock and remove recorded revenue, or mark eggs physically dispatched. Dispatched customer returns are outside this phase.
4. On Finance, record actual expenses with controlled categories and unique invoice/source references. Correct errors through void-and-replacement rather than overwriting evidence.
5. Review sales-date revenue, unpaid value, recorded cost, and operating surplus with source drill-down. Cost completeness remains unconfirmed; these results are not cash flow, official profit, or ROI. Formula costing and stock movements do not automatically book costs.

The example of 720 eggs, a one-Peti sale at PKR 18,000, and PKR 7,000 expenses leaves 360 eggs and PKR 11,000 recorded operating surplus. Historical report eggs are not silently backfilled: a company supervisor checks physical opening stock before explicitly initializing legacy evidence.

## Reports and submission

Dashboard and Reports and analytics aggregate real permitted source data on the server. Reports reuse hierarchy/date filters, support paginated tables and CSV, and retain exact decimal totals. Daily report detail links to an authenticated printable submitted revision. Audit is read-only and company-scoped; source permissions and history still apply.

For a complete relative-date demonstration, first finish the Owner password change, set a private `DEMO_PASSWORD` in `server/.env`, then run `npm run db:demo:full`. Existing records/passwords are preserved. See the demonstration script for sample labels and expected totals.

To keep role-based demo choices on the localhost sign-in page, set `LOCAL_DEMO_LOGIN=true` in `server/.env` alongside the same `DEMO_PASSWORD`, run `npm run db:demo:full`, and restart the API. The picker includes a separate demo Owner, Production Manager, two Farm Managers, Operation Manager and Doctor. Selecting an account fills its email and matching temporary password. After its password is changed, enter its current password manually; rerunning the seed does not reset it. Normal login and first-password-change checks remain in effect. This helper requires a non-production API bound to loopback; the historical mock picker remains available in explicit mock mode.

Use the localhost setup above for delivery. The local MongoDB helper and private upload directory provide persistence without cloud services. Production HTTPS serving was verified locally; deployment configuration is retained as optional reference. Public hosting, external messaging and third-party runtime APIs are outside the approved scope.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | React development server |
| `npm run dev:server` | API with file watching |
| `npm run start:server` | API without watching |
| `npm run db:dev` | Persistent local development replica set |
| `npm run db:bootstrap` | Create initial Owner from private environment input |
| `npm run db:migrate` | Apply repeatable indexes and numbered migrations |
| `npm run db:demo` | Optional two-farm demonstration fixture; requires private `DEMO_PASSWORD` and empty development hierarchy |
| `npm run db:demo:full` | Relative-date full demonstration; private `DEMO_PASSWORD`, non-production only |
| `npm run db:backup -- <new-directory>` | Paired database/private-file backup |
| `npm run db:restore -- <bundle-directory>` | Restore to separate empty database and new upload directory |
| `npm run test:release` | Production HTTPS/all-role/restart/recovery browser verification |
| `npm run test:demo-login` | Verify localhost role picker, normal login and password change for all six demo accounts |
| `npm run docs:api` | Regenerate OpenAPI request/permission specification |
| `npm run db:check` | Verify connection and real transaction execution |
| `npm run build` | Production frontend bundle in `dist/` |
| `npm run preview` | Preview frontend bundle; a real API must be served/proxied separately |
| `npm test` | Existing browser-mock workflow checks |
| `npm run test:server` | Actual temporary MongoDB/API/security integration checks |
| `npm run test:browser` | Headless Edge identity/admin/hierarchy/report/clinical/inventory workflow with temporary API/frontend/database |
| `npm run docs:access` | Regenerate the default access matrix from the seed catalog |

Verification commands never reset your configured application database. They create independent temporary test databases. Browser screenshots are saved under ignored `.data/verification/`.

## Environment variables

Frontend values are public and compiled into the browser bundle:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_DATA_MODE` | `api` | `api` for all live workflows; `mock` opens the historical demo in development only |
| `VITE_API_BASE_URL` | `/api/v1` | API prefix; development uses the Vite proxy |
| `VITE_APP_NAME` | `LayerFlow` | Visible application name |

Server configuration belongs in `server/.env`:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Development/test/production behavior |
| `HOST` | Bind address; loopback by default, `0.0.0.0` in the container |
| `SERVE_SPA`, `SPA_DIR` | Serve built SPA (default in production); default repository `dist/` |
| `DEMO_PASSWORD` | Private temporary staff password for explicit local demo seeding |
| `LOCAL_DEMO_LOGIN` | Explicit localhost account picker; default false. Shows only seeded demo accounts and matching temporary passwords; never bootstrap credentials. Requires non-production loopback binding. |
| `RESTORE_MONGODB_URI`, `RESTORE_UPLOAD_DIR` | Separate empty database and new private upload directory, restore command only |
| `PORT` | API port; default 5000, matching the development proxy |
| `MONGODB_URI` | Transaction-capable database URI |
| `FRONTEND_ORIGIN` | Exact permitted frontend origin; default `http://localhost:5173` |
| `SESSION_SECRET` | Required random secret, at least 32 characters; placeholder is rejected |
| `SESSION_MAX_AGE_MS` | Session lifetime; default 8 hours, maximum 7 days |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE` | Cookie topology; production requires secure cookies/HTTPS |
| `TRUST_PROXY` | Trusted reverse-proxy hop count; default 0 |
| `BUSINESS_TIMEZONE` | Default `Asia/Karachi` |
| `UPLOAD_DIR` | Private persistent disk for authenticated images; default `../.data/uploads`; never expose as a static directory |
| `REMINDER_INTERVAL_MS` | Restart-safe reminder scan interval; default 60000 |
| `MORTALITY_ALERT_PERCENT` | Demonstration alert threshold; default 2%, not veterinary advice |
| `BOOTSTRAP_NAME`, `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD` | One-time initial account input |

Use **localhost** consistently with the default frontend-origin setting. If opening another hostname/port, update the allowed origin accordingly. Do not put secrets in `VITE_*` variables. For a later deployed environment, serve the SPA and `/api/v1` through one HTTPS origin and configure the trusted proxy explicitly.

## Historical frontend mock demo

To inspect the original frontend workflows independently of the API, explicitly set this in the root `.env` and restart Vite:

```dotenv
VITE_DATA_MODE=mock
```

Mock mode retains browser-persisted sample users, farm structure, daily reports, clinical/medication flows, inventory, formulas, sales, finance, alerts, and audit. The login helper clearly identifies those as mock accounts. They are not live server credentials, and clearing browser storage does not reset MongoDB.

Restore `VITE_DATA_MODE=api` before working with the live backend. Production builds reject mock mode; requests never silently fall back to mock data.

## Project structure and conventions

```text
src/
  app/           routes and route guards
  config/        module registry and shared permission identifiers
  context/       authentication, farm selection, feedback
  components/    shared controls/layout/table/dialogs
  features/      feature hooks and components
  pages/         existing and integrated pages
  services/      UI-facing facades, API transport, explicit mock implementations
  styles/        plain CSS and design tokens
server/
  src/config/    validated environment and database connection
  src/modules/   feature routes, controllers, services, identity models
  src/middleware/ authentication, permissions, CSRF
  src/policies/  scope/date/separation foundations
  src/lib/       errors, validation, pagination, decimals, idempotency
  src/scripts/   migrations, bootstrap, database probe
  scripts/       development DB, browser checks, access documentation
  tests/         backend integration/security checks
docs/            implementation log and generated access matrix
tests/           original mock workflow checks
```

Pages are registered in `src/config/modules.js` and `PAGE_REGISTRY` in `src/app/routes.jsx`. UI authorization uses permission codes through `useAuth()`/`<Can>`. Services sit behind facades; server checks are authoritative. Existing components and plain CSS tokens remain the UI foundation.
