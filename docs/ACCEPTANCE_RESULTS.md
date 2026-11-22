# Acceptance and verification results

Verified locally on 22 November 2026, Windows, Node 24.18.0, Microsoft Edge headless, real isolated MongoDB replica sets. Mock checks are separate. The user approved localhost-only delivery and skipping external-service/API/cloud features. Public hosting is excluded from acceptance; no public deployment is claimed.

## Commands and results

| Check | Observed result |
| --- | --- |
| `npm run test:server` | 74 API/database/performance/restart checks passed in the full run. Two additional focused checks passed afterwards: narrow report/audit disclosure and CSV edge cases (76 checks in the current suite). |
| `npm test` | All nine historical mock service checks passed. |
| `npm run test:browser` | Complete live Phases 0-9 browser journey passed, including grant revocation, stale UI clearing, report revisions, clinical handoff, inventory, formula costing, commerce and medical evidence. No browser runtime errors. |
| `npm run test:release` | Production API, API-only SPA and local HTTPS proxy passed all five roles, empty/failure/retry/session states, multi-farm scope, print/CSV/audit keyboard workflow, restart and restored-server login. Local self-signed TLS, not a public deployment. |
| `npm run build` | Production bundle passed (265 modules). Explicit mock production build is rejected. |
| Independent `npm ci` / server install / build | Passed in generated `.data/verification/fresh-install-v4OqRv`; frontend needed one uncached package fetched after the initial offline attempt. Release verification also targets this fresh server installation. |
| `npm run docs:api`, `npm run docs:access` | Generated specification (105 resource paths) and current default permission matrix. |
| Compose `config --quiet` | Passed. Docker engine unavailable, so image build and public-host execution are still unverified. |
| Backup/recovery | Actual database shutdown/restart; restored separate database/private image directory; old session rejected, login succeeds, exact image/totals/alert state preserved; nonempty target and corrupt database payload refused. |

The new disclosure/CSV checks and final backup-corruption check were run after the full suite; this records what actually ran rather than claiming a second complete run.

Local demo login follow-up: the updated full-seed check and new localhost-picker API check passed. `npm run test:demo-login` passed real browser selection, normal login, required password change and dashboard access for six seeded accounts covering all five role types. No browser runtime errors; mobile picker screenshot is included in evidence. Build passed with 266 modules. The current suite contains 77 checks; the complete 74-check run above predates these focused additions.

All 107 server JavaScript files passed syntax checks. New/updated documentation links resolve. The untouched original Flutter `PRD.md` retains ten pre-existing references to unavailable source documents/images; those historical sources were not fabricated or rewritten.

## Required scenario mapping

| Acceptance | Evidence |
| --- | --- |
| AC-01 | Access API login/password/session/logout checks; browser refresh/restart/logout; release restored-session reauthentication. |
| AC-02 | Staff role defaults/API denial; browser pending-access journey. |
| AC-03 | Active-session role edits/reset/deactivation/scope reassignment API checks; browser removal of inaccessible tables/selection. Shared live result clearing on authority changes. |
| AC-04 | Hierarchy ancestry/scope and direct report/clinical/inventory/commerce/evidence tests; Phase 10 wrong-farm filters. |
| AC-05 | Concurrent final-administrator deactivation test and protected recovery role guards. |
| AC-06 | Duplicate flock/date report checks and concurrent submit/source uniqueness. |
| AC-07 | Report lifecycle/revisions/delta publication API and full browser journey. |
| AC-08 | Seven-category/Peti examples; zero-opening denominator test. |
| AC-09 | Population continuity, dependent correction and backdated first-submit guards. |
| AC-10 | Unique recurring clinical occurrences, retry/concurrent finalization; seed has 12 tasks. |
| AC-11 | Original-prescriber denial API and Doctor-to-Farm-Manager browser handoff. |
| AC-12 | Duplicate outcomes, concurrent effective evidence, attributable immutable corrections. |
| AC-13 | Stock receipt/issue/adjustment/paired transfer/reversal/reconciliation and both endpoint scopes. |
| AC-14 | Concurrent stock issues and egg sales; historical/current negative-stock denial. |
| AC-15 | Report feed/egg posting, corrections, insufficient-stock rollback and publication retry tests. |
| AC-16 | Exact formula example, separate composition/pricing, grant revocation/redacted reads, immutable versions. |
| AC-17 | Sale/dispatch/payment/cancellation stock and revenue checks plus browser commerce. |
| AC-18 | Exact expense/source claims and finance checks; formulas do not book expenses. |
| AC-19 | Medical routing/fallback/independent recipient state/clinical response/critical resolution tests and browser journey. |
| AC-20 | File signature/type/size/parent locks/wrong farm/revocation and restart bytes; production restore retrieves images. |
| AC-21 | Operational list/detail/revision/date tests; Phase 10 dashboard/report/export history denials and audit source-date denial. |
| AC-22 | Clinical-history versus operational-history tests; release Doctor finance denial. |
| AC-23 | Published 735 collected / 720 saleable fixture, 1,750 g weighted mean, exact 11,000 surplus, no returned-draft leakage; narrow source grants protect fields/exports. |
| AC-24 | Server attribution/secret scrubbing; audit list/detail redaction; POST/PATCH/DELETE rejected. |
| AC-25 | Stale version/concurrent/retry API checks; browser validation/error flows; release injected 503 clears stale metrics and retry recovers; logout/expired session goes to login. |
| AC-26 | Local clean installs, production startup/restart, paired backup restore passed. Public deployment and public-host restart checks skipped under the user-approved localhost scope. |
| AC-27 | 360/390 phone, 768 tablet and 1440 desktop journeys; screenshots reviewed; audit modal Tab containment/Escape/focus restoration; existing workflow form/table/dialog checks. |

## Performance

Latest full-suite measurement: AMD Ryzen 9 4900HS, five farms, 20 flocks, 10,000 dated weight records across 90 days; 20 requests per category. Normal reads use pagination. A 10,000+ row export is rejected with a narrowing instruction.

| Category | p95 | PRD target |
| --- | --- | --- |
| Paginated reads | 153 ms | 2,000 ms |
| Writes | 41 ms | 2,000 ms |
| Report aggregation | 117 ms | 3,000 ms |
| Dashboard | 131 ms | 3,000 ms |

The query plan uses the organization/farm/businessDate index. Results are local observations, not public-host latency promises. Generated timing/query-plan evidence is `.data/verification/performance.json`.

## Visual evidence and limits

Representative screenshots in [evidence](evidence/README.md) include live desktop reports/print/audit and phone/tablet role dashboards. Full generated browser evidence remains under ignored `.data/verification/`. Charts expose dated text values alongside SVG; unavailable metrics and incomplete costs are labeled.

Dependency audit of the existing lockfile reported four frontend findings: Vite high (development server/editor path issues), esbuild moderate, and React Router/DOM moderate. Fixes proposed by npm require major version migrations. This phase preserves the existing React 18/Vite 5 baseline and records the findings; production serves prebuilt assets via Express, never the Vite development server. The app uses fixed internal route destinations and no SSR hydration, reducing applicability of the reported router cases; this is not a claim that the packages have no advisories. Public hosting and any chosen dependency upgrade need their own final verification.

Phases 10 and 11 satisfy the revised localhost delivery scope. Public deployment, cloud setup and external-service features are skipped by explicit user request. Optional [deployment reference](DEPLOYMENT.md) is retained for future use; it is not a required setup step.
