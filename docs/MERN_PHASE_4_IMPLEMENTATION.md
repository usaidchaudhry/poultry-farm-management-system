# LayerFlow — MERN Phase 4 implementation

Date: 20 November 2026. Requirements: Phase 4, M03, and M04 of [LayerFlow_MERN_PRD.md](../LayerFlow_MERN_PRD.md). Prerequisite: [Phase 3](MERN_PHASE_3_IMPLEMENTATION.md). This change implements the Phase 4 interim gate; physical egg/feed stock posting remains dependent on Phases 6 and 8.

## What was implemented

1. Inspected repository guidance, progress, report/measurement requirements, existing mock work pages, live hierarchy/access services, date policies, decimal helpers, and verification scripts.
2. Added a reports module using Mongoose models, strict Zod validation, route middleware, controllers, service rules, existing access transactions, and server audit events. No dependencies were added.
3. Added unique flock/date reports, immutable numbered submission snapshots, append-only bird movements, measurements, and deferred production/feed publication intents.
4. Added migration `003-reports-and-population`, including repeatable opening-movement backfill for existing flocks. New flock creation and optional demo seeding now create their opening movement atomically.
5. Added draft save, submission validation, return/reason, correction/resubmission, optimistic versions, population calculations, date/scope checks, and source-keyed mortality/production effects.
6. Added approved placement, signed adjustment, and counted-opening reconciliation entries, gap detection, dependent-report correction protection, and current-population capacity enforcement.
7. Added normalized bird measurements, sample-size-weighted summaries, preceding-sample differences, optional report links, and explicit unavailable standards.
8. Added live React report list/form/detail/revision views, Mortality as published-report data, Bird parameters, existing service/error/loading/empty patterns, phone-width layouts, and farm/date filters.
9. Added actual MongoDB/API, concurrency, migration, full database-restart, and clean-browser workflow checks. Updated README, progress, and repository guidance.

The modular MVC-style architecture is retained. `server/src/modules/reports/` contains `models.js`, `validation.js`, `routes.js`, `controller.js`, and `service.js`. React pages use `src/services/reportService.js`; API pages never call the browser mock work service. Explicit mock mode retains the historical demo pages.

## Data model

All records carry server-derived organization/site/farm/house/flock references. Client report identity accepts only flock/date; alternate ancestor fields are rejected. UTC timestamps and actor references are stored separately from the organization's business date.

| Collection | Purpose and constraints |
| --- | --- |
| `dailyreports` | One logical record per `(flockId, businessDate)`, current draft data/summary, status, version, effective published summary/revision, return reason, creator/updater identity |
| `reportrevisions` | Numbered immutable data/calculation snapshots, submission reason, actor name/ID, time; unique `(reportId, number)` |
| `birdmovements` | Immutable signed opening, placement, adjustment, reconciliation, and revision mortality effects; unique `sourceKey` |
| `birdmeasurements` | Independent timestamped samples, positive size/weight, original unit/value, normalized grams, notes, actor; no uniqueness by date because multiple samples are valid |
| `publicationintents` | One deferred production/feed effect per report revision, category deltas, feed before/after references and quantities; unique `sourceKey` |

Evidence collections have no update/delete API. Document saves reject edits to existing evidence. This is application-level append-only behavior, not protection against a database administrator. Report drafts are mutable with version checks; published snapshots are not overwritten.

Indexes support organization/farm/business-date and flock/measurement-time reads. Existing role definitions, identities, and hierarchy data are preserved by migration. The migration marker and opening source key prevent duplicate flock openings on restart.

## Report structure and adopted validation

| Section | Fields and behavior |
| --- | --- |
| Identity | Flock, business date, derived ancestors, recording/updating staff, age days/week when age at placement is known |
| Eggs | Jumbo, Starter, Standard, Small, Floor, Broken, Discard; disjoint nonnegative integer counts |
| Egg weight | Repeatable single-egg/tray observations, positive value, g/kg; nine empty initial form slots, add/remove support |
| Population | Derived opening, approved movement changes, available, mortality, closing, gap/prior-report context |
| Feed | Item/location reference text, bags, recorded bag size kg, additional kg, notes; server total/per-bird calculation |
| Environment | Water litres, light hours between 0 and 24, in-house observations |
| Medicine/vaccine | Repeatable name, optional nonnegative quantity, unit, reference note |
| Health/visits | Post-mortem observations, comments, operational issues, doctor-visit reference note/remarks, optional Per Pe note |
| Bird weight | Optional existing measurement ID; same flock, no later than the report date, accessible under measurement date policy; link does not create another measurement |

