import { forwardRef, useId } from 'react';
import './forms.css';

const Checkbox = forwardRef(function Checkbox({ label, hint, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className="field">
      <label className="check" htmlFor={inputId}>
        <input ref={ref} id={inputId} type="checkbox" aria-describedby={hint ? `${inputId}-hint` : undefined} {...rest} />
        <span>{label}</span>
      </label>
      {hint && <p className="field__message" id={`${inputId}-hint`}>{hint}</p>}
    </div>
  );
});

export default Checkbox;
