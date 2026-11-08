import { mockOrganizationService } from './mock/mockOrganizationService.js';

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
export const organizationService = {
  getScopedHierarchy: (actor) => mockOrganizationService.getScopedHierarchy(actor),
  createEntity: (kind, data) => mockOrganizationService.createEntity(kind, data),
  updateEntity: (kind, id, data) => mockOrganizationService.updateEntity(kind, id, data),
  setArchived: (kind, id, archived) => mockOrganizationService.setArchived(kind, id, archived),
  listAssignments: () => mockOrganizationService.listAssignments(),
  setAssignment: (userId, scope) => mockOrganizationService.setAssignment(userId, scope),
};
