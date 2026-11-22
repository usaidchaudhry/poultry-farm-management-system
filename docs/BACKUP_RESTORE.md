# Database and private evidence recovery

Back up MongoDB and its referenced image bytes together. The application command writes a new private bundle containing `database.ejson`, `manifest.json` and `files/`. Canonical Extended JSON preserves ObjectIds, dates and Decimal128 monetary values; indexes and durable retry/source records are retained. SHA-256 checks cover database content and each file. Checksums detect corruption, not malicious replacement of both data and manifest.

## Local commands

With the API's private configuration in `server/.env`, choose a **new** absolute directory:

```powershell
npm run db:backup -- C:/private-layerflow-backups/backup-2026-11-22
```

The command serializes critical business mutations using the existing transaction guard while reading a database snapshot and copying retained linked files. For a quiet, reproducible demonstration, stop API traffic and reminder workers first. The backup command opens its own database connection and does not require the HTTP server. Missing/incomplete linked files fail the backup. A failed destination is left for inspection; use a new destination for a retry.

Restore into a **separate empty replica-set database** and a **new upload directory**:

```powershell
$env:RESTORE_MONGODB_URI='mongodb://127.0.0.1:27017/layerflow_recovered?replicaSet=layerflow'
$env:RESTORE_UPLOAD_DIR='C:/private-layerflow-recovery/uploads'
npm run db:restore -- C:/private-layerflow-backups/backup-2026-11-22
Remove-Item Env:RESTORE_MONGODB_URI
Remove-Item Env:RESTORE_UPLOAD_DIR
```

All checksums and file/database links are checked before target writes. A nonempty target database is refused; no existing records are dropped or overwritten. File destination creation is exclusive. Documents are inserted transactionally after creating collections/indexes. If infrastructure fails after creating target directories/collections, inspect the failed target and retry with another empty database/new directory; do not treat a partial attempt as a completed recovery.

After success, stop the old API, point `MONGODB_URI` and `UPLOAD_DIR` to the recovered pair, run `npm run db:check`, then start the API. Reauthenticate: sessions are intentionally excluded. Compare a submitted report, sale/expense totals, finalized formula, notification state and image bytes before accepting the recovered installation. Keep the old source unchanged until this succeeds.

## Container commands

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml exec app node src/scripts/backup.js create /app/private/backups/backup-2026-11-22
```

Copy the complete bundle off the host into protected storage. Configure the separate recovery URI privately and run the same restore CLI with `RESTORE_MONGODB_URI`/`RESTORE_UPLOAD_DIR` set in the operator environment. The recovery upload destination must be on a persistent mounted disk; update the container's mount/configuration when switching to it. Do not restore into the running source database.

## Scope and proof

Bundles contain account password hashes and private operational/clinical records. They contain no live sessions, environment files or session secret. Restrict access and encrypt offsite storage. POSIX modes are 0700/0600; Windows operators must apply equivalent ACLs.

This in-memory logical backup is suitable for the course dataset, subject to MongoDB transaction duration and process memory. It is not point-in-time recovery or a managed production backup platform. Larger deployments should use infrastructure/managed backups with a coordinated private-file snapshot; see [MongoDB backup and restore guidance](https://www.mongodb.com/docs/manual/tutorial/backup-and-restore-tools/).

`npm run test:server` exercises an actual MongoDB shutdown/restart and restores records/files to a fresh database. `npm run test:release` starts the production API against that restored pair and verifies login, financial totals and private image retrieval. Both operate only on their generated isolated fixtures.
