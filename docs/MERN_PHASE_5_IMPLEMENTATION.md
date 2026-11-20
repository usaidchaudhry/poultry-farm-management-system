# LayerFlow — MERN Phase 5 implementation

Date: 20 November 2026. Scope: Phase 5, M05/M06 of [LayerFlow_MERN_PRD.md](../LayerFlow_MERN_PRD.md), following the [Phase 4 implementation](MERN_PHASE_4_IMPLEMENTATION.md).

## Completed work

1. Read repository guidance, progress, clinical/prescription/administration requirements, hierarchy/archive rules, permissions, clinical history policy, Phase 4 models/services, and existing mock pages.
2. Added the clinical module: Mongoose models, strict schemas, schedule resolver, routes, controllers, service rules, and daily-report clinical-link validation. Existing transaction guards, scope policies, sessions, CSRF, and audit events are reused. No dependencies were added.
3. Added visits, versioned prescriptions, immutable task definitions with mutable resolution pointers, and separate append-only administration events. Added migration `004-clinical-administration` and supporting indexes.
4. Implemented visit entry/edit, optional existing bird-measurement link, multi-item prescription drafts, explicit daily times, bounded schedule preview, atomic finalization, and stable task keys.
5. Implemented independent completed/missed outcomes, explicit actual time/dose/instruction reference, delayed recording, immutable corrections, and prescriber denial on every outcome mutation.
6. Implemented draft cancellation, finalized cancellation/replacement, linked replacement versions, preservation of recorded and elapsed evidence, automatic resolution state, and archive guards.
7. Connected live Clinical and Medication pages, repeatable forms, schedule preview, open/history filters, detail/evidence views, mobile layouts, and optional daily-report visit/prescription/administration links.
8. Extended actual MongoDB/API, concurrency, timezone, full database-restart, and browser verification. Updated README, progress, and repository guidance.

The modular MVC-style structure remains: `server/src/modules/clinical/` contains models, validation, schedule logic, routes, controller, services, and report-link validation. React imports the live facade `src/services/clinicalService.js`. Historical mock pages remain available only in explicit mock mode.

## Models and integrity

Every record has server-derived organization/site/farm/house/flock references. Bodies accept a flock ID for a visit, never client-supplied alternate ancestors. Records use UTC timestamps and organization business dates separately.

| Collection | Stored information and constraints |
| --- | --- |
| `clinicalvisits` | Occurrence time/date, observations, required diagnosis, parameters, remarks, optional measurement reference, recording actor/name, optimistic version |
| `prescriptions` | Visit, sequence, previous/replacement references, original prescriber/name, finalizer/name, timezone, structured items, state/version, finalization/cancellation timestamps, reason; unique `(visitId, sequence)` |
| `medicationtasks` | Frozen item/occurrence identifiers, medicine/reference, dose/instructions, route/batch label, due UTC/business date/timezone, original prescriber, state/version, effective-event pointer, cancellation metadata; unique `(prescriptionId, itemKey, occurrenceKey)` |
| `administrationevents` | Task/prescription, numbered outcome, superseded-event reference, actual time/business date, actual dose/unit or instruction reference, comments/reason, recording actor/name/server time; unique `(taskId, number)` |

Indexes support scoped business-date visits, task state/due time, and closed-outcome dates. Migrations create collections/indexes repeatably and do not overwrite prior data, users, or edited role grants. No clinical data is fabricated by migration.

Task definitions are generated only from a saved prescription. There is no arbitrary create/edit/delete-task endpoint. Finalized prescription item content is never overwritten. Administration events have no update/delete endpoint and reject document-save overwrites. Application-level evidence protection is not a claim against database administrators.

## Visit and prescription policies

Visits require `clinical.manage`; reads require `clinical.view`. Scope applies independently of permissions. Visit times must be on/after flock placement and no later than now. Optional measurements must be accessible, from the same flock, and no later than the visit. The UI displays linked normalized weight/sample size and explicitly unavailable standards.

Visit identifying scope cannot change. A visit can be edited while it has no finalized/cancelled prescription evidence. Once an order leaves draft, the visit record is locked. The author and version remain attributable.

