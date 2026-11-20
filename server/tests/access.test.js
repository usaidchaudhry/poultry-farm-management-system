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
import { User, Role, AuditEvent, SecurityGuard, Migration, models } from '../src/modules/access/models.js';
import { idempotentWrite } from '../src/lib/idempotency.js';
import { businessDate, allowedDateRange } from '../src/policies/dates.js';
import { assertScope, assertIndependentAdministrator } from '../src/policies/access.js';
import { money } from '../src/lib/decimal.js';
import { seedDemoHierarchy } from '../src/scripts/demo-hierarchy-service.js';
import { reportModels, DailyReport, ReportRevision, BirdMovement, BirdMeasurement, PublicationIntent } from '../src/modules/reports/models.js';
import { clinicalModels, ClinicalVisit, Prescription, MedicationTask, AdministrationEvent } from '../src/modules/clinical/models.js';
import { taskStatus } from '../src/modules/clinical/service.js';
import { localInstant, occurrences } from '../src/modules/clinical/schedule.js';
import { hierarchyModels as H } from '../src/modules/organization/models.js';

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
  for (const model of clinicalModels) await model.deleteMany({});
  for (const model of reportModels) await model.deleteMany({});
  for (const model of Object.values(H)) await model.deleteMany({});
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

test('organization is connected and authentication endpoints are rate-limited', async () => {
  await admin.agent.get('/api/v1/organization/hierarchy').expect(200);
  const limited = createApp({ ...config, loginLimit: 2 });
  const agent = request.agent(limited);
  const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken;
  for (let count = 0; count < 2; count += 1) await agent.post('/api/v1/auth/login').set('X-CSRF-Token', csrf).send({ email: owner.email, password: 'wrong' }).expect(401);
  await agent.post('/api/v1/auth/login').set('X-CSRF-Token', csrf).send({ email: owner.email, password: 'wrong' }).expect(429);
});

async function hierarchyFixture(placementDate = '2026-11-01') {
  const create = async (kind, values) => (await admin.send('post', `/organization/${kind}s`, values, 201)).body.data;
  const site = await create('site', { name: 'North Site', location: 'Lahore' });
  const farmA = await create('farm', { name: 'Farm Alpha', siteId: site.id });
  const farmB = await create('farm', { name: 'Farm Beta', siteId: site.id });
  const houseA = await create('house', { name: 'House Alpha', farmId: farmA.id, capacity: 1000 });
  const houseB = await create('house', { name: 'House Beta', farmId: farmB.id });
  const flock = await create('flock', { name: 'Layer Alpha', houseId: houseA.id, initialCount: 500, placementDate, birdType: 'Layer' });
  return { create, site, farmA, farmB, houseA, houseB, flock };
}

test('hierarchy derives ancestors, rejects forged parents, duplicate names, occupied houses and invalid counts', async () => {
  const f = await hierarchyFixture();
  assert.equal(f.flock.siteId, f.site.id);
  assert.equal(f.flock.farmId, f.farmA.id);
  await admin.send('post', '/organization/farms', { name: ' farm alpha ', siteId: f.site.id }, 409);
  await admin.send('post', '/organization/houses', { name: 'Forged', farmId: f.farmA.id, siteId: f.site.id }, 422);
  await admin.send('post', '/organization/flocks', { name: 'Second', houseId: f.houseA.id, initialCount: 1, placementDate: '2026-11-02' }, 409);
  for (const initialCount of [-1, 0, 1.5, 1001]) await admin.send('post', '/organization/flocks', { name: 'Invalid', houseId: f.houseA.id, initialCount, placementDate: '2026-11-02' }, 422);
  await admin.send('post', '/organization/flocks', { name: 'Invalid date', houseId: f.houseB.id, initialCount: 10, placementDate: '2026-02-30' }, 422);
  await admin.send('patch', `/organization/flocks/${f.flock.id}`, { name: 'Rename', initialCount: 3, version: 1 }, 422);
  await admin.send('patch', `/organization/farms/${f.farmA.id}`, { name: 'Moved', siteId: f.site.id, version: 1 }, 422);
  await applyMigrations(config);
  assert.equal(await H.flock.countDocuments(), 1);
});

test('archive, restore, capacity and stale versions are enforced transactionally', async () => {
  const f = await hierarchyFixture();
  await admin.send('patch', `/organization/sites/${f.site.id}/status`, { archived: true, version: 1 }, 409);
  await admin.send('patch', `/organization/houses/${f.houseA.id}`, { name: 'House Alpha', capacity: 100, version: 1 }, 422);
  const archived = (await admin.send('patch', `/organization/flocks/${f.flock.id}/status`, { archived: true, version: 1 })).body.data;
  await admin.send('patch', `/organization/flocks/${f.flock.id}/status`, { archived: false, version: 1 }, 409);
  const house = (await admin.send('patch', `/organization/houses/${f.houseA.id}/status`, { archived: true, version: 1 })).body.data;
  await admin.send('post', '/organization/flocks', { name: 'Blocked', houseId: house.id, initialCount: 10, placementDate: '2026-11-01' }, 409);
  await admin.send('patch', `/organization/flocks/${archived.id}/status`, { archived: false, version: archived.version }, 409);
  await admin.send('patch', `/organization/houses/${house.id}/status`, { archived: false, version: house.version });
  const replacement = await f.create('flock', { name: 'Replacement', houseId: house.id, initialCount: 300, placementDate: '2026-11-02' });
  await admin.send('patch', `/organization/flocks/${archived.id}/status`, { archived: false, version: archived.version }, 409);
  await admin.send('patch', `/organization/flocks/${replacement.id}/status`, { archived: true, version: replacement.version });
  await admin.send('patch', `/organization/flocks/${archived.id}/status`, { archived: false, version: archived.version });
  assert.ok(await AuditEvent.exists({ action: 'organization.flock.status' }));
});

