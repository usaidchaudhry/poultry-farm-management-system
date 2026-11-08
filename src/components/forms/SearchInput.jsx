import { useId } from 'react';
import Icon from '../common/Icon.jsx';
import IconButton from '../common/IconButton.jsx';
import './forms.css';

// Controlled search box. onChange receives the text (not the event).
export default function SearchInput({ value, onChange, placeholder = 'Search...', label = 'Search', id }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className="control control--icon">
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <Icon name="search" size={16} className="control__icon" />
      <input
        id={inputId}
        type="search"
        className="control__input"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <IconButton icon="close" label="Clear search" size="sm" className="control__clear" onClick={() => onChange('')} />
      )}
    </div>
  );
}
