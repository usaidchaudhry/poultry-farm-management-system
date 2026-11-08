import { useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import { getErrorMessage } from '../../services/apiError.js';
import './users.css';

export default function ScopeAssignModal({ open, user, sites, farms, assignment, onClose, onSubmit }) {
  const [siteIds, setSiteIds] = useState(assignment?.siteIds || []);
  const [farmIds, setFarmIds] = useState(assignment?.farmIds || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toggle = (items, setItems, id) => setItems(items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const save = async () => {
    setSaving(true);
    setError('');
    try { await onSubmit({ siteIds, farmIds }); }
    catch (err) { setError(getErrorMessage(err, 'Could not save access scope.')); setSaving(false); }
  };

  return <Modal open={open} onClose={saving ? undefined : onClose} title="Assign sites and farms" description={user ? `${user.name} (${user.email})` : ''} footer={<><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={save} loading={saving}>Save assignments</Button></>}>
    <div className="users__modal-body">
      {error && <Alert tone="error">{error}</Alert>}
      <p className="text-muted">Selecting a site gives access to all farms under it. Select individual farms to grant narrower access. An account with no assignment sees no organization records.</p>
      {!sites.some((site) => site.status === 'active') && <Alert tone="info">No active sites are available. Create a site under Organization first.</Alert>}
      {sites.filter((site) => site.status === 'active').map((site) => <fieldset key={site.id} className="users__scope-site">
        <legend>{site.name}</legend>
        <label className="users__scope-choice"><input type="checkbox" checked={siteIds.includes(site.id)} onChange={() => toggle(siteIds, setSiteIds, site.id)} /> Entire site</label>
        {farms.filter((farm) => farm.siteId === site.id && farm.status === 'active').map((farm) => <label className="users__scope-choice" key={farm.id}><input type="checkbox" checked={siteIds.includes(site.id) || farmIds.includes(farm.id)} disabled={siteIds.includes(site.id)} onChange={() => toggle(farmIds, setFarmIds, farm.id)} /> {farm.name}</label>)}
      </fieldset>)}
    </div>
  </Modal>;
}
