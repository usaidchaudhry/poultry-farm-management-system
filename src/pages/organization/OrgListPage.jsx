import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import ErrorState from '../../components/common/ErrorState.jsx';
import LoadingState from '../../components/common/LoadingState.jsx';
import Select from '../../components/forms/Select.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import { PERMISSIONS } from '../../config/permissions.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFarm } from '../../context/FarmContext.jsx';
import OrgCrudDialogs from '../../features/organization/OrgCrudDialogs.jsx';
import OrgToolbar from '../../features/organization/OrgToolbar.jsx';
import { getActionsColumn, statusColumn } from '../../features/organization/orgColumns.jsx';
import useOrgCrud from '../../features/organization/useOrgCrud.js';
import useClientTable from '../../hooks/useClientTable.js';
import { formatDate, formatNumber } from '../../utils/formatters.js';
import '../../features/organization/organization.css';

const CONFIG = {
  site: { list: 'sites', parent: null, parentKey: null, path: '/organization/sites', plural: 'Sites' },
  farm: { list: 'farms', parent: 'site', parentKey: 'siteId', path: '/organization/farms', plural: 'Farms' },
  house: { list: 'houses', parent: 'farm', parentKey: 'farmId', path: '/organization/houses', plural: 'Houses' },
  flock: { list: 'flocks', parent: 'house', parentKey: 'houseId', path: '/organization/flocks', plural: 'Flocks' },
};

const parentName = (farm, kind, row) => {
  if (kind === 'farm') return farm.maps.siteById[row.siteId]?.name || 'Unknown site';
  if (kind === 'house') return farm.maps.farmById[row.farmId]?.name || 'Unknown farm';
  if (kind === 'flock') return farm.maps.houseById[row.houseId]?.name || 'Unknown house';
  return '';
};

