# LayerFlow — MERN Phase 3 implementation

Date: 20 November 2026. Scope: Phase 3 of [the MERN PRD](../LayerFlow_MERN_PRD.md), following [Phases 0–2](MERN_PHASE_0_2_IMPLEMENTATION.md). Phase 4 is not implemented in this change.

## Outcome

Organization, Sites, Farms, Houses, Flocks, staff scope assignment, and the working-area selector now use the live MongoDB API. The existing React layouts and service facade remain in place. Explicit mock mode still runs the historical frontend demo.

The architecture remains a modular MVC-style Express backend: Mongoose models, route/controller handlers, service-layer business rules, and shared access policies. React provides the views. This phase adds no dependencies.

## Implementation steps completed

1. Read the MERN Phase 3 requirements, historical `PROGRESS.md`, identity transaction/authentication code, organization screens, user assignment dialog, service facade, and farm context.
2. Added referenced Site, Farm, House, and Flock models under `server/src/modules/organization/`. The existing Organization model remains the single company root.
3. Added repeatable collection/index creation and migration marker `002-organization-hierarchy`. Existing identities, edited roles, and passwords are preserved.
4. Added hierarchy/list/detail/create/edit/archive/restore routes with strict schemas, permission checks, optimistic versions, transactions, and audit events.
5. Added a reusable `scopeFilter` and scoped entity lookup. All ancestor IDs come from the actual parent, and callers cannot supply alternate ancestors or change parents.
6. Added versioned user assignments, active-record validation, session revocation, and administrative audit events.
7. Connected `organizationService`, existing CRUD dialogs, `FarmContext`, top-bar selector, and Users assignment modal. Enabled the five organization pages for API mode.
8. Added an explicit development demo command for two farms with separately assigned managers, without a default password or destructive reset.
9. Extended MongoDB/API, restart-persistence, and browser checks. Updated README, repository guidance, and progress tracking.

## Data dictionary

All four hierarchy collections have an organization reference, display name, normalized `nameKey`, `status` (`active` or `archived`), `version` starting at 1, and UTC creation/update timestamps.

| Collection | Parent and derived references | Identifying fields |
| --- | --- | --- |
| `sites` | Organization | Required name and location |
| `farms` | Site | Required name |
| `houses` | Farm; derived site | Required name; optional positive integer capacity |
| `flocks` | House; derived farm and site | Required name, calendar placement date, positive integer initial count; optional bird type, strain, age at placement in days |

Names are trimmed, normalized with NFKC, and lowercased for a unique organization/parent/name index. Archived names remain reserved. Flocks have a partial unique house index for `status: active`, so concurrent requests cannot create two active occupants.

Placement date, initial count, age at placement, and parent references are immutable after creation. Optional unknown age is `null`; zero means day-old chicks. Bird type is Layer/Broiler/Other or unspecified. Optional house capacity is `null`, never an invented zero. Initial placement cannot exceed capacity, and a house cannot be reduced below its active flock's initial placement count. Current population reconciliation belongs to Phase 4.

User `siteIds` and `farmIds` remain referenced assignment arrays. Assignment changes increment the user's record version and `authVersion`.

## API contract

Prefix: `/api/v1`. Success wraps results in `{ data }`. Existing cookie, CSRF, origin, password-change, and error conventions apply. All mutation bodies reject unknown fields.

| Method and endpoint | Behavior |
| --- | --- |
| `GET /organization/hierarchy` | Flat `{ company, sites, farms, houses, flocks }`, limited to the actor's scope; includes accessible archived records |
| `GET /organization/<resource>` | Scoped array for sites, farms, houses, or flocks |
| `GET /organization/<resource>/:id` | Scoped detail; inaccessible records return 404 |
| `POST /organization/<resource>` | Create using the immediate parent ID only; returns 201 |
| `PATCH /organization/<resource>/:id` | Edit permitted identifying fields with current `version` |
| `PATCH /organization/<resource>/:id/status` | `{ archived: boolean, version }`; archive/restore without deletion |
| `GET /organization/assignments` | User-ID-keyed map of `{ siteIds, farmIds, version }` |
| `PUT /users/:id/scope` | `{ siteIds, farmIds, version }`; replace assignments and revoke existing sessions |

This implementation keeps hierarchy endpoints together under `/organization` and uses one status endpoint instead of the PRD's illustrative separate archive/restore endpoints. The frontend facade provides the original `setArchived` interface. Collections are returned as arrays for the existing small-course-project tables; server pagination for hierarchy is not introduced here. Client query parameters do not alter authorization.

Create bodies:

```json
{ "name": "North Site", "location": "Lahore" }
{ "name": "Farm Alpha", "siteId": "<site ID>" }
{ "name": "House 1", "farmId": "<farm ID>", "capacity": 1000 }
{ "name": "Layer A", "houseId": "<house ID>", "placementDate": "2026-11-01", "initialCount": 500, "birdType": "Layer", "strain": "", "ageAtPlacementDays": 0 }
```

Each JSON line above is a separate request example. Farm edits contain name/version; site edits name/location/version; house edits name/capacity/version; flock edits name/birdType/strain/version. Status and assignment writes also require the latest version. Stale versions return 409; invalid fields return 422; duplicate names/occupancy return 409.

## Access and integrity decisions

