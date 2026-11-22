# LayerFlow

## Product requirements document and phased MERN implementation plan

**Scope amendment - 22 November 2026:** The user approved localhost-only delivery: no public deployment; skip features requiring external services, third-party APIs or cloud. Use the local Express API, local MongoDB replica set and private local file storage. Public hosting, hosted database/storage and external messaging are excluded. This amendment supersedes deployment requirements in Phase 11, AC-26 and Section 14; their local installation, production-build verification, restart, backup/restore and documentation requirements remain applicable. Phases 10 and 11 are complete within this revised scope; see the implementation logs and acceptance results.

| Item | Definition |
| --- | --- |
| Version | 1.0 |
| Date | 19 November 2026 |
| Status | Implementation baseline; proposed business defaults are identified below |
| Project type | University course project, sized for a working demonstration rather than a commercial rollout |
| Application | Responsive web application for desktop and mobile browsers |
| Stack | MongoDB, Express.js, React, Node.js; JavaScript modules throughout |
| Existing starting point | React 18 + Vite frontend with working mock workflows |
| Primary deliverable | One integrated application with persistent data, enforced permissions, and demonstrable farm workflows |

This document adapts the supplied [source PRD](PRD.md) to LayerFlow and the existing React repository. It covers the whole application, including backend development, database design, frontend integration, verification, and deployment. It is a plan only; the features described as targets are not claims about completed implementation.

The existing [progress checklist](PROGRESS.md) and [frontend assumptions](ASSUMPTIONS.md) describe the current frontend. Their original phase numbers remain historical frontend milestones. The phases in this document are a new full-stack sequence, numbered **MERN Phase 0–11**.

The source references additional briefs, paper reports, images, database documents, and earlier backend work. Those supporting files and that backend are not present in this repository. Their contents and implementation status are not assumed. Requirements below come from the supplied PRD and inspected local code. Proposed defaults make the university project actionable without presenting unresolved business choices as confirmed facts.

## 1. Product purpose

LayerFlow helps a poultry operation record daily farm activity, monitor flock health, manage feed and stock, track egg sales, and review basic financial results. Different staff members share the same records while retaining separate responsibilities.

The main demonstration should tell one connected story: an administrator creates the farm structure and assigns staff; a Farm Manager submits a daily report; a Doctor records a visit and prescription; another authorized user records medication administration; operations staff manage feed, cost a formula, sell collected eggs, and record expenses; management reviews the resulting dashboard and audit trail.

### 1.1 Problems addressed

- Daily reports, mortality observations, medication records, stock, and sales are difficult to reconcile when maintained separately.
- A prescription does not prove that medicine was administered.
- Repeated entry of egg production can inflate available stock and reports.
- Farm staff need access to their assigned working area without exposing unrelated farms.
- Managers need useful summaries whose figures can be traced to stored records.

### 1.2 Objectives

1. Replace browser-only mock records with MongoDB-backed records through an Express API.
2. Reuse the existing React interface and shared components.
3. Complete the most important workflows from data entry through reporting.
4. Enforce authentication, permissions, scope, date rules, and state transitions on the server.
5. Preserve the distinction between diagnosis, prescription, and administration.
6. Calculate bird counts, egg totals, stock balances, formula costs, and financial summaries consistently.
7. Deliver an application another student or evaluator can install and demonstrate from the README.

### 1.3 Definition of a successful course submission

- Each of the five default roles can demonstrate its required workflow.
- Records survive server restart, browser refresh, and sign-in from another browser.
- Editing an API request cannot bypass permissions or farm restrictions.
- Repeated submissions cannot create duplicate stock, sales, or administration events.
- Dashboard and report figures reconcile with the underlying records.
- Setup instructions, sample data, API documentation, and acceptance evidence are included.

## 2. Existing codebase assessment

The repository is an implemented frontend prototype, not an empty application and not yet a complete MERN application.

| Area | Evidence in the repository | Implementation consequence |
| --- | --- | --- |
| Frontend foundation | React 18, Vite, React Router, Axios, plain CSS in `package.json` | Keep the current frontend stack; a framework rewrite is unnecessary |
| Navigation | `src/config/modules.js` generates navigation and routes; `PAGE_REGISTRY` in `src/app/routes.jsx` registers built pages | Integrate existing pages and register only genuinely new pages |
| UI controls | Shared forms, tables, dialogs, feedback states, layout, and design tokens | Reuse these components and styling conventions |
| Authentication | `AuthContext.jsx`, mock auth/user services, a mock session in `sessionStorage` | Replace mock identity restoration with a server-authenticated `/auth/me` request |
| Permissions | Permission constants, role grants, `useAuth()`, `<Can>`, and route guards | Retain permission-code checks; use the API as the authority for grants |
| Organization | Hierarchy CRUD, scope assignment, selectors, `FarmContext.jsx`, and `organizationService.js` | Preserve the hierarchy and selector behavior while implementing server enforcement |
| Operations | Daily reports, clinical visits, medication, inventory, formulas, production, sales, expenses, notifications, analytics, and audit pages | These are reusable interfaces, but their storage and rules remain mock implementations |
| Mock isolation | Auth, users, and organization have service facades; `workService.js` directly contains browser storage and business logic | Move operational mock logic under `src/services/mock/` and introduce real feature adapters |
| Asynchronous behavior | Several work pages call `workService.list/create/update/transition` synchronously, including during rendering | Converting a facade to Axios alone is insufficient; pages need asynchronous loading, saving, and error handling |
| Database and API | No Express server, MongoDB models, or backend dependency manifest is present | Create the backend rather than assuming the source PRD's earlier backend exists here |
| Existing checks | `tests/organization.test.mjs` and `tests/workService.test.mjs` exercise mock workflows | Preserve them as mock checks; they do not establish API security or database correctness |
| Remaining UI QA | `PROGRESS.md` records browser, responsive, and accessibility verification as pending | Complete those checks during full-stack acceptance |

### 2.1 Gaps that must be resolved deliberately

1. **Daily reports and egg production are independent mock records.** The target uses submitted report revisions as the source of production so the same eggs cannot be entered twice.
2. **Inventory has a company-wide mock balance.** The target tracks balances and movements per farm/location.
3. **A mock prescription creates one task.** The target supports several prescription items and one task per scheduled occurrence.
4. **Dates are currently filtered in the browser.** The target restricts data before API responses and exports are produced.
5. **Mock authority is supplied by the browser.** Actor IDs, roles, prices, calculated totals, and stock balances must not be trusted as authorization or calculated truth.
6. **Audit records are browser data.** The target records audit events on the server and provides no ordinary mutation API for them.
7. **File upload and server export endpoints are absent.** Add the scoped versions defined in this document.
8. **Role editing is absent.** Add a small role-and-permission administration interface; multiple roles per user remain an extension.

## 3. Scope and project size

### 3.1 Required course-project scope

The baseline is one organization with multiple sites, farms, houses, and flocks. It includes all modules below at the stated depth; it does not require enterprise infrastructure.

| Area | Required baseline |
| --- | --- |
| Identity | Staff login/logout, persistent server sessions, profile, password change, administrator-issued accounts and password reset |
| Access control | Five default roles, permission editing, one role per user, site/farm assignments, protected administrative controls |
| Organization | Site/farm/house/flock management, archive/restore, valid parent relationships, active working-area selection |
| Daily operations | Complete structured daily report, mortality, post-mortem observations, corrections, weekly weight measurements |
| Clinical | Visits, multiple prescription items, simple recurring schedules, separate administration outcomes |
| Inventory | Item catalog, farm stock locations, opening stock, receipts, issues, adjustments, paired transfers, low stock |
| Feed | Formula composition, submission, separate pricing/finalization, immutable finalized versions |
| Eggs and sales | Production derived from reports, collection-room stock, sales in eggs/Peti, stock checks, payment status |
| Finance | Recorded expense categories, daily sales revenue, recorded costs, operating surplus/deficit |
| Evidence and alerts | Authorized image attachments, comments, durable in-app alerts, medical emergency acknowledgement and resolution |
| Insights | Scoped dashboard, required report views, CSV downloads, printable daily report |
| Accountability | Server audit events for access changes and important business changes |
| Delivery | Local setup, deployed demonstration, seed data, acceptance checks, README, API documentation |

### 3.2 Optional extensions after the baseline works

- Audio evidence, native push, email/SMS/WhatsApp delivery, and automated escalation.
- Multiple roles per user, house-specific staff assignments, delegated administration, MFA, and email-based self-service recovery.
- Offline synchronization, native Android/iOS apps, and installed desktop applications.
- Flock relocation, concurrent-flock exceptions, automatic bird transfers between flocks, and retrospective population reconciliation.
- Supplier/customer master modules, invoices, taxes, credit ledgers, purchase orders, and sales returns.
- Inventory batch/lot expiry, feed manufacturing/recipe stock consumption, and medicine-to-stock unit conversion.
- Supervisor-approved strain standards, missing-measurement reminders, additional bird parameters, and official ROI.
- Generated server PDF/XLSX reports, advanced charts, IoT integrations, and large-scale performance work.

These are explicit reductions from the broader source scope. Image evidence and in-app alerts remain required. Audio, external delivery, and advanced accounting are extensions to keep the baseline achievable for a course project.

### 3.3 Non-goals

Automated diagnosis or treatment recommendations, payroll, general accounting, public customer/supplier portals, multi-company SaaS billing, microservices, Kubernetes, and a real-time event platform are outside this project.

## 4. Users, permissions, and scope

### 4.1 Default role templates

Roles are stored permission templates. UI components check permissions, never role names. The API resolves permissions and scope from authenticated server-side records.

