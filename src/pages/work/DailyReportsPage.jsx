import { useRef, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import Modal from '../../components/common/Modal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFarm } from '../../context/FarmContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { reportService } from '../../services/reportService.js';
import { getErrorMessage } from '../../services/apiError.js';
import ReportForm from '../../features/reports/ReportForm.jsx';
import ReportDetails from '../../features/reports/ReportDetails.jsx';
import { RangeFilters, useRecords, shown } from '../../features/reports/common.jsx';
import '../../features/reports/reports.css';

export default function DailyReportsPage({ mortality = false }) {
  const { hasPermission } = useAuth(); const farm = useFarm(); const toast = useToast();
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [flockId, setFlock] = useState(farm.active.flockId || ''); const [page, setPage] = useState(1);
  const query = { from: from || undefined, to: to || undefined, flockId: flockId || undefined, page, pageSize: 20 };
  const records = useRecords(reportService.list, query, mortality);
  const [form, setForm] = useState(null); const [detail, setDetail] = useState(null); const [loadingDetail, setLoadingDetail] = useState(false); const [detailError, setDetailError] = useState(''); const sequence = useRef(0);
  const view = async (id) => {
    const request = ++sequence.current; setLoadingDetail(true); setDetailError('');
    try { const r = await reportService.detail(id); if (request === sequence.current) setDetail(r); }
    catch (e) { if (request === sequence.current) setDetailError(getErrorMessage(e)); }
    finally { if (request === sequence.current) setLoadingDetail(false); }
  };
  const closeDetail = () => { sequence.current += 1; setDetail(null); setDetailError(''); setLoadingDetail(false); };
  const columns = [
    { key: 'businessDate', header: 'Business date' }, { key: 'flockId', header: 'Flock', render: (r) => farm.maps.flockById[r.flockId]?.name || 'Flock' }, ...(!mortality ? [{ key: 'status', header: 'Status' }] : []),
    { key: 'mortality', header: 'Mortality', render: (r) => shown(r.data.mortality) }, ...(!mortality ? [{ key: 'eggs', header: 'Eggs', render: (r) => r.summary.totalEggs }, { key: 'closing', header: 'Closing birds', render: (r) => r.summary.closingBirds }] : []),
    ...(mortality ? [{ key: 'postMortem', header: 'Post-mortem observations', render: (r) => r.data.postMortem || 'None recorded' }] : []),
    ...(hasPermission('daily-reports.view') ? [{ key: 'actions', header: 'Details', render: (r) => <Button variant="ghost" onClick={() => view(r.id)}>View report {r.businessDate}</Button> }] : []),
  ];
  const changeFilter = (setter) => (v) => { setter(v); setPage(1); };
  return <div className="reports__stack">
    <div className="reports__actions"><p className="text-muted">{mortality ? 'Published report mortality and post-mortem observations. Zero-mortality health concerns remain in Daily reports.' : 'One report per flock and business date. Drafts and returns preserve previous published evidence.'}</p>{!mortality && hasPermission('daily-reports.manage') && <Button onClick={() => setForm({ record: null })}>New daily report</Button>}</div>
    <Card><RangeFilters from={from || records.meta.from || ''} to={to || records.meta.to || ''} onFrom={changeFilter(setFrom)} onTo={changeFilter(setTo)} flockId={flockId} onFlock={changeFilter(setFlock)} /><DataTable caption={mortality ? 'Published mortality' : 'Daily reports'} rows={records.data} columns={columns} loading={records.loading} error={records.error} onRetry={records.reload} emptyTitle={mortality ? 'No mortality recorded' : 'No daily reports found'} emptyDescription="Choose an allowed date range or another permitted flock." pagination={{ page, pageSize: 20, total: records.meta.total || 0, onPageChange: setPage }} /></Card>
    {form && <ReportForm record={form.record} initialFlockId={flockId || farm.active.flockId} dateSuggestion={records.meta.to} businessToday={records.meta.today} onClose={() => setForm(null)} onSaved={async () => { setForm(null); await records.reload(); toast.success('Report draft saved. Open it to review and submit.'); }} />}
    {detail && !loadingDetail && <ReportDetails key={`${detail.id}:${detail.version}`} record={detail} onClose={closeDetail} onEdit={(r) => { closeDetail(); setForm({ record: r }); }} onChanged={async (id) => { await records.reload(); await view(id); toast.success('Report updated.'); }} />}
    {(loadingDetail || detailError) && <Modal open title="Daily report" onClose={closeDetail}>{loadingDetail ? <p>Loading report…</p> : <Alert tone="error">{detailError}</Alert>}</Modal>}
  </div>;
}
