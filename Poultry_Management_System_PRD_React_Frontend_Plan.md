# Poultry Management System

## Product Requirements Document (PRD) and React Frontend Implementation Plan

  -----------------------------------------------------------------------
  Field                               Value
  ----------------------------------- -----------------------------------
  Project name                        Poultry Management System

  Project type                        University Final Year Project

  Document                            Product Requirements Document and
                                      Frontend Implementation Plan

  Version                             1.0

  Status                              Draft for academic project
                                      development

  Application type                    Responsive React web application

  Technology stack                    MERN: MongoDB, Express.js,
                                      React.js, Node.js

  Frontend scope                      React web application

  Backend scope                       REST API using Node.js and
                                      Express.js

  Database                            MongoDB

  Primary users                       Owner / Production Head, Production
                                      Manager, Farm Manager, Operation
                                      Manager, Doctor
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 1. Project Overview

The **Poultry Management System** is a web-based application designed to
help poultry businesses manage farm operations, bird health, medication,
inventory, feed, egg production, sales, and operational performance
through a centralized platform.

The system will provide role-based workspaces so that each user can
access the information and functions relevant to their responsibilities.
It will replace scattered manual records with structured digital
records, improve traceability, and make important farm information
easier to review.

The project will be developed as a responsive web application using
React.js. The frontend will communicate with a backend REST API built
with Node.js and Express.js, with MongoDB used for persistent data
storage.

This document defines the product requirements and, in particular, a
phased implementation plan for the React frontend. The frontend plan is
structured so that the interface can first be developed with mock data
and then connected to backend APIs as they become available.

## 2. Problem Statement

Poultry farm operations involve several interconnected activities,
including daily production reporting, mortality tracking, medication,
veterinary visits, feed consumption, inventory management, and egg
sales. When these activities are recorded manually or across separate
tools, several problems can arise:

-   Farm health, mortality, treatment, inventory, and sales records may
    be incomplete or difficult to connect.
-   Prescribing medication and confirming that it was administered may
    be treated as the same activity, reducing accountability.
-   Managers may not have a timely overview of farm performance or
    urgent issues.
-   Different employees require different levels of access to
    operational and sensitive information.
-   Preparing daily and historical reports can take considerable time.
-   Records may be difficult to search, compare, and audit.

The proposed system will centralize these workflows and provide
authorized users with a consistent view of poultry farm operations.

## 3. Project Objectives

### 3.1 Functional objectives

1.  Provide secure login and role-based access to the web application.
2.  Organize records around the company, site, farm, house/shed, and
    flock hierarchy.
3.  Digitize daily poultry reports, egg counts, bird population,
    mortality, feed, water, and other farm measurements.
4.  Record veterinary visits, diagnoses, prescriptions, and medication
    administration as separate activities.
5.  Manage inventory, feed stocks, feed formulas, ingredient costing,
    egg production, and egg sales.
6.  Provide notifications for emergencies, overdue tasks, incomplete
    reports, and low stock.
7.  Display dashboards, charts, filters, and reports based on authorized
    data.
8.  Maintain an audit trail for important actions and record changes.

### 3.2 Frontend objectives

1.  Build a clean, consistent, responsive React interface.
2.  Provide role-specific navigation and dashboards.
3.  Use reusable components for forms, tables, filters, status
    indicators, modals, and charts.
4.  Keep API communication separate from presentation components.
5.  Handle loading, empty, validation, error, success, and
    permission-denied states.
6.  Make the interface usable on desktop, tablet, and mobile browser
    sizes.
7.  Ensure that frontend visibility rules improve usability but do not
    replace backend authorization.

## 4. Project Scope

### 4.1 In scope

-   Authentication and user profile.
-   Role and permission-aware navigation.
-   Organization, site, farm, house, and flock management.
-   Daily farm reports and mortality records.
-   Post-mortem observations and media attachments.
-   Veterinary visits and prescriptions.
-   Medication administration tracking.
-   Inventory and feed stock management.
-   Feed formula creation and costing.
-   Egg production and sales.
-   Bird measurements and weekly weight records.
-   Notifications and emergency response.
-   Dashboards, analytics, and reports.
-   Audit and administration screens.

### 4.2 Out of scope for the initial university project

-   Automated medical diagnosis or treatment recommendations.
-   Payroll and a complete accounting/ERP system.
-   IoT sensor integration.
-   Supplier or customer self-service portals.
-   A separately installed desktop application.
-   Offline-first synchronization.
-   SMS, WhatsApp, or other paid notification integrations unless time
    and project requirements permit them.

These items may be considered future enhancements rather than
requirements for the first working version.

## 5. Users and Responsibilities

The application will use configurable roles and permissions. The
frontend will use the permissions returned by the backend to determine
which navigation items and actions should be displayed. The backend
remains responsible for enforcing access.

  -----------------------------------------------------------------------
  User role               Main responsibilities   Frontend workspace
  ----------------------- ----------------------- -----------------------
  Owner / Production Head Overall access,         Executive dashboard,
                          management overview,    reports, user and role
                          historical analytics,   management
                          administration

  Production Manager      Broad operational       Management dashboard,
                          oversight and           farm overview, reports
                          management activities

  Farm Manager            Daily reports,          Farm dashboard, daily
                          mortality, post-mortem  report, mortality,
                          observations,           medication tasks
                          medication
                          administration, feed
                          consumption

  Operation Manager       Inventory, feed stocks, Operations dashboard,
                          formula costing, egg    inventory, feed, sales
                          sales, expenses and     and finance
                          daily financial results

  Doctor                  Clinical visits,        Clinical dashboard,
                          diagnosis,              visits, prescriptions
                          prescriptions, bird     and bird records
                          parameters and clinical
                          history

  Unassigned user         No access to business   Access-denied or
                          records until assigned  pending-access screen
                          a role and scope
  -----------------------------------------------------------------------

