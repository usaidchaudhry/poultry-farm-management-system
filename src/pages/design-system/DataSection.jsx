import { useMemo, useState } from 'react';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import IconButton from '../../components/common/IconButton.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import SearchInput from '../../components/forms/SearchInput.jsx';
import Select from '../../components/forms/Select.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useClientTable from '../../hooks/useClientTable.js';
import { formatDate, formatNumber } from '../../utils/formatters.js';
import { DEMO_FLOCKS, STATUS_OPTIONS } from './demoData.js';

export default function DataSection() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState('normal'); // normal | loading | error
  const [rowToArchive, setRowToArchive] = useState(null);

  const filtered = useMemo(
    () =>
      DEMO_FLOCKS.filter(
        (row) =>
          (!status || row.status === status) &&
          `${row.name} ${row.house}`.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [search, status]
  );

  const table = useClientTable(filtered, { initialPageSize: 5, initialSort: { key: 'name', direction: 'asc' } });

  const columns = [
    { key: 'name', header: 'Flock', sortable: true },
    { key: 'house', header: 'House', sortable: true },
    { key: 'birds', header: 'Birds', sortable: true, align: 'right', render: (row) => formatNumber(row.birds) },
    { key: 'placedOn', header: 'Placed on', sortable: true, render: (row) => formatDate(row.placedOn) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      render: (row) => (
        <div className="table__actions">
          <IconButton icon="eye" label={`View ${row.name}`} size="sm" onClick={() => toast.info(`Viewing ${row.name}`)} />
          <IconButton icon="edit" label={`Edit ${row.name}`} size="sm" onClick={() => toast.info(`Editing ${row.name}`)} />
          <IconButton icon="archive" label={`Archive ${row.name}`} size="sm" onClick={() => setRowToArchive(row)} />
        </div>
      ),
    },
  ];

  return (
    <Card
      title="Data table"
      subtitle="Search, filter, sort and paginate. Try the state buttons on the right."
      padded={false}
      actions={
        <>
          <Button size="sm" variant={view === 'normal' ? 'primary' : 'secondary'} onClick={() => setView('normal')}>Data</Button>
          <Button size="sm" variant={view === 'loading' ? 'primary' : 'secondary'} onClick={() => setView('loading')}>Loading</Button>
          <Button size="sm" variant={view === 'error' ? 'primary' : 'secondary'} onClick={() => setView('error')}>Error</Button>
        </>
      }
    >
      <div className="ds__toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by flock or house" />
        <Select aria-label="Filter by status" placeholder="All statuses" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} />
      </div>

      <DataTable
        caption="Demo flocks"
        columns={columns}
        rows={table.rows}
        sort={table.sort}
        onSortChange={table.onSortChange}
        pagination={table.pagination}
        loading={view === 'loading'}
        error={view === 'error' ? 'The demo server did not respond.' : null}
        onRetry={() => setView('normal')}
        emptyAction={<Button variant="secondary" onClick={() => { setSearch(''); setStatus(''); }}>Clear filters</Button>}
      />

      <ConfirmDialog
        open={Boolean(rowToArchive)}
        title="Archive this flock?"
        message={rowToArchive ? `${rowToArchive.name} will be hidden from active lists. You can restore it later.` : ''}
        confirmLabel="Archive"
        onCancel={() => setRowToArchive(null)}
        onConfirm={() => {
          toast.success(`${rowToArchive.name} archived.`);
          setRowToArchive(null);
        }}
      />
    </Card>
  );
}
