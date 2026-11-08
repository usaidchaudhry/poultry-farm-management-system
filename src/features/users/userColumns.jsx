import Badge from '../../components/common/Badge.jsx';
import IconButton from '../../components/common/IconButton.jsx';
import StatusBadge from '../../components/common/StatusBadge.jsx';
import { ROLE_INFO } from '../../config/roles.js';
import { formatDate } from '../../utils/formatters.js';
import './users.css';

// Builds the table columns. Action buttons are only included when the viewer may manage users.
export function getUserColumns({ canManage, currentUserId, onEdit, onChangeRole, onToggleActive }) {
  const columns = [
    {
      key: 'name',
      header: 'User',
      sortable: true,
      render: (row) => (
        <div className="user-cell">
          <strong>
            {row.name}
            {row.id === currentUserId && <span className="user-cell__you">You</span>}
          </strong>
          <span className="text-muted">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (row) =>
        row.role ? <Badge tone="primary">{ROLE_INFO[row.role]?.label || row.role}</Badge> : <Badge tone="warning">Unassigned</Badge>,
    },
    { key: 'isActive', header: 'Status', sortable: true, render: (row) => <StatusBadge status={row.isActive ? 'active' : 'inactive'} /> },
    { key: 'lastLoginAt', header: 'Last sign-in', sortable: true, render: (row) => (row.lastLoginAt ? formatDate(row.lastLoginAt) : 'Never') },
  ];

  if (canManage) {
    columns.push({
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      render: (row) => {
        const isSelf = row.id === currentUserId;
        return (
          <div className="table__actions">
            <IconButton icon="edit" label={`Edit ${row.name}`} size="sm" onClick={() => onEdit(row)} />
            <IconButton
              icon="users"
              label={isSelf ? 'You cannot change your own role' : `Change role for ${row.name}`}
              size="sm"
              disabled={isSelf}
              onClick={() => onChangeRole(row)}
            />
            <IconButton
              icon={row.isActive ? 'xCircle' : 'checkCircle'}
              label={
                row.isActive
                  ? isSelf ? 'You cannot deactivate your own account' : `Deactivate ${row.name}`
                  : `Activate ${row.name}`
              }
              size="sm"
              disabled={isSelf && row.isActive}
              onClick={() => onToggleActive(row)}
            />
          </div>
        );
      },
    });
  }
  return columns;
}
