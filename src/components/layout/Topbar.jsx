import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Icon from '../common/Icon.jsx';
import { PERMISSIONS } from '../../config/permissions.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ActiveSelectionButton from '../../features/organization/ActiveSelectionButton.jsx';
import IconButton from '../common/IconButton.jsx';
import { workService } from '../../services/workService.js';
import Breadcrumbs from './Breadcrumbs.jsx';
import UserMenu from './UserMenu.jsx';
import './layout.css';

export default function Topbar({ sidebarOpen, onMenuClick }) {
  const { hasPermission, user } = useAuth();
  const [, setRevision] = useState(0);
  useEffect(() => { const update = () => setRevision((value) => value + 1); window.addEventListener('pms-work-changed', update); return () => window.removeEventListener('pms-work-changed', update); }, []);
  const openNotifications = hasPermission(PERMISSIONS.NOTIFICATIONS_VIEW) ? workService.list('notifications', { id: user.id, role: user.role }).filter((item) => item.status !== 'resolved').length : 0;

  return (
    <header className="topbar">
      <IconButton
        icon="menu"
        label="Open menu"
        className="topbar__menu"
        onClick={onMenuClick}
        aria-expanded={sidebarOpen}
        aria-controls="app-sidebar"
      />
      <div className="topbar__crumbs">
        <Breadcrumbs />
      </div>
      <div className="topbar__right">
        {hasPermission(PERMISSIONS.ORGANIZATION_VIEW) && <ActiveSelectionButton />}
        {hasPermission(PERMISSIONS.NOTIFICATIONS_VIEW) && (
          <Link to="/notifications" className="topbar__bell" aria-label="Notifications">
            <Icon name="bell" size={18} />{openNotifications > 0 && <span className="topbar__bell-count">{openNotifications}</span>}
          </Link>
        )}
        <UserMenu />
      </div>
    </header>
  );
}
