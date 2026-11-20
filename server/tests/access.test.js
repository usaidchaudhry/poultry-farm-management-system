import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { readConfig } from '../src/config/env.js';
import { connectDatabase, mongoose, transaction } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import { applyMigrations } from '../src/scripts/migrations.js';
import { bootstrapOwner } from '../src/scripts/bootstrap-service.js';
import { User, Role, AuditEvent, SecurityGuard, models } from '../src/modules/access/models.js';
import { idempotentWrite } from '../src/lib/idempotency.js';
import { businessDate, allowedDateRange } from '../src/policies/dates.js';
import { assertScope, assertIndependentAdministrator } from '../src/policies/access.js';
import { money } from '../src/lib/decimal.js';

const initialPassword = 'Temporary-test-password-123';
const changedPassword = 'Changed-test-password-456';
const origin = 'http://localhost:5173';
let replica; let app; let config; let owner; let admin;

async function client(email = 'owner@layerflow.test', password = initialPassword) {
  const agent = request.agent(app);
  let csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.data.csrfToken;
  const login = await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf).send({ email, password }).expect(200);
  csrf = login.body.data.csrfToken;
  return {
    agent, user: login.body.data.user,
    async send(method, path, input, status = method === 'post' && ['/users', '/roles'].includes(path) ? 201 : 200) {
      const response = await agent[method](`/api/v1${path}`).set('Origin', origin).set('X-CSRF-Token', csrf).send(input).expect(status);
      if (response.body.data?.csrfToken) csrf = response.body.data.csrfToken;
      return response;
    },
  };
}

async function staff(roleCode, prefix = 'staff') {
  const created = (await admin.send('post', '/users', { name: `${prefix} User`, email: `${prefix}@layerflow.test`, password: initialPassword })).body.data;
  let user = created;
  if (roleCode) {
    const role = await Role.findOne({ code: roleCode });
    user = (await admin.send('put', `/users/${user.id}/role`, { roleId: String(role._id), version: user.version })).body.data;
  }
  const loggedIn = await client(user.email);
  await loggedIn.send('post', '/auth/change-password', { currentPassword: initialPassword, newPassword: changedPassword });
  return { ...loggedIn, record: (await User.findById(user.id)).toObject() };
}

before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { downloadDir: resolve('../.data/mongodb-binaries') }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  config = { ...readConfig({ NODE_ENV: 'test', MONGODB_URI: replica.getUri('layerflow_test'), SESSION_SECRET: 'a-test-only-random-session-secret-with-enough-characters' }), loginLimit: 1000 };
  await connectDatabase(config.mongoUri);
  await applyMigrations(config);
  app = createApp(config);
}, { timeout: 240000 });

beforeEach(async () => {
  for (const model of models) await model.deleteMany({});
  await mongoose.connection.db.collection('sessions').deleteMany({});
  await applyMigrations(config);
  owner = await bootstrapOwner({ name: 'Test Owner', email: 'owner@layerflow.test', password: initialPassword });
  admin = await client();
  await admin.send('post', '/auth/change-password', { currentPassword: initialPassword, newPassword: changedPassword });
});

after(async () => { await mongoose.disconnect(); if (replica) await replica.stop(); });

test('health/readiness are safe, bootstrap is one-time, passwords are hashed, and indexes/seeds are repeatable', async () => {
  await request(app).get('/api/v1/health').expect(200);
  await request(app).get('/api/v1/ready').expect(200);
  await applyMigrations(config);
  assert.equal(await Role.countDocuments(), 5);
  await assert.rejects(bootstrapOwner({ name: 'Another Owner', email: 'another@layerflow.test', password: initialPassword }), { code: 'BOOTSTRAP_CLOSED' });
  const secret = await User.findById(owner.id).select('+passwordHash');
  assert.match(secret.passwordHash, /^scrypt\$/);
  assert.equal(JSON.stringify((await admin.agent.get('/api/v1/auth/me')).body).includes('passwordHash'), false);
  assert.equal(secret.passwordHash.includes(changedPassword), false);
});