export default function OrgListPage({ kind }) {
  const cfg = CONFIG[kind];
  const farm = useFarm();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.ORGANIZATION_MANAGE);
  const crud = useOrgCrud(kind);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [params, setParams] = useSearchParams();
  const parentFilter = cfg.parentKey ? params.get(cfg.parentKey) || '' : '';
  const parentList = cfg.parent ? farm[CONFIG[cfg.parent].list] : [];
  const activeParents = parentList.filter((item) => item.status === 'active' && (
    cfg.parent === 'site' ||
    (cfg.parent === 'farm' && farm.maps.siteById[item.siteId]?.status === 'active') ||
    (cfg.parent === 'house' && farm.maps.farmById[item.farmId]?.status === 'active' && farm.maps.siteById[farm.maps.farmById[item.farmId]?.siteId]?.status === 'active')
  ));
  const parentOptions = activeParents.map((item) => ({ value: item.id, label: item.name }));
  const filterOptions = parentList.map((item) => ({ value: item.id, label: `${item.name}${item.status === 'archived' ? ' (archived)' : ''}` }));

  const filtered = useMemo(() => farm[cfg.list].filter((row) => {
    if (!showArchived && row.status === 'archived') return false;
    if (parentFilter && row[cfg.parentKey] !== parentFilter) return false;
    const haystack = `${row.name} ${parentName(farm, kind, row)} ${row.location || ''} ${row.birdType || ''}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  }), [farm, cfg, kind, showArchived, parentFilter, search]);

  const columns = [
    { key: 'name', header: 'Name', sortable: true, render: (row) => <strong>{row.name}</strong> },
    ...(cfg.parent ? [{ key: 'parent', header: cfg.parent[0].toUpperCase() + cfg.parent.slice(1), render: (row) => <Link to={`${CONFIG[cfg.parent].path}${CONFIG[cfg.parent].parentKey ? `?${CONFIG[cfg.parent].parentKey}=${encodeURIComponent(farm.maps[`${cfg.parent}ById`][row[cfg.parentKey]]?.[CONFIG[cfg.parent].parentKey] || '')}` : ''}`}>{parentName(farm, kind, row)}</Link> }] : []),
    ...(kind === 'site' ? [{ key: 'location', header: 'Location', sortable: true, render: (row) => row.location || '—' }] : []),
    ...(kind === 'house' ? [{ key: 'capacity', header: 'Capacity', sortable: true, render: (row) => formatNumber(row.capacity) }] : []),
    ...(kind === 'flock' ? [
      { key: 'birdType', header: 'Bird type', sortable: true, render: (row) => row.birdType || '—' },
      { key: 'placementDate', header: 'Placed', sortable: true, render: (row) => formatDate(row.placementDate) },
      { key: 'initialCount', header: 'Birds placed', sortable: true, render: (row) => formatNumber(row.initialCount) },
    ] : []),
    statusColumn,
    getActionsColumn({ canManage, onView: crud.openDetails, onEdit: crud.openEdit, onArchive: crud.requestArchive, onRestore: crud.restore }),
  ];
  const table = useClientTable(filtered, { initialSort: { key: 'name', direction: 'asc' } });
  const getDetailRows = (row) => [
    { label: 'Name', value: row.name },
    ...(cfg.parent ? [{ label: cfg.parent[0].toUpperCase() + cfg.parent.slice(1), value: parentName(farm, kind, row) }] : []),
    ...(kind === 'site' ? [{ label: 'Location', value: row.location || '—' }] : []),
    ...(kind === 'house' ? [{ label: 'Capacity', value: formatNumber(row.capacity) }] : []),
    ...(kind === 'flock' ? [{ label: 'Bird type', value: row.birdType || '—' }, { label: 'Placement date', value: formatDate(row.placementDate) }, { label: 'Birds placed', value: formatNumber(row.initialCount) }] : []),
    { label: 'Status', value: row.status },
    { label: 'Created', value: formatDate(row.createdAt) },
  ];

  if (farm.loading) return <LoadingState message={`Loading ${cfg.plural.toLowerCase()}...`} />;
  if (farm.error) return <ErrorState message={farm.error} onRetry={farm.reload} />;

  return (
    <div className="org__stack">
      <nav className="org__path" aria-label="Organization hierarchy"><Link to="/organization">Organization</Link><span>/</span><strong>{cfg.plural}</strong>{parentFilter && <span>/ {parentList.find((item) => item.id === parentFilter)?.name || 'Selected parent'}</span>}</nav>
      <div className="org__heading"><p className="text-muted">{farm[cfg.list].length} in your permitted scope</p>{canManage && <Button leftIcon="plus" onClick={crud.openCreate}>Add {crud.label.toLowerCase()}</Button>}</div>
      <Card padded={false}>
        <OrgToolbar search={search} onSearch={setSearch} placeholder={`Search ${cfg.plural.toLowerCase()}...`} showArchived={showArchived} onShowArchived={setShowArchived}>
          {cfg.parent && <Select label={`Filter by ${cfg.parent}`} placeholder={`All ${CONFIG[cfg.parent].plural.toLowerCase()}`} options={filterOptions} value={parentFilter} onChange={(event) => setParams(event.target.value ? { [cfg.parentKey]: event.target.value } : {})} />}
        </OrgToolbar>
        <DataTable columns={columns} rows={table.rows} caption={cfg.plural} sort={table.sort} onSortChange={table.onSortChange} pagination={table.pagination} emptyTitle={`No ${cfg.plural.toLowerCase()} found`} emptyDescription={farm[cfg.list].length ? 'Try changing the search or filters.' : `No ${cfg.plural.toLowerCase()} are available in your scope yet.`} emptyAction={canManage && !farm[cfg.list].length ? <Button onClick={crud.openCreate}>Add {crud.label.toLowerCase()}</Button> : undefined} />
      </Card>
      <OrgCrudDialogs crud={crud} parentOptions={canManage ? parentOptions : []} getDetailRows={getDetailRows} />
    </div>
  );
}