A user may have more than one role only if that policy is approved for
the project. A Doctor must not be able to confirm that their own
prescription was administered, even if another assigned role normally
has medication-administration permission.

## 6. Product Principles

1.  **Backend authorization is authoritative.** Hiding a button in React
    is not a security control.
2.  **Responsibilities remain separate.** A prescription and a
    medication-administration event are different records.
3.  **Records retain their farm context.** Business records should be
    associated with the appropriate site, farm, house, and flock.
4.  **Historical access is controlled by the API.** The frontend must
    not fetch unauthorized history and merely hide it.
5.  **Important actions are traceable.** The interface should display
    the actor and timestamps where supplied by the API.
6.  **Operational problems remain visible.** Overdue medication,
    incomplete reports, low stock, and emergencies should have clear
    statuses.
7.  **Reusable components are preferred.** Common UI patterns should be
    implemented once and reused across modules.

## 7. Functional Modules and Frontend Requirements

### M01 --- Authentication and Access Control

**Purpose:** Allow authorized users to sign in and access the
application according to their assigned permissions.

Frontend capabilities: - Login page with email/username and password
fields, according to the agreed backend contract. - Logout action. -
Current-user profile and session state. - Protected routes for
authenticated pages. - Role- and permission-aware sidebar/navigation. -
Access-denied page for unauthorized routes or actions. - User list,
create/invite, edit, activate/deactivate, and role assignment screens
for authorized administrators. - Role and permission management screens,
if included in the approved project scope. - Clear session-expired
handling.

Frontend security note: the React application may use route guards and
conditional rendering for user experience, but every protected API
request must also be authorized by the backend.

### M02 --- Organization, Sites, Farms, Houses, and Flocks

**Purpose:** Provide the organizational structure shared by the other
modules.

Frontend capabilities: - View and manage sites. - View and manage farms
under a site. - View and manage houses/sheds under a farm. - View and
manage flocks under the approved house/farm structure. - Assign users to
permitted sites and farms. - Select the active site, farm, house, or
flock when a user has access to multiple. - Display parent-child
relationships through breadcrumbs, selectors, or nested tables.

The intended hierarchy is:

**Company → Site → Farm → House/Shed → Flock**

The exact flock transfer, concurrent occupancy, and archival rules
should be confirmed before implementing complex lifecycle screens.

### M03 --- Daily Farm Reports and Mortality

**Purpose:** Digitize the Farm Manager's daily reporting workflow.

Frontend capabilities: - Select farm, house, flock, and business date. -
Create and edit a daily report while it is in draft state. - Display
report sections in a clear form or tabbed/step-based layout. - Record
egg counts for Jumbo, Starter, Standard, Small, Floor, Broken, and
Discard. - Display calculated total eggs and Peti using **360 eggs per
Peti**. - Distinguish collected eggs from saleable eggs. - Record bird
population, mortality, remaining birds, age/week, placement, transfers,
and adjustments. - Record feed bags, bag size, per-bird feed, water
consumption, light duration, and extra feed material. - Record medicine
and vaccine entries without automatically treating them as proof of
administration. - Record operational issues and doctor visit remarks. -
Record mortality details and post-mortem observations. - Attach
pictures/audio and comments where supported by the API. - Preview
calculated totals before submission. - Support draft, submitted,
returned-for-correction, and resubmitted states. - Show submission and
review history. - Prevent accidental duplicate submissions through UI
feedback and backend validation.

Derived values should be displayed from backend responses where the
backend is authoritative. Any client-side preview calculation must use
the same agreed formula and must not replace server validation.

### M04 --- Clinical Visits and Prescriptions

**Purpose:** Allow Doctors to document clinical work and prescribe
treatment.

Frontend capabilities: - List and filter clinical visits within the
user's authorized scope. - Create a visit associated with the relevant
site, farm, house, flock, and date/time. - Record diagnosis,
observations, bird parameters, remarks, and attachments. - Create
prescription items with medicine, dose, frequency, start date/time,
duration, route, and instructions. - Support water- or feed-based
administration routes. - Display prescription status separately from
administration status. - Display authorized clinical history. - Prevent
the Doctor interface from offering an action to confirm their own
prescription as administered.

Medicine master data, units, and final prescription rules must be agreed
before detailed form validation is finalized.

### M05 --- Medication Administration

**Purpose:** Allow an independently authorized user to record whether
prescribed medication was administered.

Frontend capabilities: - Display due, overdue, completed, missed, and
cancelled administration tasks. - Filter tasks by farm, house, flock,
date, and status where permitted. - Open a task to view its linked
prescription and instructions. - Record actual administration time,
quantity/dose, method, result, and optional comments/evidence. - Display
the person who recorded the administration. - Allow corrections or
cancellations only when the API grants the required permission. -
Clearly distinguish prescription status from administration status.

