import { useRef } from 'react';
import Input from '../../components/forms/Input.jsx';
import Select from '../../components/forms/Select.jsx';
import { useFarm } from '../../context/FarmContext.jsx';
import { getErrorMessage } from '../../services/apiError.js';
export const errorText = (e) => [getErrorMessage(e), ...Object.entries(e.fieldErrors || {}).map(([k, v]) => `${k}: ${v}`)].join(' ');
export function useWriteKey() { const request = useRef(null); return (payload) => { const hash = JSON.stringify(payload); if (request.current?.hash !== hash) request.current = { hash, key: crypto.randomUUID() }; return request.current.key; }; }
export function CommerceFilters({ values, meta, onChange }) {
  const farm = useFarm();
  return <div className="reports__filters"><Select label="Transaction farm" placeholder="All permitted farms" value={values.farmId} onChange={(e) => onChange('farmId', e.target.value)} options={farm.farms.map((f) => ({ value: f.id, label: f.name }))} /><Input label="Transaction from date" type="date" value={values.from || meta.from || ''} onChange={(e) => onChange('from', e.target.value)} /><Input label="Transaction to date" type="date" value={values.to || meta.to || ''} onChange={(e) => onChange('to', e.target.value)} /></div>;
}
export const queryFor = (values, page = 1) => ({ farmId: values.farmId || undefined, from: values.from || undefined, to: values.to || undefined, page, pageSize: 20 });
