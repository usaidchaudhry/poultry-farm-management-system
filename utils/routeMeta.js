import { matchPath } from 'react-router-dom';
import { ALL_PAGES } from '../config/modules.js';

const HOME = { label: 'Dashboard', path: '/dashboard' };

// Finds the page definition for a URL. Supports patterns such as '/organization/farms/:id'
// if a later phase adds them to modules.js.
export function getPageMeta(pathname) {
  return ALL_PAGES.find((page) => matchPath({ path: page.path, end: true }, pathname)) || null;
}

// Breadcrumb trail: Dashboard > Parent > Current page.
export function getBreadcrumbs(pathname) {
  const page = getPageMeta(pathname);
  if (!page) return [HOME, { label: 'Page not found' }];

  const trail = [{ label: page.label }];
  let parentPath = page.parent;
  while (parentPath) {
    const parent = ALL_PAGES.find((item) => item.path === parentPath);
    if (!parent) break;
    trail.unshift({ label: parent.label, path: parent.path });
    parentPath = parent.parent;
  }

  if (page.path !== HOME.path) trail.unshift(HOME);
  else return [{ label: HOME.label }];
  return trail;
}