### M06 --- Inventory and Feed Stocks

**Purpose:** Provide an operational view of stock and stock movements.

Frontend capabilities: - List inventory items with category, unit,
current balance, and minimum-stock threshold. - Create and edit
inventory items where authorized. - Display receipts,
consumption/issues, adjustments, and transfers. - Provide a filtered
feed-stock view. - Display low-stock and out-of-stock indicators. - Show
movement history and the responsible user. - Allow Operation Managers to
perform permitted stock operations. - Allow Farm Managers to submit
daily consumption quantities without giving them general
inventory-ledger access.

### M07 --- Egg Production and Sales

**Purpose:** Track egg production separately from egg sales.

Frontend capabilities: - Display daily production by farm and egg
category. - Record damaged/rejected quantities separately from saleable
eggs. - Create sales with date, quantity, unit, unit price, total, buyer
reference, and payment status. - Support eggs and Peti as units using
**360 eggs per Peti**. - Display daily sales totals and sales history. -
Show available saleable stock if the egg stock ledger is included. -
Display validation errors when a sale exceeds available stock.

Production and sales must remain separate transactions. Recording
production must not automatically mark eggs as sold.

### M08 --- Bird Parameters and Weekly Weight

**Purpose:** Record bird measurements and compare them with approved
standards.

Frontend capabilities: - Record sample date/time, sample size, average
weight, unit, and notes. - Display actual versus standard weight. -
Display gain/loss and measurement history. - Show weight trends in
charts. - Flag missing scheduled measurements where scheduling data is
available. - Support additional bird parameters once their fields are
confirmed.

Standard weight values must come from approved project data; the
frontend must not invent veterinary or breed standards.

### M09 --- Notifications and Emergency Response

**Purpose:** Make important operational events visible and track their
response.

Frontend capabilities: - Notification list with severity and status
filters. - Notification detail view linked to its source record. -
Display informational, reminder, warning, critical, and
emergency/red-alert levels if those labels are approved. - Show created,
seen, acknowledged, escalated, resolved, and cancelled states as
applicable. - Allow authorized users to acknowledge, respond to, or
resolve an event. - Require a resolution note for events where the API
requires one. - Highlight medical emergencies for the Doctor. - Display
overdue medication, high mortality, incomplete reports, and low-stock
alerts when generated by the backend.

Real-time delivery (WebSocket or polling) can be added after the basic
notification list and API integration work.

### M10 --- Dashboards, Analytics, and Reports

**Purpose:** Present operational and management information in an
understandable format.

Frontend capabilities: - Role-specific dashboard landing pages. -
Summary cards for relevant metrics. - Charts for mortality, egg
production, sales, bird weight, feed consumption, and inventory. - Date,
site, farm, house, and flock filters according to user permissions. -
Links from dashboard cards/charts to the relevant source records. -
Explicit loading, no-data, incomplete-data, and error states. - Daily
and historical report screens. - PDF or spreadsheet export controls if
export endpoints are implemented.

Potential dashboard metrics: - Mortality count and rate. - Medication
due, completed, and missed. - Weekly bird-weight trend and variance. -
Feed received, used, and balance. - Inventory shortages. - Egg
production and sales quantity/value. - Water consumption and feed
costs. - Open and overdue emergencies. - Recorded revenue, costs, and
operating surplus/deficit.

Do not label operating surplus as official ROI. An official ROI
calculation should only be displayed if its formula and inputs are
approved and implemented by the backend.

### M11 --- Media and File Evidence

**Purpose:** Allow users to attach pictures and audio to supported
records.

Frontend capabilities: - File picker for supported file types. - File
name, size, and upload progress display. - Validation feedback for
unsupported or oversized files. - Preview images where appropriate. -
Display uploaded attachments on the relevant record. - Allow authorized
users to download or remove attachments if supported.

The backend must authorize uploads and downloads. A URL visible in the
browser must not itself grant unrestricted access.

### M12 --- Audit and Administration

**Purpose:** Make important changes reviewable.

Frontend capabilities: - Audit log table for authorized
administrators. - Filters for actor, action, target, module, and date. -
Detail view showing timestamp and structured before/after information
where returned by the API. - Read-only presentation; ordinary users must
not be able to edit audit events.

### M13 --- Feed Formulation and Costing

**Purpose:** Separate formula composition from ingredient pricing and
costing.

Frontend capabilities: - Farm Manager creates a formula with name,
code/date if approved, feed type/strain if approved, and ingredient
rows. - Ingredient rows include ingredient name and quantity in
kilograms. - Farm Manager can add/remove rows and see total kilograms. -
Farm Manager cannot enter or edit ingredient prices. - Submission moves
the formula to the pending-costing queue. - Operation Manager opens a
pending formula and enters ingredient rates in PKR/kg. - Display
calculated row cost, total kilograms, total cost, cost/kg, and
cost/bag. - Display the configured bag size; the supplied reference uses
50 kg for the referenced LSL/Hisex formula, but the value should be
stored per formula version. - Allow authorized users to finalize costing
or return a formula with a reason. - Display formula status and version
history. - Preserve previous finalized cost versions in the UI.

The backend should calculate authoritative monetary values using decimal
arithmetic. The frontend may show a preview but must display the
finalized values returned by the API.

### M14 --- Financial Performance

