import { COMPANY } from '../../mock/seedOrganization.js';
import { hasCompanyWideScope } from '../../config/roles.js';
import { ApiError } from '../apiError.js';
import { delay } from './delay.js';
import { orgStore } from './mockOrgStore.js';

/*
  Describes each level of the hierarchy.
  parentKey:  field holding the parent's id (null for sites)
  childKey:   field on the child records that points back to this level
  editable:   fields that may change after creation (the parent never changes)
*/
const KINDS = {
  site: { collection: 'sites', label: 'Site', parentKey: null, childCollection: 'farms', childKey: 'siteId', childLabel: 'farms', editable: ['name', 'location'] },
  farm: { collection: 'farms', label: 'Farm', parentKey: 'siteId', parentKind: 'site', childCollection: 'houses', childKey: 'farmId', childLabel: 'houses', editable: ['name'] },
  house: { collection: 'houses', label: 'House', parentKey: 'farmId', parentKind: 'farm', childCollection: 'flocks', childKey: 'houseId', childLabel: 'flocks', editable: ['name', 'capacity'] },
  flock: { collection: 'flocks', label: 'Flock', parentKey: 'houseId', parentKind: 'house', childCollection: null, editable: ['name', 'placementDate', 'initialCount', 'birdType'] },
};

const getKind = (kind) => {
  if (!KINDS[kind]) throw new ApiError('Unknown record type.', { code: 'INVALID_KIND', status: 400 });
  return KINDS[kind];
};

