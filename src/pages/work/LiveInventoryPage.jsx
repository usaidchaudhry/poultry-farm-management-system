import { useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
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
import { PERMISSIONS as P } from '../../config/permissions.js';
import { inventoryService as service } from '../../services/inventoryService.js';
import { getErrorMessage } from '../../services/apiError.js';
import { initialDate, useRecords } from '../../features/reports/common.jsx';
import '../../features/reports/reports.css';

const options = (values) => values.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
const list = (query, kind) => service.list(kind, query);
async function all(kind) {
  const rows = []; let page = 1; let result;
  do { result = await service.list(kind, { page: page++, pageSize: 100 }); rows.push(...result.data); } while (rows.length < result.meta.total);
  return rows;
}
function StockForm({ mode, record, items, locations, farms, onClose, onSaved, can, farmId }) {
  const [values, setValues] = useState(() => ({ name: record?.name || '', category: record?.category || 'feed', unit: record?.unit || 'kg', active: record?.active ?? true, farmId: farmId || farms[0]?.id || '', kind: 'other', type: can(P.INVENTORY_MANAGE) ? 'receipt' : can(P.INVENTORY_ADJUST) ? 'adjustment' : 'transfer', itemId: record?.itemId || '', locationId: record?.locationId || '', destinationId: '', quantity: '', minimum: record?.minimum ?? '', businessDate: initialDate(), reason: '', purpose: 'other' }));
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  // Reuse the exact request key for an unchanged retry after a lost response.
  const pending = useRef(null);
  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));
  const select = (key, title, choices) => <Select label={title} value={String(values[key])} onChange={(e) => set(key, e.target.value)} options={choices} placeholder="Choose" />;
  const input = (key, title, type = 'text') => <Input label={title} type={type} step="any" value={values[key]} onChange={(e) => set(key, e.target.value)} />;
  const itemChoices = items.filter((i) => i.active || i.id === values.itemId).map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }));
  const locationChoices = locations.filter((l) => l.active || l.id === values.locationId).map((l) => ({ value: l.id, label: `${farms.find((f) => f.id === l.farmId)?.name || 'Farm'} / ${l.name}` }));
  const title = mode === 'items' ? (record ? 'Edit inventory item' : 'New inventory item') : mode === 'locations' ? (record ? 'Edit stock location' : 'New stock location') : mode === 'threshold' ? 'Set low-stock threshold' : mode === 'reverse' ? 'Reverse stock operation' : 'Post stock movement';
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      let payload;
      if (mode === 'items') payload = { name: values.name, category: values.category, unit: values.unit, active: values.active };
      if (mode === 'locations') payload = record ? { name: values.name, active: values.active } : { name: values.name, farmId: values.farmId, kind: values.kind };
      if (mode === 'threshold') payload = { itemId: values.itemId, locationId: values.locationId, minimum: values.minimum === '' ? null : Number(values.minimum), version: record?.version || 1 };
      if (mode === 'post') payload = { type: values.type, itemId: values.itemId, locationId: values.locationId, ...(values.type === 'transfer' ? { destinationId: values.destinationId } : {}), quantity: values.quantity === '' ? null : Number(values.quantity), unit: items.find((i) => i.id === values.itemId)?.unit || '', businessDate: values.businessDate, reason: values.reason, purpose: values.purpose };
      if (mode === 'reverse') payload = { businessDate: values.businessDate, reason: values.reason };
      const hash = JSON.stringify(payload);
      if (!pending.current || pending.current.hash !== hash) pending.current = { hash, key: crypto.randomUUID() };
      if (mode === 'post') await service.post(payload, pending.current.key);
      else if (mode === 'reverse') await service.reverse(record.id, payload, pending.current.key);
      else if (mode === 'threshold') await service.threshold(payload);
      else await service.save(mode, record, payload);
      await onSaved();
    } catch (e) { setError([getErrorMessage(e), ...Object.entries(e.fieldErrors || {}).map(([k, v]) => `${k}: ${v}`)].join(' ')); }
    finally { setBusy(false); }
  };
  return <Modal open title={title} onClose={busy ? undefined : onClose} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" form="stock-form" loading={busy}>Save stock changes</Button></>}><form id="stock-form" className="reports__form" onSubmit={save} noValidate>
    {error && <Alert tone="error">{error}</Alert>}
    {['items', 'locations'].includes(mode) && input('name', 'Name')}
    {mode === 'items' && <>{select('category', 'Category', options(['feed', 'ingredient', 'medicine', 'vaccine', 'supply', 'egg']))}{select('unit', 'Base unit', options(['kg', 'litre', 'count', 'ml', 'g']))}<p>Feed and ingredients use kg. Eggs use whole counts. Used item units/categories are locked. Existing shared definitions require company scope to edit.</p></>}
    {mode === 'locations' && !record && <>{select('farmId', 'Farm', farms.filter((f) => f.status === 'active').map((f) => ({ value: f.id, label: f.name })))}{select('kind', 'Location kind', options(['store', 'collection', 'other']))}</>}
    {record && ['items', 'locations'].includes(mode) && <Select label="Active" value={String(values.active)} onChange={(e) => set('active', e.target.value === 'true')} options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} />}
    {mode === 'post' && select('type', 'Movement type', options([...(can(P.INVENTORY_MANAGE) ? ['receipt', 'issue'] : []), ...(can(P.INVENTORY_ADJUST) ? ['opening', 'adjustment'] : []), ...(can(P.INVENTORY_TRANSFER) ? ['transfer'] : [])]))}
    {['post', 'threshold'].includes(mode) && <>{select('itemId', 'Stock item', itemChoices)}{select('locationId', 'Source location', locationChoices)}</>}
    {mode === 'post' && <>{values.type === 'transfer' && select('destinationId', 'Destination location', locationChoices.filter((l) => l.value !== values.locationId))}{input('quantity', 'Quantity in base unit', 'number')}{values.type === 'issue' && select('purpose', 'Issue purpose', options(['other', 'loss', 'dispatch']))}<p>Feed consumption posts only through daily reports. Manual feed issues record loss or dispatch. Adjustments use signed quantities; all other quantities are positive.</p></>}
    {mode === 'threshold' && input('minimum', 'Low-stock threshold in base unit', 'number')}
    {['post', 'reverse'].includes(mode) && <>{input('businessDate', 'Stock business date', 'date')}<Textarea label="Stock reason" value={values.reason} onChange={(e) => set('reason', e.target.value)} /><p>Reversing a transfer compensates both locations together. Generated report movements must be corrected through the report. Historical negative balances are prohibited.</p></>}
  </form></Modal>;
}
export default function LiveInventoryPage() {
  const { hasPermission: can } = useAuth(); const farm = useFarm(); const toast = useToast();
  const [params] = useSearchParams();
  const [tab, setTab] = useState('balances'); const [farmId, setFarm] = useState(params.get('farmId') || farm.active.farmId || ''); const [itemId, setItem] = useState(params.get('itemId') || ''); const [locationId, setLocation] = useState(params.get('locationId') || ''); const [category, setCategory] = useState(''); const [low, setLow] = useState(false); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [page, setPage] = useState(1);
  const [form, setForm] = useState(null); const [items, setItems] = useState([]); const [locations, setLocations] = useState([]); const [lookupError, setLookupError] = useState(''); const [refresh, setRefresh] = useState(0);
  useEffect(() => { let current = true; setLookupError(''); Promise.all([all('items'), all('locations')]).then(([i, l]) => { if (current) { setItems(i); setLocations(l); } }).catch((e) => { if (current) { setItems([]); setLocations([]); setLookupError(getErrorMessage(e)); } }); return () => { current = false; }; }, [refresh, farm.farms]);
  const query = { farmId: tab === 'items' ? undefined : farmId || undefined, itemId: itemId || undefined, locationId: tab === 'items' ? undefined : locationId || undefined, category: category || undefined, low: tab === 'balances' && low ? 'true' : undefined, from: ['movements'].includes(tab) ? from || undefined : undefined, to: tab === 'movements' ? to || undefined : undefined, page, pageSize: 20 };
  const records = useRecords(list, query, tab);
  const filter = (setter) => (e) => { setter(e.target.value); setPage(1); };
  const columns = tab === 'items' ? [{ key: 'name', header: 'Item' }, { key: 'category', header: 'Category' }, { key: 'unit', header: 'Unit' }, { key: 'active', header: 'Status', render: (r) => r.active ? 'Active' : 'Inactive' }] : tab === 'locations' ? [{ key: 'name', header: 'Location' }, { key: 'farmId', header: 'Farm', render: (r) => farm.maps.farmById[r.farmId]?.name || 'Farm' }, { key: 'kind', header: 'Kind' }, { key: 'active', header: 'Status', render: (r) => r.active ? 'Active' : 'Inactive' }] : [{ key: 'itemName', header: 'Item' }, { key: 'locationName', header: 'Location', render: (r) => `${farm.maps.farmById[r.farmId]?.name || 'Farm'} / ${r.locationName || locations.find((l) => l.id === r.locationId)?.name || 'Location'}` }, { key: 'quantity', header: 'Quantity' }, ...(tab === 'movements' ? [{ key: 'unit', header: 'Unit' }, { key: 'businessDate', header: 'Date' }, { key: 'type', header: 'Type' }, { key: 'reason', header: 'Reason' }, { key: 'createdByName', header: 'Recorded by' }, { key: 'reportId', header: 'Report source', render: (r) => r.reportId ? `Report ${r.reportId} / revision ${r.revision}` : 'Manual' }] : tab === 'reconciliation' ? [{ key: 'ledgerQuantity', header: 'Ledger quantity' }, { key: 'matches', header: 'Reconciles', render: (r) => r.matches ? 'Yes' : 'Mismatch - posting blocked' }] : [{ key: 'unit', header: 'Unit' }, { key: 'minimum', header: 'Low threshold' }, { key: 'low', header: 'Condition', render: (r) => r.quantity === 0 ? 'Out of stock' : r.low ? 'Low stock' : 'Available' }])];
  if (['items', 'locations', 'balances'].includes(tab) && can(P.INVENTORY_MANAGE)) columns.push({ key: 'actions', header: 'Actions', render: (r) => <Button size="sm" variant="secondary" onClick={() => setForm({ mode: tab === 'balances' ? 'threshold' : tab, record: r })}>{tab === 'balances' ? 'Set threshold' : 'Edit'}</Button> });
  if (tab === 'movements' && can(P.INVENTORY_ADJUST)) columns.push({ key: 'reverse', header: 'Actions', render: (r) => r.source === 'manual' && !r.reversesId ? <Button size="sm" variant="secondary" onClick={() => setForm({ mode: 'reverse', record: r })}>Reverse operation</Button> : 'Source controlled' });
  return <div className="reports__stack"><div className="reports__actions">{['balances', 'items', 'locations', 'movements', 'reconciliation'].map((t) => <Button key={t} variant={tab === t ? 'primary' : 'secondary'} onClick={() => { setTab(t); setPage(1); }}>{t[0].toUpperCase() + t.slice(1)}</Button>)}</div><p>Current balances include all posted history. Movement history follows your permitted date window. Low-stock views cover configured item/location pairs; configure a zero-balance pair using a threshold.</p><div className="reports__actions">{can(P.INVENTORY_MANAGE) && <><Button onClick={() => setForm({ mode: 'items' })}>New inventory item</Button><Button onClick={() => setForm({ mode: 'locations' })}>New stock location</Button><Button onClick={() => setForm({ mode: 'threshold' })}>Configure stock threshold</Button></>}{[P.INVENTORY_MANAGE, P.INVENTORY_ADJUST, P.INVENTORY_TRANSFER].some(can) && <Button onClick={() => setForm({ mode: 'post' })}>Post stock movement</Button>}</div>{lookupError && <Alert tone="error">{lookupError}<Button onClick={() => setRefresh((v) => v + 1)}>Retry choices</Button></Alert>}<Card><div className="reports__filters"><Select label="Inventory farm" value={farmId} onChange={(e) => { setFarm(e.target.value); setLocation(''); setPage(1); }} options={farm.farms.map((f) => ({ value: f.id, label: f.name }))} placeholder="All permitted farms" /><Select label="Inventory item filter" value={itemId} onChange={filter(setItem)} options={items.map((i) => ({ value: i.id, label: i.name }))} placeholder="All items" /><Select label="Inventory location filter" value={locationId} onChange={filter(setLocation)} options={locations.filter((l) => !farmId || l.farmId === farmId).map((l) => ({ value: l.id, label: `${farm.maps.farmById[l.farmId]?.name} / ${l.name}` }))} placeholder="All locations" /><Select label="Inventory category" value={category} onChange={filter(setCategory)} options={options(['feed', 'ingredient', 'medicine', 'vaccine', 'supply', 'egg'])} placeholder="All categories" />{tab === 'balances' && <Select label="Stock condition" value={low ? 'low' : ''} onChange={(e) => { setLow(e.target.value === 'low'); setPage(1); }} options={[{ value: 'low', label: 'Low or out of stock' }]} placeholder="All balances" />}{tab === 'movements' && <><Input label="Stock from date" type="date" value={from || records.meta.from || ''} onChange={filter(setFrom)} /><Input label="Stock to date" type="date" value={to || records.meta.to || ''} onChange={filter(setTo)} /></>}</div><DataTable caption={`Inventory ${tab}`} columns={columns} rows={records.data} loading={records.loading} error={records.error} onRetry={records.reload} emptyTitle="No stock records found" pagination={{ page, pageSize: 20, total: records.meta.total || 0, onPageChange: setPage }} /></Card>{form && <StockForm {...form} farmId={farmId} items={items} locations={locations} farms={farm.farms} can={can} onClose={() => setForm(null)} onSaved={async () => { setForm(null); setRefresh((v) => v + 1); await records.reload(); toast.success('Stock changes saved.'); }} />}</div>;
}