**Purpose:** Display daily operational financial results to authorized
users.

Frontend capabilities: - Display egg-sales revenue and approved cost
categories. - Display feed, medicine/vaccine, manpower/labour, and
electricity costs where recorded. - Display total recorded cost and
operating surplus/deficit. - Show a breakdown and links to source
records. - Display official ROI only when the approved formula and
backend calculation are available.

## 8. Core User Workflows

### 8.1 Login and access

1.  User opens the application.
2.  User enters credentials on the login page.
3.  React submits the login request to the backend.
4.  The application receives the authenticated user and permitted
    role/scope information.
5.  React displays the appropriate dashboard and navigation.
6.  Protected API requests continue to be checked by the backend.

### 8.2 Farm Manager daily workflow

1.  Open the farm dashboard.
2.  Select an assigned farm, house, flock, and business date.
3.  Review population and pending medication tasks.
4.  Record mortality and post-mortem observations.
5.  Add pictures/audio if required.
6.  Complete egg production, bird population, weight, feed, water,
    light, medicine, vaccine, and issue sections.
7.  Review calculated values and validation messages.
8.  Save as draft or submit the report.
9.  Review the report status and any correction request.

### 8.3 Doctor visit and prescription workflow

1.  Doctor opens an authorized farm/house/flock record.
2.  Doctor creates a clinical visit.
3.  Doctor records diagnosis, observations, parameters, and remarks.
4.  Doctor creates one or more prescription items.
5.  The backend creates or updates administration tasks.
6.  The Doctor can review progress if permitted but cannot confirm their
    own prescription as administered.

### 8.4 Medication administration workflow

1.  Authorized farm-side user opens the medication task list.
2.  User selects a due or overdue task.
3.  User reviews prescription instructions.
4.  User records the administration outcome and actual time.
5.  The backend validates the user's permission and separation-of-duty
    rules.
6.  The interface displays the updated task status.

### 8.5 Feed formula costing workflow

1.  Farm Manager creates a formula and adds ingredient quantities.
2.  Farm Manager submits the formula for costing.
3.  Operation Manager opens the pending-costing queue.
4.  Operation Manager enters ingredient rates.
5.  The application displays the backend-calculated cost preview.
6.  Operation Manager finalizes costing or returns the formula with a
    reason.
7.  The interface displays the final status and preserves previous
    versions.

## 9. Frontend Technology and Architecture

### 9.1 Proposed technology stack

  -----------------------------------------------------------------------
  Area                    Technology              Purpose
  ----------------------- ----------------------- -----------------------
  Frontend framework      React.js                Build the web
                                                  application UI

  Language                JavaScript or           Frontend application
                          TypeScript              logic

  Build tool              Vite                    Development server and
                                                  production build

  Routing                 React Router            Page navigation and
                                                  protected routes

  API communication       Axios or Fetch API      Communicate with
                                                  backend REST endpoints

  Styling                 CSS Modules, plain CSS, Responsive styling and
                          or Tailwind CSS         reusable design
                                                  patterns

  UI components           A consistent component  Forms, tables, dialogs,
                          library or custom       navigation
                          components

  Charts                  Recharts or Chart.js    Dashboard
                                                  visualizations

  Forms                   React Hook Form         Form state and
                          (optional)              validation

  Backend                 Node.js and Express.js  REST API and business
                                                  logic

  Database                MongoDB                 Persistent application
                                                  data

  Version control         Git and GitHub          Collaboration and
                                                  source control
  -----------------------------------------------------------------------

The team should select one styling approach and one charting library
before building repeated screens. Avoid introducing several libraries
that solve the same problem.

### 9.2 Suggested React project structure

``` text
poultry-management-system/
├── public/
├── src/
│   ├── app/
│   │   ├── App.jsx
│   │   ├── routes.jsx
│   │   └── ProtectedRoute.jsx
│   ├── assets/
│   ├── components/
│   │   ├── common/
│   │   ├── forms/
│   │   ├── tables/
│   │   ├── charts/
│   │   └── layout/
│   ├── layouts/
│   │   ├── AuthLayout.jsx
│   │   └── DashboardLayout.jsx
│   ├── pages/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── organization/
│   │   ├── daily-reports/
│   │   ├── mortality/
│   │   ├── clinical/
│   │   ├── medication/
│   │   ├── inventory/
│   │   ├── feed-formulas/
│   │   ├── egg-production/
│   │   ├── sales/
│   │   ├── bird-parameters/
│   │   ├── notifications/
│   │   ├── analytics/
│   │   ├── users/
│   │   └── audit/
│   ├── features/
│   │   ├── auth/
│   │   ├── organization/
│   │   ├── daily-reports/
│   │   ├── clinical/
│   │   └── inventory/
│   ├── services/
│   │   ├── api.js
│   │   └── endpoints/
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── FarmContext.jsx
│   ├── hooks/
│   ├── utils/
│   ├── styles/
│   └── main.jsx
├── .env.example
├── package.json
└── README.md
```

This is a suggested structure, not a requirement to create every folder
immediately. Add folders as the corresponding phase begins. Keep API
calls in service modules rather than writing raw HTTP requests
throughout page components.

### 9.3 Frontend architecture rules

-   Keep page components focused on layout and composition.
-   Extract reusable UI into components.
-   Keep API calls in service modules.
-   Keep authentication and active farm context in shared state.
-   Use React Router for navigation.
-   Use route guards for authenticated pages and permission-aware
    navigation for usability.
