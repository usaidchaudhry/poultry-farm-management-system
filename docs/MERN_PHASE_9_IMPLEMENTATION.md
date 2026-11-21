# MERN Phase 9: private evidence, medical alerts, and durable reminders

Implemented for LayerFlow on 22 November 2026. This phase extends the existing MVC API and live React pages. The Phase 8 workspace changes are preserved and included with this phase in the user-requested local commit; no remote push was performed.

## Delivered workflows

1. Save a daily report, clinical visit, expense, or medical alert. Open its details and attach images or attributed comments.
2. A Farm Manager raises a medical alert, choosing its farm and severity. The server selects recipients from current active accounts and assignments.
3. An assigned Doctor opens the inbox, marks only their own recipient record seen, acknowledges the shared alert, adds an attributed response, and resolves it with a note.
4. The API runs a reminder scan at startup and every configured interval. Low stock, overdue medication outcomes, pending formula costing, and demonstration mortality conditions produce persisted inbox entries.

The explicit `VITE_DATA_MODE=mock` demo remains separate. Live accounts use MongoDB and private server disk storage, with no browser-mock fallback.

## Architecture and files

The backend follows routes → authentication/validation → controllers → services/policies → Mongoose models. All human writes re-read the actor and permissions inside the existing access-control transaction guard. The worker uses the same guard as a system operation, without impersonating a user.

| Area | Implementation |
| --- | --- |
| Private files/comments | `server/src/modules/evidence/`: models, parent policy, disk adapter, service, controller, routes |
| Inbox and shared alerts | `server/src/modules/notifications/`: models, current-access policy, validation, service, controller, routes |
| Restart-safe scanning | `server/src/modules/notifications/worker.js`; lifecycle wired in `server/src/server.js` |
| Collections/indexes | Repeatable `008-evidence-alerts-reminders` migration; existing customized roles are preserved |
| Shared React evidence | `src/features/evidence/EvidencePanel.jsx` and adjacent CSS; API facade `src/services/evidenceService.js` |
| Live inbox | `src/pages/work/LiveNotificationsPage.jsx`, `src/services/notificationService.js`, live route registration and Topbar badge |
| Source navigation | Shared `useSourceRecord` hook on reports, medication and formulas; inventory URL filters |

No dependency was added. Uploads use one bounded raw image request per file rather than multipart form data. Existing Axios CSRF/session handling applies.

## Private evidence policy

Accepted declared MIME types are `image/jpeg`, `image/png`, and `image/webp`. The adapter verifies binary signatures and basic container boundaries against that declaration, rejects unsupported/mismatched bytes, caps each file at 5 MiB, and permits at most five retained, nondeleted images per parent. PNG checks include IHDR dimensions and the terminal IEND marker; JPEG checks its start/end markers; WebP checks its RIFF length and VP8 chunk family. These are signature/container checks, not full image decoding or an antivirus service.

The original filename is bounded and sanitized for display only. The disk adapter generates an exclusive UUID filename and restricts storage-key resolution to its generated basename format. MongoDB stores metadata and links; responses never expose disk paths or storage keys. Files have private filesystem permissions where supported. There is no static upload mount.

Every metadata read, image download, upload, comment, and deletion checks the current parent permission, organization/farm scope, and applicable business-date rule. A copied URL conveys no authority. Inactive/reassigned users and revoked permissions cannot reuse an old URL to bypass those checks. Closed alert history follows report/clinical history permissions; open alerts stay actionable without unlocking old source reports or visits.

| Parent type | Read / write grants | Editable evidence state |
| --- | --- | --- |
| `report` | `daily-reports.view` / `daily-reports.manage` | Draft or returned report |
| `clinical-visit` | `clinical.view` / `clinical.manage` | No finalized or cancelled prescription evidence |
| `expense` | `finance.view` / `finance.manage` | Active expense; its posted money/content remains immutable |
| `alert` | `notifications.view` plus recipient membership / `notifications.raise` or `notifications.respond` | Medical alert not resolved |

Reports support `general` and `post-mortem` image purposes, sharing the same five-image parent limit. Other parents use `general`. A parent must already exist; forms explain that it must be saved before attachment.

Report submission seals all attached images in the same database transaction as the report publication. A returned report cannot delete previously submitted images. Clinical prescription locks, voided/replaced expenses, and resolved alerts retain their evidence. Draft deletion is restricted to the uploader, requires the parent to remain editable, creates a tombstone immediately, and writes an audit event. Its disk deletion is retried by cleanup if necessary. Comments are append-only, author/time attributed, limited to 2,000 characters and 500 per parent, and can be added only while the parent is editable. Evidence changes have their own audit trail; they do not change report totals or rewrite posted expenses.

