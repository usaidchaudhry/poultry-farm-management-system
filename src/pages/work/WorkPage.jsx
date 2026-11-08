import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import Modal from '../../components/common/Modal.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import SearchInput from '../../components/forms/SearchInput.jsx';
import Input from '../../components/forms/Input.jsx';
import Select from '../../components/forms/Select.jsx';
import Textarea from '../../components/forms/Textarea.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS } from '../../config/permissions.js';
import { useFarm } from '../../context/FarmContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useClientTable from '../../hooks/useClientTable.js';
import { getErrorMessage } from '../../services/apiError.js';
import { workService } from '../../services/workService.js';
import { formatDate, formatNumber } from '../../utils/formatters.js';
import { WORK_CONFIG } from './workConfig.js';
import './work.css';

const getValue = (record, path) => path.split('.').reduce((value, key) => value?.[key], record);
const setValue = (record, path, value) => {
  const [root, child] = path.split('.');
  return child ? { ...record, [root]: { ...(record[root] || {}), [child]: value } } : { ...record, [root]: value };
};
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };

export default function WorkPage({ kind, permission, filterRows, intro, onSaved }) {
  const config = WORK_CONFIG[kind];
  const { user, hasPermission } = useAuth();
  const farm = useFarm();
  const toast = useToast();
  const actor = { id: user.id, role: user.role };
  const canEdit = hasPermission(permission);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [farmFilter, setFarmFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [reviewReason, setReviewReason] = useState('');
  const [detailError, setDetailError] = useState('');
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const load = () => { try { setRows(workService.list(kind, actor)); setError(''); } catch (err) { setError(getErrorMessage(err)); } };
  useEffect(load, [kind, user.id, user.role]);
  const visible = useMemo(() => rows.filter((row) => {
    if (filterRows && !filterRows(row)) return false;
    if (farmFilter && row.farmId !== farmFilter) return false;
    if (statusFilter && row.status !== statusFilter) return false;
    if (dateFilter && row[config.dateKey] !== dateFilter) return false;
    return !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase());
  }), [rows, filterRows, farmFilter, statusFilter, dateFilter, search, config.dateKey]);
  const table = useClientTable(visible, { initialSort: { key: config.dateKey || 'name', direction: 'desc' } });
  const display = (key, row) => {
    const value = getValue(row, key);
    if (key === 'farmId') return farm.maps.farmById[value]?.name || '—';
    if (key === 'houseId') return farm.maps.houseById[value]?.name || '—';
    if (key === 'flockId') return farm.maps.flockById[value]?.name || '—';
    if (key === 'itemId') return workService.list('inventoryItems', actor).find((item) => item.id === value)?.name || '—';
    if (key === 'status') return <StatusBadge status={value} />;
    if (key === 'date' || key === 'dueAt') return formatDate(value);
    if (typeof value === 'number') return formatNumber(value);
    return value || '—';
  };
  const columns = config.summary.map((key) => ({ key, header: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), sortable: !key.endsWith('Id'), render: (row) => display(key, row) }));
  columns.push({ key: 'actions', header: 'Actions', render: (row) => <div className="table__actions"><Button size="sm" variant="ghost" onClick={() => setDetail(row)}>View</Button>{canEdit && ((kind === 'dailyReports' && ['draft', 'returned'].includes(row.status)) || kind === 'inventoryItems' || kind === 'clinicalVisits') && <Button size="sm" variant="ghost" onClick={() => openForm(row)}>Edit</Button>}</div> });
  const openForm = (row = null) => { setForm(row || {}); setValues(row ? structuredClone(row) : { date: today(), unit: 'eggs', status: 'draft', paymentStatus: 'pending', farmId: farm.active.farmId || '', houseId: farm.active.houseId || '', flockId: farm.active.flockId || '' }); setFormError(''); };
  const closeForm = () => { if (!saving) setForm(null); };
  const fields = config.sections.flatMap((section) => section.fields);
  const options = (field) => {
    if (field.type === 'select') return field.options;
    if (field.type === 'farm') return farm.farms.filter((row) => row.status === 'active').map((row) => ({ value: row.id, label: row.name }));
    if (field.type === 'house') return farm.houses.filter((row) => row.status === 'active' && (!values.farmId || row.farmId === values.farmId)).map((row) => ({ value: row.id, label: row.name }));
    if (field.type === 'flock') return farm.flocks.filter((row) => row.status === 'active' && (!values.houseId || row.houseId === values.houseId) && (!values.farmId || farm.maps.houseById[row.houseId]?.farmId === values.farmId)).map((row) => ({ value: row.id, label: row.name }));
    if (field.type === 'item') return workService.list('inventoryItems', actor).map((row) => ({ value: row.id, label: `${row.name} (${row.balance} ${row.unit})` }));
    return [];
  };
  const change = (field, value) => setValues((current) => {
    let next = setValue(current, field, value);
    if (field === 'farmId') next = { ...next, houseId: '', flockId: '' };
    if (field === 'houseId') next = { ...next, flockId: '' };
    return next;
  });
  const renderField = (field) => {
    const value = getValue(values, field.name) ?? '';
    const lockedField = form?.id && ((kind === 'inventoryItems' && field.name === 'balance') || (['dailyReports', 'clinicalVisits'].includes(kind) && ['farmId', 'houseId', 'flockId', 'date'].includes(field.name)));
    const common = { key: field.name, label: field.label, required: field.required, value, disabled: Boolean(lockedField), onChange: (event) => change(field.name, event.target.value) };
    if (['farm', 'house', 'flock', 'item', 'select'].includes(field.type)) return <Select {...common} placeholder={`Select ${field.label.toLowerCase()}`} options={options(field)} />;
    if (field.type === 'textarea') return <Textarea {...common} />;
    return <Input {...common} type={field.type} min={field.type === 'number' && field.name !== 'quantity' ? '0' : undefined} step={field.type === 'number' ? 'any' : undefined} />;
  };
  const submit = async (status) => {
    const missing = fields.find((field) => field.required && String(getValue(values, field.name) ?? '').trim() === '');
    if (missing) { setFormError(`${missing.label} is required.`); return; }
    setSaving(true); setFormError('');
    try {
      const payload = kind === 'dailyReports' ? { ...values, status } : values;
      if (form.id) workService.update(kind, form.id, payload, actor);
      else workService.create(kind, payload, actor);
      load(); onSaved?.(); setForm(null); toast.success(`${config.singular} saved.`);
    } catch (err) { setFormError(getErrorMessage(err)); }
    finally { setSaving(false); }
  };
  const totalEggs = Object.values(values.eggs || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const transitionReport = (action) => { try { workService.transition('dailyReports', detail.id, action, { reason: reviewReason }, actor); load(); setDetail(null); setReviewReason(''); setDetailError(''); toast.success(`Report ${action === 'return' ? 'returned' : 'submitted'}.`); } catch (err) { setDetailError(getErrorMessage(err)); } };

  return <div className="work__stack">
    {intro && <p className="text-muted">{intro}</p>}
    <div className="work__heading"><span className="text-muted">{visible.length} records in your scope</span>{canEdit && <Button leftIcon="plus" onClick={() => openForm()}>Add {config.singular}</Button>}</div>
    <Card padded={false}>
      <div className="work__filters"><SearchInput value={search} onChange={setSearch} placeholder={`Search ${config.title.toLowerCase()}...`} /><Select label="Farm" placeholder="All farms" options={farm.farms.map((row) => ({ value: row.id, label: row.name }))} value={farmFilter} onChange={(event) => setFarmFilter(event.target.value)} />{config.dateKey && <Input label="Date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />}{rows.some((row) => row.status) && <Select label="Status" placeholder="All statuses" options={[...new Set(rows.map((row) => row.status))].map((value) => ({ value, label: value }))} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} />}</div>
      <DataTable columns={columns} rows={table.rows} caption={config.title} error={error} onRetry={load} sort={table.sort} onSortChange={table.onSortChange} pagination={table.pagination} emptyTitle={`No ${config.title.toLowerCase()} found`} emptyDescription="Add a record or change the filters." />
    </Card>
    <Modal open={Boolean(form)} onClose={closeForm} title={`${form?.id ? 'Edit' : 'Add'} ${config.singular}`} size="lg" footer={<><Button variant="secondary" onClick={closeForm} disabled={saving}>Cancel</Button>{kind === 'dailyReports' ? <><Button variant="secondary" loading={saving} onClick={() => submit('draft')}>Save draft</Button><Button loading={saving} onClick={() => submit('submitted')}>Submit report</Button></> : <Button loading={saving} onClick={() => submit()}>Save</Button>}</>}>
      <div className="work__form">{formError && <p className="work__error" role="alert">{formError}</p>}{config.sections.map((section) => <section key={section.title} className="work__section"><h3>{section.title}</h3><div className="work__fields">{section.fields.map(renderField)}</div></section>)}{kind === 'dailyReports' && <Card title="Calculated preview"><p>{formatNumber(totalEggs)} eggs · {(totalEggs / 360).toFixed(2)} Peti · {formatNumber((Number(values.openingBirds) || 0) + (Number(values.birdsPlaced) || 0) + (Number(values.transfersIn) || 0) - (Number(values.transfersOut) || 0) - (Number(values.mortality) || 0))} remaining birds</p></Card>}</div>
    </Modal>
    <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? `${config.singular}: ${detail.name || detail.date || detail.id}` : config.singular} size="lg" footer={<><Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>{kind === 'dailyReports' && canEdit && ['draft', 'returned'].includes(detail?.status) && <Button onClick={() => transitionReport('submit')}>Submit</Button>}{kind === 'dailyReports' && hasPermission(PERMISSIONS.DAILY_REPORTS_REVIEW) && detail?.status === 'submitted' && <Button onClick={() => transitionReport('return')} disabled={!reviewReason.trim()}>Return for correction</Button>}</>}><div className="work__form">{detailError && <p className="work__error" role="alert">{detailError}</p>}<dl className="work__details">{detail && Object.entries(detail).filter(([key]) => !['id', 'updatedAt'].includes(key)).map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1')}</dt><dd>{typeof value === 'object' ? JSON.stringify(value) : display(key, detail)}</dd></div>)}</dl>{kind === 'dailyReports' && hasPermission(PERMISSIONS.DAILY_REPORTS_REVIEW) && detail?.status === 'submitted' && <Textarea label="Correction reason" value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} />}</div></Modal>
  </div>;
}