-   Keep form validation consistent.
-   Avoid duplicating business calculations in multiple components.
-   Do not hardcode roles throughout the application; use permission
    codes returned by the API.
-   Use environment variables for the backend API base URL.
-   Do not commit secrets or real credentials to GitHub.

## 10. Step-by-Step React Frontend Implementation Plan

The frontend should be developed in the phases below. Each phase builds
on the previous one. The recommended sequence starts with the
application foundation, then shared layout and authentication, followed
by core workflows, operational modules, and finally analytics and
testing.

### Phase 1 --- Project Setup and React Foundation

**Goal:** Create a working React project with a clean folder structure
and development workflow.

Tasks: 1. Install Node.js and npm. 2. Create the React project using
Vite. 3. Select JavaScript or TypeScript for the project. 4. Install
React Router. 5. Select and install the styling approach. 6. Create the
initial folder structure. 7. Configure global CSS, typography, spacing,
and basic color variables. 8. Create the root application component. 9.
Add a simple test page to confirm the application runs. 10. Create a Git
repository and make the initial commit. 11. Add `.env.example` and
configure the API base URL variable for later integration.

Deliverables: - React application running locally. - Agreed folder
structure. - Global styling foundation. - Git repository with initial
project setup.

Completion criteria: - `npm run dev` starts the application. - The
application loads without console errors. - The team can run the project
using the README instructions.

### Phase 2 --- UI Design System and Shared Components

**Goal:** Establish reusable visual components before building
individual modules.

Tasks: 1. Define the color palette, typography, spacing, border radius,
and shadows. 2. Build the main page container and responsive layout
rules. 3. Create reusable buttons and icon buttons. 4. Create text
inputs, number inputs, selects, date inputs, and text areas. 5. Create
reusable form labels and validation messages. 6. Create status badges
for draft, submitted, pending, overdue, completed, and rejected/returned
states. 7. Create reusable tables with loading, empty, and error states.
8. Create modal/dialog and confirmation components. 9. Create
notification/toast feedback. 10. Create reusable cards and summary
metric components. 11. Create chart wrappers and filter controls.

Deliverables: - Shared component library. - Consistent styles and
interaction patterns. - A small component demonstration page.

Completion criteria: - Common UI elements can be reused across
modules. - Components work at desktop and smaller browser widths. -
Inputs, buttons, tables, and dialogs have consistent behavior.

### Phase 3 --- Application Layout, Navigation, and Routing

**Goal:** Build the overall application shell and navigation system.

Tasks: 1. Create the authentication layout for login-related pages. 2.
Create the main dashboard layout. 3. Build the sidebar navigation. 4.
Build the top navigation bar. 5. Add page title, breadcrumb, and user
profile area. 6. Add active navigation states. 7. Configure routes for
all planned modules. 8. Add a not-found page. 9. Add a reusable
protected-route mechanism. 10. Add a permission-aware navigation
configuration. 11. Add responsive sidebar behavior for tablet and mobile
widths.

Deliverables: - Complete application shell. - Working navigation between
placeholder pages. - Route configuration. - Responsive sidebar and
header.

Completion criteria: - Every planned module has a route or placeholder
page. - Navigation works without full page reloads. - Unauthenticated
and unauthorized route behavior is defined.

### Phase 4 --- Authentication and User Access Interface

**Goal:** Build the frontend authentication flow and role-aware user
experience.

Tasks: 1. Build the login page. 2. Add required-field and format
validation. 3. Create an authentication service for
login/logout/current-user requests. 4. Create shared authentication
state using Context or another selected state approach. 5. Handle
authenticated and unauthenticated application states. 6. Implement
logout. 7. Implement session-expired and API error handling. 8. Create
the user profile page. 9. Build user list and user detail screens for
authorized administrators. 10. Build role assignment and account
activation screens if included in the agreed scope. 11. Add route and
navigation checks based on permission codes.

Deliverables: - Login and logout UI. - Shared authentication state. -
Protected routes. - Basic user administration screens.

Completion criteria: - Login and logout work against the API when
available. - User role and permission data controls the visible
interface. - The frontend handles invalid credentials, expired sessions,
and denied access. - Backend authorization is tested independently of
the frontend.

### Phase 5 --- Organization and Farm Management

**Goal:** Implement the organizational hierarchy used by all farm
workflows.

Tasks: 1. Build the site listing page. 2. Build site create/edit forms.
3. Build the farm listing page and site filter. 4. Build farm
create/edit forms. 5. Build house/shed listing and forms. 6. Build flock
listing and forms. 7. Add organization hierarchy breadcrumbs. 8. Build
user-to-site/farm assignment screens if included. 9. Add active
farm/house/flock selectors. 10. Add empty states when no organization
records exist. 11. Connect screens to the organization API endpoints.

Deliverables: - Site, farm, house, and flock screens. - Organization
selectors. - Organization API integration.

Completion criteria: - Authorized users can view and manage the
hierarchy. - Users can select only records within their permitted
scope. - Other modules can reuse the active farm/house/flock context.

### Phase 6 --- Daily Reports, Mortality, and Post-Mortem

**Goal:** Deliver the main Farm Manager workflow as a complete frontend
feature.