| Role | Main responsibilities | Default scope and restrictions |
| --- | --- | --- |
| Owner / Production Head | Organization and user administration, role permissions, all business modules, audit, management history | Organization-wide scope and historical access; separation of prescribing and administration still applies |
| Production Manager | Review daily reports, read operational summaries, manage operational alerts | Organization-wide business scope; no user/role administration by default; current/previous-day access unless explicitly granted history |
| Farm Manager | Daily reports, mortality, post-mortem observations, measurements, administration outcomes, formula composition, medical alerts | Assigned sites/farms; current/previous-day report access; no formula prices or general stock-ledger writes |
| Operation Manager | Inventory, feed costing, egg stock/sales, expenses, financial summaries | Assigned sites/farms; current/previous-day transaction access; no clinical write access |
| Doctor | Clinical visits, prescriptions, clinical history, clinical responses, measurement reads | Assigned sites/farms; historical clinical access; no default administration permission |
| Unassigned account | Sign in, change its password, view pending-access information | No business data until role and required scope are assigned |

The source gives the Production Manager broader administrative responsibilities than the current frontend. The restricted default above is a **proposed university-project choice**, preserving the existing frontend assumption. Broader privileges require an explicit role grant. Full historical analytics is initially granted only to the Owner; Doctor history is limited to clinical records.

### 4.2 Authorization requirements

**AUTHZ-01:** Every protected API action checks active session, permission, resource scope, permitted date policy, valid record state, and applicable separation of duty.

**AUTHZ-02:** Scope is explicit configuration, not a role-name condition in a page. A company-wide grant covers the organization. An assigned site includes its current and future farms; a direct farm assignment reveals its parent site without granting access to sibling farms.

**AUTHZ-03:** A newly assigned farm exposes only its own houses/flocks. The API derives and validates ancestor IDs; a valid `flockId` paired with an unrelated `farmId` is rejected.

**AUTHZ-04:** Deactivation, permission revocation, and scope removal take effect on the next protected request. The frontend clears inaccessible selections and previously loaded data after refresh or denial.

**AUTHZ-05:** Login identity is derived from the session. Request bodies cannot choose `actorId`, `createdBy`, role, scope grants, or administrator status.

**AUTHZ-06:** The prescriber cannot record an administration outcome for their own prescription, including if later granted another role or administration permission. The baseline applies this restriction to both completed and missed outcomes.

**AUTHZ-07:** The last effective active administrator cannot be deactivated, demoted, or stripped of recovery permissions. Concurrent changes must not bypass this safeguard. Self-demotion/deactivation follows the existing prohibited default.

**AUTHZ-08:** Formula rate, cost, and financial fields are omitted from responses to users lacking their read permissions, including nested versions, audit changes, and exports.

### 4.3 Permission catalog

Use the existing identifiers in `src/config/permissions.js` wherever they already express the action. Seed the same catalog on the server. Add identifiers before dependent endpoints/pages are implemented.

| Capability | Existing or proposed codes |
| --- | --- |
| Organization and assignments | Existing `organization.view`, `organization.manage`; assignment changes initially require organization and user management |
| Users and roles | Existing `users.view`, `users.manage`; add `roles.view`, `roles.manage` |
| Daily reports | Existing `daily-reports.view`, `daily-reports.manage`, `daily-reports.review`; add `daily-reports.submit`, `daily-reports.correct-history` |
| Mortality and measurements | Existing `mortality.view`, `bird-parameters.view`, `bird-parameters.manage`; report write controls embedded mortality; add `bird-population.manage` for Owner-authorized placement/reconciliation entries |
| Clinical | Existing `clinical.view`, `clinical.manage`; add `clinical.history.view` |
| Administration | Existing `medication.view`, `medication.administer`; add `medication.correct` for audited corrections |
| Inventory | Existing `inventory.view`, `inventory.manage`; add `inventory.adjust`, `inventory.transfer` |
| Formulas | Existing `feed-formulas.view`, `feed-formulas.compose`, `feed-formulas.cost`; add `feed-formulas.submit`, `feed-formulas.cost-view`, `feed-formulas.finalize`, `feed-formulas.return` |
| Egg collection | Existing `egg-production.view`, `egg-production.manage`; manage controls collection stock adjustments, not duplicate production entry |
| Sales and finance | Existing `sales.view`, `sales.manage`, `finance.view`, `finance.manage` |
| Alerts | Existing `notifications.view`; add `notifications.raise`, `notifications.acknowledge`, `notifications.respond`, `notifications.resolve` |
| Insights | Existing `dashboard.view`, `reports.view`; add `reports.export`, `reports.history.view` |
| Audit | Existing `audit.view` |

The broad existing `notifications.manage` is a mock compatibility permission. Replace its live actions with explicit permissions. Other `.manage` permissions authorize documented editable fields; they never bypass finalization, scope, or separation rules. There is no need to introduce the source PRD's alternative permission naming scheme alongside this one.

### 4.4 Business dates and historical access

- Proposed organization timezone: `Asia/Karachi`; store it in configuration, independent of the computer's timezone.
- Persist event timestamps in UTC and business dates as validated `YYYY-MM-DD` strings interpreted in that timezone.
- Farm and Operation Managers can view/write dated operational records for today and the preceding calendar day. Production Manager uses the same history window by default. Reject forbidden ranges explicitly rather than downloading hidden data.
- Example: on 19 November 2026 in the business timezone, these users may query 18–19 November; a query beginning 17 November is denied.
- An omitted date filter uses the caller's permitted default window. Owner historical queries are still bounded and paginated.
- Doctor clinical-history permission permits earlier visits, prescriptions, administration history, and linked clinical measurements in assigned scope. It does not expose historical finance, inventory transactions, or entire daily reports.
- Long-lived working records remain usable: current stock balances, active flocks, pending formula handoffs, open medication tasks, and unresolved emergencies can be returned as current operational state even when originally created earlier. This exception exposes only fields needed to act, not unrestricted source history.
- Current balances are derived from the complete ledger; restricting transaction history must not reset a balance to the last two days of movements.
- An older returned report does not automatically grant a Farm Manager access. Owner handles older corrections with an explicit permission and reason. Extending correction access to other staff is an optional policy change.

## 5. Functional requirements

### M01. Authentication and staff administration

**ID-01:** Staff sign in using email/password, sign out, restore their session on refresh, and view their profile. Public signup is excluded.

**ID-02:** An administrator creates a staff account, assigns a temporary password, and separately assigns a role and scope. Accounts initially have no business access. Temporary passwords require change at first login; until changed, only session/password endpoints are available.

**ID-03:** Store password hashes, not plaintext passwords. Provide authenticated password change and administrator reset with a one-time temporary password. Never return existing credentials. Reset/deactivation invalidates existing sessions.

**ID-04:** Provide user search/list, profile editing, activation/deactivation, role assignment, and site/farm assignment. Prevent duplicate normalized email addresses.

**ID-05:** Provide a compact roles screen to list/create roles and edit permission checkboxes. Each user has one role in the baseline. Protect the bootstrap administrator's recovery access and prevent privilege grants outside the acting administrator's authority.

**Acceptance:** Login/logout, first-password change, unassigned-account blocking, session restoration, last-administrator protection, and immediate permission revocation are demonstrated through the API and UI.

### M02. Organization and flock context

**ORG-01:** Support `Organization → Site → Farm → House/Shed → Flock`, using separate referenced records and one organization root.

**ORG-02:** Required fields: site name/location; farm name and site; house name, farm, optional capacity; flock name, house, placement date, initial bird count, optional bird type/strain and age at placement.

**ORG-03:** Support create, list, detail, edit, archive, and restore. Names are case-insensitively unique within the same parent. Parent IDs cannot be changed after creation in the baseline.

**ORG-04:** A parent with active children cannot be archived. A record with unresolved medication tasks or unsubmitted work cannot be archived until those records are resolved or cancelled appropriately. Archived records retain historical references and cannot receive new operational entries.

**ORG-05:** Proposed baseline: one active flock per house; enforce this in the database. This deliberately replaces the mock assumption that permits concurrent active flocks. Confirm the change before migrating any real records.

**ORG-06:** Retain `useFarm()` for active site/farm/house/flock selection. Persist selection as a preference only; revalidate it against the server's accessible hierarchy after sign-in and access changes.

**Acceptance:** Owner creates the hierarchy and assigns a farm. Its manager sees that farm and its ancestors/children, cannot access a sibling farm by changing IDs, and cannot create mismatched parent references.

### M03. Daily reports, mortality, and post-mortem observations

**DAY-01:** Maintain one logical report per flock and business date. Drafts and revisions belong to that same report, with a database unique index preventing duplicate reports.

**DAY-02:** Include these sections:

| Section | Required information and behavior |
| --- | --- |
| Identity | Business date, derived site/farm/house/flock, reporting staff member, flock age/week where placement age is known |
| Eggs | Nonnegative integer counts for Jumbo, Starter, Standard, Small, Floor, Broken, Discard; total, saleable total, Peti equivalent |
| Egg weight | Repeatable weight samples with sample type, value and unit; support nine initial slots from the source description; average only comparable samples |
| Birds | Opening birds, placements/approved adjustments, mortality, closing birds; movement reason/reference where relevant |
| Weekly weight | Linked measurement, sample size, actual average weight, prior comparison; standard/variance only when reference data exists |
| Feed | Item/location reference, bags, bag size kg, additional kg, total kg, per-bird preview, extra feed notes |
| Environment | Water litres, light hours from 0–24, in-house observations |
| Medicine/vaccine | Repeatable entries with name, quantity/unit where known, optional prescription/administration link |
| Health | Mortality count, post-mortem observations, comments and image attachments |
| Visits/issues | Operational issues, linked doctor visit and visit remarks |

The source's undefined “Per Pe” measurement is an optional labeled note until its meaning and unit are confirmed. Do not invent a derived metric. The physical form is unavailable here, so exact print-layout matching is not a completion claim.

**DAY-03:** Support `draft → submitted → returned → submitted`. Submission validates required sections; return requires a review permission and reason. Each submission has a numbered immutable snapshot and actor/time. A return preserves the last published snapshot while the next revision is edited.

