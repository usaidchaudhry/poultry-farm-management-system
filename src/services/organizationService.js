import { mockOrganizationService } from './mock/mockOrganizationService.js';
import { config } from '../utils/config.js';
import { ApiError } from './apiError.js';

/*
  The UI imports ONLY this file for organization data. Swap the bodies for Axios calls later.
  kind is 'site' | 'farm' | 'house' | 'flock'.
    getScopedHierarchy(actor)       -> { company, sites, farms, houses, flocks }  (flat arrays with parent ids)
    createEntity(kind, data)        -> record
    updateEntity(kind, id, data)    -> record
    setArchived(kind, id, archived) -> record
    listAssignments()               -> { [userId]: { siteIds, farmIds } }
    setAssignment(userId, scope)    -> { siteIds, farmIds }
*/
const mockFacade = {
  getScopedHierarchy: (actor) => mockOrganizationService.getScopedHierarchy(actor),
  createEntity: (kind, data, actor) => mockOrganizationService.createEntity(kind, data, actor),
  updateEntity: (kind, id, data, actor) => mockOrganizationService.updateEntity(kind, id, data, actor),
  setArchived: (kind, id, archived, actor) => mockOrganizationService.setArchived(kind, id, archived, actor),
  listAssignments: () => mockOrganizationService.listAssignments(),
  setAssignment: (userId, scope, actor) => mockOrganizationService.setAssignment(userId, scope, actor),
};

// Live organization CRUD/assignments belong to MERN Phase 3. Calls cannot
// silently read or mutate browser mocks under a real server-authenticated user.
export const organizationService = Object.fromEntries(Object.entries(mockFacade).map(([name, method]) => [name, (...args) => {
  if (config.isMock) return method(...args);
  return Promise.reject(new ApiError('Organization integration is scheduled for MERN Phase 3.', { code: 'PHASE_NOT_IMPLEMENTED', status: 501 }));
}]));
