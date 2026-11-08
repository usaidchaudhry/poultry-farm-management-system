import { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/common/Card.jsx';
import MetricCard from '../../components/common/MetricCard.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Input from '../../components/forms/Input.jsx';
import Select from '../../components/forms/Select.jsx';
import { PERMISSIONS as P } from '../../config/permissions.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFarm } from '../../context/FarmContext.jsx';
import { workService } from '../../services/workService.js';
import { formatNumber } from '../../utils/formatters.js';
import './work.css';

const SOURCES = [
  { kind: 'dailyReports', permission: P.DAILY_REPORTS_VIEW, path: '/daily-reports', label: 'Daily reports', value: (row) => Number(row.mortality || 0), metric: 'Mortality' },
  { kind: 'dailyReports', permission: P.DAILY_REPORTS_VIEW, path: '/daily-reports', label: 'Feed consumption', value: (row) => Number(row.feedBags || 0), metric: 'Feed bags' },
  { kind: 'eggProduction', permission: P.EGG_PRODUCTION_VIEW, path: '/egg-production', label: 'Egg production', value: (row) => Number(row.totalEggs || 0), metric: 'Eggs' },
  { kind: 'sales', permission: P.SALES_VIEW, path: '/sales', label: 'Sales', value: (row) => Number(row.total || 0), metric: 'Sales PKR' },
  { kind: 'measurements', permission: P.BIRD_PARAMETERS_VIEW, path: '/bird-parameters', label: 'Measurements', value: (row) => Number(row.averageWeight || 0), metric: 'Weight' },
  { kind: 'stockMovements', permission: P.INVENTORY_VIEW, path: '/inventory', label: 'Stock movements', value: (row) => Math.abs(Number(row.quantity || 0)), metric: 'Stock units moved' },
];

export default function AnalyticsPage() {
  const { user, hasPermission } = useAuth();
  const farm = useFarm();
  const [farmId, setFarmId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const actor = { id: user.id, role: user.role };
  const sources = SOURCES.filter((item) => hasPermission(item.permission)).map((item) => ({ ...item, rows: workService.list(item.kind, actor).filter((row) => (!farmId || row.farmId === farmId) && (!from || (row.date || row.createdAt?.slice(0, 10)) >= from) && (!to || (row.date || row.createdAt?.slice(0, 10)) <= to)) }));
  const allEmpty = sources.every((source) => source.rows.length === 0);
  return <div className="work__stack"><div className="work__filters"><Select label="Farm" placeholder="All permitted farms" options={farm.farms.map((row) => ({ value: row.id, label: row.name }))} value={farmId} onChange={(event) => setFarmId(event.target.value)} /><Input label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /><Input label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>{allEmpty ? <EmptyState title="No data for this range" description="Add operational records or widen the date range." /> : <><div className="org__metrics">{sources.map((source) => <MetricCard key={`${source.kind}-${source.metric}`} label={source.metric} value={formatNumber(source.rows.reduce((sum, row) => sum + source.value(row), 0))} icon="barChart" />)}</div>{sources.map((source) => { const days = Object.entries(source.rows.reduce((acc, row) => { const date = row.date || row.createdAt?.slice(0, 10) || 'Unknown'; acc[date] = (acc[date] || 0) + source.value(row); return acc; }, {})).sort(([a], [b]) => a.localeCompare(b)).slice(-12); const max = Math.max(1, ...days.map(([, value]) => value)); return <Card key={`${source.kind}-${source.metric}`} title={source.label} actions={<Link to={source.path}>View records</Link>}>{days.length ? <div className="work__chart" role="img" aria-label={`${source.metric} by date`}>{days.map(([date, value]) => <div key={date} className="work__chart-row"><span>{date}</span><div><span style={{ width: `${Math.max(2, (value / max) * 100)}%` }} /></div><strong>{formatNumber(value)}</strong></div>)}</div> : <p className="text-muted">No records in this range.</p>}</Card>; })}</>}</div>;
}
