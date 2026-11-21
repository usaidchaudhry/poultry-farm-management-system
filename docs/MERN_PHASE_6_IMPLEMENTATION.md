# LayerFlow MERN Phase 6 implementation

Implemented 22 November 2026. This document supersedes the Phase 4/5 deferred **feed** posting boundary. Egg production posting remains Phase 8. Earlier phase logs are historical records.

## Work completed

1. Read the MERN inventory requirements, previous implementation logs, hierarchy/report contracts, permissions, existing mock inventory screen, service patterns, and progress checklist.
2. Added inventory catalog, farm locations, cached balances, immutable movements, durable posting operations, and immutable report-feed publications in `server/src/modules/inventory/`.
3. Added repeatable collection/index migration `005-location-inventory`. Existing farms receive Main store and Egg collection room locations. New farms and explicit demo farms receive the same locations in their creation transaction. No quantities, catalog items, credentials, or historical consumption are fabricated.
4. Added strict validation, farm/organization/date policies, canonical-unit rules, opening stock, receipts, issues, signed adjustments, paired transfers, compensating reversals, thresholds, and reconciliation.
5. Made posting/reversal transactional with the existing access guard, conditional balance updates, historical running-balance validation, source uniqueness, durable retry keys, and audit attribution.
6. Connected report publication to the feed ledger in the same transaction as revisions, mortality, report state, and publication intent. Added refund/delta/location-change handling and source-only correction rules.
7. Added the asynchronous live Inventory screen and facade. Added scoped stock selectors to report forms and updated publication feedback. Explicit mock mode retains the historical inventory demo.
8. Extended API/database, concurrency, restart-persistence, and clean-browser verification. Updated README, repository guidance, and progress without changing historical checklists.

The existing modular MVC-style pattern continues: routes -> authorization/validation -> controllers -> services/policies -> Mongoose models. No dependencies were added.

## Data model and units

| Collection/model | Purpose and constraints |
| --- | --- |
| InventoryItem | Organization catalog; normalized unique name; category, canonical unit, active flag, optimistic version |
| StockLocation | Server-derived organization/site/farm; unique farm/name; store, collection, or other kind; active flag/version |
| StockBalance | Unique item/location; current integer-thousandths amount, location-specific minimum, optimistic version |
| StockMovement | Append-only signed thousandths, effective business date, frozen item/location names and unit, source key, actor/name, reason, optional report/revision or manual operation/reversal link |
| StockOperation | Durable actor/request-key uniqueness, validated payload fingerprint, movement IDs, original/reversal operation links |
| FeedPublication | Append-only unique report/revision; actual posted kg, selected item/location, movement IDs |

Feed and ingredients use kg. Eggs use whole counts. Other items declare kg, litre, count, ml, or g; automatic conversions are rejected. Decimal inputs accept at most three places and absolute quantities up to 1,000,000,000 base units. Stored integer thousandths avoid accumulated floating point errors; count quantities/minimums must be whole numbers. Each resulting location balance is bounded to the same maximum. API quantities/minimums are returned in base units, not stored thousandths.

Egg category exists to support the next ledger integration, but this phase does not publish report eggs or implement sales. Egg manual opening/adjustment/transfer and their reversals additionally require `egg-production.manage`. Generic receipt/issue cannot masquerade as egg production or sales.

Units/categories lock after the first movement. Names remain editable with versions, while movement evidence retains original labels. Items and locations cannot deactivate with stock remaining. Farm/site archive also checks remaining stock. Restore the context before posting new movements or compensating a report into an inactive source. Locations cannot move between farms.

Shared catalog creation requires inventory management. Editing existing organization-wide catalog definitions additionally requires company scope, preventing an assigned operator from changing another farm's shared definitions. Location and threshold changes remain available within the operator's farm scope. Role-name conditions are not used.

## Posting, permissions, and integrity

| Operation | Required grant / behavior |
| --- | --- |
| Catalog/location writes, thresholds | `inventory.manage`; versions for edits and thresholds |
| Receipt / manual issue | `inventory.manage`; positive quantity and reason |
| Opening / adjustment | `inventory.adjust`; opening must be first movement; adjustment is signed/nonzero |
| Transfer | `inventory.transfer`; both endpoints active, distinct, and independently scoped; equal negative/positive paired entries |
| Reversal | `inventory.adjust`; manual original only; transfer also requires transfer permission and access to both endpoints |
| Inventory reads / reconciliation | `inventory.view`; current balances independent of date-filtered history |
| Feed choices | Report manage or submit grant, scoped flock; catalog/location identities only, without balances/history |
| Report feed consumption | Existing report submit grant; Farm Manager needs no inventory write grant |

