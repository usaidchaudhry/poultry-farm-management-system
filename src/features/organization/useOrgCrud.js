import { useState } from 'react';
import { useFarm } from '../../context/FarmContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { getErrorMessage } from '../../services/apiError.js';
import { organizationService } from '../../services/organizationService.js';
import { ENTITY_LABELS } from './entityConfig.js';

// Create / edit / view / archive / restore logic shared by the Sites, Farms, Houses and Flocks pages.
export default function useOrgCrud(kind) {
  const toast = useToast();
  const { refresh } = useFarm();
  const label = ENTITY_LABELS[kind];

  // `key` changes on every open so the form starts fresh
  const [form, setForm] = useState({ open: false, mode: 'create', record: null, key: 0 });
  const [details, setDetails] = useState({ open: false, record: null });
  const [archiving, setArchiving] = useState(null);
  const [busy, setBusy] = useState(false);

  const openCreate = () => setForm((f) => ({ open: true, mode: 'create', record: null, key: f.key + 1 }));
  const openEdit = (record) => setForm((f) => ({ open: true, mode: 'edit', record, key: f.key + 1 }));
  const closeForm = () => setForm((f) => ({ ...f, open: false }));
  const openDetails = (record) => setDetails({ open: true, record });
  const closeDetails = () => setDetails((d) => ({ ...d, open: false }));

  const submitForm = async (values) => {
    if (form.mode === 'create') {
      const created = await organizationService.createEntity(kind, values);
      toast.success(`${label} "${created.name}" was created.`);
    } else {
      const updated = await organizationService.updateEntity(kind, form.record.id, values);
      toast.success(`${label} "${updated.name}" was updated.`);
    }
    await refresh();
    closeForm();
  };

  const restore = async (record) => {
    try {
      await organizationService.setArchived(kind, record.id, false);
      toast.success(`${label} "${record.name}" was restored.`);
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, `Could not restore the ${label.toLowerCase()}.`));
    }
  };

  const confirmArchive = async () => {
    setBusy(true);
    try {
      await organizationService.setArchived(kind, archiving.id, true);
      toast.success(`${label} "${archiving.name}" was archived.`);
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, `Could not archive the ${label.toLowerCase()}.`));
    } finally {
      setBusy(false);
      setArchiving(null);
    }
  };

  return {
    kind,
    label,
    form,
    details,
    archiving,
    busy,
    openCreate,
    openEdit,
    closeForm,
    openDetails,
    closeDetails,
    submitForm,
    requestArchive: setArchiving,
    cancelArchive: () => setArchiving(null),
    confirmArchive,
    restore,
  };
}
