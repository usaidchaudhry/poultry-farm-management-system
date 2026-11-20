import { useCallback, useEffect, useRef, useState } from 'react';
import Input from '../../components/forms/Input.jsx';
import Select from '../../components/forms/Select.jsx';
import { useFarm } from '../../context/FarmContext.jsx';
import { getErrorMessage } from '../../services/apiError.js';
export const eggKeys = ['jumbo', 'starter', 'standard', 'small', 'floor', 'broken', 'discard'];
export const label = (s) => s[0].toUpperCase() + s.slice(1);
export const shown = (v) => v === null || v === undefined ? 'Unavailable' : v;
export function useRecords(service, query, extra) {
  const [result, setResult] = useState({ data: [], meta: {} });
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const sequence = useRef(0); const key = JSON.stringify(query);
  const reload = useCallback(async () => {
    const request = ++sequence.current; setLoading(true); setError('');
    try { const value = await service(JSON.parse(key), extra); if (request === sequence.current) setResult(value); }
    catch (err) { if (request === sequence.current) { setError(getErrorMessage(err)); setResult({ data: [], meta: {} }); } }
    finally { if (request === sequence.current) setLoading(false); }
  }, [service, key, extra]);
  useEffect(() => { reload(); return () => { sequence.current += 1; }; }, [reload]);
  return { ...result, loading, error, reload };
}
// The API supplies dates in the organization timezone; Asia/Karachi is the
// default suggestion until that first response arrives.
export const initialDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function FlockSelect({ value, onChange, disabled = false }) {
  const farm = useFarm();
  return <Select label="Flock" required placeholder="Choose a flock" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} options={farm.flocks.filter((f) => disabled || f.status === 'active').map((f) => ({ value: f.id, label: `${farm.maps.farmById[f.farmId]?.name || 'Farm'} / ${f.name}` }))} />;
}
export function RangeFilters({ from, to, onFrom, onTo, flockId, onFlock }) {
  const farm = useFarm();
  return <div className="reports__filters"><Input type="date" label="From date" value={from} onChange={(e) => onFrom(e.target.value)} /><Input type="date" label="To date" value={to} onChange={(e) => onTo(e.target.value)} /><Select label="Filter by flock" placeholder="All permitted flocks" value={flockId} onChange={(e) => onFlock(e.target.value)} options={farm.flocks.map((f) => ({ value: f.id, label: `${farm.maps.farmById[f.farmId]?.name} / ${f.name}` }))} /></div>;
}
