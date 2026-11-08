import { ROLES } from '../config/roles.js';

// MOCK DATA ONLY. Passwords are plain text here because there is no backend.
// A real backend never returns or stores passwords like this.
export const DEMO_PASSWORD = 'Poultry@123';

const user = (id, name, email, role, extra = {}) => ({
  id,
  name,
  email,
  password: DEMO_PASSWORD,
  role,
  isActive: true,
  createdAt: '2026-08-01T09:00:00.000Z',
  lastLoginAt: null,
  ...extra,
});

export const SEED_USERS = [
  user('u1', 'Hamza Raza', 'owner@poultry.test', ROLES.OWNER),
  user('u2', 'Sana Malik', 'production@poultry.test', ROLES.PRODUCTION_MANAGER),
  user('u3', 'Bilal Ahmed', 'farm@poultry.test', ROLES.FARM_MANAGER),
  user('u4', 'Areeba Noor', 'operations@poultry.test', ROLES.OPERATION_MANAGER),
  user('u5', 'Dr. Usman Tariq', 'doctor@poultry.test', ROLES.DOCTOR),
  user('u6', 'Imran Shah', 'imran@poultry.test', ROLES.FARM_MANAGER),
  user('u7', 'Dr. Kamran Ali', 'kamran@poultry.test', ROLES.DOCTOR, { isActive: false }),
  user('u8', 'Zoya Khan', 'zoya@poultry.test', null), // unassigned: sees the pending-access screen
];

// Shown in the login screen's "demo accounts" helper. Remove that helper before a real deployment.
export const DEMO_LOGINS = SEED_USERS.filter((u) => ['u1', 'u2', 'u3', 'u4', 'u5', 'u7', 'u8'].includes(u.id)).map(
  (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive })
);
