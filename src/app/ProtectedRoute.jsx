import { Navigate, Outlet, useLocation } from 'react-router-dom';
import LoadingState from '../components/common/LoadingState.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import AccessDeniedPage from '../pages/common/AccessDeniedPage.jsx';

/*
  Route guard. Two ways to use it:
    <Route element={<ProtectedRoute />}> ...routes... </Route>               -> must be signed in
    <ProtectedRoute permission="users.view"><UsersPage /></ProtectedRoute>   -> also needs a permission
  Checking saved session -> loading screen
  Not signed in          -> redirected to /login (and sent back after login)
  Signed in, no role     -> redirected to /pending-access
  Missing permission     -> the Access denied page is shown in place
  This is for usability only. The backend must enforce access on every API request.
*/
export default function ProtectedRoute({ permission, children }) {
  const { user, isAuthenticated, isInitializing, hasPermission } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="route-loading">
        <LoadingState message="Checking your session..." />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!user.role) return <Navigate to="/pending-access" replace />;
  if (permission && !hasPermission(permission)) return <AccessDeniedPage />;
  return children || <Outlet />;
}
