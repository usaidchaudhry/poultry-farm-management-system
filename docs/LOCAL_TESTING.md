# Configured localhost test installation

Configured and verified on 22 November 2026. Open **http://localhost:5173**. The persistent local database, API and frontend were started in hidden background processes for this session. No external service/cloud account was used.

## Demo sign-ins

All six accounts initially use **`LayerFlowDemo123!`**:

| User | Email |
| --- | --- |
| Owner / Production Head | `demo-owner@layerflow.test` |
| Production Manager | `demo-production@layerflow.test` |
| Farm Manager Alpha | `demo-alpha@layerflow.test` |
| Farm Manager Beta | `demo-beta@layerflow.test` |
| Operation Manager | `demo-operations@layerflow.test` |
| Doctor | `demo-doctor@layerflow.test` |

Select an account on the login page and click Sign in. First login requires a password change. Remember the new password for that account; the seed does not reset changed passwords. Initial verification signed in and logged out without changing these six temporary passwords.

## Setup performed

- Created ignored root `.env` in API mode and ignored `server/.env` with a generated random session secret, loopback API/database, private local upload path, `LOCAL_DEMO_LOGIN=true` and the demo password above.
- Started the persistent development MongoDB replica set using the cached local binary, with data in `.data/mongodb`.
- Applied migrations and bootstrapped an empty database via the normal service. A separate `local-owner@layerflow.test` setup administrator completed its initial password change through the normal password service; its current local sample password is also `LayerFlowDemo123!`. This account supports repeatable full seeding while the six presentation accounts retain their first-login flow.
- Ran the relative-date full seed via existing services: hierarchy, scoped accounts, reports, feed/egg stock, sale, expense, formula, sample clinical records, images and notifications.
- Started the API on `127.0.0.1:5000` and Vite at `localhost:5173`. Readiness, frontend/proxy and normal authentication for all six demo identities passed. No password-change or permission bypass was introduced.

These are intentionally shared localhost demonstration credentials. The random session secret stays only in the ignored server environment file.

## Restart after stopping or rebooting

Use three terminals at the repository root:

```powershell
# Terminal 1
npm run db:dev
# Terminal 2, once the database is ready
npm run dev:server
# Terminal 3
npm run dev
```

Use **localhost**, matching the configured origin. Do not start duplicate copies while the current services are running. Existing accounts and data survive restart. Run `npm run db:demo:full` to add current relative-date samples later; existing records and changed passwords are preserved.

Session background process IDs and startup logs are stored under ignored `.data/local-runtime/`. No real environment file or session secret was committed. Do not run bootstrap again against this initialized database.
