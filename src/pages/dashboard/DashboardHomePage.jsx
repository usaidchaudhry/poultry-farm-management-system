import { Link } from 'react-router-dom';
import Badge from '../../components/common/Badge.jsx';
import Card from '../../components/common/Card.jsx';
import MetricCard from '../../components/common/MetricCard.jsx';
import Icon from '../../components/common/Icon.jsx';
import { getNavigation } from '../../config/navigation.js';
import { ROLE_INFO } from '../../config/roles.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS as P } from '../../config/permissions.js';
import { workService } from '../../services/workService.js';
import { formatNumber } from '../../utils/formatters.js';
import './DashboardHomePage.css';

// Phase 3 landing page: shows the areas the current role can open.
// Phase 9 replaces this with real role-specific dashboards (cards and charts).
export default function DashboardHomePage() {
  const { user, hasPermission } = useAuth();
  const role = ROLE_INFO[user.role];
  const actor = { id: user.id, role: user.role };
  const count = (kind, permission, select) => hasPermission(permission) ? workService.list(kind, actor).reduce((sum, row) => sum + select(row), 0) : null;
  const mortality = count('dailyReports', P.DAILY_REPORTS_VIEW, (row) => Number(row.mortality || 0));
  const eggs = count('eggProduction', P.EGG_PRODUCTION_VIEW, (row) => Number(row.totalEggs || 0));
  const sales = count('sales', P.SALES_VIEW, (row) => Number(row.total || 0));
  const dueMedication = count('medicationTasks', P.MEDICATION_VIEW, (row) => ['due', 'overdue'].includes(row.status) ? 1 : 0);
  const lowStock = count('inventoryItems', P.INVENTORY_VIEW, (row) => Number(row.balance) <= Number(row.minimum || 0) ? 1 : 0);
  const openAlerts = count('notifications', P.NOTIFICATIONS_VIEW, (row) => row.status !== 'resolved' ? 1 : 0);
  const items = getNavigation(hasPermission)
    .flatMap((group) => group.items)
    .filter((item) => item.key !== 'dashboard');

  return (
    <div className="home">
      <Card title={`Welcome, ${user.name}`} subtitle={role?.label}>
        <p className="home__text">{role?.description}. Below are the areas available to your role.</p>
      </Card>

      <div className="home__grid">
        {mortality !== null && <Link to="/mortality"><MetricCard label="Mortality recorded" value={formatNumber(mortality)} icon="activity" tone="danger" /></Link>}
        {dueMedication !== null && <Link to="/medication"><MetricCard label="Medication due" value={formatNumber(dueMedication)} icon="check" tone="warning" /></Link>}
        {eggs !== null && <Link to="/egg-production"><MetricCard label="Eggs produced" value={formatNumber(eggs)} icon="egg" /></Link>}
        {sales !== null && <Link to="/sales"><MetricCard label="Sales (PKR)" value={formatNumber(sales)} icon="cart" /></Link>}
        {lowStock !== null && <Link to="/inventory"><MetricCard label="Low stock items" value={formatNumber(lowStock)} icon="package" tone="warning" /></Link>}
        {openAlerts !== null && <Link to="/notifications"><MetricCard label="Open alerts" value={formatNumber(openAlerts)} icon="bell" tone="danger" /></Link>}
      </div>

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
