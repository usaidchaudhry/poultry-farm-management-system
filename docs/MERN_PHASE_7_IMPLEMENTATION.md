# LayerFlow MERN Phase 7 implementation

Date: 22 November 2026. Scope: Phase 7 and M08 of [LayerFlow_MERN_PRD.md](../LayerFlow_MERN_PRD.md). Prerequisites: identity, farm scope, and the [Phase 6 inventory catalog](MERN_PHASE_6_IMPLEMENTATION.md).

## Work completed

1. Reviewed repository guidance, requirements, prior implementation contracts, permission grants, mock formula screen, live service/UI patterns, decimal helpers, and progress.
2. Added a modular MVC-style formula feature: models, validation, routes, controllers, decimal calculation, transaction services, and ingredient selection.
3. Added logical formulas, numbered composition versions, separate confidential pricing, immutable finalized snapshots, durable create/revise request records, and repeatable migration `006-formula-costing`.
4. Implemented compose/edit/submit, pending-costing queue, server cost preview, saved rates, return with reason, separate finalization, linked new drafts, and completed-formula archive.
5. Enforced scope, date windows, active hierarchy/catalog, optimistic versions, strict field allowlists, server actors, source uniqueness, retry deduplication, and safe audit attribution.
6. Added an asynchronous live Feed formulas page with farm/state/date filters, ingredient rows, separate pricing controls, previews, history, revisions, archive, pagination, and error/retry handling. Preserved the historical screen exclusively in explicit mock mode.
7. Added API/database acceptance scenarios, restart-persistence coverage, and a browser Farm Manager-to-Operation Manager walkthrough. Updated README, repository guidance, and progress.

No dependencies were added. The implementation was initially left uncommitted as requested; the user subsequently authorized a local commit.

## Data dictionary

| Model | Stored state and constraints |
| --- | --- |
| FeedFormula | Organization/site/farm derived by server; code and normalized farm-unique code; latest number/version pointer; archived flag; logical optimistic version |
| FormulaVersion | Logical reference, numbered version, previous-version link, date/name/feed type/strain, bag size, stable ingredient row keys/catalog IDs/frozen names/kg, total kg, workflow state, optimistic record version, reasons and attributable actors/timestamps |
| FormulaPricing | One private pricing record per version; row-keyed PKR/kg rates; updated actor; mutable only while pending costing |
| FormulaSnapshot | One append-only snapshot per finalized version; complete composition/code/date, bag size, exact rates, rounded row costs, totals, rounding-policy identifier, currency and finalizer/time |
| FormulaRequest | Durable unique actor/request key, validated-input fingerprint, resulting version ID; no TTL |

Migration creates collections/indexes without overwriting edited grants or fabricating formulas/prices. Catalog items are reused; ingredient choices expose only active kg ingredients, not balances or stock history. Formula code/farm are fixed after creation. Every ingredient has a stable client-generated row key, including when rows are removed or reordered. Duplicate row keys are rejected; repeated catalog ingredients on distinct rows are supported and independently costed.

Version numbers are separate from optimistic record versions. Number 1 can have several draft/pricing changes, each increasing `version`. A finalized number is never edited; revision creates number N+1 with `previousVersionId`. A formula has one current working version; revising an older number or duplicating a revision is rejected. History reads show up to 100 version references within the authorized bounded date interval; lists remain paginated.

Finalized composition records reject document-save overwrites after being loaded as finalized. Snapshot evidence rejects overwrites. No snapshot mutation/deletion API exists. These are application invariants, not protection against database administrators.

## Decimal calculation contract

Formula quantities, bag size, rates, and money use MongoDB Decimal128. JSON exposes decimals as strings; the frontend sends unformatted decimal strings. The shared Decimal arithmetic uses 28 significant digits and round-half-up. Positive values must be at most 1,000,000,000; kg/bag size allows three decimal places, rates four. A formula accepts 1-100 rows. Missing, negative, zero, unsupported numeric formats, excessive precision, and client-calculated totals are rejected.

1. Normalize each kg quantity and bag size to three places; default bag size is 50 kg.
2. Multiply each row's kg by its PKR/kg rate, rounding that row to two PKR decimals.
3. Sum rounded row amounts for total cost; sum row kg for total kg.
4. Divide total cost by total kg; report cost/kg to four places.
5. Multiply the **unrounded ratio** by the version's bag size and round cost/bag to two places.