Each item has a stable client item key, medicine name/reference, optional positive dose value with unit, explicit instructions, `water`/`feed` route, start date, duration, daily clock times, and optional descriptive tank/feed-batch label. Supply a numeric dose with its unit or explicit instructions. The system never infers a dose. Duplicate item keys/times, invalid clock values, unknown fields, and unbounded schedules are rejected.

The original prescriber is the actor who creates the prescription draft and is retained on draft edits/finalization. A different authorized finalizer is recorded separately. Finalization cannot transfer ownership merely to bypass the original prescriber's administration restriction. A linked replacement is a new prescription with its own author/prescriber.

One initial prescription is allowed per visit. Use draft editing or the explicit replacement action afterward. A new unrelated treatment course after completion can use a new visit. Finalized items are immutable; cancellation/replacement changes lifecycle metadata and creates new records.

## Schedule rules

- Baseline recurrence: 1–8 items, 1–4 distinct `HH:mm` local times per item, 1–30 days. The maximum is 960 task occurrences per prescription.
- Start date must be on/after the visit and no more than 30 days after today's business date.
- Finalization cannot start a newly recorded course before yesterday, even for a role with historical clinical reads. Same-day/yesterday elapsed occurrences may be recorded for delayed documentation; older task generation is rejected.
- Times resolve in the organization's IANA timezone. The prescription and each task retain that timezone and exact UTC due instant; later timezone changes do not shift existing tasks.
- The resolver derives actual offsets with `Intl`, validates the resulting local clock time, and rejects nonexistent or ambiguous daylight-saving times instead of moving a dose silently.
- Preview returns the complete bounded occurrence set without writing tasks. The UI shows the timezone, total, and first 20 occurrences; changes to an item invalidate the preview.
- Finalization locks/version-checks the draft and inserts all tasks in the same transaction as state and audit updates. Repeated/stale/concurrent finalization requests cannot duplicate tasks; a stale version returns 409.

Drafts do not imply treatment started. Duration ending does not mark medication administered. Task timing is derived from server time: future = scheduled; due time through the next hour = due; at least one hour late = overdue. This one-hour display convention is a demonstration default, not a clinical protocol. Lists refresh every 30 seconds; detail/outcome writes recheck actual server state.

## Administration and corrections

Recording a first outcome requires `medication.administer`; correction requires `medication.correct`. **The task's original prescriber is always denied on both routes**, including protected Owner/all-permission accounts and after role changes. This is an actor identity check, separate from role permissions and farm scope.

An initial outcome is allowed only for an open task. Corrections are allowed only for completed/missed tasks, with a current version and reason. Cancelled tasks cannot receive outcomes. Concurrent/repeated requests commit one effective event and return conflicts for stale versions rather than duplicating evidence.

Completed requires an actual numeric dose/unit or explicit recorded instruction reference. Missed requires a reason and cannot contain a numeric administered dose or instruction reference claiming administration. Actual time must be on/after the scheduled occurrence and no later than server now. The form starts with blank actual-dose fields; prescribed values are not copied as assumed actual evidence.

Both actual event time and server recording time are retained. An ordinary administrator can resolve old open work with a genuinely current actual time under the operational-state exception. Backdating actual time before yesterday additionally requires correction permission and a reason; history-read permission alone is insufficient. First historical recording therefore needs both administration and correction grants. Corrections do not erase original time, actor, comments, or dose.

Each correction appends event number N+1 with `supersedesId` pointing to N, updates the task's effective pointer/state/version, and writes audit evidence atomically. The UI retains the original event and shows actual/recorded times and actor names. When every task is resolved, an active prescription becomes `completed`; this means all occurrences are resolved, and does not convert missed tasks into administered ones.

Administration does **not** issue inventory automatically. Dose-to-stock conversion remains undefined. Daily-report medicine/vaccine observations do not record task outcomes, even when they link an existing event.

## Cancellation and replacement

Both require `clinical.manage`, current prescription version, an active flock/parent chain, and a reason.

| Situation | Behavior |
| --- | --- |
| Draft cancellation | Cancel the draft, create no tasks, preserve the draft record |
| Finalized, no outcomes yet | Cancel all remaining open tasks, including elapsed ones; a replacement generates a linked finalized version |
| Any outcome recorded | Completed/missed tasks and events stay intact; only open tasks strictly in the future can be cancelled/replaced |
| Elapsed open task after an outcome | Remains actionable and must be resolved independently; it cannot be erased by replacing the prescription |
| Replacement after an outcome | Every new occurrence must be in the future; otherwise the transaction rolls back |
| No eligible future tasks | Reject cancellation/replacement rather than pretending past work was cancelled |

