import { forwardRef, useId } from 'react';
import { cn } from '../../utils/classNames.js';
import Icon from '../common/Icon.jsx';
import FormField from './FormField.jsx';

// Text-like input (text, email, password, number...). Shows label, hint and error message.
const Input = forwardRef(function Input(
  { label, hint, error, required, leftIcon, id, className, type = 'text', disabled, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <FormField id={inputId} label={label} hint={hint} error={error} required={required} className={className}>
      <div className={cn('control', leftIcon && 'control--icon', error && 'control--invalid', disabled && 'control--disabled')}>
        {leftIcon && <Icon name={leftIcon} size={16} className="control__icon" />}
        <input
          ref={ref}
          id={inputId}
          type={type}
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

export default Input;
