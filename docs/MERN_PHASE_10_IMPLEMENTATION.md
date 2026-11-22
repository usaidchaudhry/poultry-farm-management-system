# MERN Phase 10 implementation

Implemented 22 November 2026. Read with the Phase 0-9 logs and [acceptance results](ACCEPTANCE_RESULTS.md).

## Changes

- Added `server/src/modules/insights/` using the existing route, validation, controller, policy/service and Mongoose architecture. Aggregation executes in MongoDB; the browser receives bounded rows, summaries and trends.
- Added live Dashboard, Reports and analytics, and Audit screens behind the existing service facades. Explicit development mock mode retains the historical screens. Reused the established CSS tokens, controls, loading/error/empty states and permission codes.
- Implemented ten report definitions: daily poultry, eggs, mortality, bird weight, medicine/vaccination observations, feed consumption, finalized formula cost, current inventory, sales and daily financial results.
- Added cascading site/farm/house/flock and business-date filters, supported status/category filters, pagination, accessible trend values and CSV downloads. Farm-only sources reject house/flock filters; dashboard sections explain that omission instead of attributing farm money to an individual house.
- Added authenticated printable daily reports at `GET /api/v1/daily-reports/:id/print`. Browser Print supports paper or Save as PDF; this is not a PDF-generation service. An optional `revision` selects a submitted revision.
- Added company-scoped, read-only audit list/detail routes, literal search and actor/action/target/farm/date filters. Added actor names, immutable hierarchy/business-date context, indexes and repeatable migration `009-reporting-audit-context`. Existing events are enriched where their source remains available.
- Shared live record loading now clears prior results on refresh/failure or authority changes and reloads after grant/scope changes. This prevents stale dashboard amounts remaining visible after permission revocation.

## Calculation and disclosure decisions

| Source | Authoritative meaning |
| --- | --- |
| Poultry/eggs/feed/mortality | Effective published `ReportRevision`, including the last submitted revision while a report is returned. Draft edits do not affect totals. |
| Ratios | Sum numerator / sum opening birds. Zero denominator is unavailable; missing reports are not zero production. Feed kilograms convert to grams before division. |
| Weight | Sum of grams multiplied by sample size / total sampled birds. Preceding-sample differences are per flock within the selected permitted window. No clinical standard is invented. |
| Medicine/vaccination | Reported observations and links, not evidence of administration. Incompatible units are never summed. |
| Formula | Immutable finalized snapshots only. Decimal128 costs; planning costs do not create expenses. |
| Inventory | Current ledger-derived balances, not a historical closing balance for the selected dates. Low-stock counts require active item/location and a positive threshold. |
| Sales | Posted sales contribute revenue/eggs; cancelled rows remain evidence. Payment status does not change sales-date recognition. |
| Finance | Posted revenue minus active recorded expenses, with unpaid revenue separately shown. Cost completeness remains unconfirmed; official profit/ROI is unavailable. |

Financial arithmetic remains server-side decimal arithmetic; JSON money is a decimal string. Charts convert values only for display coordinates. Summaries cover the selected permitted dataset, not just the displayed page. Trends are bounded to the permitted maximum 90 days. Inventory quantities retain each item's unit.

## API and authorization

- `GET /api/v1/dashboard`: requires `dashboard.view`; each section also requires its underlying source grant.
- `GET /api/v1/reports/catalog` and `/reports/:type`: require `reports.view` and the selected source grant. Formula costs require both formula read and cost-view grants. Egg/mortality projections do not inherit broader poultry fields.
- `GET /api/v1/reports/:type/export`: additionally requires `reports.export`. Same filters, scope, history, projections and totals as the interactive report. More than 10,000 rows returns `422 EXPORT_TOO_LARGE`; no silently truncated export.
- Print requires `daily-reports.view` and `reports.export`, plus the report detail's scope/date policy. Only submitted snapshots are printable; HTML escapes user content.
- `/audit-events` and `/audit-events/:id`: require company scope and `audit.view`. No mutation route exists. Details use a structured allowlist and require the underlying source read permission. Credentials, financial rates/costs and clinical narratives are omitted. Old source business dates remain protected even when the audit event itself is new.
- Current open medication work, current stock and unresolved alerts retain their documented current-state exceptions. An explicit forbidden historical range still fails. These exceptions do not open old source detail/export routes.

CSV uses a UTF-8 BOM, quoted cells, doubled quotes and CRLF records. Formula-capable user text, including leading whitespace/control characters, receives an apostrophe. Strict negative numeric values retain their numeric meaning.

Audit is application-immutable, not tamper-proof against a database administrator. Metadata may identify an event without disclosing its underlying private content. Read-only audit access does not grant operational mutation permissions.

## Verification

API checks reconcile 735 collected / 720 saleable fixture eggs, 18,000 revenue minus 7,000 cost = 11,000 recorded surplus, and 10 birds at 1,600 g plus 30 at 1,800 g = 1,750 g weighted average. They cover returned drafts, print snapshots, CSV formula protection, wrong farms/ancestors, alternate historical paths, pricing denial, audit redaction/search and rejected audit writes. See [acceptance results](ACCEPTANCE_RESULTS.md) for complete commands and measured performance.
