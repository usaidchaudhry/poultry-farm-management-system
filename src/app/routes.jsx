import { Navigate, Route, Routes } from 'react-router-dom';
import { ALL_PAGES } from '../config/modules.js';
import AuthLayout from '../layouts/AuthLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import LoginPage from '../pages/auth/LoginPage.jsx';
import PendingAccessPage from '../pages/auth/PendingAccessPage.jsx';
import ModulePlaceholderPage from '../pages/common/ModulePlaceholderPage.jsx';
import NotFoundPage from '../pages/common/NotFoundPage.jsx';
import DashboardHomePage from '../pages/dashboard/DashboardHomePage.jsx';
import DesignSystemPage from '../pages/design-system/DesignSystemPage.jsx';
import ProfilePage from '../pages/profile/ProfilePage.jsx';
import UsersPage from '../pages/users/UsersPage.jsx';
import OrganizationPage from '../pages/organization/OrganizationPage.jsx';
import OrgListPage from '../pages/organization/OrgListPage.jsx';
import WorkPage from '../pages/work/WorkPage.jsx';
import MedicationPage from '../pages/work/MedicationPage.jsx';
import FeedFormulasPage from '../pages/work/FeedFormulasPage.jsx';
import InventoryPage from '../pages/work/InventoryPage.jsx';
import FinancePage from '../pages/work/FinancePage.jsx';
import NotificationsPage from '../pages/work/NotificationsPage.jsx';
import AnalyticsPage from '../pages/work/AnalyticsPage.jsx';
import AuditPage from '../pages/work/AuditPage.jsx';
import SalesPage from '../pages/work/SalesPage.jsx';
import { PERMISSIONS } from '../config/permissions.js';
import SetupCheckPage from '../pages/setup/SetupCheckPage.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';

/*
  Pages that are really built. Anything in config/modules.js that is NOT listed here
  automatically gets a placeholder page. In later phases, import the real page and
  add one line, e.g.  users: UsersPage
*/
const PAGE_REGISTRY = {
  dashboard: DashboardHomePage,
  'design-system': DesignSystemPage,
  users: UsersPage,
  organization: OrganizationPage,
  sites: () => <OrgListPage kind="site" />,
  farms: () => <OrgListPage kind="farm" />,
  houses: () => <OrgListPage kind="house" />,
  flocks: () => <OrgListPage kind="flock" />,
  'daily-reports': () => <WorkPage kind="dailyReports" permission={PERMISSIONS.DAILY_REPORTS_MANAGE} />,
  mortality: () => <WorkPage kind="dailyReports" permission={PERMISSIONS.DAILY_REPORTS_MANAGE} filterRows={(row) => Number(row.mortality) > 0} intro="Mortality and post-mortem observations are recorded in daily reports." />,
  clinical: () => <WorkPage kind="clinicalVisits" permission={PERMISSIONS.CLINICAL_MANAGE} />,
  medication: MedicationPage,
  'bird-parameters': () => <WorkPage kind="measurements" permission={PERMISSIONS.BIRD_PARAMETERS_MANAGE} />,
  inventory: InventoryPage,
  'feed-formulas': FeedFormulasPage,
  'egg-production': () => <WorkPage kind="eggProduction" permission={PERMISSIONS.EGG_PRODUCTION_MANAGE} />,
  sales: SalesPage,
  finance: FinancePage,
  notifications: NotificationsPage,
  analytics: AnalyticsPage,
  audit: AuditPage,
  profile: ProfilePage,
};

function renderPage(page) {
  const Page = PAGE_REGISTRY[page.key];
  return (
    <ProtectedRoute permission={page.permission}>
      {Page ? <Page /> : <ModulePlaceholderPage page={page} />}
    </ProtectedRoute>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/pending-access" element={<PendingAccessPage />} />
      </Route>
      <Route path="/setup-check" element={<SetupCheckPage />} />

      {/* Signed-in area */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {ALL_PAGES.map((page) => (
            <Route key={page.path} path={page.path} element={renderPage(page)} />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