const toNumberOrNull = (value) => (value === '' || value === null || value === undefined ? null : Number(value));
const makeId = (kind) => `${kind.slice(0, 2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Cleans raw form input into the shape that is stored
function normalize(kind, data) {
  const out = {};
  if ('name' in data) out.name = String(data.name || '').trim();
  if (kind === 'site' && 'location' in data) out.location = String(data.location || '').trim();
  if (kind === 'house' && 'capacity' in data) out.capacity = toNumberOrNull(data.capacity);
  if (kind === 'flock') {
    if ('placementDate' in data) out.placementDate = data.placementDate || '';
    if ('initialCount' in data) out.initialCount = toNumberOrNull(data.initialCount);
    if ('birdType' in data) out.birdType = data.birdType || '';
  }
  return out;
}

function validate(kind, values, { isCreate, parentId }) {
  const errors = {};
  if (!values.name) errors.name = 'Name is required.';
  if (isCreate && KINDS[kind].parentKey && !parentId) errors[KINDS[kind].parentKey] = `Select a parent ${KINDS[kind].parentKind}.`;
  if (kind === 'house' && values.capacity !== null && values.capacity !== undefined && !(values.capacity > 0)) {
    errors.capacity = 'Capacity must be a number greater than 0.';
  }
  if (kind === 'flock') {
    if (!values.placementDate) errors.placementDate = 'Placement date is required.';
    if (!(values.initialCount > 0) || !Number.isInteger(values.initialCount)) errors.initialCount = 'Enter a whole number greater than 0.';
  }
  if (Object.keys(errors).length) throw new ApiError('Please fix the highlighted fields.', { code: 'VALIDATION', status: 400, fieldErrors: errors });
}

// Names are unique within the same parent (ASSUMPTION, see PROGRESS.md). Sites are unique company-wide.
function assertUniqueName(kind, name, parentId, ignoreId) {
  const cfg = KINDS[kind];
  const clash = orgStore
    .all(cfg.collection)
    .some((item) => item.id !== ignoreId && (!cfg.parentKey || item[cfg.parentKey] === parentId) && item.name.toLowerCase() === name.toLowerCase());
  if (clash) {
    throw new ApiError('Name already in use.', { code: 'DUPLICATE_NAME', status: 409, fieldErrors: { name: `A ${cfg.label.toLowerCase()} with this name already exists here.` } });
  }
}

function getOrThrow(kind, id) {
  const record = orgStore.find(getKind(kind).collection, id);
  if (!record) throw new ApiError(`${KINDS[kind].label} not found.`, { code: 'NOT_FOUND', status: 404 });
  return record;
}

export const mockOrganizationService = {
  /*
    Everything the signed-in user may see (archived records included, so managers can restore them).
    Company-wide roles get all records; other roles get only their assigned sites/farms and what is below them.
    `actor` is { id, role }. A real API derives it from the auth token.
  */
  async getScopedHierarchy(actor) {
    await delay(400);
    const sites = orgStore.all('sites');
    const farms = orgStore.all('farms');
    const houses = orgStore.all('houses');
    const flocks = orgStore.all('flocks');

    if (hasCompanyWideScope(actor.role)) return { company: COMPANY, sites, farms, houses, flocks };

    const assignment = orgStore.assignments()[actor.id] || { siteIds: [], farmIds: [] };
    const scopedFarms = farms.filter((farm) => assignment.siteIds.includes(farm.siteId) || assignment.farmIds.includes(farm.id));
    const farmIds = new Set(scopedFarms.map((farm) => farm.id));
    const scopedHouses = houses.filter((house) => farmIds.has(house.farmId));
    const houseIds = new Set(scopedHouses.map((house) => house.id));
    const siteIds = new Set(scopedFarms.map((farm) => farm.siteId));
    return {
      company: COMPANY,
      sites: sites.filter((site) => siteIds.has(site.id)),
      farms: scopedFarms,
      houses: scopedHouses,
      flocks: flocks.filter((flock) => houseIds.has(flock.houseId)),
    };
  },

  async createEntity(kind, data) {
    await delay(500);
    const cfg = getKind(kind);
    const parentId = cfg.parentKey ? data[cfg.parentKey] : null;
    const values = normalize(kind, data);
    validate(kind, values, { isCreate: true, parentId });

    if (cfg.parentKey) {
      const parent = getOrThrow(cfg.parentKind, parentId);
      if (parent.status === 'archived') {
        throw new ApiError(`The selected ${cfg.parentKind} is archived. Restore it first.`, { code: 'PARENT_ARCHIVED', status: 409, fieldErrors: { [cfg.parentKey]: 'This parent is archived.' } });
      }
    }
    assertUniqueName(kind, values.name, parentId);

    const now = new Date().toISOString();
    const record = { id: makeId(kind), ...(cfg.parentKey ? { [cfg.parentKey]: parentId } : {}), ...values, status: 'active', createdAt: now, updatedAt: now };
    return orgStore.insert(cfg.collection, record);
  },

  async updateEntity(kind, id, data) {
    await delay(500);
    const cfg = getKind(kind);
    const existing = getOrThrow(kind, id);
    const values = normalize(kind, Object.fromEntries(Object.entries(data).filter(([key]) => cfg.editable.includes(key))));
    const merged = { ...existing, ...values };
    validate(kind, merged, { isCreate: false });
    assertUniqueName(kind, merged.name, cfg.parentKey ? existing[cfg.parentKey] : null, id);
    return orgStore.update(cfg.collection, id, { ...values, updatedAt: new Date().toISOString() });
  },

  // Archive or restore (nothing is ever deleted)
  async setArchived(kind, id, archived) {
    await delay(450);
    const cfg = getKind(kind);
    const record = getOrThrow(kind, id);

    if (archived && cfg.childCollection) {
      const activeChildren = orgStore.all(cfg.childCollection).filter((child) => child[cfg.childKey] === id && child.status === 'active');
      if (activeChildren.length > 0) {
        throw new ApiError(`"${record.name}" still has ${activeChildren.length} active ${cfg.childLabel}. Archive them first.`, { code: 'HAS_ACTIVE_CHILDREN', status: 409 });
      }
    }
    if (!archived && cfg.parentKey) {
      const parent = orgStore.find(KINDS[cfg.parentKind].collection, record[cfg.parentKey]);
      if (parent && parent.status === 'archived') {
        throw new ApiError(`Restore the ${cfg.parentKind} "${parent.name}" first.`, { code: 'PARENT_ARCHIVED', status: 409 });
      }
    }
    const now = new Date().toISOString();
    return orgStore.update(cfg.collection, id, archived ? { status: 'archived', archivedAt: now, updatedAt: now } : { status: 'active', archivedAt: null, updatedAt: now });
  },

  async listAssignments() {
    await delay(250);
    return orgStore.assignments();
  },

  async setAssignment(userId, { siteIds = [], farmIds = [] }) {
    await delay(450);
    const validSites = new Set(orgStore.all('sites').map((site) => site.id));
    const validFarms = new Set(orgStore.all('farms').map((farm) => farm.id));
    return orgStore.setAssignment(userId, {
      siteIds: siteIds.filter((id) => validSites.has(id)),
      farmIds: farmIds.filter((id) => validFarms.has(id)),
    });
  },
};
