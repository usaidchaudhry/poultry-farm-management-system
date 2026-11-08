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
import { formatNumber } from '../../utils/formatters.js';
import './work.css';

export default function FeedFormulasPage() {
  const { user, hasPermission } = useAuth();
  const farm = useFarm();
  const toast = useToast();
  const actor = { id: user.id, role: user.role };
  const [rows, setRows] = useState(() => workService.list('feedFormulas', actor));
  const [form, setForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState('');
  const [farmId, setFarmId] = useState('');
  const [bagSize, setBagSize] = useState('50');
  const [ingredients, setIngredients] = useState([{ name: '', quantity: '' }]);
  const [rates, setRates] = useState({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const compose = hasPermission(PERMISSIONS.FEED_FORMULAS_COMPOSE);
  const cost = hasPermission(PERMISSIONS.FEED_FORMULAS_COST);
  const table = useClientTable(rows, { initialSort: { key: 'createdAt', direction: 'desc' } });
  const refresh = () => setRows(workService.list('feedFormulas', actor));
  const columns = [{ key: 'name', header: 'Formula', sortable: true }, { key: 'farmId', header: 'Farm', render: (row) => farm.maps.farmById[row.farmId]?.name || '—' }, { key: 'totalKg', header: 'Total kg', render: (row) => formatNumber(row.totalKg || row.ingredients.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)) }, { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> }, { key: 'costPerBag', header: 'Cost per bag', render: (row) => row.costPerBag ? `PKR ${formatNumber(row.costPerBag)}` : 'Pending' }, { key: 'actions', header: 'Actions', render: (row) => <Button size="sm" variant="ghost" onClick={() => { setSelected(row); setRates({}); setError(''); }}>View</Button> }];
  const create = () => { setSaving(true); setError(''); try { if (!name.trim() || !farmId || ingredients.some((item) => !item.name.trim() || !(Number(item.quantity) > 0))) throw new Error('Enter a name, farm, and positive ingredient quantities.'); const values = { name: name.trim(), farmId, bagSize: Number(bagSize), ingredients: ingredients.map((item) => ({ name: item.name.trim(), quantity: Number(item.quantity) })) }; if (editingId) workService.update('feedFormulas', editingId, values, actor); else workService.create('feedFormulas', values, actor); refresh(); setForm(false); setEditingId(null); setName(''); setIngredients([{ name: '', quantity: '' }]); toast.success('Formula draft saved.'); } catch (err) { setError(err.message || getErrorMessage(err)); } finally { setSaving(false); } };
  const edit = (row) => { setEditingId(row.id); setName(row.name); setFarmId(row.farmId); setBagSize(String(row.bagSize || 50)); setIngredients(row.ingredients.map((item) => ({ name: item.name, quantity: String(item.quantity) }))); setSelected(null); setForm(true); };
  const action = (name) => { setSaving(true); setError(''); try { workService.transition('feedFormulas', selected.id, name, { rates, reason }, actor); refresh(); setSelected(null); toast.success('Formula updated.'); } catch (err) { setError(getErrorMessage(err)); } finally { setSaving(false); } };
  if (compose) columns.push({ key: 'newVersion', header: '', render: (row) => row.status === 'finalized' ? <Button size="sm" variant="secondary" onClick={() => { try { workService.transition('feedFormulas', row.id, 'revise', {}, actor); refresh(); toast.success('New draft version created.'); } catch (err) { toast.error(getErrorMessage(err)); } }}>New version</Button> : null });
  return <div className="work__stack"><div className="work__heading"><span className="text-muted">Farm Managers enter quantities; Operations enters prices and finalizes costing.</span>{compose && <Button leftIcon="plus" onClick={() => { setEditingId(null); setName(''); setFarmId(''); setIngredients([{ name: '', quantity: '' }]); setForm(true); setError(''); }}>New formula</Button>}</div><Card padded={false}><DataTable columns={columns} rows={table.rows} caption="Feed formulas" sort={table.sort} onSortChange={table.onSortChange} pagination={table.pagination} emptyTitle="No feed formulas" emptyDescription="Create a formula draft to begin." /></Card>
    <Modal open={form} onClose={() => setForm(false)} title="Create feed formula" size="lg" footer={<><Button variant="secondary" onClick={() => setForm(false)}>Cancel</Button><Button loading={saving} onClick={create}>Save draft</Button></>}><div className="work__form">{error && <p className="work__error" role="alert">{error}</p>}<Input label="Formula name" value={name} onChange={(event) => setName(event.target.value)} /><Select label="Farm" placeholder="Select farm" value={farmId} onChange={(event) => setFarmId(event.target.value)} options={farm.farms.filter((item) => item.status === 'active').map((item) => ({ value: item.id, label: item.name }))} /><Input label="Bag size (kg)" type="number" min="1" value={bagSize} onChange={(event) => setBagSize(event.target.value)} /><h3>Ingredients</h3>{ingredients.map((item, index) => <div key={index} className="work__fields"><Input label="Ingredient" value={item.name} onChange={(event) => setIngredients((current) => current.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} /><Input label="Quantity (kg)" type="number" min="0" value={item.quantity} onChange={(event) => setIngredients((current) => current.map((row, i) => i === index ? { ...row, quantity: event.target.value } : row))} /><Button variant="ghost" onClick={() => setIngredients((current) => current.filter((_, i) => i !== index))} disabled={ingredients.length === 1}>Remove</Button></div>)}<Button variant="secondary" onClick={() => setIngredients((current) => [...current, { name: '', quantity: '' }])}>Add ingredient</Button><p>Total: {formatNumber(ingredients.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0))} kg</p></div></Modal>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name || 'Formula'} size="lg" footer={<><Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>{compose && ['draft', 'returned'].includes(selected?.status) && <><Button variant="secondary" onClick={() => edit(selected)}>Edit composition</Button><Button loading={saving} onClick={() => action('submit')}>Submit for costing</Button></>}{cost && selected?.status === 'pending_costing' && <><Button variant="secondary" loading={saving} onClick={() => action('return')}>Return for revision</Button><Button loading={saving} onClick={() => action('finalize')}>Finalize costing</Button></>}</>}><div className="work__form">{error && <p className="work__error" role="alert">{error}</p>}<p>Status: <StatusBadge status={selected?.status} /> · Version {selected?.version}</p><p>Bag size: {selected?.bagSize} kg · Total cost: {selected?.totalCost ? `PKR ${formatNumber(selected.totalCost)}` : 'Pending'} · Cost/kg: {selected?.costPerKg ? `PKR ${formatNumber(selected.costPerKg)}` : 'Pending'}</p>{selected?.ingredients.map((item, index) => <div key={index} className="work__fields"><p>{item.name}: {item.quantity} kg {item.cost != null && `· PKR ${formatNumber(item.cost)}`}</p>{cost && selected.status === 'pending_costing' && <Input label="Rate (PKR/kg)" type="number" min="0" value={rates[index] ?? ''} onChange={(event) => setRates((current) => ({ ...current, [index]: event.target.value }))} />}</div>)}{cost && selected?.status === 'pending_costing' && <Textarea label="Return reason" value={reason} onChange={(event) => setReason(event.target.value)} />}{selected?.versions?.length > 0 && <p>Finalized versions: {selected.versions.map((version) => `v${version.version} (PKR ${formatNumber(version.totalCost)})`).join(', ')}</p>}</div></Modal>
  </div>;
}