Tasks: 1. Build the daily report listing page. 2. Add filters for date,
farm, house, flock, and report status. 3. Build the report creation page
with clearly separated sections. 4. Implement egg category inputs and
display the total. 5. Display Peti conversion using 360 eggs per Peti.
6. Build bird population and mortality sections. 7. Build feed, water,
and light sections. 8. Build medicine, vaccine, and operational issue
sections. 9. Build bird weight and measurement sections. 10. Build
post-mortem observation forms. 11. Add picture/audio attachment controls
if supported. 12. Implement save-draft and submit actions. 13. Build
report detail and review-status pages. 14. Build returned-for-correction
and resubmission states. 15. Add duplicate-submission and validation
feedback. 16. Connect the workflow to the daily report and mortality
APIs.

Deliverables: - Daily report list, create, edit, detail, and review
screens. - Mortality and post-mortem forms. - Attachment interface. -
Working report submission flow.

Completion criteria: - The approved daily report fields are
represented. - Calculated values are displayed consistently with backend
responses. - Draft/submitted/returned states are clear. - Validation and
API errors are understandable. - The complete report can be completed
without navigating through unrelated screens.

### Phase 7 --- Clinical Visits and Medication Administration

**Goal:** Implement the Doctor and Farm Manager clinical workflows while
preserving separation of duties.

Tasks: 1. Build the clinical visit list. 2. Build clinical visit detail
and creation forms. 3. Add diagnosis, observations, parameters, remarks,
and attachment fields. 4. Build prescription creation and editing
screens. 5. Add medicine, dosage, route, frequency, and duration fields
according to the approved API contract. 6. Build prescription detail and
status views. 7. Build the medication task list. 8. Add due, overdue,
completed, missed, and cancelled filters. 9. Build medication
administration detail and outcome forms. 10. Display the user and
timestamp associated with an administration event. 11. Hide prohibited
actions based on permissions and actor context. 12. Connect clinical and
medication screens to their APIs. 13. Test the Doctor restriction
against the backend, including users who hold multiple roles.

Deliverables: - Clinical visit and prescription screens. - Medication
task and administration screens. - Separate prescription and
administration status views.

Completion criteria: - A Doctor can create a prescription but cannot
confirm their own prescription as administered. - An authorized
farm-side user can record an administration event. - Prescription and
administration statuses are never presented as interchangeable.

### Phase 8 --- Inventory, Feed Formulas, Egg Production, and Sales

**Goal:** Implement the primary operations workflows.

Tasks: 1. Build inventory item listing and detail pages. 2. Build
inventory item create/edit forms. 3. Build stock movement history. 4.
Build receipt, issue, adjustment, and transfer forms according to
permissions. 5. Build low-stock and out-of-stock views. 6. Build
feed-stock listing and consumption views. 7. Build feed formula creation
with dynamic ingredient rows. 8. Add formula submission and
pending-costing views. 9. Build ingredient pricing and costing screens
for Operation Managers. 10. Display row cost, total cost, cost/kg, and
cost/bag returned by the backend. 11. Build formula finalization,
return-for-revision, and version-history views. 12. Build egg production
listing and entry forms. 13. Build egg sales listing and create-sale
forms. 14. Add egg/Peti unit selection and conversion display. 15.
Display saleable stock and overselling errors if the stock ledger is
available. 16. Build expense entry and daily financial summary views if
included in the API. 17. Integrate the operations APIs.

Deliverables: - Inventory and feed-stock screens. - Feed formula
composition and costing workflow. - Egg production and sales screens. -
Financial summary screens where supported.

Completion criteria: - Farm Managers can submit formula quantities
without price fields. - Operation Managers can enter prices and finalize
costing when authorized. - Production and sales remain separate. - Stock
and financial values shown by the frontend match backend results.

### Phase 9 --- Notifications, Dashboards, Analytics, and Reports

**Goal:** Provide operational visibility and management summaries.

Tasks: 1. Build the notification list and notification detail pages. 2.
Add severity and status filters. 3. Build acknowledge, respond, and
resolve interactions where permitted. 4. Add a notification indicator to
the main navigation. 5. Build role-specific dashboard layouts. 6. Create
summary metric cards. 7. Add mortality and egg-production charts. 8. Add
sales and inventory charts. 9. Add bird-weight and feed-consumption
trends. 10. Add date and organization filters. 11. Link chart/card
selections to relevant source records. 12. Build report listing and
report detail screens. 13. Add export controls when backend export
endpoints exist. 14. Add explicit no-data and incomplete-data states.
15. Apply date-range restrictions returned/enforced by the backend. 16.
Integrate analytics and notification APIs.

Deliverables: - Notification and emergency screens. - Role-specific
dashboards. - Analytics charts and filters. - Report pages and available
export actions.

Completion criteria: - Each role sees relevant dashboard information. -
Charts use API data rather than permanent hardcoded sample values. -
Filters respect the user's assigned scope and historical access. -
Notifications show their current lifecycle state.

### Phase 10 --- Audit Interface, Responsive Polish, and Frontend Testing

**Goal:** Improve reliability, usability, and presentation quality
before final demonstration.