test('two differently assigned managers see only their farms; site grants include future farms and sessions revoke on reassignment', async () => {
  const f = await hierarchyFixture();
  const a = await staff('farm_manager', 'alpha');
  const b = await staff('farm_manager', 'beta');
  assert.equal((await a.agent.get('/api/v1/organization/hierarchy').expect(200)).body.data.farms.length, 0);
  const assign = async (u, siteIds, farmIds) => admin.send('put', `/users/${u.record._id}/scope`, { siteIds, farmIds, version: u.record.version });
  await assign(a, [], [f.farmA.id]); await assign(b, [], [f.farmB.id]);
  await a.agent.get('/api/v1/organization/hierarchy').expect(401);
  const aa = await client('alpha@layerflow.test', changedPassword);
  const bb = await client('beta@layerflow.test', changedPassword);
  const data = (await aa.agent.get('/api/v1/organization/hierarchy').expect(200)).body.data;
  assert.deepEqual(data.farms.map((x) => x.id), [f.farmA.id]);
  assert.deepEqual(data.sites.map((x) => x.id), [f.site.id]);
  assert.equal(data.houses[0].id, f.houseA.id);
  assert.deepEqual((await bb.agent.get('/api/v1/organization/farms').expect(200)).body.data.map((x) => x.id), [f.farmB.id]);
  for (const path of [`farms/${f.farmB.id}`, `houses/${f.houseB.id}`]) await aa.agent.get(`/api/v1/organization/${path}`).expect(404);
  const other = await f.create('site', { name: 'Hidden Site', location: 'Lahore' });
  await aa.agent.get(`/api/v1/organization/sites/${other.id}`).expect(404);
  await aa.send('patch', `/organization/farms/${f.farmA.id}`, { name: 'Denied', version: 1 }, 403);
  await aa.send('put', `/users/${a.record._id}/scope`, { siteIds: [f.site.id], farmIds: [], version: 1 }, 403);
  const current = await User.findById(a.record._id);
  await admin.send('put', `/users/${current._id}/scope`, { siteIds: [f.site.id], farmIds: [], version: current.version });
  const future = await f.create('farm', { name: 'Future Farm', siteId: f.site.id });
  const fresh = await client('alpha@layerflow.test', changedPassword);
  assert.ok((await fresh.agent.get('/api/v1/organization/hierarchy')).body.data.farms.some((x) => x.id === future.id));
  const assignments = (await admin.agent.get('/api/v1/organization/assignments').expect(200)).body.data;
  assert.deepEqual(assignments[String(current._id)].siteIds, [f.site.id]);
  await admin.send('put', `/users/${current._id}/scope`, { siteIds: [], farmIds: [], version: current.version }, 409);
  await admin.send('put', `/users/${current._id}/scope`, { siteIds: [], farmIds: ['000000000000000000000001'], version: current.version + 1 }, 422);
});

test('delegated organization editors cannot mutate outside their scope or expand visible ancestor access', async () => {
  const f = await hierarchyFixture();
  const role = (await admin.send('post', '/roles', { code: 'scoped_editor', name: 'Scoped editor', description: '', scopeMode: 'assigned', permissions: ['organization.view', 'organization.manage'] })).body.data;
  const s = await staff(null, 'editor');
  let user = (await admin.send('put', `/users/${s.record._id}/role`, { roleId: role.id, version: s.record.version })).body.data;
  await admin.send('put', `/users/${user.id}/scope`, { siteIds: [], farmIds: [f.farmA.id], version: user.version });
  const editor = await client('editor@layerflow.test', changedPassword);
  await editor.send('patch', `/organization/farms/${f.farmB.id}`, { name: 'Denied', version: 1 }, 404);
  await editor.send('post', '/organization/houses', { name: 'Denied', farmId: f.farmB.id }, 404);
  await editor.send('post', '/organization/farms', { name: 'Denied sibling', siteId: f.site.id }, 404);
  await editor.send('patch', `/organization/sites/${f.site.id}`, { name: 'Denied parent', location: 'Lahore', version: 1 }, 404);
  await editor.send('post', '/organization/sites', { name: 'Denied root', location: 'Lahore' }, 403);
  await editor.send('post', '/organization/houses', { name: 'Allowed house', farmId: f.farmA.id }, 201);
});

test('concurrent flock creation leaves exactly one active occupant', async () => {
  const f = await hierarchyFixture();
  // Separate authenticated clients avoid shared Supertest-agent cookie races.
  const x = await client(owner.email, changedPassword); const y = await client(owner.email, changedPassword);
  const requests = await Promise.allSettled([x, y].map((c, index) => c.send('post', '/organization/flocks', { name: `Concurrent ${index}`, houseId: f.houseB.id, initialCount: 10, placementDate: '2026-11-01' }, 201)));
  assert.equal(requests.filter((r) => r.status === 'fulfilled').length, 1);
  assert.match(requests.find((r) => r.status === 'rejected').reason.message, /409/);
  assert.equal(await H.flock.countDocuments({ houseId: f.houseB.id, status: 'active' }), 1);
});


test('optional demo fixture creates two isolated managers and refuses to overwrite existing data', async () => {
  const accounts = await seedDemoHierarchy(initialPassword);
  assert.equal(accounts.length, 2);
  assert.equal(await H.farm.countDocuments(), 2);
  for (const account of accounts) {
    const c = await client(account.email);
    await c.send('post', '/auth/change-password', { currentPassword: initialPassword, newPassword: changedPassword });
    const hierarchy = (await c.agent.get('/api/v1/organization/hierarchy').expect(200)).body.data;
    assert.deepEqual(hierarchy.farms.map((f) => f.id), [account.farmId]);
    assert.equal(hierarchy.flocks.length, 1);
  }
  await assert.rejects(seedDemoHierarchy(initialPassword), { code: 'DEMO_EXISTS' });
  assert.equal(await H.farm.countDocuments(), 2);
});

const today = () => businessDate();
const daysAgo = (n) => new Date(Date.parse(today()) - n * 86400000).toISOString().slice(0, 10);
const completeReport = (mortality = 2) => ({ eggs: { jumbo: 10, starter: 20, standard: 100, small: 5, floor: 3, broken: 2, discard: 1 }, mortality, feed: { itemReference: 'Layer feed', locationReference: 'House store', bags: 1, bagSizeKg: 50, additionalKg: 2, notes: '' }, waterLitres: 100, lightHours: 16, eggSamples: [{ sampleType: 'single-egg', value: 0.06, unit: 'kg' }, { sampleType: 'single-egg', value: 64, unit: 'g' }, { sampleType: 'tray', value: 1800, unit: 'g' }], medicines: [{ name: 'Recorded medicine', quantity: 1, unit: 'ml', reference: 'Observation only' }], vaccines: [], comments: 'Daily observations', postMortem: 'No diagnosis inferred.' });
const createReport = async (f, date = today(), data = completeReport(), reason = '') => (await admin.send('post', '/daily-reports', { flockId: f.flock.id, businessDate: date, data, reason }, 201)).body.data;

