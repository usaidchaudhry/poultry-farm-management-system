import { PERMISSIONS as P } from '../../config/permissions.js';
import { clinicalService, medicationService } from '../../services/clinicalService.js';
import { inventoryService } from '../../services/inventoryService.js';
import { useEffect, useState } from 'react';
import Modal from '../../components/common/Modal.jsx';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/forms/Input.jsx';
import Textarea from '../../components/forms/Textarea.jsx';
import Select from '../../components/forms/Select.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { reportService, measurementService } from '../../services/reportService.js';
import { getErrorMessage } from '../../services/apiError.js';
import { FlockSelect, eggKeys, initialDate, label } from './common.jsx';

const blankSample = () => ({ sampleType: 'single-egg', value: '', unit: 'g' });
const number = (v) => v === '' || v === null || v === undefined ? null : Number(v);
export default function ReportForm({ record, initialFlockId, dateSuggestion, businessToday, onClose, onSaved }) {
  const { hasPermission } = useAuth();
  const [flockId, setFlock] = useState(record?.flockId || initialFlockId || '');
  const [date, setDate] = useState(record?.businessDate || dateSuggestion || initialDate());
  const [data, setData] = useState(() => ({ eggs: Object.fromEntries(eggKeys.map((k) => [k, ''])), mortality: '', feed: { itemReference: '', locationReference: '', bags: '', bagSizeKg: '', additionalKg: '', notes: '' }, waterLitres: '', lightHours: '', eggSamples: Array.from({ length: 9 }, blankSample), medicines: [], vaccines: [], measurementId: '', observations: '', postMortem: '', comments: '', issues: '', doctorVisitReference: '', doctorRemarks: '', perPeNote: '', ...record?.data, ...(record ? { eggSamples: record.data.eggSamples.length ? record.data.eggSamples : Array.from({ length: 9 }, blankSample) } : {}) }));
  const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [fieldErrors, setFieldErrors] = useState({}); const [saving, setSaving] = useState(false);
  const [population, setPopulation] = useState(null); const [populationError, setPopulationError] = useState(''); const [revision, setRevision] = useState(0);
  const [clinicalVisits, setClinicalVisits] = useState([]); const [prescriptions, setPrescriptions] = useState([]); const [events, setEvents] = useState([]); const [linkError, setLinkError] = useState('');
  const [measurements, setMeasurements] = useState([]); const [measurementError, setMeasurementError] = useState('');
  const [stock, setStock] = useState({ items: [], locations: [] }); const [stockError, setStockError] = useState('');
  useEffect(() => {
    let current = true; setStock({ items: [], locations: [] }); setStockError('');
    async function load() {
      const items = []; const locations = []; let page = 1; let response;
      do { response = await inventoryService.feedOptions(flockId, page++); items.push(...response.items.data); locations.push(...response.locations.data); } while (items.length < response.items.meta.total || locations.length < response.locations.meta.total);
      if (current) setStock({ items, locations: locations.filter((l) => l.kind !== 'collection') });
    }
    if (flockId) load().catch((e) => { if (current) setStockError(getErrorMessage(e)); });
    return () => { current = false; };
  }, [flockId]);
  const [movement, setMovement] = useState({ type: 'reconciliation', count: '', reason: '' }); const [movementBusy, setMovementBusy] = useState(false);
  useEffect(() => {
    let current = true; setPopulation(null); setPopulationError('');
    if (flockId && date) reportService.population(flockId, date).then((p) => { if (current) setPopulation(p); }).catch((e) => { if (current) setPopulationError(getErrorMessage(e)); });
    return () => { current = false; };
  }, [flockId, date, revision]);
  useEffect(() => {
    let current = true; setMeasurements([]); setMeasurementError('');
    if (flockId && date && hasPermission(P.BIRD_PARAMETERS_VIEW)) {
      const historical = hasPermission(P.REPORTS_HISTORY_VIEW) || hasPermission(P.CLINICAL_HISTORY_VIEW);
      const earliest = historical ? new Date(Date.parse(date) - 89 * 86400000).toISOString().slice(0, 10) : new Date(Date.parse(businessToday || initialDate()) - 86400000).toISOString().slice(0, 10);
      measurementService.list({ flockId, from: earliest > date ? date : earliest, to: date, pageSize: 100 }).then((r) => { if (current) setMeasurements(r.data); }).catch((error) => { if (current) setMeasurementError(getErrorMessage(error)); });
    }
    return () => { current = false; };
  }, [flockId, date, hasPermission, businessToday]);
  useEffect(() => {
    let current = true; setClinicalVisits([]); setEvents([]); setLinkError('');
    if (flockId && date) {
      const history = hasPermission(P.CLINICAL_HISTORY_VIEW) || hasPermission(P.REPORTS_HISTORY_VIEW);
      const earliest = history ? new Date(Date.parse(date) - 89 * 86400000).toISOString().slice(0, 10) : new Date(Date.parse(businessToday || initialDate()) - 86400000).toISOString().slice(0, 10);
      const query = { flockId, from: earliest > date ? date : earliest, to: date, pageSize: 100 };
      Promise.all([hasPermission(P.CLINICAL_VIEW) ? clinicalService.list(query) : { data: [] }, hasPermission(P.MEDICATION_VIEW) ? medicationService.list({ ...query, view: 'history' }) : { data: [] }]).then(([visits, tasks]) => { if (current) { setClinicalVisits(visits.data); setEvents(tasks.data.filter((r) => r.effectiveOutcome).map((r) => ({ ...r.effectiveOutcome, medicine: r.medicine }))); } }).catch((e) => { if (current) setLinkError(getErrorMessage(e)); });
    }
    return () => { current = false; };
  }, [flockId, date, businessToday, hasPermission]);
  useEffect(() => {
    let current = true; setPrescriptions([]);
    if (data.doctorVisitId && hasPermission(P.CLINICAL_VIEW)) clinicalService.detail(data.doctorVisitId).then((v) => { if (current) setPrescriptions(v.prescriptions); }).catch((e) => { if (current) setLinkError(getErrorMessage(e)); });
    return () => { current = false; };
  }, [data.doctorVisitId, hasPermission]);
  const update = (key, value) => setData((d) => ({ ...d, [key]: value }));
  const input = (key, title, type = 'number') => <Input key={key} label={title} type={type} min="0" step={key === 'mortality' ? '1' : 'any'} value={data[key] ?? ''} onChange={(e) => update(key, e.target.value)} error={fieldErrors[`data.${key}`]} />;
  const editRow = (key, index, field, value) => setData((d) => ({ ...d, [key]: d[key].map((r, i) => i === index ? { ...r, [field]: value } : r) }));
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setFieldErrors({});
    try {
      const packed = { ...data, eggs: Object.fromEntries(eggKeys.map((k) => [k, number(data.eggs[k])])), mortality: number(data.mortality), waterLitres: number(data.waterLitres), lightHours: number(data.lightHours), measurementId: data.measurementId || null, doctorVisitId: data.doctorVisitId || null, feed: { ...data.feed, bags: number(data.feed.bags), bagSizeKg: number(data.feed.bagSizeKg), additionalKg: number(data.feed.additionalKg) }, eggSamples: data.eggSamples.filter((s) => s.value !== '' && s.value !== null).map((s) => ({ ...s, value: Number(s.value) })) };
      for (const key of ['medicines', 'vaccines']) packed[key] = data[key].map((r) => ({ ...r, quantity: number(r.quantity), prescriptionId: r.prescriptionId || null, administrationEventId: r.administrationEventId || null }));
      await reportService.save(record, { flockId, businessDate: date, data: packed, reason });
      await onSaved();
    } catch (e) { setError(getErrorMessage(e)); setFieldErrors(e.fieldErrors || {}); }
    finally { setSaving(false); }
  };
  const recordMovement = async () => {
    setMovementBusy(true); setPopulationError('');
    try { await reportService.movement(flockId, { businessDate: date, ...movement, count: Number(movement.count) }); setRevision((v) => v + 1); setMovement({ ...movement, count: '', reason: '' }); }
    catch (e) { setPopulationError(getErrorMessage(e)); }
    finally { setMovementBusy(false); }
  };
  const rowSection = (key, title) => <fieldset><legend>{title}</legend>{data[key].map((row, i) => <div className="reports__repeat" key={i}><Input label={`${title} ${i + 1} name`} value={row.name} onChange={(e) => editRow(key, i, 'name', e.target.value)} /><Input label={`${title} ${i + 1} quantity`} type="number" min="0" step="any" value={row.quantity ?? ''} onChange={(e) => editRow(key, i, 'quantity', e.target.value)} /><Input label={`${title} ${i + 1} unit`} value={row.unit} onChange={(e) => editRow(key, i, 'unit', e.target.value)} /><Input label={`${title} ${i + 1} reference note`} value={row.reference} onChange={(e) => editRow(key, i, 'reference', e.target.value)} /><Select label={`${title} ${i + 1} prescription`} disabled={!hasPermission(P.CLINICAL_VIEW) && !row.prescriptionId} placeholder="No prescription link" value={row.prescriptionId || ''} onChange={(e) => editRow(key, i, 'prescriptionId', e.target.value)} options={[...prescriptions.map((p) => ({ value: p.id, label: `Prescription ${p.sequence} - ${p.status}` })), ...(row.prescriptionId && !prescriptions.some((p) => p.id === row.prescriptionId) ? [{ value: row.prescriptionId, label: 'Previously linked prescription' }] : [])]} /><Select label={`${title} ${i + 1} administration evidence`} disabled={!hasPermission(P.MEDICATION_VIEW) && !row.administrationEventId} placeholder="No administration link" value={row.administrationEventId || ''} onChange={(e) => editRow(key, i, 'administrationEventId', e.target.value)} options={[...events.filter((e) => !row.prescriptionId || e.prescriptionId === row.prescriptionId).map((e) => ({ value: e.id, label: `${e.medicine} - ${e.outcome} - ${e.businessDate}` })), ...(row.administrationEventId && !events.some((e) => e.id === row.administrationEventId) ? [{ value: row.administrationEventId, label: 'Previously linked event' }] : [])]} /><Button variant="ghost" onClick={() => update(key, data[key].filter((_, index) => index !== i))}>Remove {title.toLowerCase()} {i + 1}</Button></div>)}<Button variant="secondary" disabled={data[key].length >= 50} onClick={() => update(key, [...data[key], { name: '', quantity: '', unit: '', reference: '' }])}>Add {title.toLowerCase()}</Button></fieldset>;
  return <Modal open title={record ? 'Edit daily report' : 'New daily report'} size="lg" onClose={saving || movementBusy ? undefined : onClose} footer={<><Button variant="secondary" onClick={onClose} disabled={saving || movementBusy}>Cancel</Button><Button type="submit" form="daily-report-form" loading={saving} disabled={movementBusy || !flockId || !date}>Save draft</Button></>}>
    <form id="daily-report-form" className="reports__form" onSubmit={save} noValidate>
      {error && <Alert tone="error">{error}{Object.entries(fieldErrors).map(([key, message]) => <div key={key}>{key}: {message}</div>)}</Alert>}
      {record?.returnReason && <Alert tone="warning">Returned: {record.returnReason}</Alert>}
      <div className="reports__grid"><FlockSelect value={flockId} onChange={setFlock} disabled={Boolean(record)} /><Input label="Business date" type="date" required value={date} disabled={Boolean(record)} onChange={(e) => setDate(e.target.value)} /></div>
      <fieldset><legend>Bird population</legend>{populationError && <Alert tone="error">{populationError}</Alert>}{flockId && date && !population && !populationError && <p>Loading bird population...</p>}{population && <><p>Opening birds: <strong>{population.openingBirds}</strong> · Approved change: {population.approvedChange} · Available: {population.availableBirds}</p>{population.gap && <Alert tone="warning">Earlier daily reports are missing. Record an opening reconciliation before submission.</Alert>}</>}{input('mortality', 'Mortality count')}
        {hasPermission(P.BIRD_POPULATION_MANAGE) && <details><summary>Record an approved population entry</summary><div className="reports__grid"><Select label="Population entry type" value={movement.type} onChange={(e) => setMovement({ ...movement, type: e.target.value })} options={['reconciliation', 'placement', 'adjustment'].map((value) => ({ value, label: label(value) }))} /><Input label={movement.type === 'reconciliation' ? 'Counted available birds' : 'Population change (signed for adjustment)'} type="number" step="1" value={movement.count} onChange={(e) => setMovement({ ...movement, count: e.target.value })} /><Textarea label="Population reason" value={movement.reason} onChange={(e) => setMovement({ ...movement, reason: e.target.value })} /></div><Button onClick={recordMovement} loading={movementBusy} disabled={!flockId || !date || movement.count === '' || movement.reason.trim().length < 3}>Record population entry</Button></details>}
      </fieldset>
      <fieldset><legend>Egg collection</legend><div className="reports__grid">{eggKeys.map((key) => <Input key={key} label={`${label(key)} eggs`} type="number" min="0" step="1" value={data.eggs[key] ?? ''} onChange={(e) => update('eggs', { ...data.eggs, [key]: e.target.value })} error={fieldErrors[`data.eggs.${key}`]} />)}</div></fieldset>
      <fieldset><legend>Egg weight samples</legend><p className="text-muted">Enter only measured slots. Single-egg and tray averages stay separate; kg is converted to grams.</p>{data.eggSamples.map((row, i) => <div className="reports__sample" key={i}><Select label={`Sample ${i + 1} type`} value={row.sampleType} onChange={(e) => editRow('eggSamples', i, 'sampleType', e.target.value)} options={[{ value: 'single-egg', label: 'Single egg' }, { value: 'tray', label: 'Tray' }]} /><Input label={`Sample ${i + 1} weight`} type="number" min="0" step="any" value={row.value ?? ''} onChange={(e) => editRow('eggSamples', i, 'value', e.target.value)} /><Select label={`Sample ${i + 1} unit`} value={row.unit} onChange={(e) => editRow('eggSamples', i, 'unit', e.target.value)} options={[{ value: 'g', label: 'g' }, { value: 'kg', label: 'kg' }]} /><Button variant="ghost" onClick={() => update('eggSamples', data.eggSamples.filter((_, index) => i !== index))}>Remove sample {i + 1}</Button></div>)}<Button variant="secondary" onClick={() => update('eggSamples', [...data.eggSamples, blankSample()])} disabled={data.eggSamples.length >= 100}>Add egg sample</Button></fieldset>
      <fieldset><legend>Feed and environment</legend>{stockError && <Alert tone="error">{stockError}</Alert>}<div className="reports__grid">{[['itemReference', 'Feed item reference', stock.items], ['locationReference', 'Feed location reference', stock.locations]].map(([key, title, rows]) => <Select key={key} label={title} value={data.feed[key]} placeholder="Choose real stock reference" onChange={(e) => update('feed', { ...data.feed, [key]: e.target.value })} error={fieldErrors[`data.feed.${key}`]} options={[...rows.map((r) => ({ value: r.id, label: r.name })), ...(data.feed[key] && !rows.some((r) => r.id === data.feed[key]) ? [{ value: data.feed[key], label: `Previous reference: ${data.feed[key]} (select active stock before submitting)` }] : [])]} />)}{[['bags', 'Feed bags'], ['bagSizeKg', 'Bag size (kg)'], ['additionalKg', 'Additional feed (kg)']].map(([key, title]) => <Input key={key} label={title} type="number" min="0" step="any" value={data.feed[key] ?? ''} onChange={(e) => update('feed', { ...data.feed, [key]: e.target.value })} error={fieldErrors[`data.feed.${key}`]} />)}{input('waterLitres', 'Water (litres)')}{input('lightHours', 'Light hours (0–24)')}</div><Textarea label="Extra feed notes" value={data.feed.notes} onChange={(e) => update('feed', { ...data.feed, notes: e.target.value })} /><p>Positive consumption requires an active kg feed item and a store in this farm. Submission issues stock atomically; drafts and returns keep the last posted amount effective. Legacy text references must be explicitly replaced. A first stock-enabled revision of a legacy report posts its full selected consumption.</p></fieldset>
      <fieldset><legend>Weekly bird weight</legend>{measurementError && <Alert tone="error">Could not load measurements: {measurementError}</Alert>}<Select label="Linked bird measurement" placeholder="No linked measurement" value={data.measurementId || ''} onChange={(e) => update('measurementId', e.target.value)} options={[...measurements.map((m) => ({ value: m.id, label: `${m.grams} g on ${m.businessDate} · ${m.sampleSize} birds · ${new Date(m.measuredAt).toLocaleTimeString()}` })), ...(data.measurementId && !measurements.some((m) => m.id === data.measurementId) ? [{ value: data.measurementId, label: 'Previously linked measurement' }] : [])]} /><p className="text-muted">Create samples in Bird parameters. This list includes accessible earlier samples through the selected business date. Standard not configured.</p></fieldset>
      {rowSection('medicines', 'Medicine')}{rowSection('vaccines', 'Vaccine')}
      <fieldset><legend>Health, visits, and issues</legend>{linkError && <Alert tone="error">Could not load clinical evidence: {linkError}</Alert>}<Select label="Linked clinical visit" disabled={!hasPermission(P.CLINICAL_VIEW) && !data.doctorVisitId} placeholder="No visit link" value={data.doctorVisitId || ''} onChange={(e) => update('doctorVisitId', e.target.value || null)} options={[...clinicalVisits.map((v) => ({ value: v.id, label: `${v.businessDate} - ${v.diagnosis.slice(0, 70)}` })), ...(data.doctorVisitId && !clinicalVisits.some((v) => v.id === data.doctorVisitId) ? [{ value: data.doctorVisitId, label: 'Previously linked visit' }] : [])]} /><p className="text-muted">Optional prescription and administration references link existing evidence only; they do not confirm another dose. Clinical choices require clinical view permission; outcome choices require medication view permission.</p><div className="reports__grid">{[['observations', 'In-house observations'], ['postMortem', 'Post-mortem observations'], ['comments', 'Comments'], ['issues', 'Operational issues'], ['doctorVisitReference', 'Doctor visit reference note'], ['doctorRemarks', 'Doctor visit remarks'], ['perPeNote', 'Per Pe (optional note)']].map(([key, title]) => <Textarea key={key} label={title} value={data[key]} onChange={(e) => update(key, e.target.value)} />)}</div></fieldset>
      <Textarea label="Correction reason" hint="Required for historical changes. Explain a resubmission when submitting the saved revision." value={reason} onChange={(e) => setReason(e.target.value)} />
      <p className="text-muted">Drafts can be incomplete. Submission requires all egg counts, mortality, feed quantities, water, and light values, including explicit zeros. Calculated totals appear after saving.</p>
    </form>
  </Modal>;
}