Tasks: 1. Build the audit log list and detail view for authorized
administrators. 2. Review all pages for consistent spacing, typography,
and component usage. 3. Test the application at desktop, tablet, and
mobile browser widths. 4. Test forms with valid, invalid, missing, and
boundary values. 5. Test loading, empty, error, success, and
permission-denied states. 6. Test route protection and permission-aware
navigation. 7. Test filters, pagination, sorting, and search. 8. Test
file upload feedback and attachment display. 9. Test API failure and
expired-session behavior. 10. Check browser console errors and remove
debug code. 11. Run the production build and fix build warnings/errors.
12. Prepare a demo account and representative sample data. 13. Update
the README with setup and run instructions. 14. Prepare screenshots and
acceptance evidence for the university evaluation.

Deliverables: - Audit interface. - Responsive frontend. - Tested
production build. - Setup documentation. - Demonstration-ready
application.

Completion criteria: - Main user workflows pass the agreed test
scenarios. - No critical frontend errors remain. - Responsive layouts
are usable. - The project can be installed and run using the README.

## 11. Recommended Frontend Development Order

The phases should be followed in sequence because later modules depend
on shared foundations and organization context.

  ------------------------------------------------------------------------
                  Order Phase            Priority         Dependency
  --------------------- ---------------- ---------------- ----------------
                      1 Project setup    Critical         None
                        and React
                        foundation

                      2 UI design system Critical         Phase 1
                        and shared
                        components

                      3 Layout,          Critical         Phases 1--2
                        navigation, and
                        routing

                      4 Authentication   Critical         Phases 1--3 and
                        and user access                   backend auth
                                                          contract

                      5 Organization and High             Phases 1--4
                        farm management

                      6 Daily reports,   Critical         Phases 1--5
                        mortality, and
                        post-mortem

                      7 Clinical visits  High             Phases 1--5;
                        and medication                    organization
                        administration                    context

                      8 Inventory, feed, High             Phases 1--5
                        egg production,
                        and sales

                      9 Notifications,   Medium--High     Relevant source
                        dashboards,                       modules and APIs
                        analytics, and
                        reports

                     10 Audit,           Critical         All implemented
                        responsive                        phases
                        polish, and
                        testing
  ------------------------------------------------------------------------

**Recommended university-project MVP:** If development time is limited,
prioritize Phases 1--6, then implement the essential clinical,
medication, inventory, and sales flows from Phases 7--8. A smaller
number of complete, integrated workflows is preferable to many
unfinished screens.

## 12. Frontend and Backend Integration Strategy

The frontend should not wait for every backend endpoint to be completed.
Development can proceed in stages.

### Stage A --- UI with mock data

-   Build layouts, tables, forms, and navigation.
-   Use clearly identified temporary mock data.
-   Keep mock data separate from page components.
-   Agree on expected request and response shapes with the backend team.

### Stage B --- API contract alignment

-   Confirm endpoint paths, HTTP methods, request bodies, response
    fields, pagination, and error formats.
-   Confirm authentication/session behavior.
-   Confirm permission codes and scope fields.
-   Document the contract before integrating each feature.

### Stage C --- Feature-by-feature integration

-   Integrate authentication first.
-   Integrate organization data next.
-   Integrate daily reports and the highest-priority operational
    modules.
-   Replace mock data one feature at a time.
-   Keep the application usable while individual modules are being
    integrated.

### Stage D --- Integration testing

-   Test successful requests and validation errors.
-   Test expired sessions and denied permissions.
-   Test wrong-farm and wrong-flock access attempts.
-   Test duplicate submissions and repeated actions.
-   Confirm that backend-calculated values are displayed correctly.

### Suggested API service pattern

``` javascript
// src/services/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

export default api;
```

``` javascript
// Example feature service
// src/services/endpoints/farms.js
import api from "../api";

export const getFarms = async () => {
  const response = await api.get("/farms");
  return response.data;
};
```

The exact authentication configuration, endpoint paths, and response
handling must match the backend implementation. The snippets above are
illustrative starting points, not final API contracts.

## 13. UI/UX Requirements

-   Use a consistent dashboard layout across modules.
-   Keep the most frequent Farm Manager actions easy to reach.
-   Use clear page titles and breadcrumbs.
-   Use tables for searchable/list-based records and forms for
    create/edit workflows.
-   Use confirmation dialogs for destructive or irreversible actions.
-   Use status labels and icons in addition to color.
-   Show required fields and explain validation errors near the relevant
    input.
-   Display loading feedback for API requests.
-   Provide useful empty states rather than blank screens.
-   Preserve entered form values when recoverable API errors occur.
-   Make tables usable on smaller screens through responsive layouts or
    controlled horizontal scrolling.
-   Keep date, number, weight, quantity, and currency formats
    consistent.
-   Clearly label calculated and read-only values.
-   Do not imply that a record has been saved until the backend confirms
    success.

## 14. Frontend Non-Functional Requirements

### Performance

-   Use pagination for large lists.
-   Avoid loading every farm record at once.
-   Lazy-load routes or large modules where useful.
-   Avoid unnecessary repeated API calls.
-   Keep chart data limited to the selected scope and date range.

### Security

-   Do not store passwords or secrets in frontend source code.
-   Use the backend's approved session/token strategy.
-   Do not rely on hidden buttons or route guards as authorization.
-   Avoid exposing sensitive information in browser logs.
-   Handle session expiry and unauthorized API responses consistently.

### Accessibility and usability

