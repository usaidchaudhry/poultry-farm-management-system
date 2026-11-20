import { useEffect, useState } from 'react';
import Modal from '../../components/common/Modal.jsx';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/forms/Input.jsx';
import Select from '../../components/forms/Select.jsx';
import Textarea from '../../components/forms/Textarea.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS as P } from '../../config/permissions.js';
import { clinicalService } from '../../services/clinicalService.js';
import { measurementService } from '../../services/reportService.js';
import { getErrorMessage } from '../../services/apiError.js';
import { FlockSelect, initialDate } from '../reports/common.jsx';
export const localInput = (value = new Date()) => { const date = new Date(value); return new Date(date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
export const clinicalError = (error) => `${getErrorMessage(error)}${error.fieldErrors ? ` ${Object.entries(error.fieldErrors).map(([key, value]) => `${key}: ${value}`).join(' ')}` : ''}`;

export function VisitForm({ record, initialFlock, timezone, onClose, onSaved }) {
  const { hasPermission } = useAuth();
  const [flockId, setFlock] = useState(record?.flockId || initialFlock || '');
  const [values, setValues] = useState({ occurredAt: localInput(record?.occurredAt), diagnosis: record?.diagnosis || '', observations: record?.observations || '', parameters: record?.parameters || '', remarks: record?.remarks || '', measurementId: record?.measurementId || '' });
  const [measurements, setMeasurements] = useState([]); const [measurementError, setMeasurementError] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));
  useEffect(() => {
    let current = true; setMeasurements([]); setMeasurementError('');
    if (flockId && values.occurredAt && hasPermission(P.BIRD_PARAMETERS_VIEW)) {
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(values.occurredAt));
      const oldest = hasPermission(P.CLINICAL_HISTORY_VIEW) || hasPermission(P.REPORTS_HISTORY_VIEW) ? new Date(Date.parse(date) - 89 * 86400000).toISOString().slice(0, 10) : date;
      measurementService.list({ flockId, from: oldest, to: date, pageSize: 100 }).then((r) => { if (current) setMeasurements(r.data); }).catch((e) => { if (current) setMeasurementError(getErrorMessage(e)); });
    }
    return () => { current = false; };
  }, [flockId, values.occurredAt, timezone, hasPermission]);
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { const { occurredAt, ...data } = values; await clinicalService.saveVisit(record, { ...data, occurredAt: new Date(occurredAt).toISOString(), measurementId: data.measurementId || null, ...(!record ? { flockId } : {}) }); await onSaved(); }
    catch (e) { setError(clinicalError(e)); } finally { setBusy(false); }
  };
  return <Modal open title={record ? 'Edit clinical visit' : 'New clinical visit'} size="lg" onClose={busy ? undefined : onClose} footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="clinical-visit-form" loading={busy} disabled={!flockId || !values.occurredAt}>Save visit</Button></>}><form id="clinical-visit-form" className="reports__form" onSubmit={save} noValidate>{error && <Alert tone="error">{error}</Alert>}<div className="reports__grid"><FlockSelect value={flockId} onChange={setFlock} disabled={Boolean(record)} /><Input label="Visit time" type="datetime-local" required value={values.occurredAt} onChange={(e) => set('occurredAt', e.target.value)} hint="Browser local time; stored in UTC." /></div>{[['diagnosis', 'Clinical diagnosis'], ['observations', 'Visit observations'], ['parameters', 'Clinical parameters'], ['remarks', 'Visit remarks']].map(([key, title]) => <Textarea key={key} label={title} required={key === 'diagnosis'} value={values[key]} onChange={(e) => set(key, e.target.value)} />)}{measurementError && <Alert tone="error">{measurementError}</Alert>}<Select label="Visit bird measurement" placeholder="No linked measurement" value={values.measurementId} onChange={(e) => set('measurementId', e.target.value)} options={[...measurements.map((m) => ({ value: m.id, label: `${m.businessDate} · ${m.grams} g · ${m.sampleSize} birds` })), ...(values.measurementId && !measurements.some((r) => r.id === values.measurementId) ? [{ value: values.measurementId, label: 'Previously linked measurement' }] : [])]} /></form></Modal>;
}
const newItem = () => ({ key: crypto.randomUUID(), medicine: '', medicineReference: '', doseValue: '', doseUnit: '', instructions: '', route: 'water', startDate: initialDate(), durationDays: 3, times: '08:00', batchLabel: '' });
export function PrescriptionForm({ record, visitId, replacement, onClose, onSaved }) {
  const [items, setItems] = useState(() => record?.items.map((r) => ({ ...r, doseValue: r.doseValue ?? '', times: r.times.join(', ') })) || [newItem()]);
  const [reason, setReason] = useState(''); const [preview, setPreview] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const edit = (index, key, value) => { setItems((rows) => rows.map((row, i) => i === index ? { ...row, [key]: value } : row)); setPreview(null); };
  const packed = () => items.map((row) => ({ ...row, doseValue: row.doseValue === '' ? null : Number(row.doseValue), durationDays: Number(row.durationDays), times: row.times.split(',').map((t) => t.trim()).filter(Boolean) }));
  const inspect = async () => { setBusy(true); setError(''); try { setPreview(await clinicalService.preview(visitId, packed())); } catch (e) { setError(clinicalError(e)); } finally { setBusy(false); } };
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { if (replacement) await clinicalService.replace(record, packed(), reason); else await clinicalService.savePrescription(record, visitId, packed()); await onSaved(); }
    catch (e) { setError(clinicalError(e)); } finally { setBusy(false); }
  };
  return <Modal open title={replacement ? 'Replace future prescription' : record ? 'Edit prescription draft' : 'New prescription draft'} size="lg" onClose={busy ? undefined : onClose} footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button variant="secondary" onClick={inspect} loading={busy}>Preview schedule</Button><Button type="submit" form="prescription-form" disabled={!preview || (replacement && reason.trim().length < 3)} loading={busy}>{replacement ? 'Finalize replacement' : 'Save prescription draft'}</Button></>}><form id="prescription-form" className="reports__form" onSubmit={save} noValidate>{error && <Alert tone="error">{error}</Alert>}{replacement && <Alert tone="warning">This creates a linked finalized prescription and cancels eligible old tasks. Recorded outcomes remain unchanged. After an outcome, every replacement occurrence must be in the future.</Alert>}{items.map((item, index) => <fieldset key={item.key}><legend>Prescription item {index + 1}</legend><div className="reports__grid">{[['medicine', 'Medicine name', 'text'], ['medicineReference', 'Medicine reference', 'text'], ['doseValue', 'Prescribed dose', 'number'], ['doseUnit', 'Prescribed unit', 'text'], ['startDate', 'Start date', 'date'], ['durationDays', 'Duration (days)', 'number'], ['times', 'Daily times (HH:mm, comma separated)', 'text'], ['batchLabel', 'Tank or feed batch label', 'text']].map(([key, title, type]) => <Input key={key} label={`Item ${index + 1} ${title}`} type={type} min={key === 'durationDays' ? 1 : 0} max={key === 'durationDays' ? 30 : undefined} step={key === 'doseValue' ? 'any' : '1'} value={item[key]} onChange={(e) => edit(index, key, e.target.value)} />)}<Select label={`Item ${index + 1} Route`} value={item.route} onChange={(e) => edit(index, 'route', e.target.value)} options={[{ value: 'water', label: 'Water' }, { value: 'feed', label: 'Feed' }]} /></div><Textarea label={`Item ${index + 1} Instructions`} value={item.instructions} onChange={(e) => edit(index, 'instructions', e.target.value)} hint="Provide a dose with unit or explicit instructions. No dose is inferred by the system." /><Button variant="ghost" disabled={items.length === 1} onClick={() => { setItems(items.filter((_, i) => i !== index)); setPreview(null); }}>Remove item {index + 1}</Button></fieldset>)}<Button variant="secondary" disabled={items.length >= 8} onClick={() => { setItems([...items, newItem()]); setPreview(null); }}>Add prescription item</Button>{replacement && <Textarea label="Replacement reason" required value={reason} onChange={(e) => setReason(e.target.value)} />}{preview && <section aria-label="Schedule preview"><h3>{preview.occurrences.length} scheduled occurrences</h3><p>Timezone: {preview.timezone}. Preview does not create tasks.</p><ul>{preview.occurrences.slice(0, 20).map((r) => <li key={`${r.itemKey}:${r.occurrenceKey}`}>{r.medicine} · {new Date(r.dueAt).toLocaleString(undefined, { timeZone: preview.timezone })} · UTC {r.dueAt}</li>)}</ul>{preview.occurrences.length > 20 && <p>Showing the first 20 occurrences.</p>}</section>}</form></Modal>;
}