Revision views label the evidence panel as **retained parent evidence**, which can include later additions. It is not presented as a historical image snapshot of that revision. Published report totals and earlier revision data remain immutable.

### Storage consistency and deployment

`UPLOAD_DIR` defaults to `../.data/uploads` when starting the API from `server/`. Use an absolute path in deployment. This directory must be on a private persistent disk mounted across process/container restarts. Back it up together with MongoDB; an ephemeral filesystem is not a valid deployment for this adapter. Multiple API instances must share the same private disk. A private object-storage implementation can replace the storage adapter later.

The service writes an exclusive generated file, then rechecks authorization, parent state, and limits inside the guarded linking transaction. A confirmed failed link deletes that file; an uncertain commit acknowledgement leaves it for later metadata-aware cleanup. A crash between the filesystem write and MongoDB link can leave an orphan, so the worker removes generated files older than one hour only when no live metadata references them. The grace period protects in-flight writes and transaction retries. Unrecognized filenames are left alone. Deleted metadata denies access immediately, even if disk cleanup has not finished. Missing private storage returns `FILE_UNAVAILABLE` and does not fabricate evidence.

## Medical-alert lifecycle and recipient routing

Supported severities are `info`, `reminder`, `warning`, `critical`, and `emergency`. The server generates organization, farm ancestry, business date, creator, source path, and recipient records. The client cannot nominate recipients or submit an actor/role.

Routing uses capabilities and scope rather than UI role-name checks:

- Assigned clinicians have `clinical.manage`, `notifications.respond`, and `notifications.view`, with an assignment to the farm or its site.
- Company management with `notifications.resolve` and `notifications.view` receives medical alerts, as does the authorized raiser.
- If no assigned clinician is available, the protected Owner is included explicitly. The response and UI state `doctorCount: 0` and `ownerFallback: true`; they do not imply that a Doctor received it.
- Only active accounts that completed their temporary-password change are eligible for operational inbox delivery.

These predicates preserve the default Doctor, Farm Manager, Owner and Production Manager workflows while supporting custom roles. The worker adds eligible newly assigned recipients to still-open medical alerts on its next scan. The initial Doctor count/fallback fields remain a creation-time routing snapshot. Recipient membership never overrides current scope or permission revocation.

Shared state is `open` → `acknowledged` → `resolved`. Acknowledging records both the shared first acknowledgement and that recipient's acknowledgement. A response is a separate immutable attributed event; it does not silently resolve an alert. Response/resolution notes must contain at least three characters. Critical/emergency resolution requires a previous shared acknowledgement. All medical actions check optimistic `version`; stale concurrent actions return 409 and the UI provides Refresh alert. Closed alerts reject further actions/evidence edits.

Each recipient has their own `deliveredToInboxAt`, `seenAt`, and `acknowledgedAt`. Opening an alert marks only that user's inbox record seen. A shared resolution does not mark every recipient seen or acknowledged. Clinical-capability attribution is stored with response events; a notification response does not create a prescription or record medication administration.

Delivery means a durable LayerFlow inbox entry. No SMS, email, external push, WebSocket service, or outside delivery acknowledgement is claimed.

## Durable reminder rules

The API starts one nonoverlapping scan loop, waits for it during shutdown, logs safe failure metadata, and retries on its next interval. Independent processes serialize scans using the same MongoDB guard, so concurrent/restarted scans reuse the open source episode. A unique persisted episode key and existing open `activeKey` track delivery. No external queue platform is required.

| Kind | Trigger / authorized recipients | Clearing behavior |
| --- | --- | --- |
| `low-stock` | Active item/location balance with positive configured minimum and amount below it; recipients also need `inventory.view` | Threshold/balance/item/location/farm condition no longer applies |
| `overdue-medication` | Open task overdue by more than one hour; recipients also need `medication.view` | Actual source task becomes completed, missed, or cancelled |
| `awaiting-costing` | Formula version in `pending_costing`; recipients also need `feed-formulas.cost` | Version is returned or finalized |
| `mortality` | Published report's mortality percentage meets `MORTALITY_ALERT_PERCENT`; recipients also need `daily-reports.view` | Published correction falls below threshold or farm context is archived |

All recipients additionally require `notifications.view` and current farm/site/company scope. Reminder messages contain minimal source information, without copied diagnoses, confidential formula prices, or treatment recommendations. Source links open the exact task/formula/report or stock pair and retain that source's original permission/date policy.

An unchanged condition produces no new reminder on each poll or restart. Clearing it resolves the generated entry with an attributed system event; a later low-stock recurrence creates a new episode. Users resolve generated reminders through their source workflow, not by a fake clinical resolution. Medical alerts are never auto-resolved by scanning. Mortality uses the published summary even while a correction is a draft, and is explicitly a configured **demonstration rule**, not veterinary advice.

