import { useCallback, useEffect, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Modal from '../../components/common/Modal.jsx';
import Input from '../../components/forms/Input.jsx';
import Textarea from '../../components/forms/Textarea.jsx';
import Select from '../../components/forms/Select.jsx';
import Checkbox from '../../components/forms/Checkbox.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { PERMISSIONS as P } from '../../config/permissions.js';
import { roleService } from '../../services/roleService.js';
import { getErrorMessage } from '../../services/apiError.js';
import { config } from '../../utils/config.js';
import '../../features/users/users.css';
import './roles.css';

function RoleEditor({ role, permissions, onClose, onSave }) {
  const [values, setValues] = useState({ code: role?.code || '', name: role?.name || '', description: role?.description || '', scopeMode: role?.scopeMode || 'assigned', permissions: [...(role?.permissions || [])] });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const { hasPermission } = useAuth();
  const groups = permissions.reduce((result, code) => { (result[code.split('.')[0]] ||= []).push(code); return result; }, {});
  const change = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const toggle = (code, checked) => setValues((current) => ({ ...current, permissions: checked ? [...current.permissions, code] : current.permissions.filter((permission) => permission !== code) }));
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setFieldErrors({});
    try {
      const { code, ...editable } = values;
      if (role) await roleService.updateRole(role.id, { ...editable, version: role.version });
      else await roleService.createRole({ ...editable, code });
      await onSave();
    } catch (failure) { setError(getErrorMessage(failure)); setFieldErrors(failure.fieldErrors || {}); }
    finally { setBusy(false); }
  };
  return <Modal open title={role ? `Edit ${role.name}` : 'Create role'} description="Permissions grant actions; scope limits the records those actions can reach." size="lg" onClose={busy ? undefined : onClose}
    footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" form="role-editor" loading={busy}>Save role</Button></>}>
    <form id="role-editor" className="users__modal-body" onSubmit={submit}>
      {error && <Alert tone="error">{error}</Alert>}
      <Input label="Role name" required minLength={2} maxLength={100} value={values.name} onChange={change('name')} error={fieldErrors.name} />
      {!role && <Input label="Role code" required pattern="[a-z][a-z0-9_-]{2,49}" hint="3–50 lowercase letters, digits, underscores or hyphens; begin with a letter." value={values.code} onChange={change('code')} error={fieldErrors.code} />}
      <Textarea label="Description" maxLength={300} value={values.description} onChange={change('description')} error={fieldErrors.description} />
      <Select label="Scope" value={values.scopeMode} onChange={change('scopeMode')} options={[{ value: 'assigned', label: 'Assigned sites/farms' }, { value: 'company', label: 'Entire organization' }]} />
      <Alert tone="info">Organization-wide scope includes all farms. Assigned farm scopes will be configured in MERN Phase 3. Permissions for later modules take effect when those modules are connected.</Alert>
      <div className="roles__permission-groups">{Object.entries(groups).map(([group, codes]) => <fieldset key={group} className="roles__permission-group"><legend>{group}</legend>{codes.map((code) => <Checkbox key={code} label={code} checked={values.permissions.includes(code)} disabled={!hasPermission(code)} onChange={(event) => toggle(code, event.target.checked)} />)}</fieldset>)}</div>
    </form>
  </Modal>;
}

function LiveRolesPage() {
  const { hasPermission, refreshUser } = useAuth();
  const toast = useToast();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [definitions, catalog] = await Promise.all([roleService.listRoles(), roleService.permissions()]); setRoles(definitions); setPermissions(catalog); }
    catch (failure) { setError(getErrorMessage(failure)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const columns = [
    { key: 'name', header: 'Role', render: (row) => <div className="user-cell"><strong>{row.name}</strong><span className="text-muted">{row.code}</span></div> },
    { key: 'scopeMode', header: 'Scope', render: (row) => row.scopeMode === 'company' ? 'Entire organization' : 'Assigned sites/farms' },
    { key: 'permissions', header: 'Permissions', render: (row) => row.permissions.length },
    { key: 'actions', header: 'Actions', render: (row) => row.isProtected ? <Badge tone="neutral">Protected recovery role</Badge> : hasPermission(P.ROLES_MANAGE) ? <Button size="sm" variant="secondary" onClick={() => setEditor({ role: row })}>Edit {row.name}</Button> : 'Read only' },
  ];
  return <div className="roles__stack">
    <div className="roles__heading"><p className="text-muted">{roles.length} role templates</p>{hasPermission(P.ROLES_MANAGE) && <Button onClick={() => setEditor({ role: null })}>Create role</Button>}</div>
    <Alert tone="info">Role changes apply to existing sessions on their next protected request. The recovery role remains protected.</Alert>
    <Card padded={false}><DataTable caption="Roles" columns={columns} rows={roles} loading={loading} error={error} onRetry={load} emptyTitle="No roles found" /></Card>
    {editor && <RoleEditor role={editor.role} permissions={permissions} onClose={() => setEditor(null)} onSave={async () => { setEditor(null); await refreshUser(); await load(); toast.success('Role saved.'); }} />}
  </div>;
}

export default function RolesPage() {
  return config.isMock ? <EmptyState title="Role administration uses the API" description="Open LayerFlow in API mode to create or edit persistent roles. Mock mode retains the original demonstration role templates." /> : <LiveRolesPage />;
}
