# LayerFlow MERN Phase 8 implementation

Date: 22 November 2026. Scope: MERN Phase 8, M09/M10 and the remaining egg side of daily-report publication in [LayerFlow_MERN_PRD.md](../LayerFlow_MERN_PRD.md). Dependencies: [report revisions](MERN_PHASE_4_IMPLEMENTATION.md), [stock ledger](MERN_PHASE_6_IMPLEMENTATION.md), and [formula costing boundary](MERN_PHASE_7_IMPLEMENTATION.md).

## Completed work

1. Reviewed the PRD, repository guidance, prior publication/stock/access contracts, existing mock production/sales/finance pages, decimal helpers, and progress checklist.
2. Added a modular MVC-style commerce feature with models, strict validation, controllers, routes, setup, publication, sales, expenses, and financial summary services. Reused the existing transaction guard, scope/date policy, stock ledger, audit, and decimal dependency.
3. Added repeatable migration `007-eggs-sales-finance`, system egg-category catalog identities, farm saleability/collection configuration, immutable egg-publication evidence, posted sales, expense records/source claims, and durable request deduplication.
4. Completed transactional report egg publication and revision deltas. Added explicit legacy initialization without silently treating historical collections as today's physical opening stock. Submitted revision intents now record `posted`; earlier intents remain unchanged.
5. Implemented multi-line whole-egg/Peti sales, exact selected-unit prices, stock deductions, payment updates, dispatch recording, and pre-dispatch cancellation with compensating movements.
6. Implemented controlled expenses, positive decimal amounts, duplicate source/reference protection, void-and-replacement, daily recorded revenue/cost/surplus, unpaid value, and paginated source drill-down.
7. Connected live Egg production, Sales, and Finance screens with asynchronous loading, filters, detail evidence, stock choices, forms, pagination, permission checks, and error/retry handling. Explicit mock mode retains the historical screens.
8. Extended actual MongoDB/API, concurrent stock, restart-persistence, and clean-browser checks. Updated README, repository guidance, and progress.

No dependencies were added. Phase 8 is included with Phase 9 in the user-requested local commit; no remote push was performed.

## Models and migration

| Model/change | Purpose and constraints |
| --- | --- |
| InventoryItem.eggCategory | System mapping for each of the seven report egg categories; unique organization/category partial index; remains active egg/count; user bodies cannot assign this field |
| EggPolicy | Unique farm; server-derived organization/site, active collection location, allowed categories, optimistic version |
| EggPublication | Append-only unique report/revision; business date, frozen policy version/categories/room/item IDs, effective category counts, source movement IDs |
| Sale | Scope, date, room, buyer/reference, immutable selected-unit lines/egg counts/Decimal128 prices and total; payment, dispatch, cancellation lifecycle and optimistic version |
| Expense | Scope/date/category/Decimal128 amount/description/reference/optional receipt; immutable posted content, void metadata and replacement links |
| ExpenseClaim | Unique organization/farm/source key; protects normalized references and actual inventory receipt IDs from duplicate booking |
| CommerceRequest | Durable unique actor/request key with validated-input fingerprint, result kind and record ID; no TTL |
| StockMovement | Added `sale` source and sale reference; existing immutable/source-key/running-balance rules apply |
| PublicationIntent | New report publications use `posted`; legacy `deferred` evidence remains immutable |

Migration creates collections/indexes and configures existing farms without fabricating quantities, sales, expenses, or monetary balances. New and explicit-demo farms get the same configuration in their creation transaction. Seven dedicated catalog items use reserved initial names `Egg stock: <category>`; existing unrelated egg catalog items are not guessed/mapped into saleable stock. Their manual balances remain separate.

Default policy: Jumbo, Starter, Standard, Small saleable; Floor, Broken, Discard excluded. Each farm initially posts to its Egg collection room. A company-scope actor with `egg-production.manage` can change future saleability and the active collection room with a version/reason. Assigned operators can manage their permitted transactions but cannot change the company-supervised category policy. Policy changes are audited with before/after values. Category items can be renamed by a company inventory manager but cannot be deactivated or changed to another category/unit.

## Report egg publication and corrections