test('transaction helper rolls back all writes on failure', async () => {
  const before = await SecurityGuard.findById('access-control');
  await assert.rejects(transaction(async (session) => {
    await SecurityGuard.updateOne({ _id: 'access-control' }, { $inc: { revision: 20 } }, { session });
    throw new Error('rollback probe');
  }));
  assert.equal((await SecurityGuard.findById('access-control')).revision, before.revision);
});

test('login requires CSRF/origin, normalizes email, regenerates a cookie session and logout invalidates it', async () => {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email: owner.email, password: changedPassword }).expect(403);
  const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken;
  await agent.post('/api/v1/auth/login').set('Origin', 'https://untrusted.example').set('X-CSRF-Token', csrf).send({ email: owner.email, password: changedPassword }).expect(403);
  const response = await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf).send({ email: ' OWNER@LAYERFLOW.TEST ', password: changedPassword }).expect(200);
  assert.match(response.headers['set-cookie'].join(' '), /HttpOnly/);
  assert.match(response.headers['set-cookie'].join(' '), /SameSite=Lax/);
  await agent.get('/api/v1/auth/me').expect(200);
  await agent.post('/api/v1/auth/logout').set('Origin', origin).set('X-CSRF-Token', response.body.data.csrfToken).expect(204);
  await agent.get('/api/v1/auth/me').expect(401);
});

test('temporary password permits only session/password actions and errors do not reveal account existence', async () => {
  const user = (await admin.send('post', '/users', { name: 'Temporary User', email: 'temporary@layerflow.test', password: initialPassword })).body.data;
  const loggedIn = await client(user.email);
  assert.equal(loggedIn.user.mustChangePassword, true);
  const denied = await loggedIn.agent.get('/api/v1/users').expect(403);
  assert.equal(denied.body.code, 'PASSWORD_CHANGE_REQUIRED');
  await loggedIn.send('post', '/auth/change-password', { currentPassword: 'wrong-password', newPassword: changedPassword }, 422);
  await loggedIn.send('post', '/auth/change-password', { currentPassword: initialPassword, newPassword: changedPassword });
  const me = (await loggedIn.agent.get('/api/v1/auth/me')).body.data;
  assert.equal(me.mustChangePassword, false);
  assert.equal(me.role, null);
  assert.deepEqual(me.permissions, []);
  await loggedIn.agent.get('/api/v1/users').expect(403);
  const agent = request.agent(app);
  const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken;
  const unknown = await agent.post('/api/v1/auth/login').set('X-CSRF-Token', csrf).send({ email: 'missing@layerflow.test', password: initialPassword }).expect(401);
  const wrong = await agent.post('/api/v1/auth/login').set('X-CSRF-Token', csrf).send({ email: owner.email, password: initialPassword }).expect(401);
  assert.equal(unknown.body.message, wrong.body.message);
});

test('staff creation rejects privilege injection, duplicate emails, unsafe queries and stale writes', async () => {
  await admin.send('post', '/users', { name: 'Bad User', email: 'bad@layerflow.test', password: initialPassword, roleId: owner.roleId }, 422);
  const user = (await admin.send('post', '/users', { name: 'Valid User', email: 'valid@layerflow.test', password: initialPassword })).body.data;
  await admin.send('post', '/users', { name: 'Duplicate', email: 'VALID@LAYERFLOW.TEST', password: initialPassword }, 409);
  await admin.send('patch', `/users/${user.id}`, { name: 'Updated User', email: user.email, version: user.version });
  const conflict = await admin.send('patch', `/users/${user.id}`, { name: 'Stale User', email: user.email, version: user.version }, 409);
  assert.equal(conflict.body.code, 'VERSION_CONFLICT');
  await admin.agent.get('/api/v1/users?pageSize=101').expect(422);
  await admin.agent.get('/api/v1/users?email[$ne]=x').expect(422);
  await admin.send('patch', '/users/not-an-id', { name: 'Bad', email: owner.email, version: 1 }, 422);
  const page = await admin.agent.get('/api/v1/users?page=1&pageSize=1').expect(200);
  assert.equal(page.body.data.length, 1); assert.equal(page.body.meta.total, 2);
});

