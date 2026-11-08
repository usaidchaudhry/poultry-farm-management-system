import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader.jsx';
import Sidebar from '../components/layout/Sidebar.jsx';
import Topbar from '../components/layout/Topbar.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { getPageMeta } from '../utils/routeMeta.js';
import './layouts.css';

// Main application shell: sidebar + top bar + page header + the current page.
export default function DashboardLayout() {
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const page = getPageMeta(pathname);

  usePageTitle(page?.label || 'Page not found');

  // Close the mobile drawer after navigating
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Escape closes the drawer, and the page behind it does not scroll while it is open
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const handleKey = (event) => event.key === 'Escape' && setSidebarOpen(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [sidebarOpen]);

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Topbar sidebarOpen={sidebarOpen} onMenuClick={() => setSidebarOpen(true)} />
        <main className="app-content" id="main-content">
          {page && !page.isDeveloperPage && <PageHeader title={page.label} description={page.description} />}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
