import { AuthProvider } from '../context/AuthContext.jsx';
import { FarmProvider } from '../context/FarmContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import AppRoutes from './routes.jsx';

// Root component. Providers wrap the routes so every page can use them.
// FarmProvider holds the organization data and the active site/farm/house/flock.
export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <FarmProvider>
          <AppRoutes />
        </FarmProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
