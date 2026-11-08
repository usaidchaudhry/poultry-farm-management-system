import { useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../../components/common/Badge.jsx';
import Card from '../../components/common/Card.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import LoadingState from '../../components/common/LoadingState.jsx';
import Switch from '../../components/forms/Switch.jsx';
import { PERMISSIONS } from '../../config/permissions.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFarm } from '../../context/FarmContext.jsx';
import '../../features/organization/organization.css';

const levels = [
  { key: 'sites', parent: null, parentKey: null, path: '/organization/sites', label: 'Sites' },
  { key: 'farms', parent: 'sites', parentKey: 'siteId', path: '/organization/farms', label: 'Farms' },
  { key: 'houses', parent: 'farms', parentKey: 'farmId', path: '/organization/houses', label: 'Houses' },
  { key: 'flocks', parent: 'houses', parentKey: 'houseId', path: '/organization/flocks', label: 'Flocks' },
];

export default function OrganizationPage() {
  const farm = useFarm();
  const { hasPermission } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const canManage = hasPermission(PERMISSIONS.ORGANIZATION_MANAGE);
  if (farm.loading) return <LoadingState message="Loading organization..." />;
  if (farm.error) return <ErrorState message={farm.error} onRetry={farm.reload} />;

  const visible = (list) => list.filter((item) => showArchived || item.status === 'active');
  const renderLevel = (index, parent) => {
    const level = levels[index];
    const records = visible(farm[level.key]).filter((item) => !parent || item[level.parentKey] === parent.id);
    if (!records.length) return null;
    return <ul className="org__tree-list">{records.map((item) => (
      <li key={item.id} className="org__tree-item">
        <div className="org__tree-row">
          <Link to={level.parentKey ? `${level.path}?${level.parentKey}=${encodeURIComponent(parent.id)}` : level.path}>{item.name}</Link>
          {item.status === 'archived' && <Badge tone="neutral">Archived</Badge>}
          {index < levels.length - 1 && <Link className="org__tree-more" to={`${levels[index + 1].path}?${levels[index + 1].parentKey}=${encodeURIComponent(item.id)}`}>View {levels[index + 1].label.toLowerCase()}</Link>}
        </div>
        {index < levels.length - 1 && renderLevel(index + 1, item)}
      </li>
    ))}</ul>;
  };

  return <div className="org__stack">
    <div className="org__heading"><p className="text-muted">{farm.company?.name || 'Company'} / sites / farms / houses / flocks</p><Switch label="Show archived" checked={showArchived} onChange={setShowArchived} /></div>
    <nav className="org__quick-links" aria-label="Organization sections">{levels.map((level) => <Link className="btn btn--secondary btn--md" key={level.key} to={level.path}>{level.label}</Link>)}</nav>
    <Card title="Organization hierarchy" subtitle="Open any level to see its records and manage them if you have permission.">
      {visible(farm.sites).length ? <div className="org__tree"><strong>{farm.company?.name || 'Company'}</strong>{renderLevel(0, null)}</div> : <EmptyState title="No sites in your scope" description={canManage ? 'Add a site to start the organization hierarchy.' : 'Ask the Owner to assign a site or farm to your account.'} action={canManage ? <Link to="/organization/sites">Go to sites</Link> : undefined} />}
    </Card>
  </div>;
}
