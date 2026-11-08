import { PERMISSIONS as P } from './permissions.js';

/*
  Every page of the app is described here once.
  - group: sidebar section (modules without a group are not shown in the sidebar)
  - permission: code needed to open the page (omit = any signed-in user)
  - phase: the PRD phase that builds the real page (shown on the placeholder)
  - children: sub-pages shown under the parent in the sidebar
  - parent: path of the parent page, used by breadcrumbs
*/
export const NAV_GROUPS = ['Overview', 'Farm operations', 'Operations and finance', 'Insights', 'Administration'];

export const MODULES = [
  {
    key: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'grid', group: 'Overview',
    permission: P.DASHBOARD_VIEW, phase: 9,
    description: 'Role-specific landing page with summary cards and charts.',
    capabilities: ['Summary cards for the metrics each role needs', 'Charts for mortality, egg production, sales and feed', 'Filters by site, farm, house and flock', 'Clear loading, no-data and error states'],
  },
  {
    key: 'notifications', label: 'Notifications', path: '/notifications', icon: 'bell', group: 'Overview',
    permission: P.NOTIFICATIONS_VIEW, phase: 9,
    description: 'Important events and emergencies, with their response status.',
    capabilities: ['Notification list with severity and status', 'Emergency highlighting', 'Notification detail and response tracking'],
  },
  {
    key: 'daily-reports', label: 'Daily reports', path: '/daily-reports', icon: 'clipboard', group: 'Farm operations',
    permission: P.DAILY_REPORTS_VIEW, phase: 6,
    description: 'The Farm Manager daily reporting workflow.',
    capabilities: ['Select farm, house, flock and business date', 'Create and edit reports while in draft', 'Review and submit workflow'],
  },
  {
    key: 'mortality', label: 'Mortality', path: '/mortality', icon: 'activity', group: 'Farm operations',
    permission: P.MORTALITY_VIEW, phase: 6,
    description: 'Mortality records and post-mortem observations.',
    capabilities: ['Record mortality counts', 'Post-mortem observations', 'Mortality history by flock'],
  },
  {
    key: 'clinical', label: 'Clinical visits', path: '/clinical', icon: 'droplet', group: 'Farm operations',
    permission: P.CLINICAL_VIEW, phase: 7,
    description: 'Doctor visits, diagnosis and prescriptions.',
    capabilities: ['List and filter clinical visits', 'Record diagnosis and observations', 'Create prescription items'],
  },
  {
    key: 'medication', label: 'Medication', path: '/medication', icon: 'check', group: 'Farm operations',
    permission: P.MEDICATION_VIEW, phase: 7,
    description: 'Medication administration tasks and their status.',
    capabilities: ['Due, overdue, completed and missed tasks', 'Confirm administration by an authorized user', 'A Doctor cannot confirm their own prescription'],
  },
  {
    key: 'bird-parameters', label: 'Bird parameters', path: '/bird-parameters', icon: 'target', group: 'Farm operations',
    permission: P.BIRD_PARAMETERS_VIEW, phase: 6,
    description: 'Bird measurements and weekly weight against standards.',
    capabilities: ['Record sample size and average weight', 'Compare with approved standards', 'Weekly weight trend'],
  },
  {
    key: 'inventory', label: 'Inventory and feed', path: '/inventory', icon: 'package', group: 'Operations and finance',
    permission: P.INVENTORY_VIEW, phase: 8,
    description: 'Stock levels and stock movements.',
    capabilities: ['Inventory items with balance and minimum threshold', 'Stock movements', 'Low-stock visibility'],
  },
  {
    key: 'feed-formulas', label: 'Feed formulas', path: '/feed-formulas', icon: 'sliders', group: 'Operations and finance',
    permission: P.FEED_FORMULAS_VIEW, phase: 8,
    description: 'Formula composition and costing.',
    capabilities: ['Create formulas from ingredients', 'Separate ingredient pricing and costing', 'Formula versions'],
  },
  {
    key: 'egg-production', label: 'Egg production', path: '/egg-production', icon: 'egg', group: 'Operations and finance',
    permission: P.EGG_PRODUCTION_VIEW, phase: 8,
    description: 'Daily egg production by farm and category.',
    capabilities: ['Daily production by farm and egg category', 'Damaged and rejected quantities recorded separately'],
  },
  {
    key: 'sales', label: 'Sales', path: '/sales', icon: 'cart', group: 'Operations and finance',
    permission: P.SALES_VIEW, phase: 8,
    description: 'Egg sales, tracked separately from production.',
    capabilities: ['Record sales by customer and category', 'Sales quantity and value'],
  },
  {
    key: 'finance', label: 'Finance', path: '/finance', icon: 'dollar', group: 'Operations and finance',
    permission: P.FINANCE_VIEW, phase: 8,
    description: 'Daily operational financial results.',
    capabilities: ['Expense entry', 'Daily financial summary', 'Revenue, cost and operating surplus or deficit'],
  },
  {
    key: 'analytics', label: 'Reports and analytics', path: '/analytics', icon: 'barChart', group: 'Insights',
    permission: P.REPORTS_VIEW, phase: 9,
    description: 'Daily and historical reports with export controls.',
    capabilities: ['Daily and historical report screens', 'Charts and filters', 'PDF or spreadsheet export if supported'],
  },
  {
    key: 'organization', label: 'Organization', path: '/organization', icon: 'layers', group: 'Administration',
    permission: P.ORGANIZATION_VIEW, phase: 5,
    description: 'Company, sites, farms, houses and flocks.',
    capabilities: ['Organization hierarchy view', 'Site, farm, house and flock management', 'User-to-site and farm assignment'],
    children: [
      { key: 'sites', label: 'Sites', path: '/organization/sites', parent: '/organization', permission: P.ORGANIZATION_VIEW, phase: 5, description: 'Manage company sites.', capabilities: ['Create, view, edit and archive sites'] },
      { key: 'farms', label: 'Farms', path: '/organization/farms', parent: '/organization', permission: P.ORGANIZATION_VIEW, phase: 5, description: 'Manage farms under each site.', capabilities: ['Create, view, edit and archive farms', 'Filter by site'] },
      { key: 'houses', label: 'Houses and sheds', path: '/organization/houses', parent: '/organization', permission: P.ORGANIZATION_VIEW, phase: 5, description: 'Manage houses and sheds under each farm.', capabilities: ['Create, view, edit and archive houses', 'Filter by farm'] },
      { key: 'flocks', label: 'Flocks', path: '/organization/flocks', parent: '/organization', permission: P.ORGANIZATION_VIEW, phase: 5, description: 'Manage flocks in each house.', capabilities: ['Create, view, edit and archive flocks', 'Filter by house'] },
    ],
  },
  {
    key: 'users', label: 'Users', path: '/users', icon: 'users', group: 'Administration',
    permission: P.USERS_VIEW, phase: 4, built: true,
    description: 'User accounts, roles and access.',
    capabilities: ['User list, create and edit', 'Role assignment', 'Activate and deactivate accounts'],
  },
  {
    key: 'audit', label: 'Audit log', path: '/audit', icon: 'shield', group: 'Administration',
    permission: P.AUDIT_VIEW, phase: 10,
    description: 'Read-only record of important changes.',
    capabilities: ['Audit table with filters', 'Detail view with before and after values'],
  },
  // Pages that exist but are not in the sidebar
  { key: 'profile', label: 'My profile', path: '/profile', phase: 4, built: true, description: 'Your account details.', capabilities: ['View current user profile', 'Change password (if in scope)'] },
  { key: 'design-system', label: 'Design system', path: '/design-system', description: 'Shared component showcase (developer page).', isDeveloperPage: true },
];

// Flat list of every page, including children.
export const ALL_PAGES = MODULES.flatMap((module) => [module, ...(module.children || [])]);