Drafts may omit numeric sections. Omitted values remain `null`, rather than becoming zero. Submission requires explicit values for every egg category, mortality, bags, bag size, additional kg, water, and light. Zero is accepted. Positive feed use also requires item/location references; positive bag count requires a positive bag size. Medicine/vaccine names are required for rows that the user adds; quantity can remain unknown.

The server rejects negative eggs/birds/feed/water, fractional egg or mortality counts, light over 24, invalid dates, reports before flock placement, mortality above available birds, and client-supplied opening/closing totals. Numeric and array/text limits bound requests. Blank egg sample slots are omitted; entered samples retain type/value/unit. Draft totals are previews over known inputs; missing required input values remain null and block submission.

No clinical meaning is inferred from post-mortem text. Actual prescription/visit links arrive with Phase 5, and image attachments arrive with Phase 9. The current reference fields are explicitly notes rather than claimed validated clinical links. Feed item/location references are descriptive interim identifiers until the inventory catalog exists.

## Calculations

- Collected eggs: sum of seven categories. Saleable eggs: Jumbo + Starter + Standard + Small. This policy is recorded with the snapshot.
- Peti equivalent: collected eggs / 360, rounded for display. Integer category counts remain authoritative.
- Feed kg: bags × recorded bag size kg + additional kg. Decimal arithmetic is used; derived display quantities are rounded to three decimals.
- Feed per bird: feed kg × 1000 / opening birds. Mortality percentage and demonstration production percentage also use opening birds. A zero denominator returns `null`/Unavailable.
- Egg sample weights normalize kg to grams. Averages are separated by single-egg/tray type; unlike sample types are never pooled.
- Age is placement age plus elapsed calendar days. Unknown placement age produces unavailable age/week, never a fabricated week.
- Bird measurement values normalize to grams at three decimals. Values that round to zero grams are rejected. Multiple-observation summaries use `sum(grams × sampleSize) / sum(sampleSize)`.
- Weight differences compare the preceding observation for the same flock within the authorized comparison window. They do not sum average weights or expose restricted older samples. Approved strain/age targets are absent, so standard and variance remain unavailable.

## Population and report lifecycle

Initial flock placement creates `flock:<flockId>:opening`. Parents and placement baseline remain immutable. The report opening is the previous published report's closing balance, or the initial baseline when there is no preceding report, plus authorized intervening movements. Same-day placements/adjustments are shown separately. Returned reports still have an effective published closing balance.

A missing day breaks assumed continuity. Submitting a report after such a gap requires a reconciliation on that business date. Reconciliation input is a physical **available-bird target before the report's mortality**, not an arbitrary opening override. The server records the signed difference from the existing calculated population and keeps the reason. Placements are positive; adjustments are nonzero signed integers; reconciliation targets are nonnegative. Resulting population cannot be negative or exceed house capacity.

Population writes require `bird-population.manage`, a date, and a reason. They cannot be inserted on/before an existing published report that would depend on the change. All critical writes use the same transaction guard as scope changes, reload the actor, and recheck permissions/session/scope before committing.

Lifecycle:

1. Save a versioned draft. One flock/date index prevents a second logical report.
2. Submit a complete valid draft. Create a numbered snapshot, revision mortality delta, deferred publication intent, report state update, and audit event in one transaction.
3. A reviewer returns a submitted report with a reason. The published snapshot/population/production intent remains effective.
4. Edit the returned draft using the current version. A reason is required when resubmitting a correction.
5. Resubmit as the next numbered revision. Mortality and production/feed effects record only the change from the preceding published revision.

