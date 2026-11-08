import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import Modal from '../../components/common/Modal.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import Select from '../../components/forms/Select.jsx';
import Textarea from '../../components/forms/Textarea.jsx';
import { PERMISSIONS } from '../../config/permissions.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useClientTable from '../../hooks/useClientTable.js';
import { getErrorMessage } from '../../services/apiError.js';
import { workService } from '../../services/workService.js';
import { formatDate } from '../../utils/formatters.js';
import './work.css';

export default function NotificationsPage() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const actor = { id: user.id, role: user.role };
  const [rows, setRows] = useState(() => workService.list('notifications', actor));
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const canManage = hasPermission(PERMISSIONS.NOTIFICATIONS_MANAGE);
  const filtered = rows.filter((row) => (!severity || row.severity === severity) && (!status || row.status === status));
  const table = useClientTable(filtered, { initialSort: { key: 'createdAt', direction: 'desc' } });
  const columns = [{ key: 'title', header: 'Notification', sortable: true }, { key: 'severity', header: 'Severity', render: (row) => <StatusBadge status={row.severity} /> }, { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> }, { key: 'createdAt', header: 'Created', sortable: true, render: (row) => formatDate(row.createdAt) }, { key: 'actions', header: 'Actions', render: (row) => <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>View</Button> }];
  const change = (action) => { try { workService.transition('notifications', selected.id, action, { reason: note }, actor); setRows(workService.list('notifications', actor)); setSelected(null); setNote(''); toast.success(`Notification ${action}.`); } catch (err) { setError(getErrorMessage(err)); } };
  return <div className="work__stack"><Card padded={false}><div className="work__filters"><Select label="Severity" placeholder="All severities" value={severity} onChange={(event) => setSeverity(event.target.value)} options={['info', 'reminder', 'warning', 'critical', 'emergency'].map((value) => ({ value, label: value }))} /><Select label="Status" placeholder="All statuses" value={status} onChange={(event) => setStatus(event.target.value)} options={['created', 'acknowledged', 'resolved'].map((value) => ({ value, label: value }))} /></div><DataTable columns={columns} rows={table.rows} caption="Notifications" sort={table.sort} onSortChange={table.onSortChange} pagination={table.pagination} emptyTitle="No notifications" emptyDescription="Operational alerts appear when source events are recorded." /></Card><Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title || 'Notification'} footer={<><Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>{canManage && selected?.status === 'created' && <Button onClick={() => change('acknowledged')}>Acknowledge</Button>}{canManage && selected?.status !== 'resolved' && <Button onClick={() => change('resolved')}>Resolve</Button>}</>}><div className="work__form">{error && <p className="work__error" role="alert">{error}</p>}<p>Severity: <StatusBadge status={selected?.severity} /> · Status: <StatusBadge status={selected?.status} /></p><p>Source: {selected?.source} {selected?.source && <Link to={{ dailyReports: '/daily-reports', inventoryItems: '/inventory', medicationTasks: '/medication' }[selected.source] || '/dashboard'} onClick={() => setSelected(null)}>View source</Link>}</p>{selected?.response && <p>Response: {selected.response}</p>}{canManage && <Textarea label="Response or resolution note" value={note} onChange={(event) => setNote(event.target.value)} />}</div></Modal></div>;
}
