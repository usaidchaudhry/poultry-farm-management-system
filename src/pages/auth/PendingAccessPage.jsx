import { Navigate, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import LoadingState from '../../components/common/LoadingState.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import usePageTitle from '../../hooks/usePageTitle.js';

// For signed-in users who have no role yet ("unassigned user" in the PRD).
export default function PendingAccessPage() {
  const { user, isAuthenticated, isInitializing, logout } = useAuth();
  const navigate = useNavigate();

  usePageTitle('Access pending');

  if (isInitializing) return <LoadingState message="Checking your session..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user.role) return <Navigate to="/dashboard" replace />;

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <EmptyState
      icon="lock"
      title="Your access is pending"
      description={`You are signed in as ${user.email}, but no role has been assigned to your account yet. Ask the Owner to assign a role and you will be able to use the system.`}
      action={<Button variant="secondary" leftIcon="logOut" onClick={handleSignOut}>Sign out</Button>}
    />
  );
}
