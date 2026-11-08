import { cn } from '../../utils/classNames.js';
import './forms.css';

// Wrapper that adds the label, hint and error message around any control.
export default function FormField({ id, label, hint, error, required, className, children }) {
  return (
    <div className={cn('field', className)}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
          {required && <span className="field__required" aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="field__message field__message--error" id={`${id}-error`} role="alert">{error}</p>
      ) : (
        hint && <p className="field__message" id={`${id}-hint`}>{hint}</p>
      )}
    </div>
  );
}
