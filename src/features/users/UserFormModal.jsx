import { useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import Input from '../../components/forms/Input.jsx';
import Select from '../../components/forms/Select.jsx';
import Switch from '../../components/forms/Switch.jsx';
import { ROLE_OPTIONS } from '../../config/roles.js';
import { ApiError, getErrorMessage } from '../../services/apiError.js';
import { email as emailRule, minLength, required } from '../../utils/validators.js';
import RolePreview from './RolePreview.jsx';
import './users.css';

/*
  mode 'create': name, email, temporary password, role, active switch
  mode 'edit':   name and email only (role and active status have their own actions in the table)
  Parent should give this a changing `key` each time it opens so the form starts fresh.
  onSubmit(values) is async and throws an ApiError if the server refuses (e.g. duplicate email).
*/
export default function UserFormModal({ open, mode, user, onClose, onSubmit }) {
  const isCreate = mode === 'create';
  const [values, setValues] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: '',
    isActive: true,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const setField = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validate = () => ({
    name: required(values.name, 'Full name') || minLength(values.name, 2, 'Full name'),
    email: required(values.email, 'Email') || emailRule(values.email),
    password: isCreate ? required(values.password, 'Password') || minLength(values.password, 8, 'Password') : '',
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSaving(true);
    setFormError('');
    try {
      await onSubmit(values);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors((current) => ({ ...current, ...error.fieldErrors }));
      else setFormError(getErrorMessage(error, 'Could not save the user.'));
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={isCreate ? 'Add user' : 'Edit user'}
      description={isCreate ? 'Create an account and optionally assign a role.' : 'Update the name or email of this account.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="user-form" loading={saving}>{isCreate ? 'Create user' : 'Save changes'}</Button>
        </>
      }
    >
      <form id="user-form" className="users__modal-body" onSubmit={handleSubmit} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Input label="Full name" required value={values.name} onChange={setField('name')} error={errors.name} autoComplete="off" />
        <Input label="Email" type="email" required value={values.email} onChange={setField('email')} error={errors.email} autoComplete="off" />
        {isCreate && (
          <>
            <Input
              label="Temporary password"
              type="password"
              required
              hint="At least 8 characters. Share it with the user securely."
              value={values.password}
              onChange={setField('password')}
              error={errors.password}
              autoComplete="new-password"
            />
            <Select
              label="Role"
              placeholder="Unassigned (no access)"
              options={ROLE_OPTIONS}
              value={values.role}
              onChange={setField('role')}
            />
            <RolePreview role={values.role} />
            <Switch
              label={values.isActive ? 'Account is active' : 'Account is inactive'}
              checked={values.isActive}
              onChange={(next) => setValues((current) => ({ ...current, isActive: next }))}
            />
          </>
        )}
      </form>
    </Modal>
  );
}
