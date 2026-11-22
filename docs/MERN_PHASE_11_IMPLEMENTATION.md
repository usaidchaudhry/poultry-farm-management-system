# MERN Phase 11 completion for localhost

Updated 22 November 2026. Phases 10 and 11 are complete for the user-approved localhost scope. The user explicitly requested no deployment and directed that features requiring external services, APIs or cloud be skipped. Public hosting is therefore excluded, not an outstanding acceptance gate.

## Work performed

1. Read all 17 pre-existing repository Markdown documents to recover requirements, defaults, completed phases and outstanding verification.
2. Added production same-origin SPA/API serving, safe SPA route fallback, explicit bind address, fail-fast missing build/config checks, and JSON errors for unknown API paths. Production configuration requires HTTPS and secure cookies. Production frontend builds reject mock mode. Fresh-copy testing found and fixed fallback failure under a hidden parent directory: the index is now sent relative to the configured SPA root while dotfile requests remain denied.
3. Added a multi-stage, non-root Node 24 Docker image and Docker Compose/Caddy configuration with private persistent upload/backup volumes, persistent TLS state, readiness checks and an external transaction-capable MongoDB connection. No real credentials are committed.
4. Added a repeatable relative-business-date full demo command using existing business services, all default staff roles, two farms, published reports, real inventory effects, a formula, sale, expense, sample clinical records, tasks, alert and sealed placeholder image. Existing passwords/accounts and records are not reset. Full seeding refuses production mode.
5. Added checksummed canonical Extended JSON database plus private-file backup and empty-target restore commands. Sessions are excluded so restored installations require login. Verified actual database restart and restore into a separate database/upload directory.
6. Added production-mode HTTPS browser verification through a local TLS reverse proxy against real isolated MongoDB. Covered all roles, phone/tablet/desktop widths, multi-farm selection, wrong-origin CSRF denial, secure cookies, empty state, API failure/retry, CSV download, published print, audit modal keyboard focus, restart and restored-server login. Local TLS is ephemeral/self-signed and does not represent a public deployment certificate.
7. Added an isolated 10,000-record performance check with ordinary API reads/writes and aggregation timing, index evidence and export-size refusal.
8. Added the generated 105-resource-path OpenAPI specification, schema diagram, acceptance mapping, deployment/backup instructions and demonstration script. Updated README, environment examples, progress and repository guidance.

## Verification and artifacts

See [acceptance results](ACCEPTANCE_RESULTS.md). Generated local artifacts live under ignored `.data/verification/`; representative responsive screenshots are also copied to `docs/evidence/` for submission. The release script writes a machine-readable result file stating `publicDeployment: false`.

Fresh installation was checked in a separate generated working directory using independent frontend/server `npm ci` runs. The initial offline frontend attempt lacked a cached locked package; normal installation completed successfully. The MongoDB test helper's install-script approval message is not a runtime dependency; test scripts explicitly start the helper. No configured developer database was reset.

## Approved scope change: localhost only

The user's clarification supersedes the original public-deployment requirement in Phase 11 and AC-26. Use the local MongoDB replica-set helper, private local disk, MongoDB sessions and in-app reminder worker. No hosted database, domain, paid storage, external messaging provider or third-party runtime API is required. The browser calls the local Express API, which remains part of the MERN application.

Public HTTPS hosting, cloud database/storage setup and public-host restart checks are skipped by request. The prepared Docker/Caddy files remain optional reference material; Docker engine execution was not verified and is not required for localhost delivery. Local production HTTPS verification, database/server restart and paired database/file recovery have passed. Follow README for normal localhost operation; do not enable production secure-cookie settings on plain HTTP localhost.

## Adopted limits

- One application instance, coarse transaction guard, persistent private local disk and polling reminders fit the course scope. No distributed queue, cross-region HA or automatic offsite backup is claimed.
- Logical backups fit the bounded course dataset and MongoDB transaction duration/memory limits. Larger installations need infrastructure snapshots/managed backup and restore drills.
- Clinical examples and mortality thresholds are labeled demonstration data. No veterinary standards, automatic treatment, official ROI, cash ledger, returns or inventory valuation were invented.
- Existing frontend dependency advisories are recorded in acceptance results; the production image serves built assets and does not expose Vite's development server. No automatic major-version dependency migration was performed.
