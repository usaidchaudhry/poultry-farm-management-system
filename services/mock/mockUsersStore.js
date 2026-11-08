import { SEED_USERS } from '../../mock/seedUsers.js';

// In-memory "users table" for the mock backend. Saved to localStorage so edits survive a page refresh.
const STORAGE_KEY = 'pms.mock.users.v1';

const clone = (value) => JSON.parse(JSON.stringify(value));

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let users = load() || clone(SEED_USERS);

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch {
    // storage unavailable: data lasts until the page reloads
  }
}

export const usersStore = {
  all: () => clone(users),
  findById: (id) => clone(users.find((u) => u.id === id) || null),
  findByEmail: (email) => clone(users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase()) || null),
  insert(record) {
    users = [...users, record];
    persist();
    return clone(record);
  },
  update(id, patch) {
    users = users.map((u) => (u.id === id ? { ...u, ...patch } : u));
    persist();
    return clone(users.find((u) => u.id === id));
  },
  // Developer helper: restores the seed users (call from the browser console if needed).
  reset() {
    users = clone(SEED_USERS);
    persist();
  },
};

// Strips the password before data leaves the "server".
export const toPublicUser = ({ password, ...rest }) => rest;
