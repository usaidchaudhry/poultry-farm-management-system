import { useEffect, useRef, useState } from 'react';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import Modal from '../../components/common/Modal.jsx';
import Alert from '../../components/common/Alert.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import Input from '../../components/forms/Input.jsx';
import Select from '../../components/forms/Select.jsx';
import Textarea from '../../components/forms/Textarea.jsx';
import { PERMISSIONS as P } from '../../config/permissions.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFarm } from '../../context/FarmContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formulaService as service } from '../../services/formulaService.js';
import { getErrorMessage } from '../../services/apiError.js';
import { initialDate, useRecords } from '../../features/reports/common.jsx';
import '../../features/reports/reports.css';

const message = (e) => [getErrorMessage(e), ...Object.entries(e.fieldErrors || {}).map(([k, v]) => `${k}: ${v}`)].join(' ');
const blankRow = () => ({ key: crypto.randomUUID(), itemId: '', kg: '' });
function useRequestKey() {
  const request = useRef(null);
  return (payload) => { const hash = JSON.stringify(payload); if (request.current?.hash !== hash) request.current = { hash, key: crypto.randomUUID() }; return request.current.key; };
}
function CompositionForm({ record, farmId: initialFarm, onClose, onSaved }) {
  const farm = useFarm(); const keyFor = useRequestKey();
  const [values, setValues] = useState(() => ({ code: record?.code || '', farmId: record?.farmId || initialFarm || '', name: record?.name || '', businessDate: record?.businessDate || initialDate(), feedType: record?.feedType || '', strain: record?.strain || '', bagSizeKg: record?.bagSizeKg || '50', rows: record?.rows.map(({ key, itemId, kg }) => ({ key, itemId, kg })) || [blankRow()] }));
  const [ingredients, setIngredients] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => { let current = true; setLoading(true); setError(''); const load = async () => { const rows = []; let page = 1; let response; do { response = await service.ingredients(page++); rows.push(...response.data); } while (rows.length < response.meta.total); if (current) setIngredients(rows); }; load().catch((e) => { if (current) setError(message(e)); }).finally(() => { if (current) setLoading(false); }); return () => { current = false; }; }, [retry]);
  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));
  const editRow = (key, field, value) => setValues((v) => ({ ...v, rows: v.rows.map((r) => r.key === key ? { ...r, [field]: value } : r) }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const { code, farmId, ...composition } = values; const payload = record ? composition : values; const saved = await service.save(record, payload, keyFor(payload)); await onSaved(saved); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  return <Modal open title={record ? 'Edit formula composition' : 'New feed formula'} size="lg" onClose={busy ? undefined : onClose} footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" form="formula-composition" loading={busy} disabled={loading}>Save composition</Button></>}><form id="formula-composition" className="reports__form" onSubmit={save} noValidate>
    {error && <Alert tone="error">{error}<Button variant="secondary" onClick={() => setRetry((v) => v + 1)}>Reload ingredients</Button></Alert>}
    <div className="reports__grid"><Input label="Formula code" value={values.code} disabled={Boolean(record)} onChange={(e) => set('code', e.target.value)} /><Input label="Formula name" value={values.name} onChange={(e) => set('name', e.target.value)} /><Select label="Formula farm" placeholder="Choose farm" disabled={Boolean(record)} value={values.farmId} onChange={(e) => set('farmId', e.target.value)} options={farm.farms.filter((f) => f.status === 'active' || f.id === values.farmId).map((f) => ({ value: f.id, label: f.name }))} /><Input label="Formula date" type="date" value={values.businessDate} onChange={(e) => set('businessDate', e.target.value)} /><Input label="Bag size (kg)" type="number" min="0.001" step="0.001" value={values.bagSizeKg} onChange={(e) => set('bagSizeKg', e.target.value)} /><Input label="Feed type (optional)" value={values.feedType} onChange={(e) => set('feedType', e.target.value)} /><Input label="Strain (optional)" value={values.strain} onChange={(e) => set('strain', e.target.value)} /></div>
    <h3>Ingredients</h3>{loading && <p role="status">Loading ingredient catalog...</p>}{!loading && !ingredients.length && <Alert tone="info">An inventory manager must create active ingredient items with base unit kg before composition can be saved.</Alert>}
    {values.rows.map((row, index) => <div className="reports__sample" key={row.key}><Select label={`Ingredient ${index + 1}`} value={row.itemId} onChange={(e) => editRow(row.key, 'itemId', e.target.value)} placeholder="Choose catalog ingredient" options={[...ingredients.map((r) => ({ value: r.id, label: r.name })), ...(row.itemId && !ingredients.some((r) => r.id === row.itemId) ? [{ value: row.itemId, label: 'Previous ingredient unavailable - select an active item' }] : [])]} /><Input label={`Ingredient ${index + 1} kg`} type="number" min="0.001" step="0.001" value={row.kg} onChange={(e) => editRow(row.key, 'kg', e.target.value)} /><Button variant="secondary" disabled={values.rows.length === 1} onClick={() => set('rows', values.rows.filter((r) => r.key !== row.key))}>Remove ingredient {index + 1}</Button></div>)}<Button variant="secondary" disabled={values.rows.length >= 100} onClick={() => set('rows', [...values.rows, blankRow()])}>Add ingredient</Button>
    <p>Use positive kg with at most three decimal places. Row identities stay stable while editing. Saving or finalizing a formula does not manufacture feed, consume stock, or create an expense.</p>
  </form></Modal>;
}
function FormulaDetails({ record, onClose, onEdit, onOpen, onChanged }) {
  const { hasPermission: can } = useAuth(); const keyFor = useRequestKey();
  const [rates, setRates] = useState(() => Object.fromEntries((record.costing?.rows || []).map((r) => [r.key, r.rate])));
  const [preview, setPreview] = useState(null); const [reason, setReason] = useState(''); const [date, setDate] = useState(initialDate()); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const priceRead = can(P.FEED_FORMULAS_COST_VIEW); const priceWrite = priceRead && can(P.FEED_FORMULAS_COST); const pending = record.status === 'pending_costing' && !record.archived;
  const unsavedRates = priceWrite && record.rows.some((r) => {
    const saved = record.costing?.rows.find((p) => p.key === r.key)?.rate;
    return !saved || !rates[r.key] || Number(saved) !== Number(rates[r.key]);
  });
  const editable = ['draft', 'returned'].includes(record.status) && record.latest && !record.archived;
  const packedRates = () => record.rows.map((r) => ({ key: r.key, rate: rates[r.key] || '' }));
  const act = async (action) => {
    setBusy(true); setError('');
    try {
      if (action === 'preview') { setPreview(await service.preview(record, packedRates())); return; }
      let result;
      if (action === 'pricing') result = await service.pricing(record, packedRates());
      else { const values = ['return', 'revise', 'archive'].includes(action) ? { reason, ...(action === 'revise' ? { businessDate: date } : {}) } : {}; result = await service.action(record, action, values, keyFor({ id: record.id, version: record.version, action, ...values })); }
      setPreview(null); await onChanged(result);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const costing = preview || record.costing;
  const columns = [{ key: 'itemName', header: 'Ingredient' }, { key: 'kg', header: 'kg' }, ...(priceRead && costing ? [{ key: 'rate', header: 'PKR/kg' }, { key: 'cost', header: 'Row PKR' }] : [])];
  return <Modal open title={`${record.code} - Version ${record.number}`} size="lg" onClose={busy ? undefined : onClose} footer={<Button disabled={busy} onClick={onClose}>Close</Button>}><div className="reports__stack">
    {error && <Alert tone="error">{error}<Button variant="secondary" onClick={() => onOpen(record.id)}>Refresh formula</Button></Alert>}
    <p><strong>{record.name}</strong> - {record.businessDate} - {record.status}{record.archived ? ' (archived)' : ''} - Record version {record.version}</p><p>Bag size: {record.bagSizeKg} kg - Total: {record.totalKg} kg - {record.feedType || 'No feed type'} - {record.strain || 'No strain'}</p><p>Recorded by {record.createdByName}{record.finalizedAt && `; finalized by ${record.finalizedByName} at ${new Date(record.finalizedAt).toLocaleString()}`}</p>
    {record.returnReason && <Alert tone="warning">Returned: {record.returnReason}</Alert>}{record.revisionReason && <p>Revision reason: {record.revisionReason}</p>}
    <DataTable caption="Formula ingredients" rows={priceRead && costing ? costing.rows : record.rows} columns={columns} emptyTitle="No ingredients" />
    {priceRead && costing && <Card title={preview ? 'Unsaved server costing preview' : record.status === 'finalized' ? 'Finalized costing snapshot' : 'Saved costing preview'}><p>Total PKR <strong>{costing.totalCost}</strong> - PKR/kg <strong>{costing.costPerKg}</strong> - PKR per {costing.bagSizeKg} kg bag <strong>{costing.costPerBag}</strong></p><p className="text-muted">Costs round half up: ingredient amounts to two decimals and cost/kg to four. Bag cost uses the unrounded ratio.</p></Card>}
    {priceWrite && pending && <fieldset><legend>Ingredient rates</legend>{record.rows.map((r, i) => <Input key={r.key} label={`Rate ${i + 1} (PKR/kg) - ${r.itemName}`} type="number" min="0.0001" step="0.0001" value={rates[r.key] || ''} onChange={(e) => { setRates((values) => ({ ...values, [r.key]: e.target.value })); setPreview(null); }} />)}<div className="reports__actions"><Button disabled={busy} onClick={() => act('preview')}>Preview costing</Button><Button loading={busy} onClick={() => act('pricing')}>Save rates</Button></div><p>Preview is unsaved. Finalization uses saved rates; save any rate changes before finalizing.</p></fieldset>}
    {((pending && can(P.FEED_FORMULAS_RETURN)) || (record.status === 'finalized' && record.latest && !record.archived && can(P.FEED_FORMULAS_COMPOSE))) && <><Textarea label="Formula action reason" value={reason} onChange={(e) => setReason(e.target.value)} />{record.status === 'finalized' && <Input label="New version date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</>}
    <div className="reports__actions">{editable && can(P.FEED_FORMULAS_COMPOSE) && <Button variant="secondary" disabled={busy} onClick={() => onEdit(record)}>Edit composition</Button>}{editable && can(P.FEED_FORMULAS_SUBMIT) && <Button loading={busy} onClick={() => act('submit')}>Submit for costing</Button>}{pending && can(P.FEED_FORMULAS_RETURN) && <Button variant="secondary" loading={busy} onClick={() => act('return')}>Return composition</Button>}{pending && priceRead && can(P.FEED_FORMULAS_FINALIZE) && <Button loading={busy} disabled={!record.costing || unsavedRates} onClick={() => act('finalize')}>Finalize costing</Button>}{record.status === 'finalized' && record.latest && !record.archived && can(P.FEED_FORMULAS_COMPOSE) && <><Button loading={busy} onClick={() => act('revise')}>Create new draft version</Button><Button variant="secondary" loading={busy} onClick={() => act('archive')}>Archive formula</Button></>}</div>
    <p>Composition locks on submission. A return clears saved prices. New revisions copy quantities and bag size, with no carried rates. Finalized snapshots remain immutable.</p>
    <div className="reports__actions">{record.history?.map((v) => <Button key={v.id} disabled={busy || v.id === record.id} variant="secondary" onClick={() => onOpen(v.id)}>Version {v.number} - {v.status}</Button>)}</div>
  </div></Modal>;
}
export default function LiveFeedFormulasPage() {
  const { hasPermission: can } = useAuth(); const farm = useFarm(); const toast = useToast();
  const [farmId, setFarm] = useState(farm.active.farmId || ''); const [view, setView] = useState('history'); const [status, setStatus] = useState(''); const [archived, setArchived] = useState('false'); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [page, setPage] = useState(1);
  const [form, setForm] = useState(null); const [selected, setSelected] = useState(null); const [error, setError] = useState(''); const [opening, setOpening] = useState(false); const sequence = useRef(0);
  const records = useRecords(service.list, { farmId: farmId || undefined, view, status: view === 'history' ? status || undefined : undefined, archived, from: view === 'history' ? from || undefined : undefined, to: view === 'history' ? to || undefined : undefined, page, pageSize: 20 });
  useEffect(() => () => { sequence.current += 1; }, []);
  const open = async (id) => { const request = ++sequence.current; setOpening(true); setError(''); try { const row = await service.detail(id); if (request === sequence.current) setSelected(row); } catch (e) { if (request === sequence.current) { setSelected(null); setError(message(e)); } } finally { if (request === sequence.current) setOpening(false); } };
  const changed = async (row) => {
    const history = [...(selected?.history || [])].filter((v) => v.id !== row.id);
    if (selected && selected.id !== row.id && !history.some((v) => v.id === selected.id)) history.push({ id: selected.id, number: selected.number, status: selected.status, businessDate: selected.businessDate });
    history.push({ id: row.id, number: row.number, status: row.status, businessDate: row.businessDate });
    setSelected({ ...row, history: history.sort((a, b) => b.number - a.number) }); await records.reload(); toast.success('Formula updated.');
  };
  const filter = (setter) => (e) => { setter(e.target.value); setPage(1); };
  const columns = [{ key: 'code', header: 'Code' }, { key: 'name', header: 'Formula' }, { key: 'farmId', header: 'Farm', render: (r) => farm.maps.farmById[r.farmId]?.name || 'Farm' }, { key: 'number', header: 'Version' }, { key: 'businessDate', header: 'Date' }, { key: 'totalKg', header: 'kg' }, { key: 'status', header: 'Status' }, ...(can(P.FEED_FORMULAS_COST_VIEW) ? [{ key: 'costPerBag', header: 'PKR/bag', render: (r) => r.costing?.costPerBag || 'Uncosted' }] : []), { key: 'actions', header: 'Actions', render: (r) => <Button size="sm" variant="secondary" disabled={opening} onClick={() => open(r.id)}>View {r.code} v{r.number}</Button> }];
  return <div className="reports__stack"><div className="reports__actions"><p>Compose quantities, submit for pricing, and preserve each finalized version. These documents do not post stock or expenses.</p>{can(P.FEED_FORMULAS_COMPOSE) && <Button onClick={() => { setSelected(null); setForm({ record: null }); }}>New feed formula</Button>}</div>{error && <Alert tone="error">{error}</Alert>}{opening && <p role="status">Loading formula...</p>}<Card><div className="reports__filters"><Select label="Formula farm filter" placeholder="All permitted farms" value={farmId} onChange={filter(setFarm)} options={farm.farms.map((f) => ({ value: f.id, label: f.name }))} /><Select label="Formula view" value={view} onChange={filter(setView)} options={[{ value: 'history', label: 'Dated formula versions' }, { value: 'pending', label: 'Pending costing queue' }]} /><Select label="Archived formulas" value={archived} onChange={filter(setArchived)} options={[{ value: 'false', label: 'Active formulas' }, { value: 'true', label: 'Archived formulas' }]} />{view === 'history' && <><Select label="Formula status" value={status} onChange={filter(setStatus)} placeholder="All states" options={['draft', 'pending_costing', 'returned', 'finalized'].map((v) => ({ value: v, label: v.replaceAll('_', ' ') }))} /><Input label="Formula from date" type="date" value={from || records.meta.from || ''} onChange={filter(setFrom)} /><Input label="Formula to date" type="date" value={to || records.meta.to || ''} onChange={filter(setTo)} /></>}</div><DataTable caption="Feed formula versions" columns={columns} rows={records.data} loading={records.loading} error={records.error} onRetry={records.reload} emptyTitle="No formula versions found" pagination={{ page, pageSize: 20, total: records.meta.total || 0, onPageChange: setPage }} /></Card>{form && <CompositionForm record={form.record} farmId={farmId || farm.active.farmId} onClose={() => setForm(null)} onSaved={async (row) => { setForm(null); await records.reload(); toast.success('Formula composition saved.'); await open(row.id); }} />}{selected && !form && <FormulaDetails key={`${selected.id}:${selected.version}:${selected.archived}`} record={selected} onClose={() => { sequence.current += 1; setSelected(null); }} onEdit={(row) => { setSelected(null); setForm({ record: row }); }} onOpen={open} onChanged={changed} />}</div>;
}
