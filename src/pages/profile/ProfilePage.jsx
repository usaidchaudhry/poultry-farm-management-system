import Badge from '../../components/common/Badge.jsx';
import Card from '../../components/common/Card.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { getNavigation } from '../../config/navigation.js';
import { ROLE_INFO } from '../../config/roles.js';
import { useAuth } from '../../context/AuthContext.jsx';
import './ProfilePage.css';

// Read-only view of the signed-in account and what it can access.
export default function ProfilePage() {
  const { user, hasPermission } = useAuth();
  const role = ROLE_INFO[user.role];
  const areas = getNavigation(hasPermission).flatMap((group) => group.items.map((item) => item.label));

  return (
    <div className="profile">
      <Card title="Account">
        <dl className="profile__details">
          <div><dt>Name</dt><dd>{user.name}</dd></div>
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Role</dt><dd>{role?.label}</dd></div>
          <div><dt>Status</dt><dd><StatusBadge status={user.isActive ? 'active' : 'inactive'} /></dd></div>
        </dl>
      </Card>

      <Card title="Your access" subtitle={`${role?.description}.`}>
        <div className="profile__areas">
          {areas.map((area) => (
            <Badge key={area} tone="primary">{area}</Badge>
          ))}
        </div>
        <p className="text-muted profile__count">{user.permissions.length} permissions granted</p>
      </Card>
    </div>
  );
}