test('report lifecycle preserves revisions and publishes only delta effects with server-derived totals', async () => {
  const f = await hierarchyFixture(today());
  let report = await createReport(f);
  assert.equal(report.summary.totalEggs, 141);
  assert.equal(report.summary.saleableEggs, 135);
  assert.equal(report.summary.feedKg, 52);
  assert.equal(report.summary.closingBirds, 498);
  assert.equal(report.summary.eggSampleAverages['single-egg'], 62);
  assert.equal(report.summary.eggSampleAverages.tray, 1800);
  await admin.send('post', '/daily-reports', { flockId: f.flock.id, businessDate: today(), data: {} }, 409);
  report = (await admin.send('post', `/daily-reports/${report.id}/submit`, { version: report.version })).body.data;
  await admin.send('post', `/daily-reports/${report.id}/submit`, { version: 1 }, 409);
  await admin.send('patch', `/daily-reports/${report.id}`, { version: report.version, data: completeReport() }, 409);
  await admin.send('post', `/daily-reports/${report.id}/return`, { version: report.version, reason: '' }, 422);
  report = (await admin.send('post', `/daily-reports/${report.id}/return`, { version: report.version, reason: 'Correct mortality and egg count' })).body.data;
  const corrected = completeReport(3); corrected.eggs.standard = 110;
  report = (await admin.send('patch', `/daily-reports/${report.id}`, { version: report.version, data: corrected })).body.data;
  const during = (await admin.agent.get('/api/v1/mortality').expect(200)).body.data[0];
  assert.equal(during.summary.mortalityCount, 2);
  await admin.send('post', `/daily-reports/${report.id}/submit`, { version: report.version }, 422);
  report = (await admin.send('post', `/daily-reports/${report.id}/submit`, { version: report.version, reason: 'Corrected recorded counts' })).body.data;
  assert.equal(report.publishedRevision, 2);
  const detail = (await admin.agent.get(`/api/v1/daily-reports/${report.id}`).expect(200)).body.data;
  assert.equal(detail.revisions.length, 2);
  assert.equal(detail.revisions[1].data.mortality, 2);
  assert.equal(detail.revisions[0].data.mortality, 3);
  assert.equal(detail.intents[0].eggDelta.standard, 10);
  assert.equal(detail.intents[0].feedKgDelta, 0);
  assert.equal(detail.intents[0].status, 'deferred');
  const movements = await BirdMovement.find({ flockId: f.flock.id });
  assert.equal(movements.reduce((sum, m) => sum + m.count, 0), 497);
  assert.equal(await PublicationIntent.countDocuments({ reportId: report.id }), 2);
  const snapshot = await ReportRevision.findOne({ reportId: report.id }); snapshot.reason = 'Overwrite attempt';
  await assert.rejects(snapshot.save(), /append-only/);
});

test('draft blanks, invalid counts, ancestry, population gaps, reconciliation and archive protection are enforced', async () => {
  const f = await hierarchyFixture(daysAgo(3));
  let report = await createReport(f, today(), {});
  await admin.send('post', `/daily-reports/${report.id}/submit`, { version: 1 }, 422);
  await admin.send('patch', `/organization/flocks/${f.flock.id}/status`, { version: 1, archived: true }, 409);
  for (const bad of [{ ...completeReport(), mortality: -1 }, { ...completeReport(), mortality: 501 }, { ...completeReport(), lightHours: 25 }, { ...completeReport(), eggs: { ...completeReport().eggs, jumbo: 1.5 } }]) await admin.send('patch', `/daily-reports/${report.id}`, { version: report.version, data: bad }, 422);
  await admin.send('post', '/daily-reports', { flockId: f.flock.id, farmId: f.farmB.id, businessDate: today(), data: {} }, 422);
  report = (await admin.send('patch', `/daily-reports/${report.id}`, { version: report.version, data: completeReport() })).body.data;
  await admin.send('post', `/daily-reports/${report.id}/submit`, { version: report.version }, 409);
  await admin.send('post', `/flocks/${f.flock.id}/population-adjustments`, { businessDate: today(), type: 'reconciliation', count: 490, reason: 'Counted opening after missing days' }, 201);
  report = (await admin.send('post', `/daily-reports/${report.id}/submit`, { version: report.version })).body.data;
  assert.equal(report.summary.closingBirds, 488);
  assert.equal(report.summary.gap, false);
  await admin.send('post', `/flocks/${f.flock.id}/population-adjustments`, { businessDate: today(), type: 'adjustment', count: 10, reason: 'Cannot change published opening' }, 409);
});

test('later reports block population corrections, descriptive revisions survive, and zero denominators stay unavailable', async () => {
  const f = await hierarchyFixture(daysAgo(1));
  let old = await createReport(f, daysAgo(1), completeReport(500));
  old = (await admin.send('post', `/daily-reports/${old.id}/submit`, { version: old.version })).body.data;
  let next = await createReport(f, today(), { ...completeReport(0), eggs: Object.fromEntries(Object.keys(completeReport().eggs).map((k) => [k, 0])) });
  next = (await admin.send('post', `/daily-reports/${next.id}/submit`, { version: next.version })).body.data;
  assert.equal(next.summary.openingBirds, 0);
  assert.equal(next.summary.feedPerBirdG, null);
  assert.equal(next.summary.productionPercent, null);
  assert.equal(next.summary.mortalityPercent, null);
  old = (await admin.send('post', `/daily-reports/${old.id}/return`, { version: old.version, reason: 'Review source' })).body.data;
  old = (await admin.send('patch', `/daily-reports/${old.id}`, { version: old.version, data: completeReport(499) })).body.data;
  await admin.send('post', `/daily-reports/${old.id}/submit`, { version: old.version, reason: 'Changed population' }, 409);
  old = (await admin.send('patch', `/daily-reports/${old.id}`, { version: old.version, data: { ...completeReport(500), comments: 'Corrected description' } })).body.data;
  await admin.send('post', `/daily-reports/${old.id}/submit`, { version: old.version, reason: 'Description only' });
  assert.equal(await ReportRevision.countDocuments({ reportId: old.id }), 2);
});

