import { forwardRef, useId } from 'react';
import { cn } from '../../utils/classNames.js';
import Icon from '../common/Icon.jsx';
import FormField from './FormField.jsx';

// options: [{ value: 'abc', label: 'ABC' }]. `placeholder` adds an empty first option.
const Select = forwardRef(function Select(
  { label, hint, error, required, id, className, disabled, options = [], placeholder, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <FormField id={inputId} label={label} hint={hint} error={error} required={required} className={className}>
      <div className={cn('control', error && 'control--invalid', disabled && 'control--disabled')}>
        <select
          ref={ref}
          id={inputId}
          className="control__input"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <Icon name="chevronDown" size={16} className="control__chevron" />
      </div>
    </FormField>
  );
});

export default Select;
