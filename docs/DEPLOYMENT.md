# Production deployment

**Optional reference only.** The user chose localhost-only delivery and asked to skip external-service/API/cloud features. Follow the repository README for local setup; no public host, domain, Atlas account or Docker deployment is required. The configuration below is retained for potential future use and has not been deployed.

The public host/domain and MongoDB account are not configured in this workspace. These instructions prepare a single-host deployment; they do not establish that a public deployment has already happened.

## Topology

Browser -> HTTPS Caddy -> private Express/SPA container -> external MongoDB replica set/Atlas. Only Caddy publishes ports. Uploads are accessed through authenticated API routes and stored in the private `uploads` volume. `backups`, `caddy_data` and `caddy_config` are persistent volumes too.

Prerequisites: Linux host with Docker/Compose, domain DNS pointing to that host, inbound TCP 80/443, transaction-capable MongoDB with host-restricted network access, and durable disk capacity. Caddy obtains/renews certificates for a correctly configured public domain; its data directory must persist. See [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https) and [reverse proxy configuration](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

## Deploy

1. Copy the repository to the host. Copy `deploy/.env.example` to `deploy/.env`; restrict its permissions to the operator.
2. Set `DOMAIN`, `TLS_EMAIL`, private `MONGODB_URI`, and a fresh random `SESSION_SECRET` (at least 32 characters). Keep `BUSINESS_TIMEZONE` consistent with existing data. Generate the secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
3. Validate, build and initialize:

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yml build
# Temporarily supply BOOTSTRAP_NAME/EMAIL/PASSWORD in deploy/.env.
docker compose --env-file deploy/.env -f deploy/compose.yml run --rm app node src/scripts/bootstrap.js
```

Bootstrap refuses to overwrite an existing account. Remove the bootstrap password afterwards, then start:

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml up -d
curl --fail https://YOUR_DOMAIN/api/v1/ready
```

The image uses `/app` as working directory and installs only server runtime dependencies in its final stage. The build uses API mode. See [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage).

## Verify the actual host

- Sign in, change the temporary password, reload a direct `/dashboard` or `/analytics` URL, then log out and confirm protected requests return 401.
- Confirm the cookie is HttpOnly, Secure, SameSite=Lax and limited to `/api/v1`; verify wrong-origin writes fail. Never expose the app container directly while trusting forwarded headers.
- Submit a report with a permitted image, record its totals, restart `app`, and check session restoration, totals and image bytes. Restart Caddy and confirm HTTPS remains available.
- Check `/api/v1/ready` and unknown `/api/v1/not-a-route` (JSON 404). No database credentials should appear in responses/logs.
- Run a backup and restore drill as described in [backup instructions](BACKUP_RESTORE.md). Record the URL and results in [acceptance results](ACCEPTANCE_RESULTS.md).

## Configuration

| Variable | Meaning |
| --- | --- |
| `NODE_ENV` | `production`; enables HTTPS/secure-cookie requirements and SPA serving by default. |
| `HOST`, `PORT` | Container uses `0.0.0.0:5000`; local development defaults to loopback. |
| `MONGODB_URI` | Private replica-set/Atlas URI; transactions are required. |
| `FRONTEND_ORIGIN` | Exact public HTTPS origin; Compose derives it from `DOMAIN`. |
| `SESSION_SECRET`, `SESSION_MAX_AGE_MS` | Random persistent secret and bounded session duration (default eight hours). Rotating the secret signs users out. |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `TRUST_PROXY` | `true`, `lax`, `1` for the single Caddy hop. |
| `SERVE_SPA`, `SPA_DIR` | Compose uses `true`, `/app/dist`; missing build fails startup. |
| `UPLOAD_DIR` | `/app/private/uploads`, private mounted volume. Never expose this as a static path. |
| `BUSINESS_TIMEZONE` | Default `Asia/Karachi`; determines operational date windows. |
| `REMINDER_INTERVAL_MS` | Default 60,000; restart-safe scans do not duplicate condition episodes. |
| `MORTALITY_ALERT_PERCENT` | Default demonstration threshold 2; not veterinary advice. |

For a non-container deployment, run `npm ci`, `npm --prefix server ci --omit=dev`, `npm run build`, configure server environment, and start `npm run start:server` behind one HTTPS proxy. Use an explicit persistent absolute `UPLOAD_DIR`; do not use Vite preview as the production server. Do not use `docker compose down -v` on an installation whose data must survive. Back up before upgrades; migrations apply on startup.
