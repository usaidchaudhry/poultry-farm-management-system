import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Icon from '../common/Icon.jsx';
import { PERMISSIONS } from '../../config/permissions.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ActiveSelectionButton from '../../features/organization/ActiveSelectionButton.jsx';
import IconButton from '../common/IconButton.jsx';
import { workService } from '../../services/workService.js';
import { config } from '../../utils/config.js';
import Breadcrumbs from './Breadcrumbs.jsx';
import UserMenu from './UserMenu.jsx';
import { notificationService } from '../../services/notificationService.js';
import './layout.css';

export default function Topbar({ sidebarOpen, onMenuClick }) {
  const { hasPermission, user } = useAuth();
  const [, setRevision] = useState(0);
  const [unread, setUnread] = useState(0);
  const liveInbox = !config.isMock && hasPermission(PERMISSIONS.NOTIFICATIONS_VIEW);
  useEffect(() => {
    if (!liveInbox) { setUnread(0); return undefined; }
    let active = true; let sequence = 0;
    const refresh = async () => { if (document.hidden) return; const current = ++sequence; try { const value = await notificationService.unread(); if (active && current === sequence) setUnread(value.count); } catch { if (active && current === sequence) setUnread(0); } };
    void refresh(); const timer = setInterval(refresh, 30000);
    window.addEventListener('layerflow-notifications-changed', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('layerflow-notifications-changed', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [liveInbox, user.id, user.roleVersion, JSON.stringify(user.farmIds), JSON.stringify(user.siteIds)]);
  useEffect(() => { const update = () => setRevision((value) => value + 1); window.addEventListener('pms-work-changed', update); return () => window.removeEventListener('pms-work-changed', update); }, []);
  const openNotifications = config.isMock && hasPermission(PERMISSIONS.NOTIFICATIONS_VIEW) ? workService.list('notifications', { id: user.id, role: user.role }).filter((item) => item.status !== 'resolved').length : unread;

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
