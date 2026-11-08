import Alert from '../../components/common/Alert.jsx';
import Badge from '../../components/common/Badge.jsx';
import { ROLE_INFO } from '../../config/roles.js';
import { getAreasForRole } from './roleAreas.js';
import './users.css';

// Shows what a role gives access to, so the person assigning it knows the effect.
export default function RolePreview({ role }) {
  if (!role) {
    return (
      <Alert tone="warning">
        With no role, the user can sign in but only sees the "access pending" screen until a role is assigned.
      </Alert>
    );
  }
  const areas = getAreasForRole(role);
  return (
    <div className="role-preview">
      <p className="role-preview__text">{ROLE_INFO[role].description}.</p>
      <p className="role-preview__label">Can open:</p>
      <div className="role-preview__areas">
        {areas.map((area) => (
          <Badge key={area} tone="primary">{area}</Badge>
        ))}
      </div>
    </div>
  );
}
