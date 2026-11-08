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