Submitted reports cannot be edited directly. Stale versions return 409. Concurrent submissions of the same version commit one revision/effect/intent; the other receives a conflict. A retried stale submit cannot post production twice.

If a population-changing correction would affect any later report, resubmission is blocked with `DEPENDENT_POPULATION`. A first submission inserted at an earlier date is also blocked if its mortality would change a later report's population. Descriptive corrections that keep closing birds unchanged remain possible. Advanced chained correction is not part of the baseline.

Draft population previews can become stale after an authorized movement. Detail re-evaluates the preview and keeps an invalidated draft readable/editable, while submission still rejects its invalid counts. House capacity edits/restores now use the movement balance rather than the original placement count. Draft/returned reports prevent flock archiving; active children consequently prevent ancestor archiving. Archived context rejects new reports, measurements, movements, submissions, and review returns.

## API and permissions

Prefix `/api/v1`; cookie authentication, mandatory password change, CSRF/origin checks, safe errors, strict bodies, and server audit rules from earlier phases apply.

| Method and endpoint | Contract / permission |
| --- | --- |
| `GET /daily-reports` | Paged scoped list; `daily-reports.view` |
| `POST /daily-reports` | `{ flockId, businessDate, data, reason? }`; `daily-reports.manage` |
| `GET /daily-reports/:id` | Current data/calculations, immutable revisions, movement evidence, publication intents; `daily-reports.view` |
| `PATCH /daily-reports/:id` | `{ version, data, reason? }`; `daily-reports.manage` |
| `POST /daily-reports/:id/submit` | `{ version, reason? }`; `daily-reports.submit` |
| `POST /daily-reports/:id/return` | `{ version, reason }`; `daily-reports.review` |
| `GET /mortality` | Published reports with mortality > 0, including effective published data while a correction is returned; `mortality.view` |
| `GET /flocks/:id/population?date=YYYY-MM-DD` | Derived population/gap/movement context; `daily-reports.view` or `bird-population.manage` |
| `POST /flocks/:id/population-adjustments` | `{ businessDate, type, count, reason }`; `bird-population.manage` |
| `GET /bird-measurements` | Paged normalized observations and weighted summary; `bird-parameters.view` |
| `GET /bird-measurements/:id` | Scoped/date-checked immutable observation; `bird-parameters.view` |
| `POST /bird-measurements` | `{ flockId, measuredAt, sampleSize, averageWeight, unit, notes? }`; `bird-parameters.manage` |

Lists accept only `from`, `to`, `siteId`, `farmId`, `houseId`, `flockId`, `page`, and `pageSize` (maximum 100). Supplied ancestor filters must match. Lists return `{ data, meta }` with authorized range, today's organization business date, page, page size, and total. Measurement metadata also includes total sample size and weighted average. Other successes use `{ data }`.

Reads and writes use real assigned-farm/site scope. Hidden details and unauthorized farm filters return 404. Detail access checks the report date before exposing any revisions. Ordinary operational access is limited to today and yesterday. `reports.history.view` permits historical ranges of up to 90 days; `clinical.history.view` also permits measurement history. Older report/population writes additionally require `daily-reports.correct-history` and a reason. Company scope alone does not bypass date or permission checks. Population context exposes the derived current balance and same-day movement evidence, rather than unrestricted historical movement reasons. Linked weekly information already recorded in an authorized report is part of that report's evidence.

Measurement times are UTC instants, with business dates derived in the organization's timezone. Future measurement times/dates and times before placement are rejected. Measurement creation is append-only, without automatic mutation retry; separate POSTs intentionally create separate observations. The UI does not fabricate a standards table.

## Deferred stock-publication contract

Keys:

```text
flock:<flockId>:opening
report:<reportId>:revision:<number>:mortality
report:<reportId>:revision:<number>:production-feed
```

Each submitted revision creates one publication intent with `status: deferred`, current/previous revision numbers, seven signed egg deltas, feed kg delta, feed before/after reference data, and scope/date. A zero mortality delta needs no new bird effect. A changed feed item/location remains visible in the before/after payload even when net kg is unchanged.

