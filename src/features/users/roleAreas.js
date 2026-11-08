import { getNavigation } from '../../config/navigation.js';
import { ROLE_PERMISSIONS } from '../../config/roles.js';

// Names of the menu areas a role can open. Used to preview what a role assignment does.
// (A real backend would return role definitions; here they come from config/roles.js.)
export function getAreasForRole(role) {
  if (!role) return [];
  const permissions = ROLE_PERMISSIONS[role] || [];
  return getNavigation((code) => permissions.includes(code)).flatMap((group) => group.items.map((item) => item.label));
}
