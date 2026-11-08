import { useAuth } from '../../context/AuthContext.jsx';

/*
  Permission-aware rendering. Shows its children only when the user has the permission(s).
    <Can permission={PERMISSIONS.USERS_MANAGE}><Button>Add user</Button></Can>
    <Can anyOf={[P.SALES_VIEW, P.FINANCE_VIEW]} fallback={<p>No access</p>}>...</Can>
  Components never check role names. This hides UI only; the backend enforces real access.
*/
export default function Can({ permission, anyOf, fallback = null, children }) {
  const { hasPermission, hasAnyPermission } = useAuth();
  const allowed = anyOf ? hasAnyPermission(anyOf) : hasPermission(permission);
  return allowed ? children : fallback;
}
