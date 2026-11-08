import { useState } from 'react';
import Button from '../../components/common/Button.jsx';
import Card from '../../components/common/Card.jsx';
import Checkbox from '../../components/forms/Checkbox.jsx';
import DateInput from '../../components/forms/DateInput.jsx';
import Input from '../../components/forms/Input.jsx';
import SearchInput from '../../components/forms/SearchInput.jsx';
import Select from '../../components/forms/Select.jsx';
import Switch from '../../components/forms/Switch.jsx';
import Textarea from '../../components/forms/Textarea.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { positiveNumber, required } from '../../utils/validators.js';
import { STATUS_OPTIONS } from './demoData.js';

const INITIAL = { name: '', status: '', date: '', birds: '', notes: '', confirm: false, active: true };

export default function FormsSection() {
  const toast = useToast();
  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState('');

  const setField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validate = () => ({
    name: required(values.name, 'Name'),
    status: required(values.status, 'Status'),
    date: required(values.date, 'Date'),
    birds: positiveNumber(values.birds, 'Bird count'),
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      toast.error('Fix the highlighted fields and try again.');
      return;
    }
    toast.success('Form is valid and was saved (demo only).', { title: 'Saved' });
    setValues(INITIAL);
  };

  return (
    <Card title="Form controls" subtitle="Press Save with empty fields to see validation messages">
      <form className="ds__form" onSubmit={handleSubmit} noValidate>
        <Input label="Name" required placeholder="e.g. Flock 024" value={values.name} onChange={setField('name')} error={errors.name} />
        <Select label="Status" required placeholder="Select a status" options={STATUS_OPTIONS} value={values.status} onChange={setField('status')} error={errors.status} />
        <DateInput label="Placement date" required value={values.date} onChange={setField('date')} error={errors.date} hint="Use the date picker" />
        <Input label="Number of birds" required type="number" min="0" placeholder="0" value={values.birds} onChange={setField('birds')} error={errors.birds} />
        <Textarea className="ds__wide" label="Notes" placeholder="Optional remarks" value={values.notes} onChange={setField('notes')} />
        <div className="ds__wide ds__stack">
          <Checkbox label="I have checked the details above" checked={values.confirm} onChange={setField('confirm')} />
          <Switch label={values.active ? 'Record is active' : 'Record is inactive'} checked={values.active} onChange={(next) => setValues((c) => ({ ...c, active: next }))} />
        </div>
        <div className="ds__wide ds__row">
          <Button type="submit">Save</Button>
          <Button variant="secondary" onClick={() => { setValues(INITIAL); setErrors({}); }}>Reset</Button>
        </div>
      </form>

      <div className="ds__divider" />
      <SearchInput value={search} onChange={setSearch} placeholder="Search farms, houses or flocks" />
    </Card>
  );
}
