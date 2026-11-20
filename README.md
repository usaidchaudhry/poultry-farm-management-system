# LayerFlow

A poultry-management Web Programming university course project using React, Express, Node.js, and MongoDB. **MERN Phases 0–2 are implemented:** backend foundation, real authentication, staff administration, and editable role permissions. Existing farm-operation screens remain an explicit mock demo until their backend phases are connected.

- [Product requirements and phased plan](LayerFlow_MERN_PRD.md)
- [Implementation log, decisions, data dictionary, API contract, and verification](docs/MERN_PHASE_0_2_IMPLEMENTATION.md)
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

Farm scope assignment and hierarchy persistence are **MERN Phase 3**. Live farm/clinical/inventory/report pages show their pending integration phase. They do not display local mock records to real authenticated accounts. User/role administration requires company scope and its corresponding permissions; assigned operational roles do not gain account-administration access.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | React development server |
| `npm run dev:server` | API with file watching |
| `npm run start:server` | API without watching |
| `npm run db:dev` | Persistent local development replica set |
| `npm run db:bootstrap` | Create initial Owner from private environment input |
| `npm run db:migrate` | Apply repeatable indexes and numbered migrations |
| `npm run db:check` | Verify connection and real transaction execution |
| `npm run build` | Production frontend bundle in `dist/` |
| `npm run preview` | Preview frontend bundle; a real API must be served/proxied separately |
| `npm test` | Existing browser-mock workflow checks |
| `npm run test:server` | Actual temporary MongoDB/API/security integration checks |
| `npm run test:browser` | Headless Edge identity/admin workflow with temporary API/frontend/database |
| `npm run docs:access` | Regenerate the default access matrix from the seed catalog |

Verification commands never reset your configured application database. They create independent temporary test databases. Browser screenshots are saved under ignored `.data/verification/`.

## Environment variables

Frontend values are public and compiled into the browser bundle:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_DATA_MODE` | `api` | `api` for live identity; `mock` explicitly opens the historical demo |
| `VITE_API_BASE_URL` | `/api/v1` | API prefix; development uses the Vite proxy |
| `VITE_APP_NAME` | `LayerFlow` | Visible application name |

Server configuration belongs in `server/.env`:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Development/test/production behavior |
| `PORT` | API port; default 5000, matching the development proxy |
| `MONGODB_URI` | Transaction-capable database URI |
| `FRONTEND_ORIGIN` | Exact permitted frontend origin; default `http://localhost:5173` |
| `SESSION_SECRET` | Required random secret, at least 32 characters; placeholder is rejected |
| `SESSION_MAX_AGE_MS` | Session lifetime; default 8 hours, maximum 7 days |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE` | Cookie topology; production requires secure cookies/HTTPS |
| `TRUST_PROXY` | Trusted reverse-proxy hop count; default 0 |
| `BUSINESS_TIMEZONE` | Default `Asia/Karachi` |
| `UPLOAD_DIR` | Reserved private upload location for later evidence module |
| `BOOTSTRAP_NAME`, `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD` | One-time initial account input |

Use **localhost** consistently with the default frontend-origin setting. If opening another hostname/port, update the allowed origin accordingly. Do not put secrets in `VITE_*` variables. For a later deployed environment, serve the SPA and `/api/v1` through one HTTPS origin and configure the trusted proxy explicitly.

## Historical frontend mock demo

To inspect the original frontend workflows independently of the API, explicitly set this in the root `.env` and restart Vite:

```dotenv
VITE_DATA_MODE=mock
```

Mock mode retains browser-persisted sample users, farm structure, daily reports, clinical/medication flows, inventory, formulas, sales, finance, alerts, and audit. The login helper clearly identifies those as mock accounts. They are not live server credentials, and clearing browser storage does not reset MongoDB.

Restore `VITE_DATA_MODE=api` before working with the live backend. Requests never silently fall back to mock data.

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
