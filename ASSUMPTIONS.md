# Frontend assumptions

These decisions fill gaps in the current PRD for the frontend and mock services. Confirm them before making the backend contract or complex lifecycle rules final.

## Phase 5: organization

1. The hierarchy is one company → sites → farms → houses/sheds → flocks. Each record has one parent, and its parent cannot change after creation.
2. Site fields are name and optional location; farm has name; house has name and optional capacity; flock has name, optional bird type, required placement date, and required initial bird count. Bird type choices are Layer, Broiler, and Other.
3. Names are unique within the same parent, ignoring case. Site names are unique across the company.
4. Records are archived and restored instead of deleted. A parent with active children cannot be archived; a child cannot be restored while its parent is archived. Archived records can be shown in lists but cannot be selected as the working area or as a parent for a new record.
5. Concurrent active flocks in a house are allowed for now. Capacity is descriptive; flock counts are not checked against it. Transfer and occupancy rules await product confirmation.
6. Only the Owner has `organization.manage` and can change organization records or assignments. Other roles with `organization.view` can read records in their scope.
7. Owner and Production Manager have company-wide scope. Farm Manager, Operation Manager, and Doctor see assigned sites and farms. Assigning a site includes its current and future farms; assigning one farm also reveals its parent site. A site with no farms remains visible when directly assigned.
8. A user with no site or farm assignment sees an empty organization. A role without organization permission sees no organization screens or selector. Company-wide roles do not need explicit assignments.
9. The top-bar working-area choice is optional and saved per user in browser storage. Clearing a parent clears its child selections. Archived, removed, or newly inaccessible choices are discarded when organization data refreshes.
10. The frontend uses the existing `organizationService` facade backed by localStorage mock data because this repository contains no Express organization API. The backend must enforce permissions, scope, uniqueness, archive rules, and assignment integrity when integrated.

## Phases 6–10: operational workflows

11. Daily reports are unique per flock and business date. A report moves through draft → submitted → returned → submitted; Production Manager or Owner can return it with a reason. Egg totals sum the seven recorded categories, and one Peti is 360 eggs. Remaining birds is opening birds + placed + transfers in − transfers out − mortality. These are mock service calculations and require backend agreement.
12. Mortality and post-mortem observations live inside the daily report. The Mortality page shows reports with a nonzero mortality count. Medicine and vaccine text in a report is a record of what was reported, not proof that a prescription was administered.
13. Clinical visits may contain one prescription item in this frontend. A prescribed medicine creates one medication task. The item can be edited until an administration outcome is recorded. The mock task records one completed or missed outcome; recurring dose scheduling and a medicine catalog require a backend contract.
14. Inventory items use a company-wide balance because the PRD does not define warehouse and per-farm stock ledgers. Receipts, issues, and adjustments change that balance. A farm-to-farm transfer is recorded as a movement but does not change the company total. Low stock means balance is at or below the configured minimum.
15. Formula composition is entered without prices by the Farm Manager. Operation Manager enters PKR per kilogram and finalizes cost. The mock calculation is quantity × rate, with cost per bag based on the formula's bag size (default 50 kg). A new version can be drafted from a finalized formula while previous finalized versions remain visible. Real money calculations require backend decimal arithmetic.
16. Egg production and sales are separate records. Saleable eggs equal total production minus damaged and rejected eggs. Sales consume this mock ledger at the farm level. One Peti is 360 eggs. Sales pricing is per selected unit.
17. The financial summary uses recorded sales revenue and expense entries only. It displays operating surplus or deficit and does not claim official ROI. The mock expense categories are Feed, Medicine and vaccine, Labour, Electricity, and Other.
18. Bird weight entries show recorded sample size and average weight. No breed standard, expected gain, or scheduled measurement is invented; those require approved data.
19. Notifications are generated in the mock service for mortality reports and low stock movements. Acknowledgement and resolution are tracked, but no realtime delivery, escalation engine, or backend notification rules exist.
20. Charts and dashboard cards use records from the same scoped mock service. There is no export endpoint, historical retention policy, attachment upload endpoint, or API-enforced date range in this repository, so those controls are not represented as working integrations.
21. Audit events are recorded in browser storage for user, organization, and operational changes made through these services. They are for demonstration and are not a tamper-resistant audit system.
22. Demo records use sample farms and the date 7 November 2026. Clearing `localStorage` restores seed data on reload. The demo password remains the Phase 4 mock password documented in the README.