Every report submission publishes feed, saleable eggs, the numbered report snapshot, mortality delta, source intent, and audit in **one access transaction**. Repeated/stale submissions cannot create duplicate revisions or movements. Generic egg-entry endpoints do not exist; the production page reads effective published reports by farm/house/flock/date/category.

The first stock-enabled publication freezes that report's policy/categories/collection room. Each subsequent correction compares its effective category counts with the last actual EggPublication, then appends signed deltas for changed categories. A policy/location change applies to future reports, while existing reports continue to correct their original posted source. Report totals/previews use the applicable saleability policy. Floor/Broken/Discard counts remain visible as collected evidence; excluded categories are never subtracted a second time as generic damage.

Draft edits and returns leave the previous publication effective. If a reduction would make current or historical running stock negative after a sale, the complete submission rolls back. Revision count, feed posting, mortality, egg evidence, and report status do not partially publish. Correct the dependent sale/stock evidence before resubmitting. Source movements cannot be generically reversed; use report return/edit/resubmit.

**Legacy cutover:** existing Phase 4-7 reports/intents are not automatically converted into physical stock. The app cannot infer whether a later counted opening already includes those eggs. On Egg production, an authorized company actor with egg management, report review, and operational history can explicitly initialize a report's latest published snapshot with a reason, after checking physical opening quantities. Source uniqueness makes repeated initialization return the same publication without adding stock. If a new report revision is submitted before explicit initialization, its first stock-enabled publication posts its full selected saleable counts. Neither path independently creates production beyond report evidence.

Historical report snapshots and old deferred intents remain intact. EggPublication is the authority for whether a legacy report has been initialized. Its status is shown on Egg production even if the old summary predates this model. Initializing an old report also has to satisfy the ledger's historical balance rules and active farm/room requirements.

## Stock and sales rules

One Peti is exactly **360 whole eggs**. Egg counts remain integers; Peti equivalents are display strings only. The sales form prices the selected unit, so one Peti at PKR 18,000 is a PKR 18,000 line, not 360 times that price. A sale supports 1-30 lines, stable unique line keys, current saleable categories, positive whole selected quantities up to 1,000,000, and positive PKR unit prices up to 1,000,000,000 with two decimal places. Each line amount rounds half up to two places and totals sum those line amounts. Prices/totals use Decimal128 and decimal strings in JSON.

Posting derives ancestors from the selected farm, independently authorizes its collection room, freezes line content, and issues exact counts using server-generated `sale:<id>:line:<key>` source keys. All lines commit or none. The existing conditional balance updates plus complete effective-date running-ledger checks prevent concurrent overselling and spending collections from a future date. Current stock is available without returning older transaction history.

New sales start `posted` / `ready` for physical dispatch and `pending` or `paid` for payment. A posted sale already consumes stock and contributes sales-date revenue regardless of payment/dispatch status. Quantities, buyer/reference, location/date, and prices cannot be edited; correct before dispatch by cancelling and creating another intentional sale.

- Payment changes require current `version`, are separately audited, and do not change stock or revenue. They update only the unpaid figure.
- Mark physically dispatched only when the eggs leave the farm. This records dispatch/time and prevents cancellation.
- Before dispatch, reasoned cancellation appends linked positive stock movements dated on the current business day and changes sale status atomically. Cancelled sales contribute neither revenue nor unpaid value in financial summaries. Repeated cancellation is rejected and cannot restore stock twice.
- Physical customer returns/refunds after dispatch remain an extension. Cancellation is not presented as a cash refund ledger, even if the original sale was marked paid.

Generic manual stock reversal denies sale/report sources. Existing manual egg opening/adjustment/transfer controls still require egg management and reason; they cannot masquerade as production/sales. An undispatched posted sale blocks farm/site archive. Stock balances retain the earlier nonzero-stock archive guard.

## Expenses and recorded finance

Controlled categories: Feed, Medicine/Vaccine, Labour, Electricity, Other. Amounts are positive PKR with two decimals and the same 1,000,000,000 bound. Other requires a description of at least three characters. Optional invoice/reference and receipt/opening movement links are supported; attachments remain Phase 9.

