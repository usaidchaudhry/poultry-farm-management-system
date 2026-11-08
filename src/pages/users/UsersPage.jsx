import { useEffect, useState } from 'react';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import SearchInput from '../../components/forms/SearchInput.jsx';
import Select from '../../components/forms/Select.jsx';
import { PERMISSIONS } from '../../config/permissions.js';
import { ROLE_OPTIONS } from '../../config/roles.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useFarm } from '../../context/FarmContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import RoleAssignModal from '../../features/users/RoleAssignModal.jsx';
import ScopeAssignModal from '../../features/users/ScopeAssignModal.jsx';
import UserFormModal from '../../features/users/UserFormModal.jsx';
import { getUserColumns } from '../../features/users/userColumns.jsx';
import useUsers from '../../features/users/useUsers.js';
import useClientTable from '../../hooks/useClientTable.js';
import { getErrorMessage } from '../../services/apiError.js';
import { organizationService } from '../../services/organizationService.js';
import { userService } from '../../services/userService.js';
import '../../features/users/users.css';
import '../../features/organization/organization.css';

export default function UsersPage() {
  const { user, hasPermission, refreshUser } = useAuth();
  const farm = useFarm();
  const toast = useToast();
  const { users, loading, error, reload, upsert } = useUsers();
  const canManage = hasPermission(PERMISSIONS.USERS_MANAGE);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ open: false, mode: 'create', user: null, key: 0 });
  const [roleTarget, setRoleTarget] = useState(null);
  const [scopeTarget, setScopeTarget] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  useEffect(() => {
    if (!canManage) return undefined;
    let current = true;
    organizationService.listAssignments().then((data) => { if (current) setAssignments(data); }).catch((err) => { if (current) setAssignmentError(getErrorMessage(err, 'Could not load assignments.')); }).finally(() => { if (current) setAssignmentsLoading(false); });
    return () => { current = false; };
  }, [canManage]);

  const rows = users.filter((item) => {
    const query = search.trim().toLowerCase();
    return (!query || `${item.name} ${item.email}`.toLowerCase().includes(query))
      && (!roleFilter || (roleFilter === 'unassigned' ? !item.role : item.role === roleFilter))
      && (!statusFilter || (statusFilter === 'active' ? item.isActive : !item.isActive));
  });
  const table = useClientTable(rows, { initialSort: { key: 'name', direction: 'asc' } });
  const openForm = (mode, target = null) => setForm((current) => ({ open: true, mode, user: target, key: current.key + 1 }));
  const closeForm = () => setForm((current) => ({ ...current, open: false }));
  const saveUser = async (values) => {
    const saved = form.mode === 'create' ? await userService.createUser(values, { actorId: user.id }) : await userService.updateUser(form.user.id, values, { actorId: user.id });
    upsert(saved);
    if (saved.id === user.id) await refreshUser();
    closeForm();
    toast.success(form.mode === 'create' ? 'User created.' : 'User updated.');
  };
  const saveRole = async (role) => {
    const saved = await userService.assignRole(roleTarget.id, role, { actorId: user.id });
    upsert(saved);
    setRoleTarget(null);
    toast.success('Role updated.');
  };
  const saveScope = async (scope) => {
    const saved = await organizationService.setAssignment(scopeTarget.id, scope, { id: user.id, role: user.role });
    setAssignments((current) => ({ ...current, [scopeTarget.id]: saved }));
    setScopeTarget(null);
    toast.success('Site and farm assignments updated.');
  };
  const toggleActive = async () => {
    setBusy(true);
    try {
      const saved = await userService.setUserActive(toggleTarget.id, !toggleTarget.isActive, { actorId: user.id });
      upsert(saved);
      toast.success(saved.isActive ? 'User activated.' : 'User deactivated.');
      setToggleTarget(null);
    } catch (err) { toast.error(getErrorMessage(err, 'Could not change account status.')); }
    finally { setBusy(false); }
  };
  const columns = getUserColumns({ canManage, currentUserId: user.id, onEdit: (row) => openForm('edit', row), onChangeRole: setRoleTarget, onToggleActive: setToggleTarget, onAssignScope: assignmentsLoading || assignmentError || farm.loading || farm.error ? null : setScopeTarget });

  return <div className="org__stack">
    <div className="org__heading"><p className="text-muted">{users.length} accounts</p>{canManage && <Button leftIcon="plus" onClick={() => openForm('create')}>Add user</Button>}</div>
    {(assignmentError || farm.error) && <p role="alert" className="text-muted">{assignmentError || farm.error}</p>}
    <Card padded={false}>
      <div className="users__toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search users..." />
        <Select label="Role" placeholder="All roles" options={[...ROLE_OPTIONS, { value: 'unassigned', label: 'Unassigned' }]} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} />
        <Select label="Status" placeholder="All statuses" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
      </div>
      <DataTable columns={columns} rows={table.rows} caption="Users" loading={loading} error={error} onRetry={reload} sort={table.sort} onSortChange={table.onSortChange} pagination={table.pagination} emptyTitle="No users found" emptyDescription="Try changing the search or filters." />
    </Card>
    {canManage && <>
      <UserFormModal key={`user-${form.key}`} open={form.open} mode={form.mode} user={form.user} onClose={closeForm} onSubmit={saveUser} />
      <RoleAssignModal key={`role-${roleTarget?.id || 'none'}`} open={Boolean(roleTarget)} user={roleTarget} onClose={() => setRoleTarget(null)} onSubmit={saveRole} />
      <ScopeAssignModal key={`scope-${scopeTarget?.id || 'none'}`} open={Boolean(scopeTarget)} user={scopeTarget} sites={farm.sites} farms={farm.farms} assignment={assignments[scopeTarget?.id]} onClose={() => setScopeTarget(null)} onSubmit={saveScope} />
      <ConfirmDialog open={Boolean(toggleTarget)} title={`${toggleTarget?.isActive ? 'Deactivate' : 'Activate'} this user?`} message={toggleTarget ? `${toggleTarget.name} will be ${toggleTarget.isActive ? 'unable' : 'able'} to sign in.` : ''} confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'} loading={busy} onConfirm={toggleActive} onCancel={() => setToggleTarget(null)} />
    </>}
  </div>;
}