test('default staff roles cannot manage identity and an unassigned user receives no permissions', async () => {
  const manager = await staff('production_manager');
  await manager.agent.get('/api/v1/users').expect(403);
  await manager.agent.get('/api/v1/roles').expect(403);
  await manager.send('post', '/roles', { code: 'illicit', name: 'Illicit', permissions: ['users.manage'], scopeMode: 'company' }, 403);
});

test('role permission edits take effect on the next request in an existing session', async () => {
  const role = (await admin.send('post', '/roles', { code: 'reader', name: 'User Reader', permissions: ['users.view'], scopeMode: 'company' })).body.data;
  const reader = await staff('reader', 'reader');
  await reader.agent.get('/api/v1/users').expect(200);
  await admin.send('patch', `/roles/${role.id}`, { name: role.name, description: '', permissions: [], scopeMode: 'company', version: role.version });
  await reader.agent.get('/api/v1/users').expect(403);
  assert.deepEqual((await reader.agent.get('/api/v1/auth/me')).body.data.permissions, []);
});

test('role changes, resets and deactivation invalidate old sessions immediately', async () => {
  const member = await staff('production_manager');
  const current = await User.findById(member.record._id);
  const updated = (await admin.send('post', `/users/${current.id}/reset-password`, { password: 'Reset-test-password-789', version: current.version })).body.data;
  await member.agent.get('/api/v1/auth/me').expect(401);
  const reset = await client(current.email, 'Reset-test-password-789');
  assert.equal(reset.user.mustChangePassword, true);
  await admin.send('patch', `/users/${current.id}/status`, { isActive: false, version: updated.version });
  await reset.agent.get('/api/v1/auth/me').expect(401);
  const other = await staff('production_manager', 'other');
  await admin.send('put', `/users/${other.record._id}/role`, { roleId: null, version: other.record.version });
  await other.agent.get('/api/v1/auth/me').expect(401);
});

test('password changes invalidate other sessions while the rotated current session remains usable', async () => {
  const second = await client(owner.email, changedPassword);
  await admin.send('post', '/auth/change-password', { currentPassword: changedPassword, newPassword: 'Another-changed-password-789' });
  await admin.agent.get('/api/v1/auth/me').expect(200);
  await second.agent.get('/api/v1/auth/me').expect(401);
});

test('protected recovery role, self-demotion and self-deactivation are blocked', async () => {
  const role = await Role.findOne({ isProtected: true });
  await admin.send('patch', `/roles/${role.id}`, { name: role.name, permissions: [], scopeMode: 'company', version: role.version }, 403);
  const me = (await admin.agent.get('/api/v1/auth/me')).body.data;
  await admin.send('put', `/users/${owner.id}/role`, { roleId: null, version: me.version }, 403);
  await admin.send('patch', `/users/${owner.id}/status`, { isActive: false, version: me.version }, 403);
});

test('delegated administrator cannot grant permissions it lacks or manipulate protected accounts', async () => {
  const grants = ['users.view', 'users.manage', 'roles.view', 'roles.manage'];
  await admin.send('post', '/roles', { code: 'delegate', name: 'Delegated Administrator', permissions: grants, scopeMode: 'company' });
  const delegate = await staff('delegate', 'delegate');
  await delegate.send('post', '/roles', { code: 'escalated', name: 'Escalated', permissions: ['reports.history.view'], scopeMode: 'company' }, 403);
  const me = (await admin.agent.get('/api/v1/auth/me')).body.data;
  await delegate.send('post', `/users/${owner.id}/reset-password`, { password: 'Attempted-reset-password-123', version: me.version }, 403);
  await delegate.send('put', `/users/${delegate.record._id}/role`, { roleId: owner.roleId, version: delegate.record.version }, 403);
  const target = (await admin.send('post', '/users', { name: 'Grant Target', email: 'grant-target@layerflow.test', password: initialPassword })).body.data;
  await delegate.send('put', `/users/${target.id}/role`, { roleId: owner.roleId, version: target.version }, 403);
  await admin.send('post', '/roles', { code: 'stronger', name: 'Stronger Administrator', permissions: [...grants, 'reports.history.view'], scopeMode: 'company' });
  const stronger = await staff('stronger', 'stronger');
  await delegate.send('post', `/users/${stronger.record._id}/reset-password`, { password: 'Attempted-reset-password-123', version: stronger.record.version }, 403);
});