Replacement creates the next unique sequence, links both old/new versions, generates source-keyed new tasks, cancels eligible old tasks, and audits the operation in one transaction. Old item definitions remain unchanged. For a late completion on an elapsed task whose order was subsequently cancelled, actual administration must have occurred before cancellation; a missed outcome can still resolve the elapsed work.

Open medication tasks or draft prescriptions block flock archive. The existing active-child rules then protect ancestors. New clinical work, finalization, cancellation, and replacement reject archived context. A legacy open task can still be resolved without retrieving unrestricted source history; normal API archive guards prevent creating that inconsistency.

## Read history and scope

Clinical lists/details and prescription actions use the clinical date policy: ordinary access today/yesterday; `clinical.history.view` or `reports.history.view` enables older ranges of at most 90 days. Historical access never unlocks finalized content or backdated actual outcomes.

Medication has two views:

- **Current open work:** all scoped open tasks, including older overdue and bounded upcoming occurrences. It returns treatment instructions/prescriber/due context needed to act, without exposing visit diagnosis/observations. Date filters are not accepted for this view.
- **Closed outcome history:** completed/missed entries are selected by effective actual-event business date, cancellations by cancellation business date. This lets a current delayed outcome remain visible even when its original due date was old. Date restrictions apply to direct details too. Restricted event history omits older superseded event dates; authorized clinical history can inspect them.

Every list/detail/write intersects organization and assigned site/farm scope. Farm grants do not expose sibling farms. Supplied farm/flock filters must agree. Unknown/mismatched or hidden records are rejected before any write. Active scope and session/grants are reloaded inside the existing serialized transaction guard, coordinating concurrent assignments, outcomes, finalization, replacement, and archive.

## API contracts

Prefix `/api/v1`; prior cookie, password-change, CSRF/origin, strict body, safe error, and audit conventions apply. Lists use `{ data, meta }`; other successes use `{ data }`. Lists accept `from`, `to`, `farmId`, `flockId`, `page`, `pageSize` (maximum 100).

| Method and endpoint | Contract |
| --- | --- |
| `GET/POST /clinical-visits` | Scoped/date-filtered list or create `{ flockId, occurredAt, diagnosis, observations?, parameters?, remarks?, measurementId? }` |
| `GET/PATCH /clinical-visits/:id` | Detail with linked measurement summary and prescription versions; update visit fields plus `version` |
| `POST /clinical-visits/:id/schedule-preview` | `{ items }`; UTC occurrences and timezone; no writes |
| `POST /clinical-visits/:id/prescriptions` | `{ items }`; create initial draft |
| `PATCH /prescriptions/:id` | `{ version, items }`; draft content only |
| `POST /prescriptions/:id/finalize` | `{ version }`; transactional task generation |
| `POST /prescriptions/:id/cancel` | `{ version, reason }`; cancel eligible work |
| `POST /prescriptions/:id/replace` | `{ version, reason, items }`; linked finalized replacement |
| `GET /medication-tasks` | Adds `view=open|history` and appropriate `status` filter |
| `GET /medication-tasks/:id` | Minimal treatment context, effective outcome, authorized event evidence |
| `POST /medication-tasks/:id/outcomes` | `{ version, outcome, actualAt, actualDose?, doseUnit?, instructionReference?, comments?, reason? }` |
| `POST /medication-tasks/:id/corrections` | Same fields; correction permission, closed outcome and reason required |

Example item (demonstration instructions, not a treatment recommendation):

```json
{
  "key": "stable-item-alpha",
  "medicine": "Recorded medicine reference",
  "medicineReference": "Optional catalog or label note",
  "doseValue": null,
  "doseUnit": "",
  "instructions": "Explicit instructions recorded by the clinician",
  "route": "water",
  "startDate": "2026-11-20",
  "durationDays": 3,
  "times": ["08:00", "18:00"],
  "batchLabel": "Optional descriptive tank label"
}
```

Two such items at two times for three days produce 12 separate tasks, each uniquely keyed by prescription/item/local occurrence. The date in this example is illustrative; actual requests must satisfy the server date rules.

