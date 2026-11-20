import { mockOrganizationService } from './mock/mockOrganizationService.js';
import { config } from '../utils/config.js';
import api from './api.js';

/*
  The UI imports ONLY this file for organization data. API is the default; mocks are explicit.
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

const liveFacade = {
  async getScopedHierarchy() { return (await api.get('/organization/hierarchy')).data.data; },
  async createEntity(kind, data) { return (await api.post(`/organization/${kind}s`, normalize(data))).data.data; },
  async updateEntity(kind, id, data) { return (await api.patch(`/organization/${kind}s/${id}`, normalize(data))).data.data; },
  async setArchived(kind, id, archived, options) { return (await api.patch(`/organization/${kind}s/${id}/status`, { archived, version: options.version })).data.data; },
  async listAssignments() { return (await api.get('/organization/assignments')).data.data; },
  async setAssignment(id, scope, options) { return (await api.put(`/users/${id}/scope`, { ...scope, version: options.version })).data.data; },
};
function normalize(data) {
  const result = { ...data };
  if ('capacity' in result) result.capacity = result.capacity === '' ? null : Number(result.capacity);
  if ('initialCount' in result) result.initialCount = Number(result.initialCount);
  if ('ageAtPlacementDays' in result) result.ageAtPlacementDays = result.ageAtPlacementDays === '' ? null : Number(result.ageAtPlacementDays);
  return result;
}
export const organizationService = Object.fromEntries(Object.keys(mockFacade).map((name) => [name, (...args) => (config.isMock ? mockFacade : liveFacade)[name](...args)]));