test('concurrent administrator deactivation cannot remove every active recovery account', async () => {
  const second = await staff('owner', 'secondowner');
  const currentOwner = (await admin.agent.get('/api/v1/auth/me')).body.data;
  // Helpers capture the correct per-session CSRF tokens while allowing the requests to race.
  const outcomes = await Promise.allSettled([
    admin.send('patch', `/users/${second.record._id}/status`, { isActive: false, version: second.record.version }),
    second.send('patch', `/users/${owner.id}/status`, { isActive: false, version: currentOwner.version }),
  ]);
  assert.equal(outcomes.filter((entry) => entry.status === 'fulfilled').length, 1);
  assert.equal(await User.countDocuments({ isActive: true }), 1);
});

test('audit stores attribution but never password input, password hashes or session credentials', async () => {
  await admin.send('post', '/users', { name: 'Audit User', email: 'audit@layerflow.test', password: initialPassword });
  const events = await AuditEvent.find();
  assert(events.some((event) => event.action === 'user.created' && String(event.actorId) === owner.id));
  const serialized = JSON.stringify(events);
  assert.equal(serialized.includes(initialPassword), false); assert.equal(serialized.includes(changedPassword), false); assert.equal(serialized.includes('passwordHash'), false);
  await admin.send('post', '/audit-events', { action: 'injected' }, 404);
});

test('idempotency replays committed results and rejects a changed payload without duplicate effects', async () => {
  const specification = { actorId: owner.id, operation: 'test-write', key: 'test-idempotency-key-123', payload: { value: 5 } };
  const work = async (session) => {
    const [event] = await AuditEvent.create([{ action: 'idempotency.probe', targetType: 'test' }], { session });
    return { id: String(event._id) };
  };
  const first = await idempotentWrite(specification, work);
  assert.deepEqual(await idempotentWrite(specification, work), first);
  await assert.rejects(idempotentWrite({ ...specification, payload: { value: 6 } }, work), { code: 'IDEMPOTENCY_CONFLICT' });
  assert.equal(await AuditEvent.countDocuments({ action: 'idempotency.probe' }), 1);
});

test('date, scope, separation and decimal foundations enforce boundary examples', () => {
  const now = new Date('2026-11-18T19:01:00Z');
  assert.equal(businessDate(now), '2026-11-19');
  assert.deepEqual(allowedDateRange({ permissions: [] }, { now }), { from: '2026-11-18', to: '2026-11-19' });
  assert.throws(() => allowedDateRange({ permissions: [] }, { from: '2026-11-17', to: '2026-11-19', now }), { code: 'HISTORY_FORBIDDEN' });
  assert.throws(() => allowedDateRange({ permissions: [] }, { from: '2026-02-30', to: '2026-11-19', now }), { code: 'INVALID_DATE' });
  assert.deepEqual(allowedDateRange({ permissions: ['clinical.history.view'] }, { from: '2026-11-01', to: '2026-11-19', now, clinical: true }), { from: '2026-11-01', to: '2026-11-19' });
  assert.throws(() => assertScope({ roleId: 'role', organizationId: 'org', scopeMode: 'assigned', siteIds: [], farmIds: [] }, { organizationId: 'org', farmId: 'other' }), { code: 'NOT_FOUND' });
  assert.throws(() => assertIndependentAdministrator('person', 'person'), { code: 'SEPARATION_OF_DUTIES' });
  assert.equal(money('0.105'), '0.11');
});

test('future phases are explicit and authentication endpoints are rate-limited', async () => {
  await admin.agent.get('/api/v1/organization/hierarchy').expect(501);
  const limited = createApp({ ...config, loginLimit: 2 });
  const agent = request.agent(limited);
  const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken;
  for (let count = 0; count < 2; count += 1) await agent.post('/api/v1/auth/login').set('X-CSRF-Token', csrf).send({ email: owner.email, password: 'wrong' }).expect(401);
  await agent.post('/api/v1/auth/login').set('X-CSRF-Token', csrf).send({ email: owner.email, password: 'wrong' }).expect(429);
});