**DAY-04:** The API calculates totals. Mortality cannot exceed the available bird population; eggs/birds must be whole numbers and feed/water values nonnegative. Drafts may omit unfinished sections; blanks required for submission produce field errors rather than silently becoming zero.

**DAY-05:** Opening birds come from the flock opening record or preceding submitted closing balance. Do not let staff overwrite a derived opening count. Missing earlier days produce a visible gap and require an explicit opening reconciliation before continuity is assumed.

The flock's initial population creates an opening bird movement. Additional placements and population adjustments require `bird-population.manage`, a reason, and a business date; the Owner holds this permission by default. Reports display those movements and post their own mortality effect on submission. Staff cannot bypass a protected opening count by entering an arbitrary placement. Revisions replace the effective mortality through linked delta/reversal movements without deleting history.

**DAY-06:** Mortality is part of the report, with the Mortality page acting as a filtered view. Post-mortem observations are recorded as observations, with clinical diagnosis recorded by the Doctor separately. Zero-mortality reports may still contain health concerns.

**DAY-07:** Submission publishes production once. Later corrections apply only the difference between published revisions to egg/feed ledgers. A draft or return does not create a second production event or silently remove previously sold stock.

**DAY-08:** Block a correction that would create negative egg/feed stock. In the baseline, block population-changing corrections when later reports depend on that population; show a clear reconciliation requirement. Advanced chained population correction is an extension. Descriptive corrections remain possible with history.

**Acceptance:** A manager drafts, submits, receives a return reason, corrects and resubmits a report. All snapshots remain available to authorized users, and production is counted once.

### M04. Weekly bird measurements

**BIRD-01:** Record flock, measurement date/time, positive integer sample size, positive average weight, original unit, normalized grams, and notes.

**BIRD-02:** A report may link a measurement; linking does not create a duplicate measurement. Multiple samples on a date have separate identities.

**BIRD-03:** Show trends and differences from the preceding comparable observation. Do not sum average weights. If combining samples, use sample-size-weighted averages after normalizing units.

**BIRD-04:** Standard weight and expected gain remain unavailable until an approved strain/age standard is entered. Display “standard not configured” instead of manufactured targets.

**Acceptance:** A 1.6 kg entry and a 1600 g entry display consistently, and missing standards do not produce false variance figures.

### M05. Clinical visits and prescriptions

**CLIN-01:** A Doctor records a visit's farm/house/flock, timestamp, observations, diagnosis, parameters, remarks, and supporting evidence.

**CLIN-02:** A visit may have a prescription with multiple items. Each item records medicine name/reference, dose value/unit or explicit instructions, route (`water` or `feed`), start time, duration, scheduled times, and instructions. Optional tank/feed-batch labels are descriptive references.

**CLIN-03:** Use `draft → finalized → cancelled/completed` prescription states. Finalization generates tasks. Draft prescriptions do not imply treatment has started.

**CLIN-04:** The baseline schedule is daily at one or more explicit local times for a bounded number of days. The API previews occurrences and stores their UTC due timestamps. More complex schedules are excluded. Finishing a duration does not mark doses administered.

**CLIN-05:** A finalized prescription is not overwritten. Before any outcome, an authorized replacement cancels open tasks and generates a linked replacement version. After an outcome, completed evidence remains immutable and only future tasks can be cancelled/replaced with a reason.

**CLIN-06:** Doctor history follows clinical permission and farm scope. Historical access does not permit editing a finalized prescription or writing backdated outcomes without the corresponding action policy.

**Acceptance:** Two prescription items over three days generate the expected separate occurrences. The Doctor can inspect outcomes and earlier authorized history.

### M06. Medication administration

**MED-01:** List scheduled, due, overdue, completed, missed, and cancelled tasks by farm/flock. Scheduled/due/overdue are derived from due time and open state, not evidence of administration.

**MED-02:** An authorized non-prescriber records completed or missed outcome with actor, actual time, actual dose/unit when completed, and comments/reason. Missed requires a reason; completed requires actual dose or an explicit recorded instruction reference.

**MED-03:** Store administration events separately from prescription and task definitions. Only one effective outcome exists per task. Corrections append a superseding event with permission and reason; they never erase the original.

**MED-04:** A delayed recording retains both actual event time and server recording time. Reject future actual times; current open tasks may be acted on under the operational-state exception. Historical closed outcomes require correction permission.

**MED-05:** Medicine/vaccine text in a daily report is a reported observation, not an administration confirmation. Baseline administration does not automatically issue inventory, because dosage-to-stock unit conversion is undefined.

**Acceptance:** The prescriber is denied even with administration permission. A farm-side user completes one task once; retries do not duplicate its effective outcome.

### M07. Inventory and feed consumption

**STOCK-01:** Maintain inventory items with name, category (feed/ingredient/medicine/vaccine/supply), base unit, active status, and low-stock threshold per location. Create a main store and egg collection room for each farm as applicable.

**STOCK-02:** Store opening stock, receipt, issue, signed adjustment, transfer-out, and transfer-in as immutable movements. Opening stock is a movement, not an editable catalog balance.

**STOCK-03:** Transfers require authorization for both endpoints and create paired movements atomically. The receiving location gains exactly what the sending location loses; organization total is unchanged.

**STOCK-04:** Keep canonical units consistent: feed/ingredients in kg, eggs as integer counts, and each other item in its declared base unit. Bags convert using the recorded kg/bag. Reject unsupported conversions rather than guessing.

**STOCK-05:** Prevent negative stock, including under concurrent issues. Adjustments require a reason and adjustment permission. Reverse/correct a movement through linked compensating entries, never by editing a posted movement.

**STOCK-06:** Farm Managers can request report-linked feed consumption using report permission without gaining inventory management. Once the report is submitted, its authorized consumption creates one source-linked feed issue; an insufficient balance blocks publication with a useful error. Revisions post a delta. The Operation Manager must not manually issue the same report consumption again.

**STOCK-07:** Show current balances and low/out-of-stock conditions. Catalog availability does not reveal other farms' balances or transaction history.

**STOCK-08:** Generate source keys on the server. Report/sale-generated movements can only be corrected by their source workflow; generic reversal is limited to manual movements. Manual egg adjustments require `egg-production.manage` and a reason and cannot masquerade as report production. Reject future-dated postings. Backdated changes must preserve nonnegative running balances from their effective date forward as well as the current balance.

**Acceptance:** Receipt of 100 kg, issue of 20 kg, and transfer of 30 kg leave 50 kg at the source and 30 kg at the destination. Concurrent issues cannot overspend the remaining balance.

### M08. Feed formulation and costing

**FEED-01:** A Farm Manager creates a formula with code/name, farm, date, optional feed type/strain, version, bag size, and repeatable ingredient/positive-kg rows. Default bag size is 50 kg; store it on every version.

**FEED-02:** Use `draft → pending_costing → finalized`, with `pending_costing → returned → pending_costing` and archive after completion. Submission locks composition until returned. Return requires a reason.

**FEED-03:** Operation Manager enters a positive PKR/kg rate for every row, previews calculated costs, and finalizes using distinct permissions. Composition writers cannot inject rate fields through API payloads.

**FEED-04:** Finalization stores a complete immutable composition/rate/rounding/bag-size snapshot. Revising a finalized version creates a new linked draft; previous costed versions do not change.

**FEED-05:** Formula records are planning and costing documents. Creating/finalizing a formula does not manufacture feed, consume ingredients, or automatically create an expense.

**Acceptance:** For 60 kg at PKR 10/kg and 40 kg at PKR 20/kg, total is 100 kg and PKR 1,400; cost/kg is PKR 14; cost per 50 kg bag is PKR 700. Farm Manager responses omit rates/costs.

### M09. Egg collection and sales

**EGG-01:** Submitted daily-report revisions are the production source. `/egg-production` becomes a read/reconciliation view grouped by farm, house, flock, date, and category, rather than another unrestricted entry form.

**EGG-02:** One Peti equals **360 eggs**. Keep integer egg counts as the source of quantity; a decimal Peti display must not replace precise stock counts.

**EGG-03:** Proposed saleable defaults: Jumbo, Starter, Standard, Small. Floor, Broken, and Discard remain collected but unsaleable by default. The supervisor may approve another category policy before implementation. Store the policy version used for posting.

**EGG-04:** Publish saleable eggs to that farm's collection room with a source-linked receipt by category. Existing Broken/Discard/Floor counts are already excluded; do not subtract them again as generic damaged/rejected quantities. Later breakage is a separately authorized stock adjustment.

**EGG-05:** Record a sale with business date, farm/collection location, buyer name/reference, one or more category lines, eggs or whole Peti quantity, selected-unit price, totals, and `pending/paid` status. A posted sale represents issued stock; payment status does not change quantity sold.

**EGG-06:** Post the sale and stock deduction together. Reject overselling by category and location, sales against future-dated collections, and duplicate retries. A date-restricted user sees current stock without receiving its entire historical movement list.

**EGG-07:** Posted sale quantities/prices are immutable. Before physical dispatch, cancellation with reason reverses stock and revenue atomically. Real customer returns after dispatch are an extension. Payment-status changes are separately audited.

**Acceptance:** Publication of 720 saleable eggs creates two Peti of available stock. Selling one Peti leaves 360 eggs; a retry leaves the same quantity; a subsequent two-Peti sale is denied.

### M10. Expenses and daily financial results

**FIN-01:** Record farm, business date, expense category, positive PKR amount, description/reference, creator, and optional attachment. Categories initially include Feed, Medicine/Vaccine, Labour, Electricity, and controlled Other with required description.

**FIN-02:** Use non-cancelled posted sale totals as recorded sales revenue, regardless of pending/paid status; this is a sales-date view. Display unpaid value separately. It is not a cash-flow or accounting ledger.

**FIN-03:** Recorded cost is the sum of active expense entries for the selected dates and scope. Formula finalization, stock receipts/issues, and report consumption do not create costs again. An expense linked to a source document must not be booked twice.

