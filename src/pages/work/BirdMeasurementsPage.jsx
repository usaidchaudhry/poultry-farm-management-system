import { useState } from 'react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import Alert from '../../components/common/Alert.jsx';
import Input from '../../components/forms/Input.jsx';
import Select from '../../components/forms/Select.jsx';
import Textarea from '../../components/forms/Textarea.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFarm } from '../../context/FarmContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { measurementService } from '../../services/reportService.js';
import { getErrorMessage } from '../../services/apiError.js';
import { FlockSelect, RangeFilters, shown, useRecords } from '../../features/reports/common.jsx';
import '../../features/reports/reports.css';

function MeasurementForm({ flockId: initialFlock, onClose, onSaved }) {
  const [values, setValues] = useState({ flockId: initialFlock || '', measuredAt: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), sampleSize: '', averageWeight: '', unit: 'g', notes: '' });
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try { if (!values.measuredAt) throw new Error('Enter a measurement time.'); await measurementService.create({ ...values, measuredAt: new Date(values.measuredAt).toISOString(), sampleSize: Number(values.sampleSize), averageWeight: Number(values.averageWeight) }); await onSaved(); }
    catch (e) { setError(e.fieldErrors ? `${getErrorMessage(e)} ${Object.entries(e.fieldErrors).map(([k, v]) => `${k}: ${v}`).join(' ')}` : getErrorMessage(e)); }
    finally { setSaving(false); }
  };
  return <Modal open title="New bird measurement" onClose={saving ? undefined : onClose} footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" form="measurement-form" loading={saving}>Save measurement</Button></>}><form className="reports__form" id="measurement-form" onSubmit={save} noValidate>{error && <Alert tone="error">{error}</Alert>}<FlockSelect value={values.flockId} onChange={(v) => set('flockId', v)} /><Input label="Measurement time" type="datetime-local" required value={values.measuredAt} onChange={(e) => set('measuredAt', e.target.value)} hint="Your browser's local time; stored as a UTC timestamp." /><Input label="Sample size" type="number" min="1" step="1" required value={values.sampleSize} onChange={(e) => set('sampleSize', e.target.value)} /><Input label="Average weight" type="number" min="0" step="any" required value={values.averageWeight} onChange={(e) => set('averageWeight', e.target.value)} /><Select label="Weight unit" value={values.unit} onChange={(e) => set('unit', e.target.value)} options={[{ value: 'g', label: 'Grams' }, { value: 'kg', label: 'Kilograms' }]} /><Textarea label="Measurement notes" value={values.notes} onChange={(e) => set('notes', e.target.value)} /><p>Standard not configured. Samples are separate observations and are not added together as weights.</p></form></Modal>;
}
export default function BirdMeasurementsPage() {
  const { hasPermission } = useAuth(); const farm = useFarm(); const toast = useToast();
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [flockId, setFlock] = useState(farm.active.flockId || ''); const [page, setPage] = useState(1); const [open, setOpen] = useState(false);
  const records = useRecords(measurementService.list, { from: from || undefined, to: to || undefined, flockId: flockId || undefined, page, pageSize: 20 });
  const filter = (setter) => (value) => { setter(value); setPage(1); };
  const columns = [{ key: 'measuredAt', header: 'Measured at', render: (r) => new Date(r.measuredAt).toLocaleString() }, { key: 'flockId', header: 'Flock', render: (r) => farm.maps.flockById[r.flockId]?.name || 'Flock' }, { key: 'sampleSize', header: 'Birds sampled' }, { key: 'grams', header: 'Average (g)' }, { key: 'differenceGrams', header: 'Previous difference (g)', render: (r) => shown(r.differenceGrams) }, { key: 'notes', header: 'Notes' }];
  return <div className="reports__stack"><div className="reports__actions"><p>Standard not configured. Differences use preceding observations within the allowed range.</p>{hasPermission('bird-parameters.manage') && <Button onClick={() => setOpen(true)}>New bird measurement</Button>}</div><Card><RangeFilters from={from || records.meta.from || ''} to={to || records.meta.to || ''} onFrom={filter(setFrom)} onTo={filter(setTo)} flockId={flockId} onFlock={filter(setFlock)} /><p>Sample-size-weighted average of filtered observations: <strong>{shown(records.meta.weightedAverageGrams)} g</strong> · Birds sampled: {records.meta.sampleSize || 0}</p><DataTable caption="Bird measurements" columns={columns} rows={records.data} loading={records.loading} error={records.error} onRetry={records.reload} emptyTitle="No measurements found" pagination={{ page, pageSize: 20, total: records.meta.total || 0, onPageChange: setPage }} /></Card>{open && <MeasurementForm flockId={flockId || farm.active.flockId} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await records.reload(); toast.success('Bird measurement recorded.'); }} />}</div>;
}
