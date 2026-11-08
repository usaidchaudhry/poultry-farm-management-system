import { useId } from 'react';
import './forms.css';

// On/off toggle, e.g. account active / inactive. onChange receives the new boolean value.
export default function Switch({ checked, onChange, label, disabled = false, id }) {
  const autoId = useId();
  const switchId = id || autoId;
  return (
    <div className="switch">
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        className="switch__track"
        disabled={disabled}
        onClick={() => onChange(!checked)}
      />
      {label && <label htmlFor={switchId}>{label}</label>}
    </div>
  );
}