test('measurements normalize grams, aggregate by sample size, preserve identities, and validate report links', async () => {
  const f = await hierarchyFixture(daysAgo(1));
  const create = async (averageWeight, unit, sampleSize, hours) => (await admin.send('post', '/bird-measurements', { flockId: f.flock.id, measuredAt: new Date(Date.now() - hours * 3600000).toISOString(), sampleSize, averageWeight, unit, notes: 'Weekly observation' }, 201)).body.data;
  const a = await create(1.6, 'kg', 10, 3); const b = await create(1600, 'g', 20, 2); await create(800, 'g', 30, 1);
  assert.notEqual(a.id, b.id); assert.equal(a.grams, b.grams);
  const result = (await admin.agent.get(`/api/v1/bird-measurements?from=${daysAgo(1)}&to=${today()}&flockId=${f.flock.id}`).expect(200)).body;
  assert.equal(result.meta.weightedAverageGrams, 1200);
  assert.equal(result.data[0].differenceGrams, -800);
  assert.equal(result.data[0].standard, null);
  const report = await createReport(f, today(), { ...completeReport(), measurementId: a.id });
  assert.equal(report.summary.measurement.grams, 1600);
  await admin.send('patch', `/daily-reports/${report.id}`, { version: report.version, data: { ...completeReport(), measurementId: '000000000000000000000001' } }, 422);
  await admin.send('post', '/bird-measurements', { flockId: f.flock.id, measuredAt: new Date().toISOString(), sampleSize: 0, averageWeight: 1600, unit: 'g' }, 422);
});

test('report lists/details/revisions and measurements enforce date windows and assigned farm scope', async () => {
  const f = await hierarchyFixture(daysAgo(5));
  const old = await createReport(f, daysAgo(4), {}, 'Historical draft for test');
  await admin.send('post', '/daily-reports', { flockId: f.flock.id, businessDate: daysAgo(3), data: {} }, 403);
  const staffAccount = await staff('farm_manager', 'reporter');
  await admin.send('put', `/users/${staffAccount.record._id}/scope`, { siteIds: [], farmIds: [f.farmA.id], version: staffAccount.record.version });
  const manager = await client('reporter@layerflow.test', changedPassword);
  await admin.send('post', `/flocks/${f.flock.id}/population-adjustments`, { businessDate: daysAgo(4), type: 'placement', count: 10, reason: 'Authorized historical placement' }, 201);
  const currentPopulation = (await manager.agent.get(`/api/v1/flocks/${f.flock.id}/population?date=${today()}`).expect(200)).body.data;
  assert.equal(currentPopulation.openingBirds, 510);
  assert.deepEqual(currentPopulation.movements, []); // Current balance does not expose old movement history.
  await manager.agent.get(`/api/v1/daily-reports/${old.id}`).expect(403);
  await manager.agent.get(`/api/v1/daily-reports?from=${daysAgo(4)}&to=${today()}`).expect(403);
  await manager.send('post', '/daily-reports', { flockId: f.flock.id, businessDate: daysAgo(4), data: {} }, 403);
  await manager.send('post', `/flocks/${f.flock.id}/population-adjustments`, { businessDate: today(), type: 'placement', count: 10, reason: 'No permission' }, 403);
  const other = await f.create('flock', { name: 'Other farm flock', houseId: f.houseB.id, initialCount: 100, placementDate: today() });
  const hidden = (await admin.send('post', '/daily-reports', { flockId: other.id, businessDate: today(), data: {} }, 201)).body.data;
  await manager.agent.get(`/api/v1/daily-reports/${hidden.id}`).expect(404);
  await manager.send('post', `/daily-reports/${hidden.id}/return`, { version: 1, reason: 'Manager cannot review' }, 403);
  await manager.send('patch', `/daily-reports/${hidden.id}`, { version: 1, data: {} }, 404);
  await manager.agent.get(`/api/v1/daily-reports?farmId=${f.farmB.id}`).expect(404);
  await manager.agent.get(`/api/v1/daily-reports?flockId=${f.flock.id}&farmId=${f.farmB.id}`).expect(404);
  assert.equal((await manager.agent.get('/api/v1/daily-reports').expect(200)).body.data.length, 0);
  await admin.agent.get(`/api/v1/daily-reports?flockId=${f.flock.id}&farmId=${f.farmB.id}`).expect(422);
  const oldWeight = (await admin.send('post', '/bird-measurements', { flockId: f.flock.id, measuredAt: `${daysAgo(4)}T06:00:00Z`, sampleSize: 10, averageWeight: 1600, unit: 'g' }, 201)).body.data;
  await manager.agent.get(`/api/v1/bird-measurements/${oldWeight.id}`).expect(403);
  const hiddenWeight = (await admin.send('post', '/bird-measurements', { flockId: other.id, measuredAt: new Date().toISOString(), sampleSize: 10, averageWeight: 1600, unit: 'g' }, 201)).body.data;
  await manager.agent.get(`/api/v1/bird-measurements/${hiddenWeight.id}`).expect(404);
});

