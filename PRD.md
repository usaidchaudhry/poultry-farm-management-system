# Sohni Dharti Poultry Management System

## Product Requirements Document

| Field | Value |
| --- | --- |
| Status | Draft for client and engineering review |
| Version | 0.2.2 |
| Last updated | 2026-10-14 |
| Product context | [Detailed application context](writing-block.md), version 2.0 |
| Client source | [Living client brief](https://docs.google.com/document/d/1yAEwSp-yALYxzUPiA7rsspHcSkFre7kgdT6OqfTpJX4/edit) |
| Prior client-source review | 2026-10-12; recorded in version 0.1 |
| Product surfaces | Flutter mobile app for Android and iOS; responsive web remains a possible later surface |
| Backend | FastAPI, PostgreSQL, Alembic |

This document turns the detailed application context into product requirements and an implementation structure. [writing-block.md](writing-block.md) supplies the field, workflow, and responsibility detail for this revision. The living client brief remains the place to confirm business decisions. Where these sources or the existing implementation differ, the discrepancy is recorded as a decision or migration task rather than silently resolved. Items marked **Open decision** require client confirmation; proposed details are separated from stated requirements.

The proposed relational model, constraints, indexes, ownership, and migration sequence are maintained in the [Database Schema Design](DATABASE_SCHEMA.md). The [decision register](DECISIONS.md) records what is stated, provisionally designed, or still needs a business answer. The available paper and formula references and field destinations are documented in the [P0-01 source map](P0-01_SOURCE_MAP.md). The [14 October client clarifications](CLIENT_CLARIFICATIONS_2026-10-14.md) record the supplied voice-note and image evidence, duplicates, confidence, and remaining questions. Handwritten arithmetic differences do not block the schema; the app calculates totals from entered values.

## 1. Product summary

Sohni Dharti is a poultry management system for production heads, production managers, farm managers, operation managers, and doctors. It should provide one controlled place to manage farm health activity, clinical work, medication administration, inventory, feed, egg sales, alerts, daily reporting, and management analytics.

The system must make responsibility visible. A doctor may diagnose and prescribe, while an independently authorized person records whether medicine was administered. Access is controlled through dynamic roles and granular permissions enforced by the backend.

## 2. Problem statement

Farm activity is distributed across roles and currently depends on manual logging and communication. This creates several risks:

- Health, mortality, treatment, inventory, and sales records may be incomplete or difficult to relate.
- Prescribing and administering medicine can be conflated, weakening accountability.
- Emergency communication may not receive a response appropriate to its urgency.
- Managers need different access to current and historical information.
- Fixed role logic would make the system expensive to change as responsibilities evolve.

## 3. Goals

### 3.1 Product goals

1. Give each authorized person a clear workspace for their daily responsibilities.
2. Create traceable records for the complete daily poultry report, mortality, post-mortem findings, clinical visits, prescriptions, medication administration, feed formulas and costing, inventory, egg production and sales, financial results, and alerts.
3. Enforce dynamic, server-side RBAC with separate read, write, approve, and administrative actions where responsibility differs.
4. Support company → site → farm → house → flock relationships, with the exact cardinality and lifecycle of houses and flocks confirmed before their schema is approved.
5. Provide dashboards and reports with server-enforced time-range restrictions.
6. Preserve evidence through timestamps, actor identity, audit history, pictures, audio, and comments where required.
7. Keep modules independent enough for multiple developers to work in parallel behind stable contracts.

### 3.2 Engineering goals

- Keep local Uvicorn development and Docker deployment operational.
- Use reviewed Alembic migrations for every schema change.
- Keep seed data repeatable and free of credentials.
- Authorize protected reads and writes at the API, including scope and time-range rules.
- Give each business module its own API, service, schema, Flutter feature, and tests.
- Avoid shared files becoming routine merge-conflict points.

### 3.3 Proposed success measures

Targets require client baselines and approval. The product should be able to measure:

- Percentage of required daily farm reports submitted on time.
- Percentage of scheduled medication administrations completed on time, missed, or overdue.
- Percentage of required weekly bird measurements recorded.
- Time from urgent/critical alert creation to acknowledgement and resolution.
- Inventory variance and frequency of preventable stockouts.
- Completeness of mortality and post-mortem evidence.
- Completeness of paper-report fields, feed formula costing, and egg/Peti conversions.
- Time required to prepare the daily management report.
- Unauthorized cross-farm, forbidden-action, and forbidden-history access incidents; the target is zero.

## 4. Non-goals for the first production release

- Automated medical diagnosis or treatment recommendations.
- Payroll, general accounting, or a complete ERP.
- IoT device integration.
- Supplier or customer self-service portals.
- Offline-first synchronization until the client confirms it is required.
- A separately installed desktop application. Responsive Flutter web can be evaluated after the mobile workflows are stable.

## 5. Users and responsibilities

| User type | Confirmed responsibilities | Initial product interpretation |
| --- | --- | --- |
| Owner / Production Head | Complete access, super-admin controls, dashboard analytics, historical analytics | Bootstrap owner plus full business and access-control permissions |
| Production Manager | Complete access, super-admin controls, dashboard analytics | Configurable role with broad business and access-control permissions; assignment of the protected Super Admin role remains restricted |
| Farm Manager | Mortality checks, medication administration, post-mortem records, media, comments, emergencies, complete daily reports, feed formula ingredients and quantities | Assigned farm/house health and daily-operation access; no formula pricing |
| Operation Manager | Inventory, feed stocks, formula ingredient pricing and costing, egg sales, daily financial results and ROI | Assigned farm/site operational and sales access |
| Doctor | Diagnosis, medication, dosage, visits, bird parameters, prescriptions in water/feed, remarks | Clinical access; explicitly cannot record medicine as administered |
| Unassigned account | None | No business-data access until an authorized administrator assigns a role and scope |

Roles are templates of permissions, not hardcoded application branches. A person may hold more than one role if the client approves that policy. Regardless of role combinations, a doctor cannot confirm administration of their own prescription.
The retired Site Manager role must not be introduced as a default role or navigation branch.

## 6. Product principles

1. **The API is authoritative.** Flutter visibility improves usability but never grants access.
2. **Responsibility is separated.** Prescription and administration are separate records and permissions.
3. **Every business record has context.** Records belong to a site and farm and, where the activity is specific to them, a house and flock. Their exact lifecycle and key relationships remain an open schema decision.
4. **History is controlled at query time.** The API validates requested dates; the client does not download forbidden history and hide it.
5. **Changes are attributable.** Sensitive state changes record actor, time, target, and before/after values.
6. **Operational failures remain visible.** Alerts, overdue administration, stock shortages, and incomplete reports have explicit states.

## 7. Scope and modules

### M01 — Identity and access control

**Status:** Session, global RBAC, and site/farm/house scoped business grants implemented; onboarding policy differs from the target context.

Capabilities:

- Administrator-issued credentials for normal staff onboarding. The existing public signup endpoint is an implementation gap to resolve before production.
- Login with server-side sessions.
- New accounts start with no roles or permissions until explicitly assigned.
- Owner bootstrap without seeded credentials.
- Create roles and assign granular permissions.
- Assign roles to users.
- Activate or deactivate accounts.
- Provide password recovery through an approved, secure workflow.
- Audit access-control changes.

Remaining extensions:

- Review and extend the implemented site/farm/house grants as new business modules are added; each new endpoint must enforce its own exact permission and scope.
- Prevent removal of the last effective administrator.
- Decide the credential issuance/recovery mechanism, identity provider, email verification, and multi-factor authentication. Existing signup remains available only as a current implementation fact, not the target onboarding requirement.

### M02 — Organization, sites, farms, and production context

**Purpose:** Establish the shared hierarchy required by all operational modules.

Confirmed requirement:

- A company has multiple sites; a site has multiple farms; a farm has multiple houses/sheds; each house normally runs a flock.
- Daily operations and reports identify the exact house and flock. Farm and site views aggregate the child records.

Proposed MVP capabilities:

- Create, view, edit, activate, and archive sites.
- Create, view, edit, activate, and archive farms under a site.
- Manage houses and flocks under their approved parent records once the hierarchy and lifecycle are confirmed.
- Assign users to one or more sites/farms.
- Support house assignments where needed for the user's responsibilities.
- Maintain farm timezone and basic identifying information.
- Select the active farm in the app when a user has access to several.

**Open decision:** Confirm concurrent-flock exceptions, multiple reports per flock/date, naming and identity on transfer, placement/transfer lifecycle, reopening/archival rules, and whether a separate production-cycle entity is needed. The ordinary hierarchy is established; one report per flock/date is the working schema choice.

### M03 — Daily farm records and mortality

**Purpose:** Support the farm manager's daily routine and daily report.

Requirements:

- Record one daily report for a flock and business date, carrying its exact house and farm context.
- Identify its site, farm, house, flock, business date, and reporting Farm Manager at the approved report granularity.
- Record egg counts for Jumbo, Starter, Standard, Small, Floor, Broken, and Discard. Calculate total eggs and Peti at **360 eggs per Peti**, and distinguish collected from saleable eggs. Calculate production percentage only with the client's approved bird-count convention.
- Record the paper form's Peti/sample egg weights and calculated average, plus additional samples where necessary.
- Record bird population, mortality, remaining birds, age/week, and separate placement, transfer, and adjustment movements so population calculations are traceable.
- Record weekly actual and standard bird weight, gain/loss, and configurable strain/age standards.
- Record feed bags, bag size, per-bird feed, the paper form's “Per Pe” measure once defined, light duration, water consumption, and extra feed material.
- Record multiple oral/premix medicine and vaccine entries with quantity and unit; link to a prescription where appropriate without equating an entry with administration.
- Record in-house issues, operational observations, and doctor visit remarks or a link to the structured visit.
- Record mortality count and individual/details where required.
- Record post-mortem findings as observations linked to mortality, not as a confirmed veterinary diagnosis.
- Attach pictures, audio, and comments to a post-mortem record.
- Support draft, submitted, returned-for-correction, and corrected/resubmitted states. Preserve original author, submission and review actors/times, and correction history. Confirm any further approval or signature stage before adding it.
- Show ongoing medication that needs administration follow-up.
- Prevent duplicate submitted reports at the approved farm/house/flock and business-date granularity; corrections use the explicit revision workflow.
- Reject negative mortality and egg counts and keep derived values consistent across API, app, and exports.
- Preserve an audit trail for corrections after submission.

The supplied [daily report photograph](references/poultry_report.jpeg) is the authoritative paper field/layout reference. Its essential categories and business terms must survive the mobile form and eventual PDF. The [source map](P0-01_SOURCE_MAP.md) records its fields. The app calculates egg and bird totals from recorded inputs; paper arithmetic is not a schema dependency. The daily report is a core farm workflow, not an analytics-only deliverable.

### M04 — Clinical visits and prescriptions

**Purpose:** Capture the doctor's diagnosis and treatment decision.

Requirements:

- Create a doctor visit for an authorized site, farm, house, flock, and date/time as applicable.
- Record diagnosis, observations, bird parameters, remarks, dosage, and relevant pictures/audio.
- Create prescription items with administration route: water or feed.
- Record medicine, dose, frequency, start time/date, duration, and instructions.
- Keep prescription status separate from administration status. Passing a scheduled time does not imply administration.
- Prevent a doctor from marking their own prescription administered, including when they hold another role. The default Doctor role has no administration write permission.
- Preserve clinical edits in the audit history.
- Let a Doctor with the dedicated clinical-history permission read earlier clinical visits, prescriptions, and related results throughout their authorized scope. Do not apply the Farm/Operation Manager current-plus-previous-day restriction to that medical history.
- Support treatment instructions that target water or feed batches, including named/numbered water tanks where used, plus biosecurity advice and diagnostic-test orders. The supplied handwritten note is a workflow example, not approved medicine master data.

**Open decisions:** Required medicine master data, dosage units, approval workflow, and whether a prescription can be edited after administration begins.

### M05 — Medication administration

**Purpose:** Provide independent evidence that prescribed medicine was given.

Requirements:

- List due, overdue, completed, missed, and cancelled administration tasks derived from prescriptions.
- Permit only users with medication-administration permission to record an outcome.
- Record actual administration time, person, quantity/dose, result, and optional comment/evidence.
- Record administration method and status, linked to the relevant prescription and schedule.
- Prevent the prescribing doctor from confirming their own prescription even if another role grants administration permission.
- Keep the prescription record and administration events separate.
- Audit corrections and cancellations.

### M06 — Inventory and feed stocks

**Purpose:** Give operation managers a reliable stock ledger.

Proposed MVP capabilities:

- Maintain inventory items, categories, units, and minimum-stock thresholds.
- Cover feed, ingredients, medicines, vaccines, and other supplies with an opening balance, location, and responsible recorder.
- Record receipts, consumption/issues, adjustments, and transfers between allowed farms.
- Maintain a separate or filtered feed-stock view.
- Calculate current balance from immutable stock movements.
- Show low-stock and out-of-stock conditions.
- Link medication or feed usage to the relevant farm record when possible, using one movement per real consumption to avoid duplicate deductions.
- Let a Farm Manager submit the daily consumption quantities tied to their report, without general stock-ledger write access.
- Give the Operation Manager stock receipt, issue, adjustment, transfer, and reconciliation operations; if farm staff need requests or observations, model those as separate restricted actions.

**Open decisions:** Supplier records, purchase orders, batch/lot tracking, expiry tracking, and approval thresholds.

### M07 — Egg production and sales

**Purpose:** Record egg output and sales handled by operations.

Proposed MVP capabilities:

- Record daily egg production by farm and category/grade.
- Record damaged or rejected quantities separately from saleable eggs.
- Create a sale with date, quantity, unit, unit price, total, buyer reference, and payment status.
- Support eggs and Peti as sales units and convert using **360 eggs per Peti**; calculate the amount using the applicable unit price.
- Keep production and sales as separate transactions. When the egg inventory ledger is implemented, deduct sales from available saleable stock and prevent overselling without an authorized adjustment.
- Move approved saleable production into an egg-collection-room stock location inside the same farm before sale. Sale issues stock from that location; production does not become a sale automatically.
- Provide daily sales totals.

**Open decisions:** Buyer/customer master data, invoices, taxes, payment collection, returns, the exact saleable categories, and the rollout point for a full egg stock ledger. Daily egg production itself is required.

### M08 — Bird parameters and weekly weight

**Purpose:** Replace the current logging receipt with structured measurements.

Confirmed requirement:

- Weekly weight plus other bird parameters must be recorded, including actual versus standard weight and gain/loss.

Proposed MVP capabilities:

- Record sample date/time, sample size, average weight, unit, and notes.
- Store configurable standard weight by breed/strain and age once the client supplies reference values.
- Record configurable additional bird parameters once the receipt fields are supplied.
- Display trends for users with matching analytics access.
- Flag missing scheduled measurements.

**Blocked input:** The referenced image of the current logging receipt and its exact fields are not present in the reviewed document.

### M09 — Notifications and emergency response

**Purpose:** Route operational events according to urgency and require an appropriate response.

Requirements:

- Create a notification or emergency linked to a farm and source record.
- Support configurable severity that maps the context's informational, reminder, warning, critical, and emergency/red-alert levels to explicit response rules. Final labels and thresholds require approval.
- Target permitted users, roles, or an on-call group.
- Track created, delivered, seen, acknowledged, escalated, resolved, and cancelled states as applicable.
- Require acknowledgement and resolution notes for urgent/critical events.
- Notify a Doctor for medical emergencies raised by a Farm Manager; allow acknowledgement, clinical response, and authorized closure as distinct actions.
- Create durable in-app records and use push delivery where supported.
- Keep an audit trail of status changes and responses.
- Support triggers for high mortality, overdue administration, incomplete reports, low stock, and feed formulas awaiting costing once thresholds and recipients are approved.

**Open decisions:** Push, SMS, WhatsApp, email, or in-app channels; response deadlines; escalation chain; and after-hours/on-call rules.

### M10 — Dashboards, analytics, and reports

**Purpose:** Present operational and management information without exposing prohibited history.

Requirements:

- Production head can view historical analytics across authorized sites/farms.
- Farm and operation managers receive only the time range allowed by policy.
- The API rejects or clamps unauthorized date ranges before querying and returning data.
- Dashboard cards and graphs link back to their source records.
- Daily reports summarize health, treatment, operational, and sales activity for the selected scope.
- Provide explicit no-data, incomplete-data, and unavailable states.

Initial metrics to validate with the client:

- Mortality count and rate.
- Medication due/completed/missed.
- Weekly weight trend and variance.
- Feed received, used, and balance.
- Inventory shortages.
- Egg production, sales quantity, and sales value.
- Water consumption, feed costs, bird weight versus client-supplied standards, farm/site comparisons, and whether performance is improving or declining.
- Open and overdue emergencies.
- Daily revenue, recorded cost, and operating surplus/deficit; display official ROI only after its formula and inputs are approved.

Farm and Operation Managers may read the current business day and preceding calendar day in their assigned scope, including through reports and exports. Define the business timezone centrally and test boundary dates. **Open decision:** Confirm how older records may be corrected and resolve the Production Manager's historical access; the detailed context reserves confirmed full history for the Production Head.

Doctors with `clinical_history.read` may read earlier medical history in their assigned scope for diagnosis and recurring-issue review. This exception applies only to authorized clinical records; it does not grant historical inventory, sales, finance, or general farm-report access.

Required report categories are daily poultry, egg production, mortality, weekly bird weight, medicine/vaccination, feed consumption, feed formula cost, inventory, egg sales, and daily financial/ROI. Filters enforce site/farm/flock/date authorization. PDF and spreadsheet exports are recommended; the daily PDF must preserve the paper form's essential categories and terminology.

### M11 — Media and file evidence

**Purpose:** Provide secure reusable storage for pictures and audio.

Requirements:

- Upload media using a backend-issued, authorized workflow.
- Associate media with a farm and source record.
- Store metadata, uploader, timestamps, size, type, and integrity information.
- Validate file type and size.
- Authorize download independently; possession of a client-side URL must not bypass access checks.
- Support deletion/retention rules only after the client confirms policy.

### M12 — Audit and administration

**Purpose:** Make sensitive activity reviewable.

Requirements:

- Record security events and meaningful business state changes.
- Provide an authorized audit viewer with actor, action, target, time, and structured change details.
- Prevent ordinary users from modifying audit records.
- Define retention and export rules before production launch.

### M13 — Feed formulation and costing

**Purpose:** Separate physical formula composition from commercial ingredient pricing.

**Implemented composition, handoff, and provisional costing (Alembic 0011–0013):** Farm-scoped drafts have a name and ordered ingredient-name/positive-kg rows, with a server-calculated total kg. Submission moves a draft to a pending costing queue. Authorized operations staff enter manual PKR/kg rates, preview server calculations, finalize an immutable cost snapshot, or return the formula with a reason. Finalized changes create linked new drafts without rewriting old costs. Cost reads, pricing, finalization, and return have separate scope-aware permissions. Optimistic versions and actor audit cover changes; development samples are labeled. The exact price, rounding, bag, and revision rules are temporary D06 assumptions awaiting client review. Formula codes, dates, strain, and ingredient master data remain open.

Requirements:

- A Farm Manager creates a formula with code, name, date, farm, feed type/strain, and any reasonable number of ingredient rows with quantities in kilograms. They cannot enter or edit prices.
- Submission moves the formula to the Operation Manager for costing. The Operation Manager enters valid PKR/kg rates, and only an authorized costing action may finalize it.
- Calculate each ingredient cost as `quantity kg × rate PKR/kg`, total kilograms and cost as row sums, `cost/kg = total cost / total kg`, and `cost/bag = cost/kg × configurable bag size kg`. Use decimal arithmetic and defined rounding rules.
- Default the supplied LSL/Hisex formula version to a 50 kg bag because its printed per-bag calculation establishes that size. Store bag size on every version so other formulas may use a different approved value.
- Support draft, pending costing, costed, returned for revision, and archived states. Preserve formula versions and the exact ingredient prices used for historical costs.
- Do not finalize a formula with missing or invalid rates. Approval beyond costing requires a separate client decision.
- Keep the [LSL and Hisex feed PDF](references/LSL%20and%20hisex%20layer%20feed.pdf) as field and layout reference data. The app calculates row and formula costs from stored quantities and rates; differences in the printed sample do not block schema or implementation.

### M14 — Financial performance and daily ROI

**Purpose:** Show the Operation Manager daily financial results from recorded business activity.

Requirements:

- Capture or derive egg-sales revenue and the confirmed daily cost categories: feed, medicine/vaccine, manpower/labour, and electricity. Additional categories require an active expense catalog entry rather than unstructured totals.
- Calculate total recorded cost and daily operating surplus/deficit with exact decimal values and explicit attribution of source records. Do not label operating surplus as ROI.
- Show daily results and breakdowns on the Operation Manager dashboard and authorized management reports.
- Store the inputs and calculation version needed to produce official ROI after the client approves the investment base, included costs, unsold-egg treatment, rounding, and formula.
- Do not present a provisional ROI percentage as the company's official metric.

## 8. Core workflows

### 8.1 New staff onboarding

1. An authorized administrator issues or initiates staff credentials through the approved onboarding mechanism.
2. The account has no data access.
3. An authorized administrator assigns site/farm/house scope as applicable and one or more roles.
4. The staff member refreshes or signs in again.
5. The API returns current permissions and scope.
6. Every subsequent API request rechecks permission and data scope.

### 8.2 Farm manager daily workflow

1. Select an assigned farm/house/flock and current business date; show the latest population, pending medication, and report status.
2. Record mortality and review scheduled medication administration.
3. Add post-mortem observations, pictures/audio, and comments where applicable.
4. Raise a medical emergency to the Doctor when severity requires it.
5. Complete egg production and weight, bird population/weight, feed/water/light, medicines, vaccines, issues, and doctor-visit sections.
6. Review derived values and submit the report; preserve its author and handle later corrections through the explicit workflow.

### 8.3 Doctor visit to medication administration

1. Doctor opens an authorized farm visit.
2. Doctor records diagnosis, parameters, remarks, and prescription.
3. The system creates the required administration schedule/tasks.
4. An authorized farm-side user records each administration outcome.
5. Doctor may view progress if granted read access but cannot record completion through the Doctor role.
6. Missed or overdue events may create notifications according to policy.

### 8.4 Emergency lifecycle

1. An authorized user raises an emergency with severity and supporting context.
2. The server resolves recipients from configured rules.
3. Recipients receive the event through enabled channels.
4. A responsible recipient acknowledges it.
5. Responses and escalation are timestamped.
6. An authorized user resolves the emergency with a resolution note.

### 8.5 Feed formula to costed batch

1. A Farm Manager enters ingredient names and kilograms without any price fields and submits the formula.
2. The Operation Manager receives the pending formula and enters valid rates in PKR/kg.
3. The server calculates row costs, total kilograms, total cost, cost/kg, and cost/bag using the configured bag size.
4. The Operation Manager finalizes costing or returns the formula for revision.
5. Later changes create a new version without rewriting historical cost evidence.

## 9. Authorization model

### 9.1 Authorization dimensions

Access to a business action is permitted only when all applicable checks pass:

1. Valid, active server-side session.
2. Required permission code.
3. Allowed site/farm/house scope, and flock scope where required.
4. Allowed time range.
5. Record state permits the transition.
6. Separation-of-duty rule permits the actor.

### 9.2 Proposed permission families

Permission codes use `<module>.<action>`. The exact catalog will be added through repeatable seed updates before routes depend on it.

| Module | Proposed actions |
| --- | --- |
| Sites/farms | `sites.read`, `sites.write`, `farms.read`, `farms.write`, `farm_access.manage` |
| Daily records | `daily_records.read`, `daily_records.write`, `daily_records.submit` |
| Mortality/post-mortem | `mortality.read`, `mortality.write`, `postmortem.read`, `postmortem.write` |
| Clinical | Implemented: `clinical_visits.read`, `clinical_history.read`, `clinical_visits.write`, `prescriptions.read`, `prescriptions.write`, `clinical_alerts.read`, `clinical_alerts.raise`, `clinical_alerts.acknowledge`, `clinical_alerts.respond`, `clinical_alerts.close`. Other clinical actions remain planned. |
| Administration | Implemented: `medication_administration.read`, `medication_administration.write`, `medication_administration.correct`. Tasks are explicitly scheduled from finalized prescriptions; dose/units and correction policy remain provisional. |
| Inventory/feed | Implemented: `inventory.read`, `inventory.write`, `inventory.adjust`, `inventory.transfer`, `feed_consumption.read`, `feed_consumption.write`. Proposed later: `feed_stock.read`, `feed_stock.write`. The report-linked feed slice records explicit kg with one issue per report under provisional D07 rules. |
| Feed formulas | Implemented: `feed_formulas.read`, `feed_formulas.cost_read`, `feed_formulas.write`, `feed_formulas.submit`, `feed_formulas.price`, `feed_formulas.finalize`, `feed_formulas.return`. Archive remains planned. Costing policies remain provisional under D06. |
| Eggs/sales | `egg_production.read`, `egg_production.write`, `egg_sales.read`, `egg_sales.write` |
| Parameters | `bird_parameters.read`, `bird_parameters.write` |
| Notifications | `notifications.read`, `notifications.send`, `notifications.acknowledge`, `notifications.resolve` |
| Finance | `expenses.read`, `expenses.write`, `financial_results.read`, `roi.read` |
| Analytics | `dashboard.read`, `analytics.current.read`, `analytics.history.read`, `reports.read`, `reports.export` |
| Administration | Existing user, role, activation, access-management, and future audit-view permissions |

### 9.3 Default role templates

Default roles are seeded or created as editable templates only after the client approves the matrix. Changing a default role affects users assigned to it; it does not add hardcoded exceptions.

| Role | Expected permission groups | Important restriction |
| --- | --- | --- |
| Owner / Production Head | All product and access-control groups | Bootstrap assigns the protected Super Admin role, whose grants follow the seeded catalog |
| Production Manager | Broad operational, report, and access-management groups | Super Admin Controls are stated in the live brief. Define their exact administrative boundaries and history window before granting the protected all-permissions role. |
| Farm Manager | Farm reports, mortality, post-mortem, medication administration, formula composition, notifications, current analytics | Current and previous business day only; no formula pricing |
| Operation Manager | Inventory, feed stocks, formula pricing/costing, egg sales, daily financial results, notifications, current analytics | Current and previous business day only; no unrestricted clinical write |
| Doctor | Clinical visits, prescriptions, full authorized clinical history, bird parameters, clinical read views, notifications | No medication-administration write; clinical history does not unlock non-clinical history |

## 10. Data model direction

The following boundaries are proposed for schema planning. They are not final table definitions.

| Domain | Core entities |
| --- | --- |
| Identity/access | User, LoginSession, Role, Permission, UserRole, RolePermission, UserScope |
| Organization | Company/Organization, Site, Farm, House, Flock, production cycle if confirmed, UserScope |
| Daily health | DailyReport, EggProductionDetail, EggWeightReading, BirdPopulationMovement, BirdWeightRecord, FeedConsumption, VaccineRecord, MortalityRecord, PostMortemRecord, Comment |
| Clinical | ClinicalVisit, Prescription, PrescriptionItem, AdministrationTask, AdministrationEvent |
| Feed formulas | FeedIngredient, FeedFormula, FeedFormulaVersion, FeedFormulaItem, IngredientPrice |
| Operations | InventoryItem, StockLocation, StockMovement, FeedStock detail/category |
| Eggs/sales | EggProductionRecord, EggStockMovement, EggSale, SaleLine |
| Parameters | ParameterDefinition, BirdMeasurement |
| Alerts | Notification, Recipient, DeliveryAttempt, Acknowledgement, Escalation, Resolution |
| Media | MediaObject, MediaLink |
| Finance | ExpenseRecord, FinancialSummary, approved ROI calculation/version |
| Reporting/audit | AuditEvent plus read models or aggregates where justified |

All farm business records should include stable IDs, scope, creator, created/updated timestamps, and lifecycle status where relevant. A central business-timezone rule must define day boundaries; any farm-specific timezone must follow that approved rule. The initial hierarchy migration establishes IDs and parent relationships; later feature migrations must add their own traceability and lifecycle fields as needed.

## 11. API and client contracts

### 11.1 API conventions

- Version business endpoints under `/api/v1` before the first business module ships.
- Use resource-oriented routes grouped by feature modules under `backend/app/api/`.
- Put reusable business rules under `backend/app/services/`.
- Define request/response schemas independently of ORM models.
- Use consistent pagination, filtering, sorting, validation errors, and UTC timestamp serialization.
- Generate and review OpenAPI changes as part of each feature.
- Require an idempotency strategy for mobile actions that may be retried, especially submissions, administration records, stock movements, sales, and alerts.
- Use optimistic concurrency or explicit version checks for records edited by multiple people.

### 11.2 Flutter conventions

Each feature owns its models, API adapter, state, screens, and widgets:

```text
lib/
  app/
    app.dart
    routes.dart
    theme.dart
  core/
    api/
    auth/
    errors/
    storage/
    widgets/
  features/
    access/
    organization/
    daily_records/
    clinical/
    medication_administration/
    feed_formulas/
    inventory/
    egg_sales/
    finance/
    bird_parameters/
    notifications/
    analytics/
```

Screens do not call raw HTTP directly. Feature APIs use the shared client, and server responses are converted into typed domain models. Protected data is refreshed from the backend rather than treated as permanently authorized because it was previously loaded.
Review the existing demonstration prototype for useful navigation and visual patterns, while applying this PRD's revised permissions and workflows. FastAPI, PostgreSQL, and server-side sessions are the implemented project stack; the context's Supabase services are a suggested alternative, not a required migration.

### 11.3 Backend modularization

Before several schema-owning modules begin in parallel, split the current shared model and schema files into packages to reduce merge conflicts:

```text
backend/app/
  api/
    organization.py
    daily_records.py
    clinical.py
    medication_administration.py
    feed_formulas.py
    inventory.py
    egg_sales.py
    finance.py
    notifications.py
    analytics.py
  models/
    auth.py
    access.py
    organization.py
    health.py
    clinical.py
    feed_formulas.py
    operations.py
    finance.py
    notifications.py
  schemas/
    auth.py
    access.py
    organization.py
    health.py
    clinical.py
    feed_formulas.py
    operations.py
    finance.py
    notifications.py
  services/
    scope.py
    organization.py
    daily_records.py
    clinical.py
    medication_administration.py
    feed_formulas.py
    inventory.py
    egg_sales.py
    finance.py
    notifications.py
    analytics.py
```

The package refactor should preserve behavior and precede parallel model work. `backend/app/main.py` remains app assembly and middleware only.

## 12. Delivery sequence

The executable task queue, dependencies, and handoff rules live in [plan.md](plan.md). The sequence is:

1. Reconcile the paper report, feed PDF, prototype, and current schema with this PRD; record unresolved decisions with owners and examples.
2. Complete foundation: approved onboarding/recovery, API contracts, modularization, and business-timezone policy.
3. Implement company/site/farm/house/flock organization, assignments, and server-side scope checks.
4. Deliver the complete daily report, mortality, post-mortem, media, and bird measurement workflows.
5. Deliver clinical visits, prescriptions, independent medication administration, and emergency response.
6. Deliver feed formulation/costing, inventory, egg production/sales, expenses, and daily financial results.
7. Deliver dashboards, trends, historical access enforcement, report categories, and approved exports/ROI.
8. Complete production security, recovery, Android/iOS validation, and acceptance testing.

After the organization contract is stable, independent modules may proceed in parallel. Every vertical slice includes the migration, service and route, read/write permission codes seeded idempotently, scope/time checks, audit records, backend tests, Flutter models and screens, and acceptance evidence. Feed formula composition and costing are separate permission boundaries. The complete daily report belongs to the farm workflow, not a later analytics phase.

## 13. Collaboration rules

1. Assign one owner to each workstream and one reviewer from another workstream.
2. Agree on API and event contracts before independent implementation begins.
3. Each pull request should stay within one vertical slice or one shared-contract change.
4. Shared-contract changes require notice to affected workstreams and compatibility notes.
5. Never hand-edit another workstream's migration. Resolve migration heads through a deliberate Alembic merge revision when parallel migrations occur.
6. Add permission catalog entries before protected routes reference them; seeding must remain repeatable.
7. Include authorization tests for allowed, denied, revoked, wrong-scope, and forbidden-date-range cases.
8. Keep generated OpenAPI changes reviewable and update the Flutter adapter in the same slice or through an agreed compatibility window.
9. Protect shared foundation files through code ownership or required reviewers.
10. Merge foundation and contract changes before dependent feature branches are rebased.

### Suggested ownership board

| Area | Primary owner | Reviewer | Contract status | Delivery status |
| --- | --- | --- | --- | --- |
| Foundation and organization | Unassigned | Unassigned | Draft | In progress |
| Farm health | Unassigned | Unassigned | Blocked by hierarchy | Not started |
| Clinical | Unassigned | Unassigned | Interim visit/prescription contract implemented; D05 still open | Core workflow ready for review |
| Medication administration | Unassigned | Unassigned | Explicit scheduling implemented; D05 still open | Provisional workflow ready for review |
| Operations and sales | Unassigned | Unassigned | Blocked by hierarchy and units | Not started |
| Alerts and media | Unassigned | Unassigned | Manual medical alert contract implemented; D09/media still open | Manual medical alerts ready for review |
| Analytics and reports | Unassigned | Unassigned | Blocked by source modules | Not started |

## 14. Non-functional requirements

### Security and privacy

- Use HTTPS in deployed environments.
- Hash passwords with the approved password hasher and never log credentials or raw tokens.
- Store only hashed server-side session tokens.
- Apply rate limits to authentication and any enabled credential issuance or recovery endpoint.
- Validate authorization for record reads, downloads, mutations, and aggregated queries.
- Use short-lived authorized media access or authenticated streaming.
- Redact sensitive values from logs and audit metadata.

### Reliability and data integrity

- Database constraints must protect invariants that cannot rely solely on the UI.
- Critical writes use transactions.
- Retried mobile requests must not silently create duplicate business events.
- Stock balances derive from movements; corrections are explicit rather than destructive rewrites.
- Submitted reports, administrations, and resolved emergencies retain correction history.

### Performance

- Paginate list endpoints and bound date-range queries.
- Avoid returning media bodies in ordinary record responses.
- Add indexes based on verified query patterns, especially farm, business date, status, and created time.
- Define measurable response-time and scale targets after expected farms, users, record volumes, and connectivity conditions are known.

### Accessibility and usability

- Support readable touch targets, text scaling, form validation, loading, empty, offline/error, and permission-denied states.
- Make critical status understandable without relying only on color.
- Keep high-frequency farm workflows short and usable on a phone.

## 15. Definition of done for a module

A module is complete only when:

- Client-approved fields and workflows are documented.
- Permission and scope rules are explicit.
- Alembic migrations upgrade from the previous release and have a reviewed downgrade strategy.
- Seeds are repeatable and contain no secrets.
- API endpoints enforce read/write/scope/time/state rules.
- Audit events exist for meaningful state changes.
- Backend tests cover permission boundaries and core state transitions.
- Flutter uses typed models and live backend calls for protected data.
- Flutter screens cover loading, empty, validation, error, denied, and success states.
- API and UI tests pass, and manual acceptance scenarios are recorded.
- README/runbook documentation is updated.

## 16. Release acceptance scenarios

At minimum, user acceptance testing must prove:

1. A newly created staff account cannot access farm data before role and scope assignment; administrator-issued onboarding and password recovery work without public self-registration.
2. Revoking a permission affects the user's existing session on the next protected request.
3. A user cannot access a site, farm, house, or flock outside their assigned scope by changing an ID in a request.
4. A doctor can create a prescription and review earlier authorized medical history but cannot confirm their own prescription as administered, including with another role.
5. An authorized farm-side user can record administration with actor and timestamp evidence.
6. A Farm Manager completes every approved paper daily-report section, including all seven egg categories, nine initial Peti weight samples, bird counts, weight, feed/water/light, medicine, vaccine, issues, and doctor visit; totals use 360 eggs per Peti.
7. A Farm Manager records mortality observations with images/audio and raises a medical emergency delivered to a Doctor; the Doctor acknowledges and records findings.
8. A Farm Manager submits feed ingredients and kilograms but cannot price them; an Operation Manager prices each ingredient, and the system calculates accurate cost/kg and cost/bag while preserving versions.
9. A Farm Manager records daily consumption without general inventory control; an Operation Manager records allowed inventory/feed/sales and operational expenses without gaining clinical write access. Eggs enter the same farm's collection-room stock before sale, and collection does not mark them sold.
10. Daily financial results show approved revenue/cost inputs; no provisional ROI is shown as official ROI.
11. Farm and Operation Managers cannot read before the preceding business day through records, charts, APIs, or exports; the Production Head can read full authorized history. Production Manager policy is tested after approval.
12. Urgent/critical events require acknowledgement, retain escalation and resolution histories, and use distinct recipient and closure permissions.
13. Audit records show access changes, finalized-record corrections, and sensitive business state changes.
14. Android and iOS workflows are validated, and persisted records survive app restart and new sessions.

## 17. Product and delivery risks

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Flock transfer, identifier, and lifecycle exceptions remain undefined | Rework in organization constraints and movement handling | Review concurrent occupancy, transfers, flock identity on transfer, reopening, and archival before lifecycle work |
| Business timezone or correction access remains undefined | Incorrect history restriction or inability to correct records | Record exact boundary and correction examples and test them server-side |
| Existing public signup differs from administrator-issued onboarding | Unapproved account-creation path in production | Agree issuance/recovery design and migrate the current UI/API deliberately |
| Detailed daily report is implemented as a summary | Paper form and acceptance criteria are missed | Review source image and field map before the farm slice |
| Feed formula module remains absent from the current schema draft | Farm and Operation Manager workflow cannot be completed | Reconcile the schema and deliver composition and costing as separate permissions |
| Prescription fields and units are incomplete | Unsafe or unusable clinical workflow | Review real prescription examples with the doctor/client before implementation |
| ROI formula is undefined | Conflicting financial results | Document inputs, formula, rounding, and examples before analytics work |
| Media and notifications are treated as late add-ons | Emergency and post-mortem workflows cannot be completed | Freeze storage and delivery interfaces early; channel implementation may follow |
| Parallel migrations and shared-file edits conflict | Delayed integration and schema divergence | Complete modularization first and coordinate Alembic heads deliberately |
| Poor farm connectivity | Failed or duplicated submissions | Confirm offline requirements; use idempotent writes and clear retry states |
| Broad role permissions leak data across farms | Security and privacy failure | Combine permission, scope, time, and state checks in reusable backend dependencies/services |

## 18. Client decisions required before detailed implementation

### Blocking foundation and organization work

1. Confirm concurrent-flock and multiple-report exceptions, flock transfer identity, flock identity on transfer, reopening and archive rules, and whether a separate production-cycle entity is required. Company → site → farm → house/shed → flock is established; one report per flock/date is the working schema choice.
2. Define the Production Manager's history window and whether their stated Super Admin Controls can grant historical access to themselves or others. Full history is confirmed for the Production Head only.
3. Approve the central business timezone and date-boundary examples for the current plus preceding calendar day, including the rule for correcting older reports.
4. Agree how administrators issue credentials and how users recover passwords; decide whether the current public signup endpoint is removed or disabled for production.

### Blocking health and clinical modules

5. Provide the weekly-weight/bird-parameter receipt; confirm “Per Pe,” production-percentage denominator, Peti-weight sampling, standard weights, blank-field behavior, and signatures/review flow. The paper identifies house, flock, and date; the supplied feed formula implies a 50 kg bag.
6. Confirm mortality and post-mortem fields, population movement rules, and veterinary escalation thresholds without inventing a diagnosis rule.
7. Define medicine master data, dosage units, prescription fields, and administration schedule rules.
8. Confirm which farm personnel record administration and who may correct it, while preserving the prescribing-doctor prohibition.

### Blocking operations and analytics

9. Confirm ingredient-rate precision and source, formula version policy, and whether any future formula type needs a bag size other than the per-version value. Operation Manager finalization is the current workflow; add another approval stage only if an approver is named.
10. Define inventory/feed units, movement types, approval rules, and whether expiry/lot tracking is required.
11. Confirm saleable egg categories, egg-stock-ledger rollout, customer/payment/invoice requirements, and prices when selling by Peti or egg.
12. Define the daily ROI investment base, formula, unsold-egg treatment, feed/shared-cost allocation, rounding, and an approved worked example. Feed, medicine/vaccine, manpower/labour, and electricity are confirmed expense categories, but that does not define ROI.

### Blocking notifications and production rollout

13. Choose notification channels beyond durable in-app records, severity mapping, response deadlines, escalation paths, and closure authority. Medical emergencies must reach the Doctor.
14. Define media size/type limits, retention, and deletion rules.
15. Decide whether offline data entry and synchronization are required.
16. Confirm email/password versus phone/OTP or an identity provider, and verification/multi-factor requirements.
17. Provide expected scale: sites, farms, users, daily records, media volume, and connectivity conditions.

## 19. Change control

The Google Doc remains the client's living brief. When it changes:

1. Record the review date and affected source tab.
2. Update this PRD with the confirmed change.
3. Mark affected requirements, contracts, migrations, tests, and workstreams.
4. Do not treat an ambiguous note as an approved schema or workflow.
5. Increment the PRD version when a product decision changes scope or acceptance criteria.
