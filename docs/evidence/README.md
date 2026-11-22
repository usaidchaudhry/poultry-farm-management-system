# Reviewed browser evidence

Captured 22 November 2026 by `npm run test:release`, using the production API from an independently installed fresh project copy, built API-only SPA, real isolated MongoDB and local ephemeral HTTPS proxy. These contain generated sample data, no live passwords/tokens. Public hosting is not represented.

| Evidence | Viewport / purpose |
| --- | --- |
| [Dashboard](dashboard-desktop.png) | Owner, 1440 px, server aggregates and recorded financial result. |
| [Farm Manager](farm-manager.png) | 360 px, scoped phone overview with price-free operational cards. |
| [Operation Manager](operation-manager.png) | 390 px, two-farm workflow and financial report. |
| [Doctor](doctor.png) | 768 px, clinical/tablet workflow without finance. |
| [Production Manager](production-manager.png) | 768 px, restricted operational overview. |
| [Reports](reports-desktop.png) | Filtered 18,000 / 7,000 / 11,000 financial reconciliation. |
| [Daily print](daily-print-desktop.png) | Submitted snapshot with explicit units and clinical observations. |
| [Audit](audit-desktop.png) | Search results and redacted read-only change modal. |
| [Machine-readable results](results.json) | Completed checks, browser error count, local production/MongoDB indicators. |
| [Performance measurements](performance.json) | Real 10,000-record fixture, p95 timings and indexed query plan. |
| [Local demo picker](demo-picker-mobile.png) | 360 px localhost API sign-in with all five roles; verified by `npm run test:demo-login`. |

Screenshots were reviewed for responsive layout, readable labels and clipping. Automated checks also verify modal keyboard containment, Escape and focus restoration; CSV download; denied source/history access; restart; recovered private images; expired sessions and failure/retry clearing. Earlier forms/tables/clinical/inventory/commerce screenshots remain under ignored `.data/verification/`.
