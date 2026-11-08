import { ALL_PERMISSIONS, PERMISSIONS as P } from './permissions.js';

export const ROLES = {
  OWNER: 'owner',
  PRODUCTION_MANAGER: 'production_manager',
  FARM_MANAGER: 'farm_manager',
  OPERATION_MANAGER: 'operation_manager',
  DOCTOR: 'doctor',
};

// Display names and short descriptions (from PRD section 5).
export const ROLE_INFO = {
  [ROLES.OWNER]: { label: 'Owner / Production Head', description: 'Overall access, management overview, reports and administration' },
  [ROLES.PRODUCTION_MANAGER]: { label: 'Production Manager', description: 'Broad operational oversight and management activities' },
  [ROLES.FARM_MANAGER]: { label: 'Farm Manager', description: 'Daily reports, mortality, medication administration, feed consumption' },
  [ROLES.OPERATION_MANAGER]: { label: 'Operation Manager', description: 'Inventory, feed stock, formula costing, egg sales and finance' },
  [ROLES.DOCTOR]: { label: 'Doctor', description: 'Clinical visits, diagnosis, prescriptions and bird parameters' },
};

const COMMON = [P.DASHBOARD_VIEW, P.NOTIFICATIONS_VIEW];

// Role -> permission codes. ASSUMPTIONS: see PROGRESS.md. Edit here to change what a role can see.
// When a real backend exists, this map disappears: the API returns the codes for each user.
export const ROLE_PERMISSIONS = {
  [ROLES.OWNER]: ALL_PERMISSIONS,
  [ROLES.PRODUCTION_MANAGER]: [
    ...COMMON,
    P.ORGANIZATION_VIEW,
    P.DAILY_REPORTS_REVIEW,
    P.NOTIFICATIONS_MANAGE,
    P.DAILY_REPORTS_VIEW,
    P.MORTALITY_VIEW,
    P.CLINICAL_VIEW,
    P.MEDICATION_VIEW,
    P.BIRD_PARAMETERS_VIEW,
    P.INVENTORY_VIEW,
    P.FEED_FORMULAS_VIEW,
    P.EGG_PRODUCTION_VIEW,
    P.SALES_VIEW,
    P.FINANCE_VIEW,
    P.REPORTS_VIEW,
  ],
  [ROLES.FARM_MANAGER]: [
    ...COMMON,
    P.ORGANIZATION_VIEW,
    P.DAILY_REPORTS_VIEW,
    P.DAILY_REPORTS_MANAGE,
    P.MORTALITY_VIEW,
    P.MEDICATION_VIEW,
    P.MEDICATION_ADMINISTER,
    P.BIRD_PARAMETERS_VIEW,
    P.BIRD_PARAMETERS_MANAGE,
    P.FEED_FORMULAS_VIEW,
    P.FEED_FORMULAS_COMPOSE,
  ],
  [ROLES.OPERATION_MANAGER]: [
    ...COMMON,
    P.ORGANIZATION_VIEW,
    P.INVENTORY_VIEW,
    P.INVENTORY_MANAGE,
    P.FEED_FORMULAS_VIEW,
    P.FEED_FORMULAS_COST,
    P.EGG_PRODUCTION_VIEW,
    P.EGG_PRODUCTION_MANAGE,
    P.SALES_VIEW,
    P.SALES_MANAGE,
    P.FINANCE_VIEW,
    P.FINANCE_MANAGE,
    P.NOTIFICATIONS_MANAGE,
    P.REPORTS_VIEW,
  ],
  [ROLES.DOCTOR]: [
    ...COMMON,
    P.ORGANIZATION_VIEW,
    P.CLINICAL_VIEW,
    P.CLINICAL_MANAGE,
    P.NOTIFICATIONS_MANAGE,
    P.MEDICATION_VIEW,
    P.BIRD_PARAMETERS_VIEW,
  ],
};

// [{ value: 'owner', label: 'Owner / Production Head' }, ...] for role dropdowns
export const ROLE_OPTIONS = Object.entries(ROLE_INFO).map(([value, info]) => ({ value, label: info.label }));

// Which records a role may work with. ASSUMPTION (see PROGRESS.md):
//   'all'      = the whole company
//   'assigned' = only the sites/farms assigned to the user (an assigned site includes all its farms)
export const ROLE_SCOPE = {
  [ROLES.OWNER]: 'all',
  [ROLES.PRODUCTION_MANAGER]: 'all',
  [ROLES.FARM_MANAGER]: 'assigned',
  [ROLES.OPERATION_MANAGER]: 'assigned',
  [ROLES.DOCTOR]: 'assigned',
};

export const hasCompanyWideScope = (role) => ROLE_SCOPE[role] === 'all';
