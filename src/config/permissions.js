// Permission codes. Later the backend returns these codes with the logged-in user.
// Format: '<module>.<action>'. Components use these constants, never raw strings or role names.
export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  NOTIFICATIONS_VIEW: 'notifications.view',
  ORGANIZATION_VIEW: 'organization.view',
  ORGANIZATION_MANAGE: 'organization.manage',
  DAILY_REPORTS_VIEW: 'daily-reports.view',
  MORTALITY_VIEW: 'mortality.view',
  CLINICAL_VIEW: 'clinical.view',
  MEDICATION_VIEW: 'medication.view',
  BIRD_PARAMETERS_VIEW: 'bird-parameters.view',
  INVENTORY_VIEW: 'inventory.view',
  FEED_FORMULAS_VIEW: 'feed-formulas.view',
  EGG_PRODUCTION_VIEW: 'egg-production.view',
  SALES_VIEW: 'sales.view',
  FINANCE_VIEW: 'finance.view',
  REPORTS_VIEW: 'reports.view',
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  AUDIT_VIEW: 'audit.view',
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);