There is no inventory ledger, saleable-stock balance, reservation check, or stock posting consumer in Phase 4. Therefore a submitted report is **not a claim that feed was deducted or eggs are available to sell**. The detail UI says stock posting is pending. Negative-stock correction checks cannot be completed until those ledgers exist.

Phases 6/8 must consume source keys idempotently, resolve catalog/location references, apply category/location deltas transactionally, reject negative stock effects, and mark actual posting state. They must also enforce that check synchronously in subsequent correction submissions. Drafts/returns must never post again or reverse previously published effects merely because editing begins. This explicit dependency is the PRD's interim gate, not an omitted Phase 4 claim.

## Frontend workflow

1. Select a farm/flock or use the flock filter, then open **Bird parameters** to record a timestamped sample in g/kg.
2. Open **Daily reports → New daily report**. Pick the flock and business date. Opening birds are read-only server context.
3. If a gap exists, an authorized population manager can expand **Record an approved population entry**, enter the counted available birds and reason, and record reconciliation. Farm Managers cannot use that control.
4. Enter draft values. Add medicine/vaccine or egg sample rows as needed, and optionally link an accessible current/earlier bird measurement. Save draft.
5. Open the saved report, check calculated values, and submit. Missing required values produce actionable errors.
6. A reviewer opens the report, enters a reason, and chooses **Return for correction**. The manager edits the returned draft, then resubmits with a correction reason.
7. Use **Revision 1**, **Revision 2**, etc. to inspect preserved evidence. **Mortality** shows the latest published positive-mortality record; zero-mortality health concerns remain in Daily reports.

Async lists/forms/details use loading, error, empty, toast, and stale-request guards. Numeric blanks stay blank until explicitly supplied. The existing farm context remains the source of permitted selection options. Tables use contained horizontal scrolling at phone width; mortality count is prioritized ahead of wider observations. Views and controls check permission codes, not role-name branches.

## Verification

Final results: **32 backend checks passed**, **9 mock checks passed**, **clean-browser workflow passed**, and **production build passed**. Commands: `npm run test:server`, `npm test`, `npm run test:browser`, and `npm run build`. Syntax checks passed for 49 server JavaScript files; documentation links and whitespace checks passed. Desktop report and phone-width mortality/measurement evidence was visually reviewed. Coverage includes:

- Actual MongoDB/API workflow with calculated totals, draft blanks, invalid values/dates, duplicate flock/date, locked/stale writes, required reasons, immutable revisions, effective published mortality while returned, and source deltas.
- Concurrent submissions commit exactly one snapshot, mortality movement, and publication intent.
- Missing-day reconciliation, placement/adjustment trail, one-time opening migration, dependent correction blocking, descriptive corrections, unavailable zero-denominator calculations, changed-draft readability, capacity, archive guards, and unauthorized reviewer/population actions.
- Measurement g/kg equivalence, sample-size weighting, preceding comparison, distinct sample identities, report-link validation, missing standards, date restrictions, and hidden-farm denial.
- Full MongoDB restart preserves submitted report/snapshot, linked normalized measurement, bird movements, deferred intent, hierarchy, assignments, and authenticated session.
- Clean-browser Owner/Farm Manager workflow covers measurement entry, nine initial egg sample slots, incomplete draft rejection at submission, repeatable medicine/vaccine entry, submit/return/correct/resubmit, original snapshot, and published Mortality on phone width.
- Earlier identity, organization, assignment revocation, logout, mock-mode service checks, build, syntax, and documentation regressions remain part of verification.

Screenshots are local ignored evidence under `.data/verification/`: `daily-report-desktop.png`, `measurements-mobile.png`, `mortality-mobile.png`, plus the previous administration/organization screenshots. No real configured account or application database was seeded or reset during testing.

## Remaining work

Phase 5 clinical visits/prescriptions/tasks, Phases 6/8 real inventory/egg posting, Phase 9 uploads, and later analytics/export modules remain pending. The original mock completion checkboxes do not imply those modules are live. Population history is intentionally conservative: there is no cross-flock transfer, direct opening edit, deletion of movements, or automatic chained historical correction.
