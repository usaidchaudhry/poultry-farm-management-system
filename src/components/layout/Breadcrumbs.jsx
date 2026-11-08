import { Link, useLocation } from 'react-router-dom';
import { getBreadcrumbs } from '../../utils/routeMeta.js';
import Icon from '../common/Icon.jsx';
import './layout.css';

// Built automatically from the current URL and config/modules.js
export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const crumbs = getBreadcrumbs(pathname);

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`}>
              {isLast || !crumb.path ? (
                <span aria-current={isLast ? 'page' : undefined}>{crumb.label}</span>
              ) : (
                <Link to={crumb.path}>{crumb.label}</Link>
              )}
              {!isLast && <Icon name="chevronRight" size={14} className="breadcrumbs__sep" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