- Reads require `organization.view`. Hierarchy writes require `organization.manage`. Seeded roles are unchanged; Owner has organization management by default.
- Assignments require company scope plus both `users.manage` and `organization.manage`. Targets must have an assigned-scope role. Existing protected-account and grant-subset safeguards also apply.
- Company-scope users see the whole organization. A site grant includes all current and future farms underneath it. A farm grant reveals that farm's site and its own houses/flocks, without exposing sibling farms.
- A visible parent site from a farm grant is context only. A delegated assigned-scope editor cannot rename that site or create sibling farms. Root site creation requires company scope.
- Permission and scope checks are separate. The UI uses permission codes and server scope metadata, including for custom roles; it does not infer live scope from a role name.
- Assignment IDs must be unique, active, and in the same organization. An assigned farm must also have an active site. Empty assignments are valid and expose no hierarchy records.
- Hierarchy and assignment writes serialize through the existing access guard, reload the actor inside the transaction, and recheck current grants/session version. This also coordinates scope revocation, archive changes, and concurrent occupancy writes. The coarse lock is intentional for this university project.
- Parent IDs are immutable. Create bodies accept only the immediate parent; extra site/farm IDs are rejected. Ancestors are copied from the validated database parent.
- A parent with active children cannot be archived. Restore/create requires an active parent. Restore also checks active-flock uniqueness and capacity. No hard-delete route exists.
- Assignment references are retained when a hierarchy record is archived, preserving the staff's historical scope. Archived entries are excluded from selectable working areas. Restoring a record restores its usefulness within those retained grants; remove assignments explicitly if access should stay revoked.
- Every successful hierarchy/assignment write records its actor, request ID, action, target, and before/after metadata in the existing audit collection. Passwords and session values are excluded.

## Frontend behavior

`organizationService.js` selects live Axios calls by default and mocks only with `VITE_DATA_MODE=mock`. It converts form number strings to numbers/null. CRUD and archive/restore actions pass current versions and use existing validation, toast, error, loading, and empty states.

`FarmContext` reloads hierarchy on sign-in and changes to user permissions, scope, or version. It discards responses from obsolete requests and clears the previous hierarchy during access changes. A saved selection is revalidated against accessible active records and the full parent chain. The selector fills ancestors when choosing a house/flock, and invalid selections are removed. Browser storage holds preferences only.

Users with assignment-management permissions can open the existing assignment dialog, choose an entire site or individual farms, and save. Company-scope or unassigned-role accounts do not display that action. Saving refreshes the user list/version and ends the affected account's previous sessions. The affected user signs in again to receive updated access.

## Optional representative demo data

First configure the API environment and bootstrap the Owner as described in [README](../README.md). On an empty development hierarchy, add a private `DEMO_PASSWORD` of 12–128 characters to ignored `server/.env`, then run:

```powershell
npm run db:demo
```

The command creates Demo North Site, Farm Alpha and Farm Beta, one house/flock per farm (capacity 1000, placement 500), and these separately farm-assigned accounts:

- `demo-alpha@layerflow.test`
- `demo-beta@layerflow.test`

Both initially use the supplied private password and must change it on first login. Remove `DEMO_PASSWORD` afterward. The script refuses production mode, missing Owner/assigned manager-role prerequisites, existing hierarchy data, and existing demo email addresses. It never replaces existing records or passwords; its writes are atomic and audited as an explicit development CLI operation. The sample placement date is fixed at 1 November 2026 and is illustrative. No configured user database was seeded during implementation.

## Verification

Final results: **23 backend checks passed**, **9 original mock checks passed**, **browser workflow passed**, and **production build passed**. Syntax checks passed for all 44 server JavaScript files; documentation links and `git diff --check` passed. Desktop organization and phone-width scope screenshots were visually reviewed.

Commands: `npm run test:server`, `npm test`, `npm run test:browser`, and `npm run build` from the repository root. Test databases were isolated from the configured application database.

- API integration suite: checks identity regression plus derived ancestors, forged parents, duplicate names, occupancy, invalid counts/dates, immutable fields, capacity, archive/restore, stale versions, separate managers, future farms under site grants, hidden sibling/detail access, scope session revocation, invalid assignments, scoped custom editors, concurrency, and demo fixture refusal to overwrite.
- Disk-backed restart check: hierarchy, user assignment references, roles, account, and authenticated session survive MongoDB restart and repeatable migrations.
- Browser workflow: real hierarchy creation, edit, archive/restore, tree, assignment modal, scoped farm list, saved selection, empty assignments, revocation, and phone-width behavior alongside the previous identity/role checks.
- Original mock workflow suite and production build remain part of regression verification.
- Local screenshots are ignored under `.data/verification/`: `organization-desktop.png`, `farm-scope-mobile.png`, and the identity screenshots.

The browser checks caught and verified the fix for a missing expected user version in assignment saves. The final workflow also confirms that reauthentication after scope revocation restores the prior route safely and removes inaccessible farm selections.

## Boundaries for subsequent phases

Phase 4 daily reports, mortality, measurements, opening bird movements, population adjustments, and operational date restrictions remain unimplemented. Clinical tasks arrive in Phase 5. Those live pages continue to show their integration-pending state. No operational mock values are shown to API-authenticated accounts.

The Phase 3 archive checks cover hierarchy children. Once report drafts and medication tasks exist, their modules must extend the same transactional archive policy to block unresolved work as required by ORG-04. There are no such live records in this phase. Flock creation stores the immutable initial-placement baseline; Phase 4 must publish its opening bird movement without duplicating it.

The active-flock index applies to existing MongoDB data too. If a manually populated database already contains duplicate active occupants or normalized sibling names, migration fails instead of deleting or silently choosing records; resolve that data before retrying. Historical browser mock data is not migrated.
