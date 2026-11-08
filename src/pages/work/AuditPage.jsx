import { useState } from 'react';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import Modal from '../../components/common/Modal.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import SearchInput from '../../components/forms/SearchInput.jsx';
import Select from '../../components/forms/Select.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useClientTable from '../../hooks/useClientTable.js';
import { workService } from '../../services/workService.js';
import { formatDateTime } from '../../utils/formatters.js';
import './work.css';

export default function AuditPage() {
  const { user } = useAuth();
  const [rows] = useState(() => workService.list('audit', { id: user.id, role: user.role }));
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');
  const [selected, setSelected] = useState(null);
  const filtered = rows.filter((row) => (!module || row.module === module) && (!search || `${row.actorId} ${row.action} ${row.targetId}`.toLowerCase().includes(search.toLowerCase())));
  const table = useClientTable(filtered, { initialSort: { key: 'at', direction: 'desc' } });
  const columns = [{ key: 'at', header: 'Time', sortable: true, render: (row) => formatDateTime(row.at) }, { key: 'actorId', header: 'Actor', sortable: true }, { key: 'action', header: 'Action', sortable: true }, { key: 'module', header: 'Module', sortable: true }, { key: 'targetId', header: 'Target' }, { key: 'actions', header: 'Actions', render: (row) => <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>View change</Button> }];
  return <div className="work__stack"><Card padded={false}><div className="work__filters"><SearchInput value={search} onChange={setSearch} placeholder="Search audit events..." /><Select label="Module" placeholder="All modules" value={module} onChange={(event) => setModule(event.target.value)} options={[...new Set(rows.map((row) => row.module))].map((value) => ({ value, label: value }))} /></div><DataTable columns={columns} rows={table.rows} caption="Audit events" sort={table.sort} onSortChange={table.onSortChange} pagination={table.pagination} emptyTitle="No audit events" emptyDescription="Changes recorded in this browser appear here." /></Card><Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Audit event" size="lg" footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}><p>{selected?.action} · {selected?.module} · {selected?.actorId}</p><div className="work__fields"><div><h3>Before</h3><pre className="work__json">{JSON.stringify(selected?.before, null, 2) || '—'}</pre></div><div><h3>After</h3><pre className="work__json">{JSON.stringify(selected?.after, null, 2) || '—'}</pre></div></div></Modal></div>;
}
