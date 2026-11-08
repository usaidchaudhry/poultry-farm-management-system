import { SEED_ORG } from '../../mock/seedOrganization.js';

// In-memory "organization database" for the mock backend, saved to localStorage.
const STORAGE_KEY = 'pms.mock.org.v1';
const clone = (value) => JSON.parse(JSON.stringify(value));

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let data = load() || clone(SEED_ORG);

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage unavailable: data lasts until the page reloads
  }
}

export const orgStore = {
  all: (collection) => clone(data[collection]),
  find: (collection, id) => clone(data[collection].find((item) => item.id === id) || null),
  insert(collection, record) {
    data[collection] = [...data[collection], record];
    persist();
    return clone(record);
  },
  update(collection, id, patch) {
    data[collection] = data[collection].map((item) => (item.id === id ? { ...item, ...patch } : item));
    persist();
    return clone(data[collection].find((item) => item.id === id));
  },
  assignments: () => clone(data.assignments),
  setAssignment(userId, value) {
    data.assignments = { ...data.assignments, [userId]: value };
    persist();
    return clone(value);
  },
  // Developer helper: restore the seed data
  reset() {
    data = clone(SEED_ORG);
    persist();
  },
};
