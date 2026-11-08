import { useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import DateInput from '../../components/forms/DateInput.jsx';
import Input from '../../components/forms/Input.jsx';
import Select from '../../components/forms/Select.jsx';
import { ApiError, getErrorMessage } from '../../services/apiError.js';
import { positiveNumber, required } from '../../utils/validators.js';
import { ENTITY_LABELS, getFormFields } from './entityConfig.js';
import './organization.css';

/*
  One form for site / farm / house / flock, driven by entityConfig.js.
  parentOptions: [{ value, label }] for the parent select (create mode).
  Parent should give this a changing `key` each time it opens so the form starts fresh.
  onSubmit(values) is async and throws an ApiError if the server refuses.
*/
export default function EntityFormModal({ open, kind, mode, record, parentOptions = [], onClose, onSubmit }) {
  const fields = getFormFields(kind, mode);
  const label = ENTITY_LABELS[kind];
  const isCreate = mode === 'create';

  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((field) => [field.name, record?.[field.name] ?? '']))
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const missingParents = isCreate && fields.some((f) => f.type === 'parent') && parentOptions.length === 0;

  const setField = (name) => (event) => {
    setValues((current) => ({ ...current, [name]: event.target.value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: '' }));
  };

  const validate = () => {
    const next = {};
    fields.forEach((field) => {
      const value = values[field.name];
      if (field.required) next[field.name] = required(value, field.label);
      if (!next[field.name] && field.type === 'number' && String(value).trim() !== '') {
        next[field.name] = positiveNumber(value, field.label);
      }
    });
    return next;
  };

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
      else setFormError(getErrorMessage(error, `Could not save the ${label.toLowerCase()}.`));
      setSaving(false);
    }
  };

  const renderField = (field) => {
    const common = { key: field.name, label: field.label, required: field.required, hint: field.hint, error: errors[field.name], value: values[field.name], onChange: setField(field.name) };
    if (field.type === 'parent') return <Select {...common} placeholder={field.placeholder} options={parentOptions} />;
    if (field.type === 'select') return <Select {...common} placeholder={field.placeholder} options={field.options} />;
    if (field.type === 'date') return <DateInput {...common} />;
    if (field.type === 'number') return <Input {...common} type="number" min="0" step="1" />;
    return <Input {...common} autoComplete="off" />;
  };

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={isCreate ? `Add ${label.toLowerCase()}` : `Edit ${label.toLowerCase()}`}
      description={isCreate ? undefined : record?.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="org-form" loading={saving} disabled={missingParents}>
            {isCreate ? `Create ${label.toLowerCase()}` : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="org-form" className="org__form" onSubmit={handleSubmit} noValidate>
        {missingParents && <Alert tone="warning">There is no active parent record to add this under. Create or restore one first.</Alert>}
        {formError && <Alert tone="error">{formError}</Alert>}
        {fields.map(renderField)}
        {!isCreate && <p className="text-muted">The parent of a record cannot be changed after it is created.</p>}
      </form>
    </Modal>
  );
}
