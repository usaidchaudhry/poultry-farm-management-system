import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import ToastViewport from '../components/common/ToastViewport.jsx';

const ToastContext = createContext(null);
const MAX_TOASTS = 5;
let nextId = 1;

// Wrap the app once (see App.jsx). Then any component can call:
//   const toast = useToast();  toast.success('Saved');
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (tone, message, { title, duration = 4500 } = {}) => {
      const id = nextId;
      nextId += 1;
      setToasts((current) => [...current.slice(-(MAX_TOASTS - 1)), { id, tone, message, title }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (message, options) => show('success', message, options),
      error: (message, options) => show('error', message, options),
      warning: (message, options) => show('warning', message, options),
      info: (message, options) => show('info', message, options),
      dismiss,
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