test('concurrent submissions commit exactly one revision, mortality effect, and publication intent', async () => {
  const f = await hierarchyFixture(today()); const report = await createReport(f);
  const clients = await Promise.all([client(owner.email, changedPassword), client(owner.email, changedPassword)]);
  const results = await Promise.allSettled(clients.map((c) => c.send('post', `/daily-reports/${report.id}/submit`, { version: 1 })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.match(results.find((r) => r.status === 'rejected').reason.message, /409/);
  assert.equal(await ReportRevision.countDocuments({ reportId: report.id }), 1);
  assert.equal(await PublicationIntent.countDocuments({ reportId: report.id }), 1);
  assert.equal(await BirdMovement.countDocuments({ reportId: report.id }), 1);
});

test('opening movement migration backfills existing flocks once and population adjustments preserve an append-only trail', async () => {
  const f = await hierarchyFixture(today());
  await BirdMovement.deleteMany({ flockId: f.flock.id });
  await Migration.deleteOne({ _id: '003-reports-and-population' });
  await applyMigrations(config); await applyMigrations(config);
  assert.equal(await BirdMovement.countDocuments({ flockId: f.flock.id, type: 'opening' }), 1);
  await admin.send('post', `/flocks/${f.flock.id}/population-adjustments`, { businessDate: today(), type: 'placement', count: 10, reason: 'Additional authorized placement' }, 201);
  await admin.send('post', `/flocks/${f.flock.id}/population-adjustments`, { businessDate: today(), type: 'adjustment', count: -5, reason: 'Physical count correction' }, 201);
  const context = (await admin.agent.get(`/api/v1/flocks/${f.flock.id}/population?date=${today()}`).expect(200)).body.data;
  assert.equal(context.availableBirds, 505);
  assert.equal(context.movements.length, 2);
  await admin.send('post', `/flocks/${f.flock.id}/population-adjustments`, { businessDate: today(), type: 'placement', count: 1000, reason: 'Exceeds capacity' }, 422);
  assert.equal(await BirdMovement.countDocuments({ flockId: f.flock.id }), 3);
});

test('population changes leave invalidated drafts readable for correction and capacity follows the movement balance', async () => {
  const f = await hierarchyFixture(today());
  let report = await createReport(f, today(), completeReport(490));
  await admin.send('post', `/flocks/${f.flock.id}/population-adjustments`, { businessDate: today(), type: 'adjustment', count: -20, reason: 'Correct physical population' }, 201);
  const readable = (await admin.agent.get(`/api/v1/daily-reports/${report.id}`).expect(200)).body.data;
  assert.equal(readable.summary.invalidPopulation, true);
  report = (await admin.send('patch', `/daily-reports/${report.id}`, { version: report.version, data: completeReport(2) })).body.data;
  report = (await admin.send('post', `/daily-reports/${report.id}/submit`, { version: report.version })).body.data;
  await admin.send('patch', `/organization/houses/${f.houseA.id}`, { version: 1, name: f.houseA.name, capacity: 478 });
  await admin.send('patch', `/organization/flocks/${f.flock.id}`, { version: 1, name: 'Renamed with lower current population', birdType: 'Layer' });
  await admin.send('patch', `/organization/flocks/${f.flock.id}/status`, { version: 2, archived: true });
  await admin.send('post', `/daily-reports/${report.id}/return`, { version: report.version, reason: 'Archived context blocks new work' }, 409);
});

test('backdated first submissions cannot change the opening of a later published report', async () => {
  const f = await hierarchyFixture(daysAgo(1));
  await admin.send('post', `/flocks/${f.flock.id}/population-adjustments`, { businessDate: today(), type: 'reconciliation', count: 500, reason: 'Opening physically counted' }, 201);
  let current = await createReport(f);
  current = (await admin.send('post', `/daily-reports/${current.id}/submit`, { version: 1 })).body.data;
  const earlier = await createReport(f, daysAgo(1), completeReport(2));
  await admin.send('post', `/daily-reports/${earlier.id}/submit`, { version: earlier.version }, 409);
  assert.equal(await ReportRevision.countDocuments({ reportId: earlier.id }), 0);
  const intact = (await admin.agent.get(`/api/v1/daily-reports/${current.id}`).expect(200)).body.data;
  assert.equal(intact.summary.closingBirds, current.publishedSummary.closingBirds);
});

const prescriptionItems = (startDate = today()) => ['alpha', 'beta'].map((key) => ({ key, medicine: `Recorded item ${key}`, doseValue: 1, doseUnit: 'ml', instructions: 'Follow the recorded clinician instructions', route: key === 'alpha' ? 'water' : 'feed', startDate, durationDays: 3, times: ['00:00', '12:00'], batchLabel: 'Descriptive tank or batch label' }));
async function clinicalFixture() {
  const f = await hierarchyFixture(daysAgo(1));
  const d = await staff('doctor', 'clinician'); const m = await staff('farm_manager', 'administrator');
  for (const u of [d, m]) await admin.send('put', `/users/${u.record._id}/scope`, { siteIds: [], farmIds: [f.farmA.id], version: u.record.version });
  const doctor = await client('clinician@layerflow.test', changedPassword); const manager = await client('administrator@layerflow.test', changedPassword);
  const visit = (await doctor.send('post', '/clinical-visits', { flockId: f.flock.id, occurredAt: new Date(Date.now() - 60000).toISOString(), diagnosis: 'Recorded clinical assessment', observations: 'Observed findings', parameters: 'Recorded parameters', remarks: 'Course project test data' }, 201)).body.data;
  const prescription = (await doctor.send('post', `/clinical-visits/${visit.id}/prescriptions`, { items: prescriptionItems() }, 201)).body.data;
  return { ...f, doctor, manager, visit, prescription };
}

test('clinical finalization generates distinct recurring tasks once and preserves finalized definitions', async () => {
  const f = await clinicalFixture();
  const preview = (await f.doctor.send('post', `/clinical-visits/${f.visit.id}/schedule-preview`, { items: prescriptionItems() })).body.data;
  assert.equal(preview.occurrences.length, 12);
  assert.equal(preview.timezone, 'Asia/Karachi');
  assert.equal(await MedicationTask.countDocuments(), 0);
  const finalized = (await f.doctor.send('post', `/prescriptions/${f.prescription.id}/finalize`, { version: 1 })).body.data;
  assert.equal(finalized.taskCount, 12);
  await f.doctor.send('post', `/prescriptions/${f.prescription.id}/finalize`, { version: 1 }, 409);
  await f.doctor.send('patch', `/prescriptions/${f.prescription.id}`, { version: finalized.version, items: prescriptionItems() }, 409);
  await f.doctor.send('patch', `/clinical-visits/${f.visit.id}`, { version: 1, occurredAt: new Date().toISOString(), diagnosis: 'Locked' }, 409);
  assert.equal(await MedicationTask.countDocuments(), 12);
  assert.equal(new Set((await MedicationTask.find()).map((r) => `${r.itemKey}:${r.occurrenceKey}`)).size, 12);
  await admin.send('patch', `/organization/flocks/${f.flock.id}/status`, { version: 1, archived: true }, 409);
});

test('independent outcomes and corrections retain actual/recorded times and immutable superseding evidence', async () => {
  const f = await clinicalFixture();
  const finalizedByAnother = (await admin.send('post', `/prescriptions/${f.prescription.id}/finalize`, { version: 1 })).body.data;
  assert.equal(finalizedByAnother.prescribedBy, f.doctor.user.id);
  assert.equal(finalizedByAnother.finalizedBy, owner.id);
  const role = await Role.findOne({ code: 'doctor' });
  await admin.send('patch', `/roles/${role._id}`, { name: role.name, description: role.description, scopeMode: 'assigned', version: role.version, permissions: [...role.permissions, 'medication.administer', 'medication.correct'] });
  const task = await MedicationTask.findOne({ prescriptionId: f.prescription.id }).sort({ dueAt: 1 });
  const input = { version: 1, outcome: 'completed', actualAt: new Date().toISOString(), actualDose: 1, doseUnit: 'ml', comments: 'Recorded independently' };
  const blocked = await f.doctor.send('post', `/medication-tasks/${task._id}/outcomes`, input, 403);
  assert.equal(blocked.body.code, 'SEPARATION_OF_DUTIES');
  const first = (await f.manager.send('post', `/medication-tasks/${task._id}/outcomes`, input, 201)).body.data;
  assert.equal(first.effectiveOutcome.recordedBy, f.manager.user.id);
  assert.ok(Date.parse(first.effectiveOutcome.recordedAt) >= Date.parse(first.effectiveOutcome.actualAt));
  await f.manager.send('post', `/medication-tasks/${task._id}/outcomes`, input, 409);
  await f.manager.send('post', `/medication-tasks/${task._id}/corrections`, { ...input, version: first.version, reason: 'No correction grant' }, 403);
  const correction = { version: first.version, outcome: 'missed', actualAt: new Date().toISOString(), reason: 'Corrected the recorded outcome' };
  await f.doctor.send('post', `/medication-tasks/${task._id}/corrections`, correction, 403);
  const changed = (await admin.send('post', `/medication-tasks/${task._id}/corrections`, correction, 201)).body.data;
  assert.equal(changed.effectiveOutcome.supersedesId, first.effectiveOutcome.id);
  const detail = (await f.doctor.agent.get(`/api/v1/medication-tasks/${task._id}`).expect(200)).body.data;
  assert.equal(detail.events.length, 2);
  assert.equal(detail.events[1].outcome, 'completed');
  const evidence = await AdministrationEvent.findById(first.effectiveOutcome.id); evidence.comments = 'Overwrite';
  await assert.rejects(evidence.save(), /append-only/);
});

test('outcomes validate explicit dose/instructions, missed reason, future time and scheduled task boundaries', async () => {
  const f = await clinicalFixture(); await f.doctor.send('post', `/prescriptions/${f.prescription.id}/finalize`, { version: 1 });
  const task = await MedicationTask.findOne({ prescriptionId: f.prescription.id }).sort({ dueAt: 1 });
  await f.manager.send('post', `/medication-tasks/${task._id}/outcomes`, { version: 1, outcome: 'completed', actualAt: new Date().toISOString() }, 422);
  await f.manager.send('post', `/medication-tasks/${task._id}/outcomes`, { version: 1, outcome: 'missed', actualAt: new Date().toISOString() }, 422);
  await f.manager.send('post', `/medication-tasks/${task._id}/outcomes`, { version: 1, outcome: 'missed', actualAt: new Date(Date.now() + 60000).toISOString(), reason: 'Future not allowed' }, 422);
  const future = await MedicationTask.findOne({ prescriptionId: f.prescription.id, dueAt: { $gt: new Date() } });
  await f.manager.send('post', `/medication-tasks/${future._id}/outcomes`, { version: 1, outcome: 'missed', actualAt: new Date().toISOString(), reason: 'Too early' }, 422);
  await f.manager.send('post', `/medication-tasks/${task._id}/outcomes`, { version: 1, outcome: 'completed', actualAt: new Date().toISOString(), instructionReference: 'Recorded prescription instruction followed' }, 201);
});

test('replacement before outcomes cancels old tasks and links a new immutable prescription version', async () => {
  const f = await clinicalFixture(); const first = (await f.doctor.send('post', `/prescriptions/${f.prescription.id}/finalize`, { version: 1 })).body.data;
  const result = (await f.doctor.send('post', `/prescriptions/${first.id}/replace`, { version: first.version, reason: 'Authorized replacement course', items: [prescriptionItems()[0]] }, 201)).body.data;
  assert.equal(result.cancelledTasks, 12);
  assert.equal(result.replacement.previousId, first.id);
  assert.equal(result.replacement.sequence, 2);
  assert.equal(await MedicationTask.countDocuments({ prescriptionId: first.id, state: 'cancelled' }), 12);
  assert.equal(await MedicationTask.countDocuments({ prescriptionId: result.replacement.id }), 6);
  const old = (await f.doctor.agent.get(`/api/v1/clinical-visits/${f.visit.id}`).expect(200)).body.data.prescriptions.find((r) => r.id === first.id);
  assert.equal(old.items.length, 2);
  await f.doctor.send('post', `/prescriptions/${first.id}/replace`, { version: first.version, reason: 'Repeated', items: prescriptionItems() }, 409);
});

test('replacement after an outcome preserves completed and elapsed tasks and replaces future work only', async () => {
  const f = await clinicalFixture(); const first = (await f.doctor.send('post', `/prescriptions/${f.prescription.id}/finalize`, { version: 1 })).body.data;
  const task = await MedicationTask.findOne({ prescriptionId: first.id }).sort({ dueAt: 1 });
  await f.manager.send('post', `/medication-tasks/${task._id}/outcomes`, { version: 1, outcome: 'completed', actualAt: new Date().toISOString(), actualDose: 1, doseUnit: 'ml' }, 201);
  await f.doctor.send('post', `/prescriptions/${first.id}/replace`, { version: first.version, reason: 'Cannot replace elapsed work', items: prescriptionItems() }, 422);
  const result = (await f.doctor.send('post', `/prescriptions/${first.id}/replace`, { version: first.version, reason: 'Replace future occurrences', items: prescriptionItems(new Date(Date.parse(today()) + 86400000).toISOString().slice(0, 10)) }, 201)).body.data;
  assert.equal((await MedicationTask.findById(task._id)).state, 'completed');
  assert.equal(await AdministrationEvent.countDocuments({ taskId: task._id }), 1);
  assert.equal(await MedicationTask.countDocuments({ prescriptionId: first.id, state: 'cancelled', dueAt: { $lte: task.dueAt } }), 0);
  assert.ok(result.cancelledTasks > 0);
});

test('clinical history is separate from operational report history and farm scope protects every direct route', async () => {
  const f = await clinicalFixture();
  const old = (await f.doctor.send('post', '/clinical-visits', { flockId: f.flock.id, occurredAt: `${daysAgo(1)}T12:00:00+05:00`, diagnosis: 'Previous assessment' }, 201)).body.data;
  await H.flock.updateOne({ _id: f.flock.id }, { $set: { placementDate: daysAgo(10) } }); // Historical fixture only.
  const historical = (await f.doctor.send('post', '/clinical-visits', { flockId: f.flock.id, occurredAt: `${daysAgo(5)}T12:00:00+05:00`, diagnosis: 'Historical clinical record' }, 201)).body.data;
  await f.doctor.agent.get(`/api/v1/clinical-visits/${historical.id}`).expect(200);
  await f.manager.agent.get(`/api/v1/clinical-visits/${historical.id}`).expect(403);
  const draft = (await f.doctor.send('post', `/clinical-visits/${historical.id}/prescriptions`, { items: prescriptionItems(daysAgo(5)) }, 201)).body.data;
  await f.doctor.send('post', `/prescriptions/${draft.id}/finalize`, { version: 1 }, 422);
  const hiddenFlock = await f.create('flock', { name: 'Hidden clinical flock', houseId: f.houseB.id, initialCount: 100, placementDate: today() });
  const hidden = (await admin.send('post', '/clinical-visits', { flockId: hiddenFlock.id, occurredAt: new Date().toISOString(), diagnosis: 'Hidden record' }, 201)).body.data;
  await f.doctor.agent.get(`/api/v1/clinical-visits/${hidden.id}`).expect(404);
  await f.doctor.send('post', `/clinical-visits/${hidden.id}/prescriptions`, { items: prescriptionItems() }, 404);
  const hiddenPrescription = (await admin.send('post', `/clinical-visits/${hidden.id}/prescriptions`, { items: prescriptionItems() }, 201)).body.data;
  await f.doctor.send('patch', `/prescriptions/${hiddenPrescription.id}`, { version: 1, items: prescriptionItems() }, 404);
  await f.doctor.send('post', `/prescriptions/${hiddenPrescription.id}/finalize`, { version: 1 }, 404);
  await f.doctor.send('post', `/prescriptions/${hiddenPrescription.id}/cancel`, { version: 1, reason: 'Cannot cancel hidden work' }, 404);
  await admin.send('post', `/prescriptions/${hiddenPrescription.id}/finalize`, { version: 1 });
  const hiddenTask = await MedicationTask.findOne({ prescriptionId: hiddenPrescription.id }).sort({ dueAt: 1 });
  await f.doctor.agent.get(`/api/v1/medication-tasks/${hiddenTask._id}`).expect(404);
  await f.manager.send('post', `/medication-tasks/${hiddenTask._id}/outcomes`, { version: 1, outcome: 'missed', actualAt: new Date().toISOString(), reason: 'Outside assigned farm' }, 404);
  await f.doctor.agent.get(`/api/v1/clinical-visits?flockId=${f.flock.id}&farmId=${f.farmB.id}`).expect(404);
  await f.doctor.send('post', `/clinical-visits/${old.id}/schedule-preview`, { items: [{ ...prescriptionItems()[0], times: ['08:00', '08:00'] }] }, 422);
});

test('old open tasks expose current actionable state while late outcomes preserve actual time and restrict closed history', async () => {
  const f = await clinicalFixture(); await f.doctor.send('post', `/prescriptions/${f.prescription.id}/finalize`, { version: 1 });
  const task = await MedicationTask.findOne({ prescriptionId: f.prescription.id }).sort({ dueAt: 1 });
  await ClinicalVisit.updateOne({ _id: f.visit.id }, { $set: { occurredAt: new Date(`${daysAgo(10)}T06:00:00Z`), businessDate: daysAgo(10) } });
  await MedicationTask.updateOne({ _id: task._id }, { $set: { dueAt: new Date(`${daysAgo(10)}T06:00:00Z`), dueBusinessDate: daysAgo(10) } });
  await f.manager.agent.get(`/api/v1/clinical-visits/${f.visit.id}`).expect(403);
  const actionable = (await f.manager.agent.get(`/api/v1/medication-tasks/${task._id}`).expect(200)).body.data;
  assert.equal(actionable.displayStatus, 'overdue'); assert.equal('diagnosis' in actionable, false);
  await f.manager.send('post', `/medication-tasks/${task._id}/outcomes`, { version: 1, outcome: 'missed', actualAt: `${daysAgo(9)}T06:00:00Z`, reason: 'Old actual time needs permission' }, 403);
  const completed = (await f.manager.send('post', `/medication-tasks/${task._id}/outcomes`, { version: 1, outcome: 'missed', actualAt: new Date().toISOString(), reason: 'Unable to administer, recorded independently' }, 201)).body.data;
  assert.ok((await f.manager.agent.get('/api/v1/medication-tasks?view=history').expect(200)).body.data.some((r) => r.id === String(task._id)));
  await admin.send('post', `/medication-tasks/${task._id}/corrections`, { version: completed.version, outcome: 'missed', actualAt: `${daysAgo(9)}T06:00:00Z`, reason: 'Corrected actual missed occurrence time' }, 201);
  await f.manager.agent.get(`/api/v1/medication-tasks/${task._id}`).expect(403);
  await f.doctor.agent.get(`/api/v1/medication-tasks/${task._id}`).expect(200);
});

test('concurrent finalization and outcome retries commit single task definitions and single effective evidence', async () => {
  const f = await clinicalFixture();
  const doctors = await Promise.all([client('clinician@layerflow.test', changedPassword), client('clinician@layerflow.test', changedPassword)]);
  const finals = await Promise.allSettled(doctors.map((c) => c.send('post', `/prescriptions/${f.prescription.id}/finalize`, { version: 1 })));
  assert.equal(finals.filter((r) => r.status === 'fulfilled').length, 1);
  assert.match(finals.find((r) => r.status === 'rejected').reason.message, /409/);
  assert.equal(await MedicationTask.countDocuments(), 12);
  const task = await MedicationTask.findOne().sort({ dueAt: 1 });
  const managers = await Promise.all([client('administrator@layerflow.test', changedPassword), client('administrator@layerflow.test', changedPassword)]);
  const outcomes = await Promise.allSettled(managers.map((c) => c.send('post', `/medication-tasks/${task._id}/outcomes`, { version: 1, outcome: 'missed', actualAt: new Date().toISOString(), reason: 'Independent observation' }, 201)));
  assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
  assert.match(outcomes.find((r) => r.status === 'rejected').reason.message, /409/);
  assert.equal(await AdministrationEvent.countDocuments(), 1);
});

test('timezone scheduling normalizes UTC and rejects nonexistent or ambiguous DST clock times', () => {
  assert.equal(localInstant('2026-11-20', '08:30', 'Asia/Karachi').toISOString(), '2026-11-20T03:30:00.000Z');
  assert.throws(() => localInstant('2026-03-08', '02:30', 'America/New_York'), { code: 'AMBIGUOUS_SCHEDULE' });
  assert.throws(() => localInstant('2026-11-01', '01:30', 'America/New_York'), { code: 'AMBIGUOUS_SCHEDULE' });
  assert.equal(occurrences(prescriptionItems(), 'Asia/Karachi').length, 12);
});

test('cancellation preserves elapsed open work after outcomes and cancelled tasks cannot acquire evidence', async () => {
  const f = await clinicalFixture(); const finalized = (await f.doctor.send('post', `/prescriptions/${f.prescription.id}/finalize`, { version: 1 })).body.data;
  const first = await MedicationTask.findOne({ prescriptionId: finalized.id }).sort({ dueAt: 1 });
  await f.manager.send('post', `/medication-tasks/${first._id}/outcomes`, { version: 1, outcome: 'missed', actualAt: new Date().toISOString(), reason: 'Independent missed occurrence' }, 201);
  const cancelled = (await f.doctor.send('post', `/prescriptions/${finalized.id}/cancel`, { version: finalized.version, reason: 'Stop future occurrences' })).body.data;
  assert.ok(cancelled.cancelledTasks > 0);
  assert.equal(await AdministrationEvent.countDocuments(), 1);
  assert.ok(await MedicationTask.exists({ prescriptionId: finalized.id, state: 'open', dueAt: { $lte: new Date() } }));
  const closed = await MedicationTask.findOne({ prescriptionId: finalized.id, state: 'cancelled' });
  await f.manager.send('post', `/medication-tasks/${closed._id}/outcomes`, { version: closed.version, outcome: 'missed', actualAt: new Date().toISOString(), reason: 'Cancelled task cannot be acted' }, 409);
  assert.equal((await f.manager.agent.get(`/api/v1/medication-tasks?view=history&status=cancelled`).expect(200)).body.data.length, cancelled.cancelledTasks);
});

test('draft cancellation creates no tasks and resolving every task completes a prescription without inventing administration', async () => {
  const f = await clinicalFixture();
  await f.doctor.send('post', `/prescriptions/${f.prescription.id}/cancel`, { version: 1, reason: 'Discard unfinalized plan' });
  assert.equal(await MedicationTask.countDocuments(), 0);
  const visit = (await f.doctor.send('post', '/clinical-visits', { flockId: f.flock.id, occurredAt: new Date().toISOString(), diagnosis: 'Another recorded visit' }, 201)).body.data;
  const p = (await f.doctor.send('post', `/clinical-visits/${visit.id}/prescriptions`, { items: [{ ...prescriptionItems()[0], durationDays: 1, times: ['00:00'] }] }, 201)).body.data;
  await f.doctor.send('post', `/prescriptions/${p.id}/finalize`, { version: 1 });
  const task = await MedicationTask.findOne({ prescriptionId: p.id });
  await f.manager.send('post', `/medication-tasks/${task._id}/outcomes`, { version: 1, outcome: 'missed', actualAt: new Date().toISOString(), reason: 'Recorded missed outcome' }, 201);
  assert.equal((await Prescription.findById(p.id)).status, 'completed');
  assert.equal((await MedicationTask.findById(task._id)).state, 'missed');
  const now = new Date('2026-11-20T12:00:00Z');
  assert.equal(taskStatus({ state: 'open', dueAt: new Date('2026-11-20T12:01:00Z') }, now), 'scheduled');
  assert.equal(taskStatus({ state: 'open', dueAt: new Date('2026-11-20T11:30:00Z') }, now), 'due');
  assert.equal(taskStatus({ state: 'open', dueAt: new Date('2026-11-20T11:00:00Z') }, now), 'overdue');
});

test('daily-report clinical links validate source scope, dates, ancestry and grants without recording another outcome', async () => {
  const f = await clinicalFixture(); await f.doctor.send('post', `/prescriptions/${f.prescription.id}/finalize`, { version: 1 });
  const task = await MedicationTask.findOne({ prescriptionId: f.prescription.id }).sort({ dueAt: 1 });
  const outcome = (await f.manager.send('post', `/medication-tasks/${task._id}/outcomes`, { version: 1, outcome: 'completed', actualAt: new Date().toISOString(), actualDose: 1, doseUnit: 'ml' }, 201)).body.data;
  const linked = { ...completeReport(), doctorVisitId: f.visit.id, medicines: [{ name: 'Recorded item alpha', quantity: 1, unit: 'ml', prescriptionId: f.prescription.id, administrationEventId: outcome.effectiveOutcome.id }] };
  const report = await createReport(f, today(), linked);
  assert.equal(report.data.doctorVisitId, f.visit.id);
  assert.equal(report.data.medicines[0].administrationEventId, outcome.effectiveOutcome.id);
  assert.equal(await AdministrationEvent.countDocuments(), 1);
  const otherVisit = (await f.doctor.send('post', '/clinical-visits', { flockId: f.flock.id, occurredAt: new Date().toISOString(), diagnosis: 'Different visit' }, 201)).body.data;
  await admin.send('patch', `/daily-reports/${report.id}`, { version: report.version, data: { ...linked, doctorVisitId: otherVisit.id } }, 422);
  await admin.send('patch', `/daily-reports/${report.id}`, { version: report.version, data: { ...linked, medicines: [{ ...linked.medicines[0], administrationEventId: '000000000000000000000001' }] } }, 422);
  const linkedByManager = (await f.manager.send('patch', `/daily-reports/${report.id}`, { version: report.version, data: { ...completeReport(), doctorVisitId: null, medicines: [{ name: 'Reported observation', administrationEventId: outcome.effectiveOutcome.id }] } })).body.data;
  assert.equal(linkedByManager.data.medicines[0].administrationEventId, outcome.effectiveOutcome.id);
  const role = await Role.findOne({ code: 'farm_manager' });
  await admin.send('patch', `/roles/${role._id}`, { version: role.version, name: role.name, description: role.description, scopeMode: 'assigned', permissions: role.permissions.filter((p) => !['clinical.view', 'medication.view'].includes(p)) });
  await f.manager.send('patch', `/daily-reports/${report.id}`, { version: linkedByManager.version, data: linked }, 403);
});
