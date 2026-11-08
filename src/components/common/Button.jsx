import { cn } from '../../utils/classNames.js';
import Icon from './Icon.jsx';
import Spinner from './Spinner.jsx';
import './Button.css';

// variant: primary | secondary | ghost | danger     size: sm | md | lg
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  type = 'button',
  className,
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={cn('btn', `btn--${variant}`, `btn--${size}`, fullWidth && 'btn--full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={16} label="Working" /> : leftIcon && <Icon name={leftIcon} size={16} />}
      <span>{children}</span>
      {!loading && rightIcon && <Icon name={rightIcon} size={16} />}
    </button>
  );
}
