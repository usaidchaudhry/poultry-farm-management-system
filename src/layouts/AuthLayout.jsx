import { Outlet } from 'react-router-dom';
import BrandLogo from '../components/layout/BrandLogo.jsx';
import './layouts.css';

// Shell for login-related pages: brand panel on the left (hidden on small screens), form on the right.
export default function AuthLayout() {
  return (
    <div className="auth">
      <aside className="auth__brand">
        <BrandLogo />
        <div>
          <h2 className="auth__headline">Run every farm from one place.</h2>
          <p className="auth__sub">Daily reports, flock health, feed, eggs and finance, organized by role.</p>
        </div>
      </aside>
      <main className="auth__main">
        <div className="auth__card">
          <div className="auth__mobile-brand"><BrandLogo /></div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