-   Use readable text sizes and sufficient contrast.
-   Provide labels for form controls.
-   Support keyboard navigation for common interactions.
-   Use clear focus states.
-   Do not communicate critical status through color alone.
-   Make buttons and touch targets usable on smaller screens.

### Maintainability

-   Use reusable components and feature-based organization.
-   Keep API calls outside presentation components.
-   Avoid duplicated business logic.
-   Use consistent naming conventions.
-   Document setup, environment variables, and major architectural
    decisions.

## 15. Testing and Acceptance Criteria

The frontend should be considered ready for project demonstration when
the following can be shown:

1.  A user can log in and log out.
2.  The application displays navigation appropriate to the user's
    permissions.
3.  An unassigned user cannot access protected business pages through
    the normal application flow.
4.  Authorized users can navigate the company/site/farm/house/flock
    hierarchy.
5.  A Farm Manager can complete, save, and submit a daily report.
6.  Egg categories and the 360-eggs-per-Peti conversion are represented
    correctly.
7.  Mortality and post-mortem observations can be recorded.
8.  A Doctor can create a clinical visit and prescription.
9.  An authorized farm-side user can record medication administration
    separately.
10. The interface does not offer a Doctor the ability to confirm their
    own prescription as administered.
11. Authorized users can view and manage inventory and feed records.
12. Farm Managers can create and submit feed formulas without entering
    ingredient prices.
13. Operation Managers can enter ingredient prices and review costing
    results.
14. Egg production and egg sales are represented as separate workflows.
15. Notifications and emergencies display severity and lifecycle status.
16. Dashboards display data returned by the backend and show sensible
    empty/error states.
17. Unauthorized API responses are handled without exposing protected
    information.
18. The application works at common desktop and mobile browser widths.
19. The production build completes successfully.
20. A new developer can run the project by following the README.

## 16. Project Risks and Mitigation

  -----------------------------------------------------------------------
  Risk                    Possible effect         Mitigation
  ----------------------- ----------------------- -----------------------
  Backend API contracts   Frontend rework and     Agree on
  are not agreed early    integration delays      request/response
                                                  examples before feature
                                                  integration

  Too many modules are    Incomplete workflows    Follow the phased plan
  started at once                                 and prioritize an MVP

  Role permissions are    Difficult changes and   Use permission codes
  hardcoded in components inconsistent access     from the backend

  Daily report fields are Important farm data is  Confirm the report
  incomplete              omitted                 fields before Phase 6

  Business calculations   Incorrect displayed     Treat backend
  differ between frontend totals                  calculations as
  and backend                                     authoritative

  Responsive behavior is  Poor mobile-browser     Check responsive
  postponed               usability               layouts in every phase

  Mock data becomes mixed Confusing integration   Isolate mock services
  with production code    and debugging           and remove them feature
                                                  by feature

  Team members modify     Merge conflicts         Assign module ownership
  shared files without                            and agree on shared
  coordination                                    component/API contracts

  Time is spent polishing Core requirements       Complete core forms and
  dashboards before       remain unfinished       API integration before
  workflows work                                  advanced analytics
  -----------------------------------------------------------------------

## 17. Decisions and Assumptions to Confirm

The following items should be clarified by the project team or
supervisor before the relevant feature is finalized:

1.  Whether all five roles are required in the university submission or
    whether some can be combined for the demonstration.
2.  Exact fields and calculations in the daily poultry report.
3.  Flock transfer, house occupancy, and record archival rules.
4.  The business timezone and permitted historical date range for each
    role.
5.  Authentication method and account creation policy.
6.  Medicine master data, dosage units, and prescription schedule rules.
7.  Which users may record or correct medication administration.
8.  Inventory units, stock movement rules, and whether expiry/lot
    tracking is required.
9.  Saleable egg categories and whether a full egg stock ledger is part
    of the project.
10. Formula costing precision, rounding, and bag-size rules.
11. The official ROI formula, if ROI is required.
12. Notification channels and emergency escalation rules.
13. Media upload limits and supported formats.
14. Whether PDF/Excel exports are required for the university
    demonstration.

Where a decision is not confirmed, the frontend should avoid presenting
an invented business rule as final. Use a clearly marked placeholder or
defer the relevant control until the API contract is agreed.

## 18. Team Collaboration Guidelines

1.  Assign a primary owner to each frontend module.
2.  Agree on route names, shared components, naming conventions, and API
    contracts.
3.  Keep shared layout and design-system changes coordinated.
4.  Use feature branches and pull requests.
5.  Avoid editing the same shared component in parallel without
    coordination.
6.  Integrate small, working increments rather than waiting until the
    end.
7.  Review permission behavior with the backend team.
8.  Keep mock data separate from API services.
9.  Test each feature before merging it into the main branch.
10. Keep the README and project status updated.

## 19. Final Delivery

The final university project delivery should include:

-   Responsive React web application.
-   Authentication and role-aware navigation.
-   Implemented core poultry-management workflows.
-   Backend API integration for completed modules.
-   MongoDB-backed persistent records through the backend.
-   Dashboard and reporting screens for implemented metrics.
-   Basic test evidence for the primary user workflows.
-   GitHub repository with organized source code.
-   README with installation, configuration, and run instructions.
-   Final project demonstration using representative sample data.

The implementation should prioritize correctness, traceable workflows,
role separation, and a usable end-to-end demonstration over adding a
large number of incomplete features.