Worked example: 60 kg at PKR 10/kg plus 40 kg at PKR 20/kg produces `100.000` kg, `1400.00` PKR total, `14.0000` PKR/kg and `700.00` PKR per 50 kg bag. Two 1 kg rows at PKR 0.005/kg each round to 0.01, summing to 0.02. For a rounded total of PKR 1.00 and 3 kg, a 10,000 kg bag costs 3333.33; using the displayed 0.3333 ratio would incorrectly yield 3333.00.

Every finalized snapshot records the `formula-v1` calculation policy, exact decimal inputs, and rounded outputs. Catalog renames, later rates, or future drafts cannot replace a previous snapshot's figures. Preview uses the server calculation without writing prices or evidence. Finalization uses saved rates; the UI disables finalization while rate edits are unsaved.

## Workflow and permissions

| Action | Permission / state |
| --- | --- |
| Read list/detail/versions | `feed-formulas.view`; pricing still requires its separate read grant |
| Ingredient choices | Formula view or compose; active ingredient/kg catalog only |
| Create/edit composition | `feed-formulas.compose`; latest draft/returned version; active farm/site and ingredient catalog |
| Submit | `feed-formulas.submit`; latest draft/returned; revalidates ingredients; locks composition |
| Preview / save rates | Both `feed-formulas.cost` and `feed-formulas.cost-view`; latest pending version |
| Finalize | Both `feed-formulas.finalize` and `feed-formulas.cost-view`; latest pending version; complete saved rates |
| Return | `feed-formulas.return`; pending; reason required; clears nonfinal estimates |
| New draft version | `feed-formulas.compose`; latest finalized number; new permitted date and reason; copies composition/bag size, never rates |
| Archive | `feed-formulas.compose`; latest finalized number; reason; archives the logical formula, preserving all evidence |

Farm Manager defaults can compose/submit/read quantities and cannot price or retrieve costs. Operation Manager defaults can price/preview/finalize/return but cannot compose. Owner has both capabilities. Separate grants govern these actions; roles are not checked by name. This is composition-versus-pricing authorization, not a requirement that the author and finalizer always be different people when a role legitimately has both permissions.

Save rates requires exactly one positive rate for every stable row key, with no duplicates/unknown rows. It increments the same optimistic record version used by other actions, so another price edit/finalization cannot silently overwrite a concurrent change. Return requires a reason of 3-1000 characters and deletes nonfinal pricing. The returned composition can then be edited/resubmitted and needs fresh costing. Archive is available after completion; archived formulas remain readable under scope/date policy but cannot accept edits or new revisions. No archive/restore shortcut unlocks a finalized snapshot.

Farm/site archive is blocked by unfinished formula versions, preventing stranded handoffs. Every business mutation uses the existing access transaction guard, coordinating current role/scope checks, hierarchy changes, unique versions/snapshots, and audit. Formula operations do not manufacture feed, issue inventory, or create an expense.

## Privacy and history

Composition bodies reject rate, price, cost, total, actor, hierarchy, and status injection. A response allowlist returns composition fields; the entire `costing` object, including rates/row costs/totals/policy, is absent unless the current actor has `feed-formulas.cost-view`. This applies to mutation responses, list/detail, returned documents, finalized versions, revision results, and replayed requests. History navigation contains identity/date/state references, without embedded pricing. Losing the cost-read grant removes prices on the next protected response and blocks preview/save/finalize even when other cost grants remain.

Formula audit changes contain only state, identifiers, version numbers, and action reason. Rates and monetary values are never copied into generic audit evidence. No live formula export endpoint exists in this phase; Phase 10 exports must reuse the same pricing policy instead of serializing database documents.

Normal version history uses the existing today/yesterday policy, with `reports.history.view` enabling older bounded ranges. Clinical-history permission does not enable formula history. The pending queue is a current operational-state exception: scoped older pending versions expose the composition needed for costing. It accepts no date filters and does not expose sibling history outside the reader's allowed interval. Rate preview/save/finalize/return can resolve an older pending handoff; a finalized or returned old version once again needs history permission for direct reads/edits. Older returned compositions are handled by an authorized historical actor. Creating or revising into a future/forbidden business date is rejected.

Durable `Idempotency-Key` headers are required on formula creation and new-version creation. Same actor/key/validated payload returns the resulting version without duplicating logical records or numbers; a changed payload returns 409. Replays resolve current scope/date/grants and current pricing visibility. Other edits/transitions use expected record versions and reject stale retries, without duplicate snapshots. The UI reuses an unchanged form's key after a lost response and never automatically retries a mutation.