References are normalized by trim/NFKC/lowercase and claimed uniquely within the farm. A linked actual movement also claims its own source ID, so a different invoice label cannot book the same receipt twice. Linked movements must be accessible manual receipts/openings in the same farm, with inventory read and permitted source history. No guessed formula cost or stock quantity is converted to an expense automatically.

Posted expense content cannot be edited. Voiding requires reason/version and preserves the original entry. Replacement is one transaction: validate/create a new same-farm entry, transfer applicable source claims, mark the old entry voided, link both records, and audit. Duplicate/stale replacements cannot create multiple active records. Old claims are retained after void or source changes to prevent silently rebooking earlier evidence through an unrelated create request. Use the correction chain rather than creating a second entry for that source.

The server groups non-cancelled posted sale totals and active expense amounts by business date and authorized farm scope:

- Recorded revenue: sales-date totals, including unpaid sales.
- Unpaid sales: pending-payment totals among posted sales.
- Recorded cost: active entered expenses only.
- Operating surplus/deficit: recorded revenue minus recorded cost.

Cost completeness is always explicitly **unconfirmed**; entering an expense does not prove every real cost is present. Results are not official profit, ROI, or cash flow. Formula finalization, stock receipts/issues, and report consumption never book another expense. The PRD example produces `18000.00 - 7000.00 = 11000.00`; replacing the expense with 6000 changes the surplus to 12000. Prices are never calculated from browser-wide record downloads.

Finance provides paginated source identities/date/status/amount for drill-down. Full sales details still require sales-view permission; expense details require finance-view permission. Generic commerce audit metadata contains identities/state/reasons, not copied monetary totals, preventing future generic audit viewers from becoming an alternate price API.

## Authorization, dates, retries, and API

All writes use the existing serialized access transaction guard, which reloads the session actor/current role/scope and coordinates hierarchy/permission changes with business writes. All stock endpoints derive organization/farm ancestry on the server. Sales/finance history uses today/yesterday unless `reports.history.view` grants older bounded queries. Clinical history does not grant commercial history. Details, mutation sources, linked receipts, and request replays recheck scope and date; an old source ID is not an authorization bypass. No future-dated posting is allowed.

Create sale, create expense, and replace expense require a 16-100 character `Idempotency-Key`, normally UUID. Durable actor/key/fingerprint records replay the result for an identical validated payload; changed inputs return 409. The form keeps the same key for an unchanged retry after a lost response. Other mutations use optimistic versions. Unique report/revision/category keys protect publication and legacy initialization independently of request records.

Prefix `/api/v1`. Existing cookie, forced-password change, CSRF/origin, strict request validation, safe errors, and audit conventions apply. Lists return `{ data, meta }`, details/writes `{ data }`.

| Method/path | Permission and contract |
| --- | --- |
| `GET /egg-production` | `egg-production.view`; effective report evidence, grouped identities/category counts, current publication marker |
| `GET /egg-production/farms/:id/policy` | Egg or sales view; current policy |
| `PUT /egg-production/farms/:id/policy` | Company scope + egg manage; `{ version, locationId, categories, reason }` |
| `GET /egg-production/farms/:id/stock` | Egg view, sales view, or sales manage; permitted active collection rooms and current category balances/Peti equivalents |
| `POST /egg-production/:reportId/backfill` | Company scope + egg manage + report review + history; `{ reason }`; initialize published legacy evidence once |
| `GET/POST /sales` | Sales view / manage; list or post `{ farmId, locationId, businessDate, buyer, reference?, paymentStatus?, lines }`; create retry header |
| `GET /sales/:id` | Sales view; immutable lines plus stock evidence |
| `POST /sales/:id/payment` | Sales manage; `{ version, paymentStatus }` |
| `POST /sales/:id/dispatch` | Sales manage; `{ version }` |
| `POST /sales/:id/cancel` | Sales manage; `{ version, reason }`; ready sales only |
| `GET/POST /expenses` | Finance view / manage; list or `{ farmId, businessDate, category, amount, description?, reference?, sourceMovementId? }`; create retry header |
| `GET /expenses/:id` | Finance view; original/void/replacement evidence |
| `POST /expenses/:id/void` | Finance manage; `{ version, reason }` |
| `POST /expenses/:id/replace` | Finance manage; `{ version, reason, expense: <full input> }`; retry header |
| `GET /finance` | Finance view; daily results and totals/coverage note from server |
| `GET /finance/sources` | Finance view; paginated financial source identities with `kind=sales|expenses` |

