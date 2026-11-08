import { forwardRef, useId } from 'react';
import { cn } from '../../utils/classNames.js';
import FormField from './FormField.jsx';

const Textarea = forwardRef(function Textarea(
  { label, hint, error, required, id, className, disabled, rows = 4, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <FormField id={inputId} label={label} hint={hint} error={error} required={required} className={className}>
      <div className={cn('control', error && 'control--invalid', disabled && 'control--disabled')}>
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className="control__input"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      </div>
    </FormField>
  );
});

export default Textarea;