**FIN-04:** Show recorded revenue, recorded cost, and operating surplus/deficit. Include source drill-down and a clear incomplete-cost indicator when applicable. Expense correction uses an audited void-and-replacement flow.

**FIN-05:** Do not label surplus as official profit or ROI. ROI is optional until an investment base, cost allocation, valuation of unsold eggs, formula, and worked example are approved.

**Acceptance:** Sales of PKR 18,000 and recorded expenses of PKR 7,000 show PKR 11,000 operating surplus; costing a feed formula does not change it.

### M11. Evidence and comments

**FILE-01:** Attach images to authorized report/post-mortem, clinical visit, emergency, and expense records. Comments record author/time and belong to the same scope as the parent.

**FILE-02:** Proposed baseline limits: JPEG/PNG/WebP, 5 MB each, up to five files per parent record. Validate declared type, actual file signature, count, and size on the server; use generated storage names.

**FILE-03:** Store file metadata and parent links in MongoDB; store binary files in a private persistent directory for the course deployment. Every download checks parent read permission, scope, and date policy. Never expose the directory as public static content.

**FILE-04:** Use authenticated upload to an existing editable parent. Remove abandoned temporary files after failed linking. Archive/retain submitted evidence rather than silently deleting it; audit authorized draft deletions.

**FILE-05:** A deployment without persistent disk must use private object storage behind the same service interface. Browser-local files and ephemeral server storage do not satisfy persistence.

**Acceptance:** An image remains accessible after restart to authorized staff; another farm's user cannot download it with the file ID or copied route.

### M12. Notifications and emergencies

**ALERT-01:** Store durable in-app notifications with farm/source, severity (`info`, `reminder`, `warning`, `critical`, `emergency`), recipients, timestamps, and source link. Poll while the relevant UI is active; WebSockets are unnecessary for the baseline.

**ALERT-02:** A Farm Manager can raise a medical alert and choose severity. The server selects active Doctors assigned to the farm plus authorized management recipients. If no Doctor is assigned, show that state and route to the Owner; never imply delivery to a nonexistent recipient.

**ALERT-03:** Emergencies follow `open → acknowledged → resolved`; allow response notes between acknowledgement and resolution. A Doctor's clinical response is distinct from acknowledgement. Resolution requires an authorized actor and note; critical/emergency resolution requires prior acknowledgement.

**ALERT-04:** Track each recipient's seen/acknowledged state separately from shared emergency status. Store record creation and delivery-to-inbox timestamps; do not claim external push delivery.

**ALERT-05:** Generate deduplicated low-stock, overdue-medication, and awaiting-costing reminders. Mortality alerts use a configured demonstration threshold, clearly documented as a project rule rather than veterinary advice. Missing-report reminders and escalation deadlines are extensions.

**Acceptance:** A manager raises a farm medical alert, the assigned Doctor sees and acknowledges it, records a response, and an authorized user resolves it with preserved history.

### M13. Dashboard, reports, and exports

**REPORT-01:** Return dashboard metrics from server queries, with scope/date applied before aggregation. Do not download all records and hide forbidden data in React.

**REPORT-02:** Include production/saleable eggs, mortality, feed used, stock shortages, due/completed/missed medication, open emergencies, sales value, recorded cost, and surplus where the user has the underlying permission. Cards link to corresponding source views.

**REPORT-03:** Provide report views for daily poultry, egg production, mortality, bird weight, medicine/vaccination, feed consumption, formula cost, inventory, sales, and daily financial results. A common filtered table/export mechanism may serve several categories.

**REPORT-04:** Filters include authorized site/farm/house/flock where relevant, business-date range, and status/category. Show incomplete, no-data, loading, and error states. Never invent seed values when a live query is empty.

**REPORT-05:** Support authorized CSV downloads and a printable daily-report view that can be saved as PDF through the browser. Generated PDF/XLSX endpoints are extensions. Exports enforce the same field, date, and scope rules as the screen.

**REPORT-06:** Historical reports require explicit history permission; exports do not widen it. Formula costs and financial totals require their own read permission even when `reports.view` is granted.

**Acceptance:** A restricted API/export request for an older day is denied, Owner can request permitted history, and displayed totals match exported source rows.

### M14. Audit

**AUDIT-01:** Record sign-in security events, account/role/scope changes, submissions/returns/corrections, prescription finalization/cancellation, administration outcomes, stock movements, formula costing, sale changes, expense changes, emergency transitions, and evidence changes.

**AUDIT-02:** Store actor, action, target type/ID, organization/farm context, UTC timestamp, request ID, relevant before/after changes, and reason. Do not store passwords, cookies, tokens, or unrestricted uploaded file contents.

**AUDIT-03:** Audit events are append-only through application APIs. Their creation is part of the successful business transaction for critical mutations. Only authorized users can view/filter them. Application audit storage is not claimed to be tamper-proof against a database administrator.

**Acceptance:** Owner can trace a report correction and stock effect to its actor and reason; ordinary staff cannot create, alter, or delete audit events directly.

## 6. Calculation and state rules

### 6.1 Calculation definitions

| Value | Baseline rule |
| --- | --- |
| Total collected eggs | Sum of the seven mutually exclusive egg categories |
| Saleable eggs | Sum of categories enabled by the recorded saleability policy |
| Peti equivalent | Integer egg count / 360; display rounding does not change stock |
| Closing birds | Opening birds + placements + approved positive adjustments − mortality − approved negative adjustments |
| Transfers | Cross-flock bird transfers are excluded from baseline; do not expose mock transfer inputs as a working transfer workflow |
| Mortality percentage | Mortality / opening birds × 100; return unavailable when denominator is zero |
| Egg production percentage | Proposed demonstration convention: collected eggs / opening birds × 100; label the convention and confirm before treating it as an operational standard |
| Feed consumed kg | Bags × recorded bag size kg + additional kg |
| Feed per bird g | Feed kg × 1,000 / opening birds; unavailable when denominator is zero |
| Egg sample average | Sum of comparable sample weights / number of samples; never mix units or sample types without conversion |
| Weight difference | Current normalized average − preceding comparable normalized average |
| Formula row cost | Ingredient kg × PKR/kg, rounded to two PKR decimals |
| Formula total | Sum of rounded row costs; total kg is sum of row kg |
| Cost/kg | Formula total / total kg; report to four decimal places |
| Cost/bag | Unrounded decimal cost/kg × version's bag size kg; round to two decimals |
| Sale amount | Quantity in the selected sales unit × price per that unit; sum line amounts rounded to two decimals |
| Stock on hand | Opening + receipts + transfer-ins + positive adjustments − issues − transfer-outs − negative adjustments |
| Daily operating surplus/deficit | Non-cancelled posted sales revenue − active recorded expenses |

Aggregation rules matter: sum counts and money; calculate percentages from aggregated numerator/denominator; normalize and weight bird samples appropriately. Never sum average weights or average percentages without their denominators.

### 6.2 Precision and authoritative values

- Counts are integers. Quantities in kg/litres use up to three decimal places; ingredient rates use up to four; PKR totals use two.
- Use decimal arithmetic on the server and MongoDB decimal storage for quantities/rates/money. Return decimal values as strings in JSON. One small decimal arithmetic dependency is justified by costing requirements.
- Use round-half-up for the stated rounded values. Store calculation/policy versions on finalized snapshots. Do not use formatted UI strings as calculation inputs.
- Reject invalid numbers and excess precision explicitly. Recompute derived values from allowed inputs; ignore neither malicious totals nor unsupported fields silently—reject them with validation errors.
- The frontend may show a labeled preview. The response after successful save supplies authoritative values.

### 6.3 Reliable transitions

- Use an expected `version` on editable records. A stale update receives `409 VERSION_CONFLICT`, with a refresh/review path.
- Use explicit transition endpoints. A generic update must not set arbitrary status values.
- Retry-sensitive writes accept an idempotency key scoped to actor/operation. Reusing it with the same payload returns the original result; a different payload conflicts.
- Unique source references protect against duplicates even after an idempotency cache expires.
- Report publication, stock movement/balance changes, sale posting/cancellation, prescription scheduling, and their audit events use transactions.
- A prescription becomes completed only when all its tasks have recorded outcomes or cancellations; a past end date alone is insufficient. A resolved emergency and a finalized formula remain locked unless their documented correction/revision workflow is used.
- Notification creation is durable with the source change, or is retried through a persisted, deduplicated event. A notification failure must not silently lose the event or repeat the business write.

## 7. MERN architecture

### 7.1 Application shape

```text
React + Vite browser application
  → Axios feature service adapters
  → Express /api/v1
  → session + validation + permission/scope/date policies
  → module services and transactional business rules
  → Mongoose models → MongoDB
  → private media storage through a file service
```

Use one backend application and one database. Retain React Context for authentication, farm context, and toast feedback. Introduce larger state-management tools only if an actual need appears.

### 7.2 Repository structure

Keep the existing root frontend to minimize disruption:

```text
/
  src/                         existing React application
    app/                       routes and protection
    config/                    modules, permission identifiers, mock defaults
    context/                   AuthContext, FarmContext, ToastContext
    components/                existing reusable UI
    features/                  feature hooks and components
    pages/                     existing pages, integrated incrementally
    services/
      api.js                   shared Axios transport and error normalization
      authService.js
      userService.js
      organizationService.js
      workService.js           compatibility facade during transition
      endpoints/               live feature API adapters
      mock/                    all browser-only mock implementations
  server/
    package.json
    .env.example
    src/
      app.js                   Express assembly; exported for API checks
      server.js                configuration, database connection, listen
      config/
      middleware/              auth, permissions, validation, error handling
      policies/                scope, dates, separation of duties
      modules/                 auth, users, roles, organization, reports,
                               clinical, medication, inventory, formulas,
                               sales, finance, files, alerts, analytics, audit
      jobs/                    simple durable reminder processing
      scripts/                 bootstrap, demo seeds, migrations/indexes
    tests/
  docs/                        API specification and later acceptance evidence
  tests/                       retain existing frontend mock checks
```

