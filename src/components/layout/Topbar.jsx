import { Link } from 'react-router-dom';
import { PERMISSIONS } from '../../config/permissions.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ActiveSelectionButton from '../../features/organization/ActiveSelectionButton.jsx';
import IconButton from '../common/IconButton.jsx';
import Breadcrumbs from './Breadcrumbs.jsx';
import UserMenu from './UserMenu.jsx';
import './layout.css';

export default function Topbar({ sidebarOpen, onMenuClick }) {
  const { hasPermission } = useAuth();

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
            <IconButton icon="bell" label="Notifications" tabIndex={-1} />
          </Link>
        )}
        <UserMenu />
      </div>
    </header>
  );
}
