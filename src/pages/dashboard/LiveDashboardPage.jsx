import { Link } from 'react-router-dom';
import Card from '../../components/common/Card.jsx';
import Badge from '../../components/common/Badge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getNavigation } from '../../config/navigation.js';
import { LIVE_PAGE_KEYS, MERN_PHASE } from '../../config/integration.js';
import './DashboardHomePage.css';

export default function LiveDashboardPage() {
  const { user, hasPermission } = useAuth();
  const items = getNavigation(hasPermission).flatMap((group) => group.items).filter((item) => item.key !== 'dashboard');
  return <div className="home">
    <Card title={`Welcome, ${user.name}`} subtitle={user.roleLabel}>
      <p>Your account is connected to LayerFlow. User and role administration are available. Farm data and operational summaries will appear as their modules are connected.</p>
    </Card>
    <div className="home__grid">{items.map((item) => <Link className="home__tile" key={item.key} to={item.path}>
      <span className="home__tile-body"><strong>{item.label}</strong><span className="home__tile-text">{item.description}</span></span>
      <Badge tone={LIVE_PAGE_KEYS.has(item.key) ? 'success' : 'neutral'}>{LIVE_PAGE_KEYS.has(item.key) ? 'Connected' : `MERN Phase ${MERN_PHASE[item.key] || 3}`}</Badge>
    </Link>)}</div>
  </div>;
}
