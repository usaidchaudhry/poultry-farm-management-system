import { useEffect, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import Modal from '../../components/common/Modal.jsx';
import Input from '../../components/forms/Input.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import SearchInput from '../../components/forms/SearchInput.jsx';
import Select from '../../components/forms/Select.jsx';
import { PERMISSIONS } from '../../config/permissions.js';
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
import { roleService } from '../../services/roleService.js';
import { config } from '../../utils/config.js';
import '../../features/users/users.css';
import '../../features/organization/organization.css';

export default function UsersPage() {
  const { user, hasPermission, refreshUser } = useAuth();
  const farm = useFarm();
  const toast = useToast();
  const canManage = hasPermission(PERMISSIONS.USERS_MANAGE);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' });
  const query = { page, pageSize, sort: `${sort.direction === 'desc' ? '-' : ''}${sort.key}`, search: search || undefined, role: roleFilter || undefined, status: statusFilter || undefined };
  const { users, meta, loading, error, reload } = useUsers(config.isMock ? {} : query);
  const [roles, setRoles] = useState([]);
  const [roleError, setRoleError] = useState('');
  const [form, setForm] = useState({ open: false, mode: 'create', user: null, key: 0 });
  const [roleTarget, setRoleTarget] = useState(null);
  const [scopeTarget, setScopeTarget] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  useEffect(() => {
    let current = true;
    roleService.listRoles().then((data) => { if (current) { setRoles(data); setRoleError(''); } }).catch((failure) => { if (current) setRoleError(getErrorMessage(failure)); });
    return () => { current = false; };
  }, []);
  useEffect(() => {
    if (!config.isMock || !canManage) return undefined;
    let current = true;
    organizationService.listAssignments().then((data) => { if (current) setAssignments(data); }).catch((failure) => { if (current) setAssignmentError(getErrorMessage(failure)); }).finally(() => { if (current) setAssignmentsLoading(false); });
    return () => { current = false; };
  }, [canManage]);

  const mockRows = users.filter((item) => (!search || `${item.name} ${item.email}`.toLowerCase().includes(search.toLowerCase())) && (!roleFilter || (roleFilter === 'unassigned' ? !item.role : item.role === roleFilter)) && (!statusFilter || item.isActive === (statusFilter === 'active')));
  const mockTable = useClientTable(mockRows, { initialSort: { key: 'name', direction: 'asc' } });
  const openForm = (mode, target = null) => setForm((current) => ({ open: true, mode, user: target, key: current.key + 1 }));
  const closeForm = () => setForm((current) => ({ ...current, open: false }));
  const saveUser = async (values) => {
    const saved = form.mode === 'create'
      ? await userService.createUser(values, { actorId: user.id })
      : await userService.updateUser(form.user.id, values, { actorId: user.id, version: form.user.version });
    if (saved.id === user.id) await refreshUser();
    closeForm(); await reload(); toast.success(form.mode === 'create' ? 'User created. Assign a role separately when ready.' : 'User updated.');
  };
  const saveRole = async (role) => {
    await userService.assignRole(roleTarget.id, role, { actorId: user.id, version: roleTarget.version });
    setRoleTarget(null); await reload(); toast.success(config.isMock ? 'Role updated in mock data.' : 'Role updated. Existing sessions for that account have ended.');
  };
  const saveScope = async (scope) => {
    const saved = await organizationService.setAssignment(scopeTarget.id, scope, { id: user.id, role: user.role });
    setAssignments((current) => ({ ...current, [scopeTarget.id]: saved })); setScopeTarget(null); toast.success('Assignments updated.');
  };
  const toggleActive = async () => {
    setBusy(true);
    try {
      const saved = await userService.setUserActive(toggleTarget.id, !toggleTarget.isActive, { actorId: user.id, version: toggleTarget.version });
      setToggleTarget(null); await reload(); toast.success(saved.isActive ? 'User activated.' : 'User deactivated.');
    } catch (failure) { toast.error(getErrorMessage(failure)); }
    finally { setBusy(false); }
  };
  const resetPassword = async (event) => {
    event.preventDefault(); setBusy(true); setActionError('');
    try {
      await userService.resetPassword(resetTarget.id, temporaryPassword, resetTarget.version);
      setResetTarget(null); setTemporaryPassword(''); await reload(); toast.success('Temporary password set. Share it securely; existing sessions have ended.');
    } catch (failure) { setActionError(getErrorMessage(failure)); }
    finally { setBusy(false); }
  };
  const columns = getUserColumns({
    canManage, currentUserId: user.id, serverPaging: !config.isMock,
    onEdit: (row) => openForm('edit', row), onChangeRole: roles.length && !roleError ? setRoleTarget : null, onToggleActive: setToggleTarget,
    onResetPassword: config.isMock ? null : (row) => { setResetTarget(row); setTemporaryPassword(''); setActionError(''); },
    onAssignScope: config.isMock && !assignmentsLoading && !assignmentError && !farm.loading && !farm.error ? setScopeTarget : null,
  });
  const setFilter = (setter) => (value) => { setter(value); setPage(1); };
  return <div className="org__stack">
    <div className="org__heading"><p className="text-muted">{meta?.total ?? users.length} accounts</p>{canManage && <Button leftIcon="plus" onClick={() => openForm('create')}>Add user</Button>}</div>
    {!config.isMock && <Alert tone="info">New accounts start unassigned and must change their temporary password. Farm scope assignment becomes available in MERN Phase 3.</Alert>}
    {(roleError || assignmentError) && <Alert tone="error">{roleError || assignmentError}</Alert>}
    <Card padded={false}>
      <div className="users__toolbar">
        <SearchInput value={search} onChange={setFilter(setSearch)} placeholder="Search users..." />
        <Select label="Role" placeholder="All roles" options={[...roles.map((role) => ({ value: role.code, label: role.name })), { value: 'unassigned', label: 'Unassigned' }]} value={roleFilter} onChange={(event) => setFilter(setRoleFilter)(event.target.value)} />
        <Select label="Status" placeholder="All statuses" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} value={statusFilter} onChange={(event) => setFilter(setStatusFilter)(event.target.value)} />
      </div>
      <DataTable columns={columns} rows={config.isMock ? mockTable.rows : users} caption="Users" loading={loading} error={error} onRetry={reload}
        sort={config.isMock ? mockTable.sort : sort} onSortChange={config.isMock ? mockTable.onSortChange : (next) => { setSort(next); setPage(1); }}
        pagination={config.isMock ? mockTable.pagination : { page, pageSize, total: meta?.total || 0, onPageChange: setPage, onPageSizeChange: (size) => { setPageSize(size); setPage(1); } }}
        emptyTitle="No users found" emptyDescription="Try changing the search or filters." />
    </Card>
    {canManage && <>
      <UserFormModal key={`user-${form.key}`} open={form.open} mode={form.mode} user={form.user} onClose={closeForm} onSubmit={saveUser} />
      <RoleAssignModal key={`role-${roleTarget?.id || 'none'}`} open={Boolean(roleTarget)} user={roleTarget} roles={roles} onClose={() => setRoleTarget(null)} onSubmit={saveRole} />
      {config.isMock && <ScopeAssignModal key={`scope-${scopeTarget?.id || 'none'}`} open={Boolean(scopeTarget)} user={scopeTarget} sites={farm.sites} farms={farm.farms} assignment={assignments[scopeTarget?.id]} onClose={() => setScopeTarget(null)} onSubmit={saveScope} />}
      <ConfirmDialog open={Boolean(toggleTarget)} title={`${toggleTarget?.isActive ? 'Deactivate' : 'Activate'} this user?`} message={toggleTarget ? `${toggleTarget.name} will be ${toggleTarget.isActive ? 'unable' : 'able'} to sign in.` : ''} confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'} loading={busy} onConfirm={toggleActive} onCancel={() => setToggleTarget(null)} />
      <Modal open={Boolean(resetTarget)} title={`Reset password for ${resetTarget?.name || 'user'}`} onClose={busy ? undefined : () => setResetTarget(null)}>
        <form className="users__modal-body" onSubmit={resetPassword}>
          {actionError && <Alert tone="error">{actionError}</Alert>}
          <Input label="New temporary password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} hint="12–128 characters. The user must change this after signing in." />
          <Button type="submit" loading={busy}>Reset password</Button>
        </form>
      </Modal>
    </>}
  </div>;
}
