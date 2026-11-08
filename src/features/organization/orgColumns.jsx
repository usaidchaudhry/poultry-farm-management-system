import IconButton from '../../components/common/IconButton.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';

export const statusColumn = { key: 'status', header: 'Status', sortable: true, render: (row) => <StatusBadge status={row.status} /> };

// View is always available. Edit and archive/restore only when the user may manage the hierarchy.
export function getActionsColumn({ canManage, onView, onEdit, onArchive, onRestore }) {
  return {
    key: 'actions',
    header: <span className="sr-only">Actions</span>,
    align: 'right',
    render: (row) => (
      <div className="table__actions">
        <IconButton icon="eye" label={`View ${row.name}`} size="sm" onClick={() => onView(row)} />
        {canManage && <IconButton icon="edit" label={`Edit ${row.name}`} size="sm" onClick={() => onEdit(row)} />}
        {canManage &&
          (row.status === 'active' ? (
            <IconButton icon="archive" label={`Archive ${row.name}`} size="sm" onClick={() => onArchive(row)} />
          ) : (
            <IconButton icon="refresh" label={`Restore ${row.name}`} size="sm" onClick={() => onRestore(row)} />
          ))}
      </div>
    ),
  };
}
