import { useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import Select from '../../components/forms/Select.jsx';
import { ROLE_OPTIONS } from '../../config/roles.js';
import { getErrorMessage } from '../../services/apiError.js';
import RolePreview from './RolePreview.jsx';
import './users.css';

// Parent should give this a changing `key` each time it opens, so the form starts fresh.
// onSubmit(role) is async and throws if the change is refused.
export default function RoleAssignModal({ open, user, onClose, onSubmit }) {
  const [role, setRole] = useState(user?.role || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const unchanged = role === (user?.role || '');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await onSubmit(role || null);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not change the role.'));
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title="Change role"
      description={user ? `${user.name} (${user.email})` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={unchanged}>Save role</Button>
        </>
      }
    >
      <div className="users__modal-body">
        {error && <Alert tone="error">{error}</Alert>}
        <Select
          label="Role"
          placeholder="Unassigned (no access)"
          options={ROLE_OPTIONS}
          value={role}
          onChange={(event) => setRole(event.target.value)}
        />
        <RolePreview role={role} />
      </div>
    </Modal>
  );
}
