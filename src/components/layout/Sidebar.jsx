import { NavLink, useLocation } from 'react-router-dom';
import { getNavigation } from '../../config/navigation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { cn } from '../../utils/classNames.js';
import Icon from '../common/Icon.jsx';
import IconButton from '../common/IconButton.jsx';
import BrandLogo from './BrandLogo.jsx';
import './layout.css';

const linkClass = ({ isActive }) => cn('nav-link', isActive && 'nav-link--active');

// Permanent on desktop, slide-in drawer on tablet and mobile (controlled by `open`).
export default function Sidebar({ open, onClose }) {
  const { hasPermission } = useAuth();
  const { pathname } = useLocation();
  const groups = getNavigation(hasPermission);

  return (
    <>
      <div className={cn('sidebar-overlay', open && 'sidebar-overlay--visible')} onClick={onClose} aria-hidden="true" />
      <aside id="app-sidebar" className={cn('sidebar', open && 'sidebar--open')} aria-label="Main navigation">
        <div className="sidebar__header">
          <BrandLogo />
          <IconButton icon="close" label="Close menu" size="sm" className="sidebar__close" onClick={onClose} />
        </div>

        <nav className="sidebar__nav">
          {groups.map((group) => (
            <div key={group.label} className="nav-group">
              <p className="nav-group__label">{group.label}</p>
              <ul className="nav-list">
                {group.items.map((item) => {
                  const expanded = item.children.length > 0 && pathname.startsWith(item.path);
                  return (
                    <li key={item.key}>
                      <NavLink to={item.path} className={linkClass}>
                        <Icon name={item.icon} size={18} />
                        <span>{item.label}</span>
                        {item.children.length > 0 && (
                          <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={14} className="nav-link__chevron" />
                        )}
                      </NavLink>
                      {expanded && (
                        <ul className="nav-sublist">
                          {item.children.map((child) => (
                            <li key={child.key}>
                              <NavLink to={child.path} className={linkClass}>
                                <span>{child.label}</span>
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
