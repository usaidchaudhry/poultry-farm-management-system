import { Link } from 'react-router-dom';
import { useState } from 'react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Alert from '../../components/common/Alert.jsx';
import MetricCard from '../../components/common/MetricCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getNavigation } from '../../config/navigation.js';
import { insightService } from '../../services/insightService.js';
import { useRecords } from '../../features/reports/common.jsx';
import { InsightFilters, Trend, metricLabels } from '../../features/insights/common.jsx';
import '../../features/reports/reports.css';
import './DashboardHomePage.css';
const sections = {
  'daily-poultry': ['Daily poultry', '/daily-reports', ['collectedEggs', 'saleableEggs', 'waterLitres'], 'collectedEggs'],
  'egg-production': ['Egg production', '/egg-production', ['collectedEggs', 'saleableEggs'], 'saleableEggs'],
  mortality: ['Mortality', '/mortality', ['mortality', 'mortalityPercent'], 'mortalityPercent'],
  'feed-consumption': ['Feed consumption', '/daily-reports', ['feedKg', 'feedPerBirdG'], 'feedKg'],
  'bird-weight': ['Bird weight', '/bird-parameters', ['sampleSize', 'weightedAverageGrams'], 'weightedAverageGrams'],
  inventory: ['Current stock conditions', '/inventory', ['lowStockPairs']],
  medication: ['Medication follow-up', '/medication', ['scheduled', 'due', 'overdue', 'completed', 'missed']],
  sales: ['Egg sales', '/sales', ['postedValue', 'postedEggs'], 'postedValue'],
  'financial-results': ['Recorded financial results', '/finance', ['revenue', 'unpaid', 'recordedCost', 'operatingSurplus'], 'operatingSurplus'],
  emergencies: ['Medical alerts', '/notifications', ['openMedicalAlerts']],
};
export default function LiveDashboardPage() {
  const { user, hasPermission } = useAuth();
  const [filters, setFilters] = useState({});
  const records = useRecords(insightService.dashboard, filters);
  const items = getNavigation(hasPermission).flatMap((group) => group.items).filter((item) => item.key !== 'dashboard');
  return <div className="home">
    <Card title={`Welcome, ${user.name}`} subtitle={user.roleLabel}>
      <p>Review published farm activity and current work that needs attention.</p>
      <InsightFilters prefix="Dashboard" values={filters} meta={records.meta} onChange={setFilters} />
      <p className="text-muted">Business timezone: {records.meta.timezone || 'Loading'}. Standard weights and official ROI are not configured.</p>
      <Button variant="secondary" onClick={records.reload}>Refresh dashboard</Button>
    </Card>
    {records.loading && <p role="status">Loading dashboard...</p>}
    {records.error && <Alert tone="error">{records.error}<Button onClick={records.reload}>Retry dashboard</Button></Alert>}
    {records.meta.omitted?.map((note) => <Alert key={note} tone="info">{note}</Alert>)}
    {records.data.map((row) => {
      const definition = sections[row.id]; if (!definition) return null;
      const [title, path, keys, trendKey] = definition;
      const selectedKeys = row.id === 'daily-poultry' && records.data.some((s) => s.id === 'egg-production') ? ['waterLitres'] : keys;
      return <Card key={row.id} title={title} actions={<Link to={path}>View source records</Link>}><div className="insights__metrics">{selectedKeys.map((key) => <MetricCard key={key} label={metricLabels[key]} value={row.records === 0 ? 'No records' : row.summary[key] ?? 'Unavailable'} />)}</div><p className="text-muted">{row.note}</p>{trendKey && <Trend rows={row.trend} metric={trendKey} label={metricLabels[trendKey]} />}</Card>;
    })}
    <div className="home__grid">{items.map((item) => <Link className="home__tile" key={item.key} to={item.path}>
      <span className="home__tile-body"><strong>{item.label}</strong><span className="home__tile-text">{item.description}</span></span>
    </Link>)}</div>
  </div>;
}