Every manual posting/reversal requires a 16-100 character `Idempotency-Key` header, normally a UUID. Source keys are generated on the server. The durable operation record has no TTL: same actor/key/input replays the original movement IDs, changed inputs return 409. Replays recheck current session, permission, source scope, and history visibility; a key is not authority. The browser preserves a key for an unchanged retry after a lost response. Changing the form payload creates a new key. Saving an entirely new form represents a new intentional operation.

All writes hold the existing access transaction guard, which coordinates scope revocation, hierarchy archive, and stock changes. Posting checks cached quantity against the complete ledger, validates the running balance ordered by business date and movement ID, and conditionally updates a balance with enough available quantity. Backdated insertion goes after already recorded movements on its business date and before later dates. A positive present balance alone cannot authorize an issue that makes an earlier or later historical balance negative. This course-project approach reads the affected pair's ledger rather than introducing distributed locks or inventory snapshots.

Transfers and reversals commit both sides or neither. A generic reversal appends compensating entries, links the original operation, and cannot repeat. Reversals themselves cannot be reversed; an explicit new authorized adjustment records a later correction. The reversal date cannot precede the original, and the original history must be visible. Report-generated movements can only change through report return/edit/resubmit. There is no movement edit/delete API.

Manual feed `issue` requires purpose `loss` or `dispatch`; consumption is exclusively report linked. Other supplies allow purpose `other`. Reasons are mandatory (3-1000 characters). Clients cannot supply actor, ancestors, source keys, report IDs, or arbitrary consumption links. These controls prevent the application from providing two consumption entry paths; they cannot determine whether a person falsely describes consumption as physical loss.

Future posting dates are rejected. Operational history uses the organization timezone and existing today/yesterday policy; `reports.history.view` allows bounded older queries/writes. Clinical history does not grant inventory history. Current balances reflect the entire ledger without revealing old reasons/actors. Scope applies to both transfer endpoints, filters, thresholds, reversals, reconciliation, and report feed locations.

## Daily-report feed contract and legacy data

`data.feed.itemReference` and `locationReference` retain their field names for snapshot compatibility. New positive-consumption submissions require real ObjectId references to an active **feed/kg** item and active non-collection location in the report farm. Descriptive legacy references remain readable/editable as draft evidence but cannot authorize a stock issue. The form offers the real choices and marks previous unavailable references explicitly. Bag conversion continues to use the report's explicit kg/bag; stock APIs never infer bag sizes.

For each submitted revision, the service compares the new amount against its last **actual FeedPublication**:

- First stock-enabled submission issues the full selected amount.
- Same item/location posts only the quantity delta, including refunds for reduced consumption.
- Item/location changes refund the previously posted pair and issue the new pair, even with unchanged kg.
- Zero consumption refunds prior consumption and records a zero publication without inventing an issue.
- Draft edits and returning a report leave the last effective consumption unchanged.
- Insufficient stock, an invalid reference, or historical negative balance rolls back the entire report publication, including revision, mortality, feed evidence, and audit.
- Repeated/stale submission is rejected by report version/state checks; unique report/revision/source indexes prevent duplicate evidence.

**Existing Phase 4/5 reports are not automatically charged.** Their descriptive snapshots and deferred intents stay immutable. There is no reliable way to infer their item/location or whether a physical opening already accounted for that use. An authorized user explicitly selects stock and submits a new revision; its first stock-enabled publication posts the full selected consumption. Check opening-stock effective dates before revising old reports. The form and report detail state this cutover rule. Historical feed backfill/mapping is not performed.

Each newly published report summary records `feedPublication` evidence, including movement IDs and whether the baseline was a legacy report. The old combined `PublicationIntent.status = deferred` continues to describe the outstanding **egg** side; its original feed-before/feed-after snapshots remain evidence. FeedPublication is the authority for feed completion. Old report revisions and intent documents are never rewritten.

## API contracts

All paths start `/api/v1/inventory`. Existing session, forced-password change, CSRF/origin, safe errors, and audit conventions apply. Lists return `{ data, meta }`; mutations return `{ data }`. Post/reverse return movement arrays.