## Optional daily-report links

Phase 4 free-text reference notes remain supported. Reports now also accept `doctorVisitId`; each medicine/vaccine row may include `prescriptionId` and `administrationEventId`. The form offers accessible visits, prescription versions from the selected visit, and effective closed outcome events. Existing stored references remain selectable while editing. Candidate pickers are bounded to 100 records per request.

The server validates source organization/flock, relevant view permission, source date no later than the report, date-history access, and matching selected visit/prescription/event ancestry. A known source ID cannot bypass authorization. Clinical visit/prescription selectors require `clinical.view`; administration-event selectors require `medication.view`. The default Farm Manager can link medication evidence without gaining access to visit diagnoses; an Owner can add the broader clinical references. Referencing an existing event does not create another one or mark a dose administered. A report reader sees references/its own observations, not unrestricted linked clinical source content. Submitted snapshots retain their reference IDs.

## Frontend walkthrough

1. Owner assigns the Doctor and Farm Manager to the appropriate site/farm.
2. Doctor opens Clinical visits, records diagnosis/observations, and optionally links a preceding bird measurement.
3. Open the visit, create a prescription draft, add items, enter explicit start date/duration/daily times and dose/instructions, preview the schedule, and save the draft.
4. Review the draft and finalize. The Medication page shows generated occurrences; the Doctor's own tasks have no administration/correction action.
5. A different authorized staff member opens a due task, enters actual time and dose/unit or instruction reference, and records completed or missed with the required reason.
6. Inspect closed outcome history. An authorized non-prescriber may correct an outcome with a reason; earlier evidence remains visible.
7. A clinician can cancel or replace eligible future work with a reason. Open the visit to inspect linked prescription versions and Medication to inspect preserved outcomes.

The existing form, modal, table, toast, loading, error, and empty-state components are reused. Async responses are discarded after superseding selections; list errors support retry. Role-name branching is not used. Medicine labels and inventory references are descriptive; this phase provides recording workflows rather than automatic clinical decisions.

## Verification

Final results: **44 backend checks passed**, **9 mock checks passed**, **clean-browser workflow passed**, and **production build passed**. Commands: `npm run test:server`, `npm test`, `npm run test:browser`, and `npm run build`. Syntax checks passed for 56 server JavaScript files; documentation links and whitespace checks passed. Desktop clinical-prescription and phone-width administration screenshots were visually reviewed. Coverage includes:

- Two items × two times × three days = 12 tasks, preview without writes, locked visit/finalized content, unique keys and stale finalization rejection.
- Original prescriber remains blocked even when a different actor finalizes and the prescriber has administration/correction grants.
- Completed/missed validation, explicit dose/unit or instruction reference, reasons, actual/recorded times, future/early-time rejection, append-only superseding corrections and denied overwrite.
- Before/after-outcome replacement, preserved completed/elapsed work, future-only cancellation, cancelled-task denial, draft cancellation and completed-course resolution without false administration.
- Clinical history independent of operational report history, old open-task exception, historical actual-time correction policy, and scoped direct routes.
- Concurrent finalization/outcome requests generate one task set and one effective event; invalid operations roll back.
- UTC conversion and rejection of spring-forward/nonexistent and fall-back/ambiguous DST times.
- Daily-report clinical links validate scope/date/grants/ancestry and do not duplicate administration events.
- Full MongoDB restart preserves clinical visit, finalized prescription, all recurring tasks, independent administration event and its actor, plus earlier report/measurement/session evidence.
- Clean browser Doctor → Farm Manager → reviewer workflow: visit, two-item schedule preview/finalization, self restriction, actual administration at phone width, immutable correction, future replacement, scope revocation, and logout; earlier module regression checks remain included.

Screenshots are local ignored evidence under `.data/verification/`, including `clinical-prescription-desktop.png` and `medication-outcome-mobile.png`. Tests use isolated generated databases/accounts and do not seed/reset a configured application database.

## Remaining phases

Phase 6 inventory, Phase 7 feed formulas, Phase 8 egg/sales ledgers, Phase 9 image attachments/notifications, and later analytics/export features remain pending. No medication action automatically changes stock. The Phase 4 deferred egg/feed publication contract is unchanged. Supporting images remain a Phase 9 dependency; this phase stores clinical text, references, measurements, and administration evidence.