Each backend module owns its routes, validation, controller, service, and model files as needed. Controllers handle HTTP; services contain business decisions. Avoid both a giant controller and unnecessary abstraction layers for simple CRUD.

### 7.3 Authentication and browser integration

- Use server-side sessions persisted in MongoDB, with an opaque session identifier in an HttpOnly cookie. JWT refresh-token infrastructure is unnecessary for the baseline.
- Set secure cookie options for the deployed HTTPS environment, choose SameSite settings for the actual hosting topology, rotate the session at login, and expire/invalidate it on logout/reset/deactivation.
- Protect state-changing requests against CSRF with a server-validated token and origin checks. Restrict credentialed CORS to the configured frontend origin where separate origins are used.
- Prefer the same public origin for the SPA and `/api/v1` to simplify deployment. A Vite development proxy may provide the same path locally.
- Set Axios credential handling and central 401/error conversion. `/auth/me` derives identity from the cookie; do not send a stored user ID as proof of identity.
- Replace `AuthContext`'s mock token/session-storage workflow intentionally. API responses keep useful user fields and permission arrays, but live login need not return a browser-stored token.
- Keep only non-sensitive preferences such as working-area selection in browser storage. Remove loaded business data on logout and session expiry.

### 7.4 Mock-to-API migration

1. Preserve UI-facing facade names where useful, but make live methods consistently asynchronous.
2. Move the existing operational mock implementation under `src/services/mock/`; retain it only for explicit demo/development mode.
3. Serialize MongoDB `_id` as API `id` on the server. Keep feature adapters consistent about that ID, decimal strings, dates, and error normalization.
4. Refactor synchronous `list` calls in page render functions into hooks/effects. Await mutations before closing forms or showing success.
5. Replace client-wide fetch/filter/pagination with server queries and pagination while preserving `DataTable`'s presentation interface.
6. Refresh affected records and summaries after mutations. Ignore/cancel stale responses after farm changes or logout.
7. Send no browser actor/role fields to authorize operations. The mock signature may temporarily accept an actor for compatibility, but the live adapter must discard it.
8. Keep integrated modules on real data. Do not silently fall back to local mock data when an API request fails.
9. Align `VITE_API_BASE_URL` with `/api/v1`; the current example ends in `/api`. Use `VITE_APP_NAME=LayerFlow` when implementation begins.
10. Disable demo password helpers and developer-only routes in the submission build unless explicitly documented as demonstration controls.

## 8. MongoDB data model

This is a logical schema plan. Write field validators and concrete schemas before each module; MongoDB references do not provide relational foreign-key enforcement automatically.

### 8.1 Collections and relationships

| Collection | Main fields and relationships |
| --- | --- |
| `organizations` | Name, timezone, currency, egg saleability policy, relevant demonstration settings |
| `users` | Organization, name, normalized email, password hash, active flag, password-change flag, one role reference, scope mode and assigned site/farm IDs |
| `roles` | Organization, code/name, permission-code array, protected flag |
| `sessions` | Session-library server records, user association, expiry; never returned as business data |
| `sites` / `farms` / `houses` / `flocks` | Parent reference, normalized name, active/archive status, identifying fields; flock placement and initial population |
| `dailyReports` | Scope references, flock/date identity, current draft/returned data, latest published revision reference, version/status |
| `reportRevisions` | Report ID, revision number, immutable submitted sections, calculated totals, actor/time, calculation policy, source posting references |
| `birdMovements` | Flock, business date, placement/mortality/adjustment, count, reason, source report revision; no baseline cross-flock transfer |
| `birdMeasurements` | Scope, sample time/date, sample size, original unit/value, normalized average, optional standard reference |
| `clinicalVisits` | Scope, visit time/date, Doctor, diagnosis, observations, parameters, remarks, prescription references |
| `prescriptions` | Visit/scope, prescriber, status/version, bounded embedded items with stable IDs, schedule definition, replacement linkage |
| `medicationTasks` | Prescription/version/item, occurrence number, due UTC time, scope, effective outcome reference, cancellation state |
| `administrationEvents` | Task, actor, actual/recorded times, outcome, dose/unit, notes, superseded event and correction reason |
| `inventoryItems` | Organization catalog, name/category/base unit, active flag |
| `stockLocations` | Farm, name/type (main store or egg collection room), active flag |
| `stockBalances` | Item or egg category, location, exact current quantity, version; transactional cache reconciled to ledger |
| `stockMovements` | Item/category, location, signed quantity/type, business date, actor, source key, paired transfer/reversal reference |
| `feedFormulas` / `feedFormulaVersions` | Logical formula and working version; versioned ingredient kg/rates, bag size, state, immutable finalized cost snapshot |
| `sales` | Farm/location, sale date, buyer reference text, bounded lines/category/quantity/unit/price, total, payment state, posting/cancellation references |
| `expenses` | Farm/date, category, amount, source reference, description, active/void state and replacement reference |
| `media` / `comments` | Parent type/ID, scope, author, file metadata/storage key or comment text; inherit parent access |
| `notifications` / `notificationRecipients` | Source/deduplication key, severity/shared lifecycle; recipient seen/acknowledged times and response history |
| `auditEvents` | Actor/action/target/scope/time/request, redacted change details/reason |
| `idempotencyRecords` | Actor/operation/key, request fingerprint, committed result reference, expiry |

Embed bounded child structures that are read with their parent, such as prescription items or sale lines. Keep growing histories, tasks, movements, evidence, and audit events in separate collections. Do not embed a farm's entire history in one document.

Operational records include organization/farm context, derived site/house/flock references where relevant, business date, UTC timestamps, creator/updater, status, and version. Denormalized ancestor fields are derived and checked server-side. Parent changes are excluded from the baseline, simplifying historical consistency.

### 8.2 Required indexes and integrity controls

- Unique organization + normalized user email; role code/name unique within organization.
- Unique parent + normalized entity name, including archived records until an explicit rename policy exists.
- Partial unique index for an active flock per house, following the proposed occupancy rule.
- Unique `(flockId, businessDate)` for a logical report and `(reportId, revisionNumber)` for its snapshots.
- Unique prescription-version/item/occurrence key for tasks; one effective outcome per task enforced transactionally.
- Unique `(locationId, itemOrCategoryKey)` for stock balances.
- Unique stock source-action-revision-line key; two transfer legs use distinct keys under one transfer ID.
- Unique notification source/rule key, recipient/notification pair, and actor/operation/idempotency key.
- Query indexes for farm + business date, flock + business date, task state/due time, notification recipient/state, and audit actor/target/time.
- Session and idempotency expiry indexes support cleanup; application code must still reject expired sessions without waiting for background deletion.

MongoDB transactions require a suitable deployment. Use an Atlas development database or a local replica set from the foundation phase, not a standalone setup that cannot execute required multi-document writes. No paid infrastructure is required by this PRD; availability of any hosting tier must be checked when deploying.

Create repeatable seed/index scripts and numbered, idempotent migration scripts for later schema changes. Do not import mock plaintext users or browser storage wholesale. Development demo data is generated independently; production-like bootstrap credentials come from environment input and must not be committed.

## 9. API contract plan

### 9.1 Common contract

- Base path: `/api/v1`; JSON except file upload/download and CSV.
- IDs: API returns string `id`; adapters hide MongoDB-specific representation from pages.
- List query: `page`, `pageSize`, allowed `sort`, search, scope IDs, status, and `from`/`to` as appropriate. Default page size 20, maximum 100.
- Default maximum dated query span: 90 days within the caller's history permission. Larger history can be requested in bounded chunks.
- Dates/times, decimal strings, version, allowed transitions, field visibility, and permission requirements are documented per endpoint.
- Use `200` for success, `201` for creation, `204` for a successful empty response, `400` malformed input, `401` missing/expired session, `403` forbidden action/date, `404` missing or inaccessible resource, `409` state/duplicate/stock/version conflict, `422` field validation, and `413` oversized upload.
- For an otherwise valid resource ID outside the user's scope, use the same `404` response as a missing resource. Do not disclose its existence in an error.
- Validate request fields and query operators with allowlists; reject unknown protected fields. Never pass arbitrary user JSON as a MongoDB filter/update.

Example successful list:

```json
{
  "data": [{ "id": "report-id", "businessDate": "2026-11-19", "version": 2 }],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

Example error, mapped by the frontend into the existing `ApiError`:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Check the highlighted fields.",
  "fieldErrors": { "eggs.standard": "Enter a nonnegative whole number." },
  "requestId": "request-id"
}
```

### 9.2 Endpoint groups

These paths form the planned contract; write request/response examples before implementing each group. All permissions and policies in Sections 4–6 apply, including to detail and download endpoints.