| Method/path | Input or result |
| --- | --- |
| `GET /items` | Catalog; category/active/item filters, pagination |
| `POST /items` | `{ name, category, unit, active? }` |
| `PATCH /items/:id` | Full catalog values plus `version` |
| `GET /locations` | Scoped location list; farm/location/active filters |
| `POST /locations` | `{ farmId, name, kind? }` |
| `PATCH /locations/:id` | `{ name, active, version }` |
| `GET /balances` | Current per-location quantities/minimum/condition; farm/item/location/category and `low=true` filters |
| `PUT /thresholds` | `{ itemId, locationId, minimum, version }`; version 1 initializes a new zero pair; use returned balance version for changes |
| `GET /movements` | Scoped, date-filtered immutable evidence; farm/item/location/category filters |
| `POST /movements` | `{ type, itemId, locationId, quantity, unit, businessDate, reason, purpose?, destinationId? }`; retry header required |
| `POST /movements/:id/reverse` | `{ businessDate, reason }`; retry header required; either transfer leg reverses the pair |
| `GET /reconciliation` | Scoped cached-versus-ledger quantities and match flag |
| `GET /feed-options/:flockId` | Separate paginated item/location lists for report pickers; report permission rather than inventory-view permission |

Lists accept `page` (default 1) and `pageSize` (default 20, maximum 100). Movement `from`/`to` are valid business dates, defaulting to the caller's permitted window and bounded to 90 days. Unknown query/body fields and non-ID references are rejected. The UI fetches all picker pages asynchronously; table results remain paginated.

## Frontend walkthrough

1. Owner/authorized operator opens Inventory. Each farm already has Main store and Egg collection room; add a house store if useful.
2. Create an active catalog item with its canonical unit. Choose a permitted item/location and post a reasoned opening or receipt.
3. Balances shows current quantity and condition. Configure a minimum per item/location. A new threshold can register a zero-balance pair so out-of-stock is visible before a first receipt. Unconfigured catalog/location combinations are not assumed to represent stocked items.
4. Post issues, signed adjustments, or paired transfers with explicit dates/reasons. Select both endpoints from permitted locations. Movement history retains the source, revision, recording actor, and reason.
5. Use the reversal action on a manual movement to compensate its complete operation. Inspect reconciliation; mismatches block new postings for the affected pair. No silent repair rewrites cached or historical quantities.
6. Farm Manager selects an active feed item and farm store in the report, records bags/kg, saves, then submits. Stock deduction succeeds atomically or the report remains unpublished with an actionable error.
7. Return/edit/resubmit with a reason to correct consumption. Previous report and ledger evidence remain available under the caller's history policy.

## Verification

Results: **51 API/database checks passed**, **9 mock checks passed**, **clean-browser workflow passed**, and **production build passed**. Server syntax checks passed for 61 JavaScript files; documentation links and whitespace checks passed. Commands: `npm run test:server`, `npm test`, `npm run test:browser`, and `npm run build`. Final targeted checks also passed after tightening reconciliation to detect missing cached rows and adding same-location feed increase/refund cases.

The API scenarios cover the 100 receipt - 20 issue - 30 transfer example (50 source / 30 destination), compensating paired reversal, concurrent spending, unchanged/changed retry keys, wrong-farm denial, unavailable history, canonical-unit/precision rejection, historical running deficits, insufficient-stock rollback, thresholds, cache mismatch/missing cache rows, immutable evidence, and report delta/location/zero corrections. Restart verification includes stock balances/movements and feed publication markers. The browser walkthrough extends the prior phases with catalog creation, receipts/issues/transfers, reconciliation, real report selectors, feed deduction, and phone-width balances. No browser runtime errors or document-level mobile horizontal overflow were observed.

Desktop and phone screenshots were visually reviewed. Ignored local evidence includes `.data/verification/inventory-reconciliation-desktop.png` and `inventory-balances-mobile.png`. Test databases/accounts are isolated; no configured application database was reset. An initial schema validation failure incorrectly required a manual-operation reference on report-generated movements; that reference is now optional, with report source/revision retained and publication regression checks passing.

## Remaining boundaries

Phase 7 formulas/costing, Phase 8 egg publication/sales/finance, Phase 9 durable alerts/attachments, and later exports remain pending. Low-stock presentation is live; durable reminder delivery is Phase 9. Medication outcomes do not convert doses to stock. Manufacturing, batches/expiry, supplier masters, and medicine unit conversion remain outside this baseline. The serialized transaction guard and complete-pair running-ledger checks suit this course project; scaling those policies is future work.
