import { cn } from '../../utils/classNames.js';
import Icon from './Icon.jsx';
import './Alert.css';

const TONE_ICON = { error: 'xCircle', warning: 'alert', info: 'info', success: 'checkCircle' };

// Inline message box for form errors and notices. tone: error | warning | info | success
export default function Alert({ tone = 'info', title, children }) {
  return (
    <div className={cn('alert', `alert--${tone}`)} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={TONE_ICON[tone]} size={18} className="alert__icon" />
      <div>
        {title && <strong className="alert__title">{title}</strong>}
        <span>{children}</span>
      </div>
    </div>
  );
}
