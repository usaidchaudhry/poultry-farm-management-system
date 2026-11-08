import { Link } from 'react-router-dom';
import Badge from '../../components/common/Badge.jsx';
import Card from '../../components/common/Card.jsx';
import Icon from '../../components/common/Icon.jsx';
import { getNavigation } from '../../config/navigation.js';
import { ROLE_INFO } from '../../config/roles.js';
import { useAuth } from '../../context/AuthContext.jsx';
import './DashboardHomePage.css';

// Phase 3 landing page: shows the areas the current role can open.
// Phase 9 replaces this with real role-specific dashboards (cards and charts).
export default function DashboardHomePage() {
  const { user, hasPermission } = useAuth();
  const role = ROLE_INFO[user.role];
  const items = getNavigation(hasPermission)
    .flatMap((group) => group.items)
    .filter((item) => item.key !== 'dashboard');

  return (
    <div className="home">
      <Card title={`Welcome, ${user.name}`} subtitle={role?.label}>
        <p className="home__text">{role?.description}. Below are the areas available to your role.</p>
      </Card>

      <div className="home__grid">
        {items.map((item) => (
          <Link key={item.key} to={item.path} className="home__tile">
            <span className="home__tile-icon"><Icon name={item.icon} size={20} /></span>
            <span className="home__tile-body">
              <span className="home__tile-title">{item.label}</span>
              <span className="home__tile-text">{item.description}</span>
            </span>
            {item.built ? <Badge tone="success">Ready</Badge> : <Badge tone="neutral">Phase {item.phase}</Badge>}
          </Link>
        ))}
      </div>
    </div>
  );
}
