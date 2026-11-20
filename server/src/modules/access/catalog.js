import { ALL_PERMISSIONS, PERMISSIONS as P } from '../../../../src/config/permissions.js';
import { ROLE_PERMISSIONS, ROLE_INFO, ROLE_SCOPE } from '../../../../src/config/roles.js';

export { ALL_PERMISSIONS, P };
export const RECOVERY_PERMISSIONS = [P.USERS_VIEW, P.USERS_MANAGE, P.ROLES_VIEW, P.ROLES_MANAGE];
const extra = {
  owner: ALL_PERMISSIONS.filter((code) => code !== P.NOTIFICATIONS_MANAGE),
  production_manager: [P.NOTIFICATIONS_ACKNOWLEDGE, P.NOTIFICATIONS_RESPOND, P.NOTIFICATIONS_RESOLVE],
  farm_manager: [P.DAILY_REPORTS_SUBMIT, P.FEED_FORMULAS_SUBMIT, P.NOTIFICATIONS_RAISE, P.NOTIFICATIONS_ACKNOWLEDGE],
  operation_manager: [P.INVENTORY_ADJUST, P.INVENTORY_TRANSFER, P.FEED_FORMULAS_COST_VIEW, P.FEED_FORMULAS_FINALIZE, P.FEED_FORMULAS_RETURN, P.NOTIFICATIONS_ACKNOWLEDGE, P.NOTIFICATIONS_RESOLVE, P.REPORTS_EXPORT],
  doctor: [P.CLINICAL_HISTORY_VIEW, P.NOTIFICATIONS_ACKNOWLEDGE, P.NOTIFICATIONS_RESPOND, P.NOTIFICATIONS_RESOLVE],
};
export const DEFAULT_ROLES = Object.entries(ROLE_INFO).map(([code, info]) => ({
  code, name: info.label, description: info.description,
  scopeMode: ROLE_SCOPE[code] === 'all' ? 'company' : 'assigned',
  isProtected: code === 'owner',
  permissions: [...new Set([...(code === 'owner' ? [] : ROLE_PERMISSIONS[code].filter((permission) => permission !== P.NOTIFICATIONS_MANAGE)), ...extra[code]])],
}));
