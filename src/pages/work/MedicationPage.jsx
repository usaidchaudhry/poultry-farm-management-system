import { useState } from 'react';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import Modal from '../../components/common/Modal.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import Input from '../../components/forms/Input.jsx';
import Select from '../../components/forms/Select.jsx';
import Textarea from '../../components/forms/Textarea.jsx';
import { PERMISSIONS } from '../../config/permissions.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFarm } from '../../context/FarmContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useClientTable from '../../hooks/useClientTable.js';
import { getErrorMessage } from '../../services/apiError.js';
import { workService } from '../../services/workService.js';
import { formatDate, formatDateTime } from '../../utils/formatters.js';
import './work.css';

export default function MedicationPage() {
  const { user, hasPermission } = useAuth();
  const farm = useFarm();
  const toast = useToast();
  const actor = { id: user.id, role: user.role };
  const [rows, setRows] = useState(() => workService.list('medicationTasks', actor));
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [outcome, setOutcome] = useState('completed');
  const [dose, setDose] = useState('');
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const view = rows.map((row) => ({ ...row, displayStatus: row.status === 'due' && row.dueAt && new Date(row.dueAt) < new Date() ? 'overdue' : row.status })).filter((row) => !status || row.displayStatus === status);
  const table = useClientTable(view, { initialSort: { key: 'dueAt', direction: 'asc' } });
  const canAdminister = hasPermission(PERMISSIONS.MEDICATION_ADMINISTER);
  const columns = [
    { key: 'medicine', header: 'Medicine', sortable: true },
    { key: 'flockId', header: 'Flock', render: (row) => farm.maps.flockById[row.flockId]?.name || '—' },
    { key: 'dueAt', header: 'Due', sortable: true, render: (row) => formatDate(row.dueAt) },
    { key: 'dose', header: 'Prescribed dose' },
    { key: 'prescriptionStatus', header: 'Prescription', render: (row) => <StatusBadge status={row.prescriptionStatus} /> },
    { key: 'displayStatus', header: 'Administration', render: (row) => <StatusBadge status={row.displayStatus} /> },
    { key: 'actions', header: 'Actions', render: (row) => <Button size="sm" variant="ghost" onClick={() => { setSelected(row); setError(''); }}>View</Button> },
  ];
  const save = () => {
    setSaving(true); setError('');
    try {
      workService.transition('medicationTasks', selected.id, outcome, { dose, comments, at: new Date().toISOString() }, actor);
      setRows(workService.list('medicationTasks', actor)); setSelected(null); toast.success('Administration outcome recorded.');
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setSaving(false); }
  };
  return <div className="work__stack"><p className="text-muted">Prescriptions and administration outcomes are tracked separately. The prescriber cannot confirm their own prescription.</p><Card padded={false}><div className="work__filters"><Select label="Administration status" placeholder="All statuses" value={status} onChange={(event) => setStatus(event.target.value)} options={['due', 'overdue', 'completed', 'missed', 'cancelled'].map((value) => ({ value, label: value }))} /></div><DataTable columns={columns} rows={table.rows} caption="Medication tasks" sort={table.sort} onSortChange={table.onSortChange} pagination={table.pagination} emptyTitle="No medication tasks" emptyDescription="Tasks appear after a clinical visit includes a prescription." /></Card>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.medicine || 'Medication task'} footer={<><Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>{canAdminister && selected?.prescribedBy !== user.id && ['due', 'overdue'].includes(selected?.displayStatus) && <Button loading={saving} onClick={save}>Record outcome</Button>}</>}><div className="work__form">{error && <p className="work__error" role="alert">{error}</p>}<p><strong>Prescription:</strong> {selected?.dose} by {selected?.route}, {selected?.frequency} for {selected?.duration} day(s).</p><p><strong>Administration:</strong> {selected?.displayStatus}. {selected?.administeredBy && `Recorded by ${selected.administeredBy} on ${formatDateTime(selected.administeredAt)}.`}</p>{canAdminister && selected?.prescribedBy !== user.id && ['due', 'overdue'].includes(selected?.displayStatus) && <><Select label="Outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} options={[{ value: 'completed', label: 'Completed' }, { value: 'missed', label: 'Missed' }]} /><Input label="Actual dose" value={dose} onChange={(event) => setDose(event.target.value)} /><Textarea label="Comments" value={comments} onChange={(event) => setComments(event.target.value)} /></>}</div></Modal>
  </div>;
}