| Group | Planned routes |
| --- | --- |
| Health | `GET /health`, `GET /ready` (minimal status, no secrets) |
| Session | `GET /auth/csrf`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password` |
| Staff | `GET/POST /users`, `PATCH /users/:id`, `PUT /users/:id/role`, `PUT /users/:id/scope`, `PATCH /users/:id/status`, `POST /users/:id/reset-password` |
| Roles | `GET/POST /roles`, `PATCH /roles/:id`, `GET /permissions` |
| Organization | `GET /organization/hierarchy`; `GET/POST /sites`, `/farms`, `/houses`, `/flocks`; `GET/PATCH /<resource>/:id`, `POST /<resource>/:id/archive`, `POST /<resource>/:id/restore`; `POST /flocks/:id/population-adjustments` for authorized placements/reconciliations |
| Daily reports | `GET/POST /daily-reports`, `GET/PATCH /daily-reports/:id`, `POST /daily-reports/:id/submit`, `POST /daily-reports/:id/return`, `GET /daily-reports/:id/revisions` |
| Mortality/weights | `GET /mortality`, `GET/POST /bird-measurements`, audited correction on `/bird-measurements/:id` |
| Clinical | `GET/POST /clinical-visits`, `GET/PATCH /clinical-visits/:id`, `POST /clinical-visits/:id/prescriptions`, `PATCH /prescriptions/:id` for drafts, `POST /prescriptions/:id/preview-schedule`, `/finalize`, `/cancel`, `/replace` |
| Administration | `GET /medication-tasks`, `GET /medication-tasks/:id`, `POST /medication-tasks/:id/outcomes`, `POST /administration-events/:id/corrections` |
| Inventory | `GET/POST /inventory/items`, `PATCH /inventory/items/:id`, `GET /inventory/locations`, `GET /inventory/balances`, `GET/POST /inventory/movements`, `POST /inventory/transfers`, `POST /inventory/movements/:id/reverse` |
| Formulas | `GET/POST /feed-formulas`, `GET/PATCH /feed-formulas/:id`, `POST /feed-formulas/:id/submit`, `/return`, `/finalize`, `/revise`, `/archive`; `PUT /feed-formulas/:id/rates` |
| Production/sales | `GET /egg-production`, `GET/POST /sales`, `GET /sales/:id`, `POST /sales/:id/cancel`, `PATCH /sales/:id/payment-status` |
| Finance | `GET/POST /expenses`, `GET /expenses/:id`, `POST /expenses/:id/void`, `GET /finance/summary` |
| Evidence | `POST /files` with parent linkage, `GET /files/:id/content`, `DELETE /files/:id` for authorized draft removal, `GET/POST /comments` with parent reference |
| Alerts | `GET/POST /notifications`, `GET /notifications/:id`, `POST /notifications/:id/seen`, `/acknowledge`, `/responses`, `/resolve` |
| Insights | `GET /dashboard`, `GET /reports/:type`, `GET /reports/:type/export?format=csv` |
| Audit | `GET /audit-events`, `GET /audit-events/:id` |

For shorthand action suffixes, the full route retains its group prefix and `/:id`. No generic endpoint accepts arbitrary collection names or arbitrary status transitions.

### 9.3 Authorization examples to document

- `daily-reports.manage` can edit a permitted draft but cannot return it or change its published snapshot.
- `reports.view` alone cannot expose formula costs, finance, or historical rows.
- `inventory.transfer` requires access to both source and destination locations.
- `medication.administer` cannot override the prescriber restriction.
- `GET /files/:id/content` checks the parent record, even if the caller already knows the ID.
- `GET /inventory/balances` can expose authorized current stock while dated movement history remains restricted.

## 10. Step-by-step implementation phases

Every phase is a working increment: define its contract, implement its MongoDB rules and Express API, connect the relevant React UI, and record its acceptance result. Reuse completed frontend work. Do not mark a full-stack phase complete because the mock screen exists.

### MERN Phase 0 — Confirm the baseline and plan the first slice

**Depends on:** Nothing. **Priority:** Required.

1. Read this PRD alongside `PROGRESS.md`, `ASSUMPTIONS.md`, existing permission constants, and the affected pages/services.
2. Record the proposed defaults from Section 12 as adopted demonstration decisions or supervisor-approved replacements.
3. Inventory each existing service method and its callers; label synchronous operational calls that require conversion.
4. Write the initial data dictionary, role/permission matrix, date policy, and API response/error examples in `docs/`.
5. Choose a MongoDB transaction-capable development setup and one intended demonstration deployment topology.
6. Record the current frontend baseline without changing user files; preserve existing mock checks and note pending browser QA.

**Deliverables:** Agreed baseline, integration checklist, schema/API outline, dependency list.

**Exit gate:** The first implemented story is “server login → scoped farm hierarchy,” and no unresolved foundational rule is hidden in a component.

### MERN Phase 1 — Establish Express and MongoDB foundations

**Depends on:** Phase 0. **Priority:** Required.

1. Add `server/` with its own package manifest and JavaScript module configuration. Keep root Vite commands working.
2. Add server configuration for port, MongoDB URI, frontend origin, session secret, business timezone, upload directory, and environment mode. Supply examples without secrets.
3. Implement app assembly, database connection, health/readiness endpoints, centralized errors, request IDs, safe logging, input validation, and request-size limits.
4. Add session persistence, credentialed CORS/development proxy design, cookie handling, CSRF foundation, login rate limiting, and deployment security headers.
5. Define shared authorization/date-policy helpers, decimal serialization, pagination, version handling, and transaction/idempotency conventions before dependent modules.
6. Prepare seed/index and migration entry points and define environment inputs for one-time Owner bootstrap. Implement the account bootstrap with the user/role schemas in Phase 2; do not commit a production password.
7. Define future root/server run commands and update setup documentation for running frontend and API in two terminals.

**Deliverables:** Runnable backend, connected database, configuration samples, common API conventions.

**Exit gate:** The server reports database readiness, hides internal errors, and a development transaction succeeds on the selected MongoDB setup.

### MERN Phase 2 — Implement authentication, users, and permissions

**Depends on:** Phase 1. **Priority:** Required.

1. Create user/role schemas, normalized-email indexes, password hashing, protected Owner safeguards, default role/permission seeds, and the environment-driven one-time Owner bootstrap.
2. Implement login, logout, `/auth/me`, session expiry, first-login password change, authenticated change, and administrator reset.
3. Implement user CRUD actions, activation/deactivation, one-role assignment, and revocation of sessions/privileges.
4. Add role list/create/edit APIs and a small permission-editor UI using existing controls. Protect sensitive grants and the final administrator.
5. Integrate `authService.js` and `userService.js`; update `AuthContext` to restore from the cookie, use server permissions, and handle 401 globally.
6. Keep `/pending-access` for unassigned accounts. Make login/password-required/forbidden states explicit.
7. Record allowed/denied examples for account creation, role edits, session revocation, and the protected administrator.

**Deliverables:** Real login, MongoDB users/roles/sessions, live Users screen and role editor.

**Exit gate:** A user can authenticate from a clean browser, is forced to change a temporary password, and loses access on the next request after deactivation or grant removal. Unassigned users cannot retrieve business data.

### MERN Phase 3 — Persist the organization and enforce farm scope

**Depends on:** Phase 2. **Priority:** Required.

1. Create organization/site/farm/house/flock schemas with parent, name, archive, and occupancy constraints.
2. Implement authorized CRUD/archive/restore and derive ancestors server-side. Reject creation under an archived parent.
3. Implement user site/farm assignment and reusable scope query builders; apply them to lists, hierarchy, and detail routes.
4. Replace the organization facade with live calls and preserve the flat arrays expected by `FarmContext`.
5. Integrate assignment dialogs, organization lists, top-bar selection, stale-selection cleanup, and empty-assignment states.
6. Generate representative hierarchy data with at least two farms and users who have different assignments.

**Deliverables:** MongoDB hierarchy, scoped assignments, integrated organization screens/selectors.

**Exit gate:** An assigned manager cannot reach another farm through list/detail/write requests or mismatched ancestor IDs. Archive/restore and active-flock uniqueness work through the API.

### MERN Phase 4 — Deliver daily reports, mortality, and measurements

**Depends on:** Phase 3. **Priority:** Required.

1. Define report, immutable revision, bird movement, and measurement schemas; enforce flock/date uniqueness.
2. Agree the structured fields and required-at-submission rules in M03. Add repeatable medicine/vaccine and egg-weight sample sections to the existing form.
3. Implement draft save, server-derived population/totals, Owner-authorized placement/reconciliation entries, submit, review return, resubmit, expected-version checks, and correction reasons.
4. Define source posting keys and the production/feed publication hooks now. Their ledgers are completed in Phases 6 and 8; document that stock posting is not yet complete at this interim gate.
5. Integrate asynchronous daily-report list/detail/form states and change mortality to a live filtered view.
6. Connect weekly measurements, unit normalization, optional report links, and trend-ready normalized data. Keep standards unconfigured unless supplied.
7. Record revision, duplicate, invalid-count, forbidden-date, zero-denominator, and dependent-population correction scenarios.

**Deliverables:** Persistent report lifecycle, mortality/post-mortem text, measurements, calculated summaries, revision history.

**Exit gate:** A valid report survives restart, can be returned and corrected with preserved snapshots, and cannot be duplicated or edited through a stale version. Ledger posting remains an explicit dependency of the complete submission workflow until Phases 6 and 8.

### MERN Phase 5 — Deliver clinical visits and independent administration

**Depends on:** Phase 3; use Phase 4 context/measurements where linked. **Priority:** Required.

1. Create visit/prescription/task/administration-event schemas with stable item/occurrence keys.
2. Implement visit entry, multiple prescription items, explicit daily times/duration, schedule preview, and finalization.
3. Generate recurring tasks idempotently in the finalization transaction. Derive scheduled/due/overdue state from server time.
4. Implement independent completed/missed outcomes, actual/recorded times, correction events, and prescriber blocking on every outcome route.
5. Implement cancellation/replacement without overwriting completed evidence; distinguish future tasks from already recorded outcomes.
6. Refactor the Clinical and Medication pages for asynchronous calls, repeatable prescription items, task filtering, and actual outcome fields.
7. Apply clinical-history reads separately from operational report dates; validate direct detail requests as well as lists.

**Deliverables:** Visit-to-prescription-to-administration workflow with recurring tasks and attributable evidence.

**Exit gate:** A Doctor creates a three-day schedule, an authorized different person records outcomes, the prescriber is denied, and repeated finalization/outcome requests do not duplicate tasks or evidence.

### MERN Phase 6 — Implement location-based inventory and feed issues

**Depends on:** Phases 3–4. **Priority:** Required.

1. Create catalog, locations, immutable movements, and balance schemas; convert the mock company balance model to per-location balances.
2. Implement opening movements, receipts, issues, adjustments with reasons, paired transfers, and movement reversals.
3. Make balance changes conditional and transactional so concurrent requests cannot create negative stock.
4. Add source deduplication and reconciliation between cached balances and movement sums.
5. Complete daily-report feed publication and correction deltas. Limit Farm Manager writes to the report-linked path and prohibit duplicate manual consumption posting.
6. Integrate inventory item/location filters, movement forms, transfer endpoints, balances, and low-stock views with asynchronous calls.
7. Record wrong-farm transfer, unsupported-unit, insufficient-stock, retry, concurrent-issue, and report-revision scenarios.

**Deliverables:** Farm stock ledger, stock controls, live inventory screen, report-linked feed consumption.

**Exit gate:** Stock reconciles after receipt/issue/transfer, users cannot spend another farm's stock, and a repeated report submission issues feed once.

### MERN Phase 7 — Implement feed composition and versioned costing

**Depends on:** Phases 2–3; Phase 6 for catalog reuse. **Priority:** Required.

1. Create logical formula and version schemas, row identities, bag-size configuration, and exact decimal calculation rules.
2. Implement compose/save/submit without accepting rates from composition-only users.
3. Implement pending-costing queue, rate entry, cost preview, finalization, and return reason with explicit permissions.
4. Implement a new draft from a finalized snapshot and preserve the old version without mutating it.
5. Integrate the existing formula page and pricing interface; redact costs from restricted API responses and exports.
6. Verify the worked costing example, precision/rounding, missing rates, stale edits, and version preservation.

**Deliverables:** Complete composition-to-costing handoff, exact calculations, versioned history.

**Exit gate:** Farm Manager can submit but cannot price or retrieve cost fields; Operation Manager can finalize; revising does not change the previous finalized cost.

### MERN Phase 8 — Integrate egg stock, sales, and basic finance

**Depends on:** Phases 4 and 6. **Priority:** Required.

1. Configure saleable categories and collection-room locations. Complete report production posting by category with unique source/revision keys.
2. Turn the Egg Production page into a read/reconciliation view of published reports. Remove independent live entry that would duplicate eggs.
3. Implement correction deltas and prevent publication changes that would reduce stock below already issued quantities. Keep the last published report effective while a correction is being drafted.
4. Implement multi-line sale creation, selected-unit pricing, whole-Peti conversion, stock deduction, idempotency, cancellation, and payment-status updates.
5. Implement expense entry, void/replacement, controlled categories, source deduplication, and daily financial aggregation.
6. Refactor Sales and Finance pages to fetch stock/summaries from APIs rather than calculating from all browser records.
7. Reconcile report production, feed deductions, egg movements, sale revenue, and expenses using a small worked dataset.

**Deliverables:** Complete report publication effects, live egg stock/sales, expenses, daily operating results.

**Exit gate:** The same collected eggs cannot be counted twice, concurrent sales cannot oversell, corrections cannot create negative stock, and the financial example in M10 matches stored records.

### MERN Phase 9 — Add evidence, medical alerts, and in-app reminders

**Depends on:** Phases 4–8 for relevant source records. **Priority:** Required.

1. Implement private file storage adapter, metadata, parent authorization, validation limits, download checks, and cleanup.
2. Add images/comments to reports/post-mortem observations, visits, expenses, and emergency records using existing modal/form patterns.
3. Implement manual medical alert creation, scoped Doctor recipient resolution, no-Doctor fallback, and notification recipient records.
4. Add seen/acknowledge/respond/resolve actions and enforce note/prior-acknowledgement rules for severe events.
5. Add simple restart-safe reminder processing for low stock, overdue tasks, and formulas awaiting costing. Persist deduplication keys; do not add a queue platform solely for the demo.
6. Integrate notification polling, unread status, source links, severity/state filters, and retry/error feedback.
7. Demonstrate an emergency response chain and an inaccessible attachment request.

**Deliverables:** Persistent authorized images, comments, durable alert workflow, basic reminders.

**Exit gate:** A medical alert reaches an assigned Doctor's inbox, acknowledgement/response/resolution are attributable, and copied file routes do not bypass access controls.

### MERN Phase 10 — Complete dashboard, reports, exports, and audit views

**Depends on:** Implemented source modules in Phases 4–9. **Priority:** Required.

1. Audit events must already be emitted by earlier services; consolidate the read-only API/view and check coverage across modules.
2. Implement bounded server aggregation for dashboard cards and trends with permission-aware field selection.
3. Implement the required report types through reusable filters/tables; define correct units, denominators, and incomplete-data behavior.
4. Apply time/scope restrictions to aggregation, drill-down, detail, and export paths. Preserve current balance/open-task exceptions without leaking source history.
5. Add CSV exports with correct escaping and protection against spreadsheet formula execution in user-supplied text. Add a printable daily-report view.
6. Integrate Dashboard, Analytics, and Audit pages; replace browser-wide record aggregation and label unavailable metrics.
7. Reconcile UI and export totals against known inputs and record history-denial scenarios.

**Deliverables:** Live management overview, required reports, CSV/print output, searchable audit viewer.

**Exit gate:** Report values reconcile, restricted history cannot be retrieved through an alternative API/export, and cost/finance fields remain permission-protected.

### MERN Phase 11 — Verify, deploy, and prepare the submission

**Depends on:** All required preceding phases. **Priority:** Required.

1. Complete meaningful backend unit/API/database checks for the acceptance scenarios in Section 13, including authorization, state, retries, concurrency, and calculations. Keep existing mock checks separately identified.
2. Complete browser workflow checks with each default role, a clean browser, expired sessions, empty data, API failures, and multiple farm assignments.
3. Check common phone/tablet/desktop widths, keyboard operation, labels, focus handling, touch targets, and modal/table behavior. Capture evidence of the previously pending visual pass.
4. Build the frontend and start the production API against a non-mock database. Confirm that submission builds do not silently select mock services.
5. Deploy the SPA/API/database and persistent private file storage. Configure HTTPS, sessions, CSRF/CORS, SPA route fallback, environment secrets, and readiness behavior.
6. Create a repeatable, clearly labeled demo seed command using relative business dates. Avoid the existing fixed sample dates making every restricted screen empty.
7. Demonstrate backup and restoration of database plus attachment data, then confirm persistence across server restarts.
8. Finish README, environment tables, API specification/collection, schema diagram, adopted decisions, acceptance results, screenshots, and a short demonstration script.
9. Review known limitations against optional extensions. Resolve every required baseline gap or explicitly agree a reduced submission scope before calling the project complete.

**Deliverables:** Integrated deployed demonstration, reproducible local setup, acceptance evidence, complete submission documentation.

**Exit gate:** A fresh setup follows the README successfully and the connected demonstration in Section 14 passes using only real API/MongoDB data.

### 10.1 Dependency and priority guide

```text
0 Scope → 1 Backend foundation → 2 Identity → 3 Organization
  → 4 Daily reports and measurements
  → 5 Clinical and administration
  → 6 Inventory and feed posting
  → 7 Feed formula costing
  → 8 Egg publication, sales, and finance
  → 9 Evidence and alerts
  → 10 Dashboard, reports, exports, audit viewer
  → 11 Verification, deployment, submission
