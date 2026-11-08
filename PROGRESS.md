# Build progress

Project: Poultry Management System, React frontend. Source of truth: the PRD file.
Rule: finish a chunk, tick it here, then continue. Use this file and `ASSUMPTIONS.md` to resume remaining integration or browser QA work.

## Done phases
- [x] Phase 5: organization hierarchy, selectors, lists and user scope assignment (see below)
- [x] Phase 4: login, auth context, mock services, user management (see below)
- [x] Phase 3: app shell, navigation, routing, route guard (see below)
- [x] Phase 1: setup and foundation
- [x] Phase 2: design system and shared components (see /design-system)

## Phase 3: layout, navigation, routing  (COMPLETE)
Design decisions
- One source of truth for pages: `src/config/modules.js` (label, path, icon, permission, phase, capabilities).
  The sidebar (`config/navigation.js`) and the route table (`app/routes.jsx`) are both generated from it.
- Permissions are codes in `src/config/permissions.js`. Role -> permissions map is in `src/config/roles.js`.
  Components never check role names. They call `hasPermission(code)` from `useAuth()`.
- Phase 3 ships a TEMPORARY AuthContext + role picker on /login so protected routes can be tested.
  Phase 4 replaces them with a real login form, validation and a mock auth service.
- Real pages replace placeholders by registering in the `PAGE_REGISTRY` object in `app/routes.jsx`.

Chunks
- [x] A. config (permissions, roles, modules, navigation), AuthContext, demo users, ProtectedRoute, route-meta helper, new icons
- [x] B. layout components (Sidebar, Topbar, UserMenu, Breadcrumbs, PageHeader, BrandLogo) + AuthLayout + DashboardLayout + CSS
- [x] C. pages (Login, NotFound, AccessDenied, ModulePlaceholder, DashboardHome) + routes wiring + README + final check

Assumptions to confirm (role -> module access is not fully specified in the PRD)
- Production Manager: view of all operational modules and finance, no user management or audit log.
- Farm Manager: daily reports, mortality, medication, bird parameters, feed formulas, organization view.
- Operation Manager: inventory, feed formulas, egg production, sales, finance, reports.
- Doctor: clinical, medication (view), bird parameters, organization view.
- Everyone signed in sees Dashboard and Notifications.
- Only the Owner can manage organization data and users, and see the audit log.
Change any of these in `src/config/roles.js`.

## Phase 4: authentication and user access  (COMPLETE)
Design decisions
- Mock backend lives in `src/services/mock/` (store, auth service, user service) with seed data in `src/mock/seedUsers.js`.
  UI never imports from `services/mock/` directly. It imports `services/authService.js` and `services/userService.js`
  (thin facades). Swapping to real Axios calls later only changes those two files.
- Services throw `ApiError` (`services/apiError.js`) with `code`, `message`, optional `fieldErrors`. The UI maps these to messages.
- Session = `{ userId, token }` in sessionStorage. AuthContext restores the user on page load via `getCurrentUser`
  (shows a loading screen meanwhile). A failed restore sets a "session ended" notice on the login page.
- One role per user (PRD allows several only if approved). A user with no role is "unassigned" and sees /pending-access.
- Mock safeguards (a real backend must enforce them too): you cannot deactivate yourself or change your own role,
  and the last active Owner cannot be deactivated or demoted.
- Passwords are plain text in mock seed data only. Demo password for all seed users: `Poultry@123`.
- Login is by email + password (the PRD says email/username depending on the backend contract).
- New users: the admin sets a temporary password in the create form (real invite flow depends on the backend).

Chunks
- [x] A. ApiError, validators, mock seed + store + auth/user services, facades, AuthContext rewrite, ProtectedRoute, Alert, Can; service logic tested in node
- [x] B. LoginPage (validation, errors, demo account helper), PendingAccessPage, UserMenu logout update, routes
- [x] C. Users feature (list, filters, create/edit, role assignment, activate/deactivate), Profile page, registry, README, final check

## Phase 5: organization and farm management  (COMPLETE — frontend with mock service)
Design decisions
- Hierarchy: Company > Site > Farm > House > Flock. Stored FLAT and normalized (each record has its parent id:
  farm.siteId, house.farmId, flock.houseId, plus status 'active' | 'archived'). This maps directly to MongoDB collections.
  Company is a single root record (no company screens).
- Mock backend: `src/mock/seedOrganization.js`, `src/services/mock/mockOrgStore.js`, `src/services/mock/mockOrganizationService.js`.
  UI imports only `src/services/organizationService.js` (facade, same pattern as authService/userService).
- `src/context/FarmContext.jsx` (`FarmProvider`, `useFarm()`): loads the hierarchy the signed-in user may see, and holds the
  ACTIVE site/farm/house/flock selection (saved per user in localStorage). Later phases reuse `useFarm()`.
- Scope: `ROLE_SCOPE` in `src/config/roles.js`. Owner and Production Manager are company-wide. Farm Manager, Operation Manager
  and Doctor see only sites/farms assigned to them (assigned site = all its farms). The scoped hierarchy is computed by the
  service. UI never filters by role name.
- One generic form modal (`EntityFormModal`) driven by field configs in `features/organization/entityConfig.js`.
  `useOrgCrud` holds create/edit/view/archive/restore logic shared by the four list pages.

Assumptions to confirm (the PRD leaves these open, section 17 item 3)
- Fields: Site (name, location), Farm (name), House (name, capacity optional), Flock (name, placement date, initial count, bird type optional).
- Names must be unique within the same parent.
- Archive, not delete. A parent with active children cannot be archived. A child cannot be restored while its parent is archived.
- The parent of a record cannot be changed after creation (no flock transfer or moving houses until the rules are confirmed).
- No limit on active flocks per house (occupancy rule not enforced).
- Only the Owner has `organization.manage`. Everyone else with `organization.view` is read-only.

Chunks
- [x] A. ROLE_SCOPE, seed org data, mock store, mock organization service, facade; service logic tested in node
- [x] B. FarmContext (+ active selection), selection button/modal in top bar, generic form/details modals, useOrgCrud, shared list pieces
- [x] C. Sites/Farms/Houses/Flocks pages, Organization tree page, user scope assignment (Users page), registry, README, final check

Phase 5 assumptions and API boundary are documented in `ASSUMPTIONS.md`.

## Phases 6–9: operational frontend (mock-backed)
- [x] Phase 6: daily report draft/submit/return workflow, egg and bird calculations, mortality and post-mortem view, bird weight entry.
- [x] Phase 7: clinical visits, prescription entry/editing, medication tasks, administration outcome and prescriber restriction.
- [x] Phase 8: stock items and movements, feed formulas and costing, egg production and sales, expense entry and financial summary.
- [x] Phase 9: notifications, role-aware dashboard metrics, scoped analytics and charts.

## Phase 10: final frontend work
- [x] Read-only audit log with before/after detail for mock service mutations.
- [x] Production build and service workflow tests.
- [ ] Browser visual, responsive, and accessibility pass, plus screenshots. The browser access host was unavailable during this session.

All phases above use browser-persisted mock services because this repository has no Express API. Attachment uploads, server exports, and API-enforced date restrictions wait for backend endpoints. See `ASSUMPTIONS.md` for details.