## API contract

Prefix `/api/v1/feed-formulas`. Existing session, mandatory password change, CSRF/origin, strict validation, safe errors, and audit rules apply. `:id` below identifies a **FormulaVersion**, while `formulaId` identifies its logical parent.

| Method/path | Input / response |
| --- | --- |
| `GET /` | Paginated versions; farm/formula/status/archive/date filters or `view=pending` |
| `GET /ingredients` | Paginated active ingredient/kg identities; no prices or balances |
| `POST /` | `{ farmId, code, name, businessDate, feedType?, strain?, bagSizeKg?, rows }`; retry header required |
| `GET /:id` | Scoped/version detail, conditional costing, permitted history references |
| `PATCH /:id` | Full editable composition plus `version`; farm/code cannot change |
| `POST /:id/submit` | `{ version }` |
| `POST /:id/preview` | `{ version, rates: [{ key, rate }] }`; server preview, no writes |
| `PUT /:id/pricing` | Same rate body; saves complete rate set and advances version |
| `POST /:id/finalize` | `{ version }`; freezes saved costing atomically |
| `POST /:id/return` | `{ version, reason }` |
| `POST /:id/revise` | `{ version, reason, businessDate }`; retry header required; new unpriced draft |
| `POST /:id/archive` | `{ version, reason }`; completed logical formula archive |

Composition rows are `{ key, itemId, kg }`; item labels and totals are server-derived. Successes return `{ data }`, lists `{ data, meta }`. List defaults: `page=1`, `pageSize=20` (maximum 100), `view=history`, `archived=false`. `from`/`to` use the organization's business dates and a maximum 90-day range. Pending filtering rejects contradictory date/state parameters. `archived=true` selects archived logical formulas and their permitted versions.

## Frontend walkthrough

1. An inventory manager creates active ingredient catalog entries with base unit kg.
2. Farm Manager opens Feed formulas, creates a farm-scoped code/name/date, enters positive kg rows and explicit bag size, and saves composition. Row controls preserve their stable keys.
3. Open the draft and submit for costing. Composition editing disappears while pending. The Farm Manager receives no price columns or rate controls.
4. Operation Manager selects Pending costing queue, opens the handoff, enters every PKR/kg rate, previews server totals, then saves rates. Unsaved changes disable finalization.
5. Finalize to freeze the snapshot, or return with a reason to reopen composition and clear estimates. Error responses retain useful form inputs and allow refresh after conflicts.
6. The composer opens a finalized formula, supplies a reason/new business date, and creates a linked draft. Inspect the previous version through history; its content and permitted costing remain unchanged.
7. Archive a completed formula when no new revision is needed. Use the archived filter to inspect preserved versions.

## Verification

Results: **57 backend checks passed**, **9 mock checks passed**, **clean-browser verification passed**, and **production build passed**. Syntax checks passed for 66 server JavaScript files; documentation links and whitespace checks passed. Commands: `npm run test:server`, `npm test`, `npm run test:browser`, and `npm run build`. After final review, seven focused formula/restart checks passed again, including reading stored snapshot values directly and the unfinished-formula archive guard.

Acceptance checks cover the worked example, decimal/rounding rules, required rates, strict row matching, stale updates, Farm Manager pricing injection/read denial, granular permission revocation, wrong-farm requests, old pending handoffs, create/revise retry deduplication, concurrent finalization, immutable snapshots/versions, return/resubmit, archive, and unchanged stock. Restart checks retain finalized formula/pricing evidence. Browser verification uses separately assigned Farm Manager and Operation Manager accounts, including mobile composition, server preview/save/finalize, pricing redaction, and preserved revision history. No browser runtime errors were recorded.

Desktop finalized-costing and mobile composition screenshots were visually reviewed. Local ignored evidence: `.data/verification/formula-costing-desktop.png` and `formula-composition-mobile.png`. The review replaced the raw calculation-policy identifier in the UI with a readable explanation of rounding; the identifier remains in authorized API/snapshot evidence. Tests use isolated databases/accounts and do not reset the configured application database. A local commit was subsequently requested; no push is part of that request.

## Remaining boundaries

Phase 8 egg publication/sales/finance and later evidence, reminders, dashboard/export work remain pending. There is no manufacturing, automatic ingredient stock consumption, inventory valuation, supplier pricing feed, or automatic finance expense. No formula data is migrated from browser mock storage into live accounts.