```

Follow this sequence for a straightforward solo implementation. The dependency notes allow an experienced team to change order, but this plan does not require parallel developers. Audit writing, validation, scope/date policies, and basic verification belong in each module from its first live endpoint.

If course time becomes limited, first demonstrate Phases 1–5 as one persistent, permission-protected farm/clinical workflow, then complete inventory and sales. Treat that as a smaller interim milestone; it does not satisfy the full baseline in this PRD. Remove optional extensions before reducing required workflow depth.

## 11. Non-functional requirements

### 11.1 Security and privacy

- HTTPS for deployment, hashed passwords, protected server sessions, CSRF defense, restricted CORS, login rate limits, and field-level validation.
- No committed secrets, plaintext production credentials, client-trusted authority, or sensitive session/password values in logs or audit records.
- Authorization on lists, details, aggregates, mutation endpoints, downloads, and exports. Reject MongoDB operator injection and arbitrary update fields.
- Configured body/upload limits, private media, safe generated filenames, and sanitized download names.
- Production errors provide useful safe messages and request IDs without database traces.
- Browser-visible `VITE_*` settings contain public configuration only. Server credentials stay in server environment variables.

### 11.2 Reliability and data integrity

- Use database indexes, optimistic versions, transactions, and idempotency for the documented invariants.
- Authorize both current and proposed scope when modifying records; baseline business records cannot move to another farm/date through generic updates.
- Retain submitted evidence, financial/stock posting history, and actor/time for corrections.
- Do not show success before the server confirms a save. Preserve entered fields after recoverable errors.
- Persist files and database records across restart; verify restore rather than merely describing backups.

### 11.3 Performance targets for the course demonstration

These are proposed evaluation targets, not measured current performance or a commercial service guarantee.

- Use a sample dataset of approximately 5 farms, 20 flocks, and 10,000 dated operational records.
- On the documented development machine/network, at least 95% of ordinary paginated reads and writes should complete within 2 seconds; dashboard/report responses within 3 seconds, excluding large file transfer and cold-start effects.
- Keep list responses paginated, queries indexed and bounded, and media bodies out of record lists.
- Record observed timings in final verification. Investigate failed targets with query/index evidence before adding caches or infrastructure.

### 11.4 Usability and accessibility

- Retain the existing plain CSS and design-token system, consistent layouts, reusable controls, and feedback states.
- Make common report/administration tasks usable at roughly 360 px phone width as well as tablet and desktop widths.
- Provide visible labels, helpful required-field errors, keyboard navigation, clear focus, status text alongside color, and touch-friendly controls.
- Long forms use understandable sections, draft save, and a review step. Tables use controlled scrolling or compact responsive presentation.
- Display business timezone, consistent date/unit/currency formats, calculated/read-only labels, and precise remaining egg counts alongside Peti previews.

### 11.5 Maintainability

- Keep UI service calls behind facades, business calculations on the server, permission identifiers centralized, and feature code grouped by module.
- Avoid new frontend dependencies when existing controls can implement the feature.
- Document every adopted business default and each changed API contract. Use repeatable seeds/migrations and small reviewable increments.
- Update `PROGRESS.md` as MERN work is completed without replacing its historical frontend checklist or unrelated user edits. Add a clearly separate MERN section during implementation.

## 12. Decision register and proposed defaults

The following choices are intentionally explicit. They may be adopted for the demonstration during Phase 0; replacing one requires updating its calculations, schema, permissions, and acceptance examples together.

| Decision | Proposed baseline | Confirmation or extension trigger |
| --- | --- | --- |
| Project platform | Responsive React web application | Native mobile is outside baseline |
| Organization | One organization, multiple sites/farms | Multi-company tenancy requires a separate scope design |
| Staff roles | One role per user, configurable permission templates | Multiple-role membership is optional |
| Production Manager authority | Business oversight, organization-wide scope, no default access administration or history | Source is broader; supervisor decides whether to grant more |
| Business timezone | Asia/Karachi, configured centrally | Change before recording operational dates |
| Report history | Today/previous calendar day for restricted managers; Owner history | Older corrections handled by Owner |
| Clinical history | Doctor can read earlier authorized clinical records | Does not unlock non-clinical history |
| House occupancy | One active flock per house | Differs from mock; reconcile before data migration |
| Flock lifecycle | Archive/restore, fixed parent, no cross-flock transfer | Relocation and population reconciliation are extensions |
| Report identity | One logical report per flock/date with submitted revisions | Multiple daily reports require another discriminator |
| Population basis | Derived opening/closing balances; explicit reconciliations | Block dependent historical population edits in baseline |
| Production percentage | Collected eggs / opening birds for demonstration | Confirm denominator with supervisor before operational use |
| Egg weights | Optional typed/unit-labeled sample rows, supporting nine initial slots | Exact paper semantics/layout need the missing source image |
| Undefined “Per Pe” | Optional note, no calculated value | Requires a definition and unit |
| Saleable categories | Jumbo, Starter, Standard, Small | Floor treatment requires explicit approval |
| Production ownership | Submitted report revisions supply production | Independent live production entry is removed |
| Sales units | Whole eggs or whole Peti; 360 eggs/Peti | Fractional Peti support is optional |
| Prescription schedule | Explicit daily times, bounded duration, multiple items | Complex schedules need a new validated contract |
| Administration restrictions | Prescriber cannot record completed/missed outcome | Applies regardless of role/grants |
| Inventory | Farm locations, exact units, no negative balance | Batch/expiry and medicine dose conversion are optional |
| Formula bags/pricing | Per-version bag size, default 50 kg; manual PKR/kg rates | Final snapshots retain exact rates/rounding policy |
| Financial recognition | Sales-date revenue and manually recorded expenses | No implied cash flow, accounting profit, or official ROI |
| Notification channels | Durable in-app inbox with polling | External channels and escalation are optional |
| Evidence | Images required; private persistent storage; audio optional | Confirm limits/storage topology before deployment |
| Export | CSV plus printable daily report | Generated PDF/XLSX is optional |
| Weekly standards | Unavailable until approved values exist | No invented strain targets |

## 13. Verification and release acceptance

During implementation, verify each slice with representative data and direct API requests. In Phase 11, run the complete workflow and required automated checks. A successful mock test is not a substitute for live authorization or concurrency checks.

| ID | Scenario | Required result |
| --- | --- | --- |
| AC-01 | Login, first-password change, refresh, logout | Server session restores identity; logout prevents further protected requests |
| AC-02 | New account without role/scope | Pending-access UI and no business records through API |
| AC-03 | Permission/scope removed or account deactivated during a session | Next protected request is denied; stale UI data is cleared |
| AC-04 | Change farm/house/flock IDs in a request | Wrong-scope and mismatched-ancestor access is denied |
| AC-05 | Concurrent changes that remove final administrators | At least one effective active administrator remains |
| AC-06 | Two creates for the same flock/business date | One logical report; duplicate conflicts or returns original idempotent result |
| AC-07 | Draft → submit → return → correct → resubmit | Actor/reason/revision history preserved; final totals computed by server |
| AC-08 | Seven egg categories, 360-eggs/Peti conversion, zero opening birds | Correct totals; zero denominator produces unavailable metric |
| AC-09 | Population continuity and historical dependent correction | Derived opening balance; unsafe dependent edit is blocked clearly |
| AC-10 | Three-day, two-item prescription; retry finalization | Expected unique task occurrences; no duplicate task generation |
| AC-11 | Prescriber attempts outcome with administration permission | Denied; another authorized farm-side user can record it |
| AC-12 | Duplicate outcome request and later correction | One effective outcome; original retained and correction attributable |
| AC-13 | Receive, issue, adjust, transfer, and reverse stock | Location balances reconcile with movements; both transfer scopes checked |
| AC-14 | Concurrent issues/sales against limited stock | One cannot spend stock already consumed by the other; no negative balance |
| AC-15 | Report submit/retry/correction after inventory integration | One feed issue/production receipt per source effect; only deltas on revision |
| AC-16 | Compose versus price/finalize a formula | Farm Manager cannot submit/read pricing; costing example and version history are correct |
| AC-17 | Production view, sale, cancellation/payment update | No duplicate production; stock and revenue change only under documented transitions |
| AC-18 | Financial example and formula finalization | Revenue/cost/surplus match; formula cost is not booked as another expense |
| AC-19 | Manual medical alert, Doctor acknowledgement/response, resolution | Correct recipients, visible no-Doctor fallback, actor/time/required notes retained |
| AC-20 | Guessed/copied file ID from another farm; invalid upload | Unauthorized content denied; invalid type/size rejected; valid image survives restart |
| AC-21 | Restricted historical list/detail/chart/export request | All paths enforce the business-day policy consistently |
| AC-22 | Doctor's older clinical history and unrelated finance history | Clinical records permitted within scope; unrelated historical data denied |
| AC-23 | Dashboard/report/export against known source data | Counts, decimal totals, weighted measurements, and permissions reconcile |
| AC-24 | Attempt to mutate audit through API | Denied; critical business changes have server-created redacted audit events |
| AC-25 | Server failure, expired session, stale edit, repeated save | Useful errors, preserved forms, version conflict flow, no false success or duplicates |
| AC-26 | Clean installation, production build, deployment restart, backup restore | Reproducible setup and persistent database/files; no mock fallback |
| AC-27 | Phone/tablet/desktop and keyboard workflow | Core forms, tables, dialogs, focus, labels, and actions are usable |

Recommended check layers are service calculation/state checks, Express API authorization checks against a transaction-capable test database, concurrency/retry integration checks for critical writes, and a small number of browser journeys. Use a separate test database; do not run destructive fixture resets against demonstration data.

## 14. Demonstration and final delivery

### 14.1 Connected demonstration script

1. Owner signs in, creates a site/farm/house/flock, adds staff, and assigns scope.
2. A new staff member changes the temporary password; an unassigned account demonstrates pending access.
3. Operation Manager records feed opening stock in the farm store.
4. Farm Manager records eggs, mortality, feed/water/light, a measurement, and a post-mortem image; reviews and submits a report.
5. Show the derived egg collection and feed stock effects, then return/correct/resubmit without duplicate posting.
6. Farm Manager raises a medical alert; assigned Doctor acknowledges it, records a visit, and finalizes a multi-item prescription.
7. Show that the prescriber cannot record its outcome; a different authorized user completes a due task.
8. Farm Manager submits a feed formula; Operation Manager enters rates and finalizes costing; show the preserved version.
9. Operation Manager sells one Peti, records an expense, and reviews stock and financial results.
10. Owner reviews dashboard/report totals, downloads CSV, prints a daily report, and traces actions in audit.
11. Demonstrate a wrong-farm API denial and a restricted history denial, then restart and confirm persistence.

### 14.2 Submission artifacts

- Existing React frontend integrated with the Express/Node API and MongoDB.
- Deployed demonstration URL and reproducible local run instructions.
- Environment examples for frontend/server, with no real secrets or committed credentials.
- Logical schema/relationship diagram, role/permission matrix, adopted decision register, and API specification or request collection.
- Repeatable bootstrap/demo-seed commands using relative business dates and clearly labeled sample medical data.
- Acceptance results, meaningful test output, responsive screenshots, and known optional limitations.
- Documented database/file backup and restore procedure.
- Updated project progress, README, and a concise demonstration script.

## 15. Risks and implementation discipline

| Risk | Response |
| --- | --- |
| Scope exceeds course time | Complete integrated slices in phase order; defer optional extensions first |
| Existing mock screens create a false sense of completion | Require API persistence, authorization, and acceptance evidence before ticking a MERN phase |
| Synchronous UI breaks after API replacement | Convert render-time service calls and mutations to explicit asynchronous hooks/actions |
| Report and production are counted twice | Use report revisions as the sole live production source and unique posting keys |
| Restricted history produces incorrect stock balances | Separate authorized current-state reads from dated movement-history access |
| Browser authority or broad role grants leak data | Resolve identity/grants server-side and apply shared scope/date/field policies to every path |
| Repeated or concurrent writes corrupt stock | Use source uniqueness, idempotency, version checks, conditional balances, and transactions |
| Missing paper/reference data leads to invented business rules | Keep the proposed defaults visible; leave undefined clinical standards/ROI unavailable |
| Deployment loses uploads or sessions | Use persistent private storage, MongoDB sessions, correct cookie topology, and restart/restore checks |
| Old seeds make the final demo appear empty | Generate relative-date sample data within restricted users' permitted business days |

A phase is complete when its required API/database behavior, integrated UI, permission boundaries, error states, and stated exit gate work together. The final app is complete for this PRD only when every required baseline acceptance scenario passes; optional extensions remain clearly separate.
