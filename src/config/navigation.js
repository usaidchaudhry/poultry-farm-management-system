import { MODULES, NAV_GROUPS } from './modules.js';

/*
  Builds the sidebar from modules.js, keeping only what the current user may see.
  Returns: [{ label: 'Overview', items: [{ ...module, children: [...] }] }]
*/
export function getNavigation(hasPermission) {
  const canSee = (page) => !page.permission || hasPermission(page.permission);

  return NAV_GROUPS.map((group) => ({
    label: group,
    items: MODULES.filter((module) => module.group === group && canSee(module)).map((module) => ({
      ...module,
      children: (module.children || []).filter(canSee),
    })),
  })).filter((group) => group.items.length > 0);
}