Sale lines: `{ key, category, quantity, unit: 'egg'|'peti', unitPrice }`. Bodies cannot supply totals, actors, ancestor IDs, stock amounts, arbitrary statuses, or source keys. Lists accept farm/from/to/page/pageSize (maximum 100); production additionally accepts flock and verifies ancestry. Dates are valid ordered business-date ranges of at most 90 days. Finance daily rows are inherently bounded by that range; source/transaction lists remain paginated.

## Frontend walkthrough

1. Record and submit daily reports. Egg production shows the effective revision and all seven collected categories; saleable stock appears in its frozen collection room. For legacy evidence, check physical opening quantities before explicit initialization.
2. Select a farm to inspect current stock and policy. Company supervisors may configure future categories/room with a reason/version.
3. On Sales, select the farm/collection room, buyer/date, category lines, whole eggs or whole Peti, and a price per selected unit. Posting either deducts all stock or returns a useful error.
4. Inspect sale lines/evidence. Update payment separately, cancel with reason while ready, or confirm physical dispatch. No edit/return action changes dispatched quantities.
5. On Finance, enter actual expenses with category/amount/reference. Correct an entry through void or void-and-replacement. Inspect original/replacement evidence.
6. Review server totals, unpaid value, daily rows, and source drill-down, with the cost-completeness note visible. Mobile production/stock and sales views retain usable table scrolling without document-level overflow.

## Verification

Results: **64 backend checks passed**, **9 mock checks passed**, **clean-browser workflow passed**, and **production build passed**. Syntax checks passed for 72 server JavaScript files; documentation links and whitespace checks passed. Commands: `npm run test:server`, `npm test`, `npm run test:browser`, and `npm run build`. Four focused report/policy/legacy/restart checks also passed after the final summary review, including preserving the original policy's nonzero Jumbo count after a future policy change.

Added acceptance coverage includes 720 eggs/two Peti, one-Peti sale/360 remaining, durable retry and changed-input conflict, multi-line rollback, concurrent sales, sold-stock correction denial, cancellation/retry, dispatch denial, immutable content, scoped/dated requests, controlled categories/units, exact financial example, payment versus revenue, source deduplication, void/replacement, unchanged finance after formula costing, policy preservation, and explicit legacy initialization. Restart verification includes egg publication, sale, expense and financial totals. The clean-browser walkthrough exercises report revision -> production -> sale/dispatch -> expense -> financial results -> replacement, plus mobile stock/sales and previous-phase regression checks. No browser runtime errors or document-level mobile horizontal overflow were observed.

Desktop finance and mobile egg stock/sales screenshots were visually reviewed. Ignored local evidence includes `.data/verification/finance-results-desktop.png`, `egg-stock-mobile.png`, `egg-sales-mobile.png`, and `egg-sale-detail-mobile.png`. Review improved the finance total cards using the existing definition-list styles and linked financial sale sources directly to the exact sale detail. The full browser workflow passed again with the exact-source link. A separate isolated mobile fixture verified the fully loaded sales table/detail and total, with no page overflow/runtime errors; the reusable smoke script now waits for the buyer row before its mobile screenshot. Tests use isolated databases/accounts and do not reset a configured application database. Phases 8 and 9 are included together in the user-requested local commit; no remote push was performed.

An initial overselling check exposed Mongoose's rollback handling of an embedded schema's default version field with strict schemas. Explicitly disabling that unused embedded version key preserves the original insufficient-stock error and transaction rollback. No library files or versions were changed.

## Remaining phases

Phase 9 images/comments/durable alerts and Phase 10 dashboard/exports/audit viewer remain pending. Attachments, physical customer returns, invoices/tax accounting, cash/refund ledgers, inventory valuation, and official ROI are not added here. Historical mocks are never read for live commerce accounts.
