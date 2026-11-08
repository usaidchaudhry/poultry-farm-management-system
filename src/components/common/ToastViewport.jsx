import { cn } from '../../utils/classNames.js';
import Icon from './Icon.jsx';
import IconButton from './IconButton.jsx';
import './Toast.css';

const TONE_ICON = { success: 'checkCircle', error: 'xCircle', warning: 'alert', info: 'info' };

// Renders the stack of toasts. Created by ToastProvider; you rarely use it directly.
export default function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="toast-viewport" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn('toast', `toast--${toast.tone}`)}
          role={toast.tone === 'error' ? 'alert' : 'status'}
        >
          <Icon name={TONE_ICON[toast.tone]} size={20} className="toast__icon" />
          <div className="toast__content">
            {toast.title && <strong className="toast__title">{toast.title}</strong>}
            <span>{toast.message}</span>
          </div>
          <IconButton icon="close" label="Dismiss notification" size="sm" onClick={() => onDismiss(toast.id)} />
        </div>
      ))}
    </div>
  );
}