The worker performs a complete scan in one guarded transaction, appropriate for this course-project dataset. A large deployment should partition scans and introduce durable batch cursors before increasing dataset size. Optional missing-report reminders and external delivery remain outside this phase.

## API contract

All paths have `/api/v1` prefix, require an authenticated password-changed session, and require CSRF for writes. JSON writes use strict validation. Success envelopes follow the existing `{ data }` and `{ data, meta }` conventions.

| Method / path | Input / result |
| --- | --- |
| `GET /evidence/:type/:parentId` | `{ editable, files, comments }`; metadata only |
| `POST /evidence/:type/:parentId/files?name=...&purpose=general` | Raw binary body with accepted image Content-Type; 201 metadata |
| `GET /evidence/files/:id` | Authorized private image bytes; no-store, nosniff |
| `DELETE /evidence/files/:id` | Authorized own unsealed draft deletion |
| `POST /evidence/:type/:parentId/comments` | `{ text }`; 201 attributed comment |
| `GET /notifications` | `farmId`, `status`, `kind`, `severity`, `view=current|history`, `page`, `pageSize`; recipient-specific paginated inbox |
| `GET /notifications/unread` | `{ count }` of unseen entries currently permitted, including permitted closed history |
| `POST /notifications` | `{ farmId, title, message, severity }`; 201 medical alert with routing result |
| `GET /notifications/:id` | Shared alert, own inbox state, attributed events |
| `POST /notifications/:id/seen` | `{}`; idempotently mark only own inbox seen |
| `POST /notifications/:id/acknowledge` | `{ version, note? }` |
| `POST /notifications/:id/respond` | `{ version, note }` |
| `POST /notifications/:id/resolve` | `{ version, note }`; critical/emergency acknowledgement guard |

`view=current` defaults to unresolved work, including older actionable alerts. Explicit `status=resolved` or history includes only dates the actor may read. Permission/scope/history filtering also applies to unread counts and direct details. Lists never silently return inaccessible saved recipients.

## UI behavior

The shared panel supports upload, generated authenticated previews, own draft deletion, comments, retained-evidence labels, loading/error/retry states and object-URL cleanup. It appears on report, clinical, expense and manual medical-alert details. Closed parents retain readable files. The notification page has farm, source, severity, state and current/history filters, pagination, manual refresh, raise-alert form, shared event history and permission-controlled actions. The Topbar bell shows the live unread count.

Inbox and badge polling run every 30 seconds and refresh when the page becomes visible. Writes notify the badge immediately. Hidden tabs skip polling requests. Failed badge loads clear the stale count; the inbox exposes a retryable error. Permission checks are server-authoritative and use existing API/toast/loading patterns and plain CSS.

## Configuration and verification

| Setting | Default |
| --- | --- |
| `UPLOAD_DIR` | `../.data/uploads`, private persistent disk |
| `REMINDER_INTERVAL_MS` | 60,000; integer 1–3,600,000 |
| `MORTALITY_ALERT_PERCENT` | 2; finite percentage greater than 0 and at most 100; demonstration only |

API verification covers signature mismatch/malformed/oversized uploads, five-image cap, failed-link cleanup, unauthorized/cross-farm downloads, comments, own deletion, sealed returned reports, clinical/expense locks, revoked clinical history, orphan cleanup, routing/fallback, independent seen/acknowledged state, response/resolution validation, stale versions, scope revocation, concurrent reminder scans, condition clearing/reopening, and actual medication-outcome clearing. Tests use generated private upload directories and isolated MongoDB databases.

The persistence test stops and restarts MongoDB and recreates the Express app, then checks the original authenticated image bytes, stored alert acknowledgement/seen state, recipient count, and existing Phase 0–8 evidence. The browser workflow exercises the Farm Manager's private image/comment and mobile medical alert, followed by a separate Doctor's acknowledgement, attributed response, and critical resolution. Screenshots are ignored artifacts under `.data/verification/`.

Final verification results are recorded in `PROGRESS.md`. No live accounts, credentials, or operational data are seeded by these checks.

Verification also corrected private-file serving under the hidden `.data` root, prevented response/comment text edits during pending saves, isolated test uploads from application storage, and preserved linked files when a database commit acknowledgement is uncertain.

Final results: **69 backend checks**, **9 mock checks**, the full headless Edge browser workflow, the production build, **85 server syntax checks**, local documentation links and whitespace checks passed. The final focused evidence checks passed after the storage-recovery and archived-context changes. The browser run confirmed image decoding, separate Doctor response/critical resolution, scope revocation and logout with no runtime errors. Phases 8 and 9 are included together in the user-requested local commit; no remote push was performed.
