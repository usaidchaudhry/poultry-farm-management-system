import { cn } from '../../utils/classNames.js';
import Icon from './Icon.jsx';
import './Button.css';

// `label` is required: it is the accessible name and the hover tooltip.
export default function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  type = 'button',
  className,
  ...rest
}) {
  return (
    <button
      type={type}
      className={cn('btn', 'btn--icon', `btn--${variant}`, `btn--${size}`, className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={size === 'sm' ? 16 : 18} />
    </button>
  );
}
