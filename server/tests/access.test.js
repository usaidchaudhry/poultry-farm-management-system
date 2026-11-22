import { seedDemoScenario } from '../src/scripts/demo-scenario-service.js';
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
import { randomUUID } from 'node:crypto';
import { inventoryModels, InventoryItem, StockLocation, StockBalance, StockMovement, StockOperation, FeedPublication } from '../src/modules/inventory/models.js';
import { formulaModels, FeedFormula, FormulaVersion, FormulaPricing, FormulaSnapshot } from '../src/modules/formulas/models.js';
import { commerceModels, EggPolicy, EggPublication, Sale, Expense, ExpenseClaim } from '../src/modules/commerce/models.js';
import { evidenceModels, EvidenceFile, EvidenceComment } from '../src/modules/evidence/models.js';
import { notificationModels, Notification, NotificationRecipient } from '../src/modules/notifications/models.js';
import { runReminders } from '../src/modules/notifications/worker.js';
import { cleanupFiles, filePath } from '../src/modules/evidence/storage.js';
import { readdir, writeFile, utimes, mkdir, mkdtemp, rm } from 'node:fs/promises';

const initialPassword = 'Temporary-test-password-123';
const changedPassword = 'Changed-test-password-456';
const origin = 'http://localhost:5173';
let replica; let app; let config; let owner; let admin; let reportStock;
const verificationRoot = resolve('../.data/verification');

async function client(email = 'owner@layerflow.test', password = initialPassword) {
  const agent = request.agent(app);
  let csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.data.csrfToken;
  const login = await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf).send({ email, password }).expect(200);
  csrf = login.body.data.csrfToken;
  return {
    agent, user: login.body.data.user,
    async upload(path, buffer, mime = 'image/png', status = 201) {
      const response = await agent.post(`/api/v1${path}`).set('Origin', origin).set('X-CSRF-Token', csrf).set('Content-Type', mime).send(buffer);
      assert.equal(response.status, status, `UPLOAD ${path}: ${JSON.stringify(response.body)}`); return response;
    },
    async send(method, path, input, status = method === 'post' && ['/users', '/roles'].includes(path) ? 201 : 200, key) {
      const request = agent[method](`/api/v1${path}`).set('Origin', origin).set('X-CSRF-Token', csrf);
      if (key) request.set('Idempotency-Key', key);
      const response = await request.send(input);
      assert.equal(response.status, status, `${method.toUpperCase()} ${path}: ${JSON.stringify(response.body)}`);
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
  await mkdir(verificationRoot, { recursive: true });
  const privateImages = await mkdtemp(resolve(verificationRoot, 'api-images-'));
  replica = await MongoMemoryReplSet.create({ binary: { downloadDir: resolve('../.data/mongodb-binaries') }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  config = { ...readConfig({ NODE_ENV: 'test', MONGODB_URI: replica.getUri('layerflow_test'), SESSION_SECRET: 'a-test-only-random-session-secret-with-enough-characters', UPLOAD_DIR: privateImages }), loginLimit: 1000 };
  await connectDatabase(config.mongoUri);
  await applyMigrations(config);
  app = createApp(config);
}, { timeout: 240000 });

beforeEach(async () => {
  reportStock = null;
  for (const model of [...evidenceModels, ...notificationModels]) await model.deleteMany({});
  for (const model of commerceModels) await model.deleteMany({});
  for (const model of formulaModels) await model.deleteMany({});
  for (const model of inventoryModels) await model.deleteMany({});
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

after(async () => {
  await mongoose.disconnect(); if (replica) await replica.stop();
  if (config?.uploadDir) {
    const target = resolve(config.uploadDir);
    if (!target.startsWith(resolve(verificationRoot, 'api-images-'))) throw new Error('Refusing image cleanup outside the generated verification directory.');
    await rm(target, { recursive: true, force: true });
  }
});

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
  const item = (await admin.send('post', '/inventory/items', { name: 'Layer feed', category: 'feed', unit: 'kg' }, 201)).body.data;
  const location = await StockLocation.findOne({ farmId: farmA.id, kind: 'store' });
  reportStock = { itemReference: item.id, locationReference: String(location._id) };
  await admin.send('post', '/inventory/movements', { type: 'opening', itemId: item.id, locationId: String(location._id), quantity: 10000, unit: 'kg', businessDate: placementDate, reason: 'Explicit report fixture opening stock' }, 201, randomUUID());
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
const completeReport = (mortality = 2) => ({ eggs: { jumbo: 10, starter: 20, standard: 100, small: 5, floor: 3, broken: 2, discard: 1 }, mortality, feed: { ...reportStock, bags: 1, bagSizeKg: 50, additionalKg: 2, notes: '' }, waterLitres: 100, lightHours: 16, eggSamples: [{ sampleType: 'single-egg', value: 0.06, unit: 'kg' }, { sampleType: 'single-egg', value: 64, unit: 'g' }, { sampleType: 'tray', value: 1800, unit: 'g' }], medicines: [{ name: 'Recorded medicine', quantity: 1, unit: 'ml', reference: 'Observation only' }], vaccines: [], comments: 'Daily observations', postMortem: 'No diagnosis inferred.' });
const createReport = async (f, date = today(), data = completeReport(), reason = '') => (await admin.send('post', '/daily-reports', { flockId: f.flock.id, businessDate: date, data, reason }, 201)).body.data;

async function stockFixture() {
  const f = await hierarchyFixture(today());
  const item = (await admin.send('post', '/inventory/items', { name: 'Supply for ledger verification', category: 'supply', unit: 'kg' }, 201)).body.data;
  const a = await StockLocation.findOne({ farmId: f.farmA.id, kind: 'store' });
  const b = await StockLocation.findOne({ farmId: f.farmB.id, kind: 'store' });
  const payload = (type, quantity, extra = {}) => ({ type, quantity, itemId: item.id, locationId: String(a._id), unit: 'kg', businessDate: today(), reason: 'Explicit verification posting', ...extra });
  const post = async (type, quantity, extra = {}, status = 201, key = randomUUID(), actor = admin) => (await actor.send('post', '/inventory/movements', payload(type, quantity, extra), status, key)).body;
  return { ...f, item, a, b, payload, post };
}
async function assigned(role, prefix, farmIds) {
  const member = await staff(role, prefix);
  await admin.send('put', `/users/${member.record._id}/scope`, { siteIds: [], farmIds, version: member.record.version });
  return client(`${prefix}@layerflow.test`, changedPassword);
}
test('inventory receipt, issue, paired transfer, reversal, durable retries and reconciliation preserve quantities', async () => {
  const f = await stockFixture();
  const key = randomUUID();
  const receipt = await f.post('receipt', 100, {}, 201, key);
  assert.equal((await f.post('receipt', 100, {}, 201, key)).data[0].id, receipt.data[0].id);
  await f.post('receipt', 101, {}, 409, key);
  await f.post('issue', 20);
  const transfer = await f.post('transfer', 30, { destinationId: String(f.b._id) });
  assert.equal(transfer.data.reduce((sum, m) => sum + m.quantity, 0), 0);
  assert.equal((await StockBalance.findOne({ itemId: f.item.id, locationId: f.a._id })).amount, 50000);
  assert.equal((await StockBalance.findOne({ itemId: f.item.id, locationId: f.b._id })).amount, 30000);
  const checks = (await admin.agent.get(`/api/v1/inventory/reconciliation?itemId=${f.item.id}`).expect(200)).body;
  assert.ok(checks.data.every((r) => r.matches));
  const reversed = await admin.send('post', `/inventory/movements/${transfer.data[0].id}/reverse`, { businessDate: today(), reason: 'Reverse complete paired transfer' }, 201, randomUUID());
  assert.equal(reversed.body.data.length, 2);
  assert.equal((await StockBalance.findOne({ itemId: f.item.id, locationId: f.a._id })).amount, 80000);
  assert.equal((await StockBalance.findOne({ itemId: f.item.id, locationId: f.b._id })).amount, 0);
  await admin.send('post', `/inventory/movements/${transfer.data[1].id}/reverse`, { businessDate: today(), reason: 'Repeated reversal forbidden' }, 409, randomUUID());
  const movement = await StockMovement.findById(receipt.data[0].id); movement.reason = 'Overwrite'; await assert.rejects(movement.save(), /append-only/);
});
test('inventory rejects unsafe units, future postings, invalid openings and negative historical running stock', async () => {
  const f = await stockFixture();
  await admin.send('post', '/inventory/items', { name: 'Wrong feed unit', category: 'feed', unit: 'g' }, 422);
  await f.post('receipt', 1, { unit: 'ml' }, 422);
  await f.post('receipt', 0.00001, {}, 422);
  await f.post('receipt', 1, { businessDate: daysAgo(-1) }, 422);
  await f.post('opening', 100, { businessDate: daysAgo(2) });
  await f.post('opening', 1, {}, 409);
  await f.post('issue', 100, { businessDate: daysAgo(1) });
  await f.post('receipt', 100);
  // Present balance is sufficient, but an earlier issue would make yesterday negative.
  await f.post('issue', 1, { businessDate: daysAgo(2) }, 409);
  assert.equal((await StockBalance.findOne({ itemId: f.item.id, locationId: f.a._id })).amount, 100000);
  const before = await StockMovement.countDocuments();
  await f.post('transfer', 101, { destinationId: String(f.b._id) }, 409);
  assert.equal(await StockMovement.countDocuments(), before);
  await admin.send('patch', `/inventory/items/${f.item.id}`, { name: f.item.name, category: 'supply', unit: 'g', active: true, version: 1 }, 409);
});
test('concurrent inventory issues and identical retry keys commit once without overspending', async () => {
  const f = await stockFixture(); await f.post('receipt', 100);
  const clients = await Promise.all([client(owner.email, changedPassword), client(owner.email, changedPassword)]);
  const outcomes = await Promise.allSettled(clients.map((c) => f.post('issue', 80, {}, 201, randomUUID(), c)));
  assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await StockBalance.findOne({ itemId: f.item.id, locationId: f.a._id })).amount, 20000);
  const key = randomUUID();
  const repeated = await Promise.all(clients.map((c) => f.post('receipt', 0.125, {}, 201, key, c)));
  assert.equal(repeated[0].data[0].id, repeated[1].data[0].id);
  assert.equal((await StockBalance.findOne({ itemId: f.item.id, locationId: f.a._id })).amount, 20125);
});
test('assigned inventory scope protects both transfer endpoints, current balances and restricted history', async () => {
  const f = await stockFixture(); await f.post('receipt', 100, { businessDate: daysAgo(3) });
  const user = await assigned('operation_manager', 'stock-manager', [f.farmA.id]);
  const rows = (await user.agent.get('/api/v1/inventory/balances').expect(200)).body.data;
  assert.ok(rows.every((r) => r.farmId === f.farmA.id));
  assert.equal(rows.find((r) => r.itemId === f.item.id).quantity, 100);
  assert.equal((await user.agent.get(`/api/v1/inventory/movements?itemId=${f.item.id}`).expect(200)).body.data.length, 0);
  await user.agent.get(`/api/v1/inventory/movements?from=${daysAgo(3)}&to=${today()}`).expect(403);
  await f.post('transfer', 20, { destinationId: String(f.b._id) }, 404, randomUUID(), user);
  await f.post('receipt', 1, { locationId: String(f.b._id) }, 404, randomUUID(), user);
  await user.agent.get(`/api/v1/inventory/balances?farmId=${f.farmB.id}`).expect(404);
  const manager = await assigned('farm_manager', 'report-stock-manager', [f.farmA.id]);
  await manager.agent.get('/api/v1/inventory/balances').expect(403);
  const choices = (await manager.agent.get(`/api/v1/inventory/feed-options/${f.flock.id}`).expect(200)).body.data;
  assert.ok(choices.locations.data.every((l) => l.farmId === f.farmA.id));
  await f.post('receipt', 1, {}, 403, randomUUID(), manager);
});
test('daily report feed posts once, refunds or changes location on revisions, and blocks insufficient publication atomically', async () => {
  const f = await hierarchyFixture(today());
  const manager = await assigned('farm_manager', 'feed-report-manager', [f.farmA.id]);
  let report = await createReport(f);
  report = (await manager.send('post', `/daily-reports/${report.id}/submit`, { version: report.version })).body.data;
  assert.equal((await StockBalance.findOne({ itemId: reportStock.itemReference, locationId: reportStock.locationReference })).amount, 9948000);
  await manager.send('post', `/daily-reports/${report.id}/submit`, { version: 1 }, 409);
  assert.equal(await StockMovement.countDocuments({ reportId: report.id, itemId: reportStock.itemReference }), 1);
  const sourceMovement = await StockMovement.findOne({ reportId: report.id });
  await admin.send('post', `/inventory/movements/${sourceMovement._id}/reverse`, { businessDate: today(), reason: 'Cannot manually undo report stock' }, 409, randomUUID());
  const target = (await admin.send('post', '/inventory/locations', { farmId: f.farmA.id, name: 'House feed store', kind: 'store' }, 201)).body.data;
  const change = async (data) => {
    report = (await admin.send('post', `/daily-reports/${report.id}/return`, { version: report.version, reason: 'Correct feed evidence' })).body.data;
    report = (await manager.send('patch', `/daily-reports/${report.id}`, { version: report.version, data })).body.data;
  };
  await change({ ...completeReport(), feed: { ...completeReport().feed, locationReference: target.id } });
  await manager.send('post', `/daily-reports/${report.id}/submit`, { version: report.version, reason: 'Move consumption to correct store' }, 409);
  assert.equal(await ReportRevision.countDocuments({ reportId: report.id }), 1);
  assert.equal(await FeedPublication.countDocuments({ reportId: report.id }), 1);
  assert.equal((await StockBalance.findOne({ itemId: reportStock.itemReference, locationId: reportStock.locationReference })).amount, 9948000);
  await admin.send('post', '/inventory/movements', { type: 'receipt', itemId: reportStock.itemReference, locationId: target.id, quantity: 100, unit: 'kg', businessDate: today(), reason: 'Stock correct consumption location' }, 201, randomUUID());
  report = (await manager.send('post', `/daily-reports/${report.id}/submit`, { version: report.version, reason: 'Correct store unchanged kilograms' })).body.data;
  assert.equal((await StockBalance.findOne({ itemId: reportStock.itemReference, locationId: reportStock.locationReference })).amount, 10000000);
  assert.equal((await StockBalance.findOne({ itemId: reportStock.itemReference, locationId: target.id })).amount, 48000);
  await change({ ...completeReport(), feed: { ...completeReport().feed, locationReference: target.id, additionalKg: 40, bags: 0 } });
  report = (await manager.send('post', `/daily-reports/${report.id}/submit`, { version: report.version, reason: 'Reduce actual consumption by twelve kg' })).body.data;
  assert.equal((await StockBalance.findOne({ itemId: reportStock.itemReference, locationId: target.id })).amount, 60000);
  await change({ ...completeReport(), feed: { ...completeReport().feed, locationReference: target.id, additionalKg: 60, bags: 0 } });
  report = (await manager.send('post', `/daily-reports/${report.id}/submit`, { version: report.version, reason: 'Increase actual consumption by twenty kg' })).body.data;
  assert.equal((await StockBalance.findOne({ itemId: reportStock.itemReference, locationId: target.id })).amount, 40000);
  await change({ ...completeReport(), feed: { ...completeReport().feed, locationReference: target.id, additionalKg: 0, bags: 0 } });
  report = (await manager.send('post', `/daily-reports/${report.id}/submit`, { version: report.version, reason: 'Zero actual recorded consumption' })).body.data;
  assert.equal((await StockBalance.findOne({ itemId: reportStock.itemReference, locationId: target.id })).amount, 100000);
  assert.equal(await FeedPublication.countDocuments({ reportId: report.id }), 5);
  assert.equal(report.publishedSummary.stockPosting, 'posted');
});
test('report feed validates real catalog, farm and consumption path; legacy reports are not silently backfilled', async () => {
  const f = await hierarchyFixture(today());
  const data = completeReport(); data.feed.itemReference = 'Historical descriptive feed';
  let report = await createReport(f, today(), data);
  await admin.send('post', `/daily-reports/${report.id}/submit`, { version: report.version }, 422);
  data.feed = { ...completeReport().feed, locationReference: String((await StockLocation.findOne({ farmId: f.farmB.id, kind: 'store' }))._id) };
  report = (await admin.send('patch', `/daily-reports/${report.id}`, { version: report.version, data })).body.data;
  await admin.send('post', `/daily-reports/${report.id}/submit`, { version: report.version }, 422);
  await admin.send('post', '/inventory/movements', { type: 'issue', itemId: reportStock.itemReference, locationId: reportStock.locationReference, quantity: 52, unit: 'kg', businessDate: today(), reason: 'Duplicate manual feed consumption' }, 422, randomUUID());
  assert.equal(await FeedPublication.countDocuments(), 0);
});
test('low thresholds, stale edits, zero balances, archive guards and cache discrepancies are visible', async () => {
  const f = await stockFixture();
  await admin.send('put', '/inventory/thresholds', { itemId: f.item.id, locationId: String(f.a._id), minimum: 10, version: 1 });
  const low = (await admin.agent.get(`/api/v1/inventory/balances?low=true&itemId=${f.item.id}`).expect(200)).body.data;
  assert.equal(low.length, 1); assert.equal(low[0].quantity, 0);
  await admin.send('put', '/inventory/thresholds', { itemId: f.item.id, locationId: String(f.a._id), minimum: 10, version: 1 }, 409);
  await f.post('receipt', 10);
  await admin.send('patch', `/inventory/locations/${f.a._id}`, { name: f.a.name, active: false, version: f.a.version }, 409);
  await StockBalance.updateOne({ itemId: f.item.id, locationId: f.a._id }, { $inc: { amount: 1 } });
  await f.post('receipt', 1, {}, 409);
  const check = (await admin.agent.get(`/api/v1/inventory/reconciliation?itemId=${f.item.id}`).expect(200)).body.data[0];
  assert.equal(check.matches, false);
  await StockBalance.deleteOne({ itemId: f.item.id, locationId: f.a._id });
  const missing = (await admin.agent.get(`/api/v1/inventory/reconciliation?itemId=${f.item.id}`).expect(200)).body.data[0];
  assert.equal(missing.cacheMissing, true); assert.equal(missing.matches, false); assert.equal(missing.ledgerQuantity, 10);
});

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
  assert.equal(detail.intents[0].status, 'posted');
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

async function formulaFixture(date = today()) {
  const f = await hierarchyFixture(today());
  const items = [];
  for (const name of ['Maize ingredient', 'Soy ingredient']) items.push((await admin.send('post', '/inventory/items', { name, category: 'ingredient', unit: 'kg' }, 201)).body.data);
  const manager = await assigned('farm_manager', 'formula-composer', [f.farmA.id]);
  const operator = await assigned('operation_manager', 'formula-pricer', [f.farmA.id]);
  const composition = { name: 'Layer ration', businessDate: date, bagSizeKg: '50', rows: [{ key: 'maize', itemId: items[0].id, kg: '60' }, { key: 'soy', itemId: items[1].id, kg: '40' }] };
  const payload = { ...composition, farmId: f.farmA.id, code: 'LF-01' };
  const author = date === today() ? manager : admin;
  const formula = (await author.send('post', '/feed-formulas', payload, 201, randomUUID())).body.data;
  return { ...f, items, manager, operator, composition, payload, formula, rates: [{ key: 'maize', rate: '10' }, { key: 'soy', rate: '20' }] };
}
const noFormulaPrices = (value) => {
  for (const [key, child] of Object.entries(value || {})) {
    assert.equal(['rate', 'rates', 'cost', 'costing', 'totalCost', 'costPerKg', 'costPerBag'].includes(key), false, 'Restricted pricing key: ' + key);
    if (child && typeof child === 'object') noFormulaPrices(child);
  }
};
test('formula composition-to-costing handoff calculates the worked example and redacts all restricted reads', async () => {
  const f = await formulaFixture(); let row = f.formula;
  const beforeStock = await StockMovement.countDocuments();
  await f.manager.send('put', '/feed-formulas/' + row.id + '/pricing', { version: 1, rates: f.rates }, 403);
  await f.manager.send('patch', '/feed-formulas/' + row.id, { ...f.composition, version: 1, rates: f.rates }, 422);
  row = (await f.manager.send('post', '/feed-formulas/' + row.id + '/submit', { version: row.version })).body.data;
  await f.manager.send('patch', '/feed-formulas/' + row.id, { ...f.composition, version: row.version }, 409);
  const preview = (await f.operator.send('post', '/feed-formulas/' + row.id + '/preview', { version: row.version, rates: f.rates })).body.data;
  assert.equal(preview.totalKg, '100.000'); assert.equal(preview.totalCost, '1400.00'); assert.equal(preview.costPerKg, '14.0000'); assert.equal(preview.costPerBag, '700.00');
  assert.equal(await FormulaPricing.countDocuments(), 0);
  row = (await f.operator.send('put', '/feed-formulas/' + row.id + '/pricing', { version: row.version, rates: f.rates })).body.data;
  row = (await f.operator.send('post', '/feed-formulas/' + row.id + '/finalize', { version: row.version })).body.data;
  assert.equal(row.status, 'finalized'); assert.equal(row.costing.totalCost, '1400.00');
  noFormulaPrices((await f.manager.agent.get('/api/v1/feed-formulas/' + row.id).expect(200)).body);
  noFormulaPrices((await f.manager.agent.get('/api/v1/feed-formulas').expect(200)).body);
  await f.manager.send('post', '/feed-formulas/' + row.id + '/preview', { version: row.version, rates: f.rates }, 403);
  assert.equal(await StockMovement.countDocuments(), beforeStock);
  const snapshot = await FormulaSnapshot.findOne({ versionId: row.id }); assert.equal(snapshot.totalCost._bsontype, 'Decimal128');
  snapshot.name = 'Overwritten'; await assert.rejects(snapshot.save(), /append-only/);
  const frozen = await FormulaVersion.findById(row.id); frozen.name = 'Overwritten'; await assert.rejects(frozen.save(), /immutable/);
});
test('formula rates require exact row identity, positive precision and current optimistic version', async () => {
  const f = await formulaFixture(); let row = (await f.manager.send('post', '/feed-formulas/' + f.formula.id + '/submit', { version: 1 })).body.data;
  await f.operator.send('post', '/feed-formulas/' + row.id + '/finalize', { version: row.version }, 422);
  for (const rates of [[f.rates[0]], [f.rates[0], f.rates[0]], [{ key: 'unknown', rate: '10' }, f.rates[1]], [{ ...f.rates[0], rate: '0' }, f.rates[1]], [{ ...f.rates[0], rate: '1.12345' }, f.rates[1]]]) await f.operator.send('put', '/feed-formulas/' + row.id + '/pricing', { version: row.version, rates }, 422);
  row = (await f.operator.send('put', '/feed-formulas/' + row.id + '/pricing', { version: row.version, rates: f.rates })).body.data;
  await f.operator.send('put', '/feed-formulas/' + row.id + '/pricing', { version: row.version - 1, rates: f.rates }, 409);
  await f.operator.send('post', '/feed-formulas/' + row.id + '/finalize', { version: row.version, totalCost: '1' }, 422);
  assert.equal(await FormulaSnapshot.countDocuments(), 0);
});
test('formula returns clear estimates, revisions preserve snapshots, and create/revise retries do not duplicate versions', async () => {
  const f = await formulaFixture(); let row = f.formula;
  const createKey = randomUUID();
  const copy = { ...f.payload, code: 'LF-RETRY' };
  const first = (await f.manager.send('post', '/feed-formulas', copy, 201, createKey)).body.data;
  assert.equal((await f.manager.send('post', '/feed-formulas', copy, 201, createKey)).body.data.id, first.id);
  await f.manager.send('post', '/feed-formulas', { ...copy, name: 'Changed request' }, 409, createKey);
  row = (await f.manager.send('post', '/feed-formulas/' + row.id + '/submit', { version: 1 })).body.data;
  row = (await f.operator.send('put', '/feed-formulas/' + row.id + '/pricing', { version: row.version, rates: f.rates })).body.data;
  await f.operator.send('post', '/feed-formulas/' + row.id + '/return', { version: row.version, reason: '' }, 422);
  row = (await f.operator.send('post', '/feed-formulas/' + row.id + '/return', { version: row.version, reason: 'Review quantities before pricing' })).body.data;
  assert.equal(await FormulaPricing.countDocuments(), 0); noFormulaPrices(row);
  row = (await f.manager.send('patch', '/feed-formulas/' + row.id, { ...f.composition, version: row.version })).body.data;
  row = (await f.manager.send('post', '/feed-formulas/' + row.id + '/submit', { version: row.version })).body.data;
  row = (await f.operator.send('put', '/feed-formulas/' + row.id + '/pricing', { version: row.version, rates: f.rates })).body.data;
  row = (await f.operator.send('post', '/feed-formulas/' + row.id + '/finalize', { version: row.version })).body.data;
  const snapshotBefore = JSON.stringify((await FormulaSnapshot.findOne({ versionId: row.id })).toObject());
  const key = randomUUID(); const input = { version: row.version, businessDate: today(), reason: 'Plan a revised ration' };
  const draft = (await f.manager.send('post', '/feed-formulas/' + row.id + '/revise', input, 200, key)).body.data;
  assert.equal(draft.number, 2); assert.equal(draft.previousVersionId, row.id); noFormulaPrices(draft);
  assert.equal((await f.manager.send('post', '/feed-formulas/' + row.id + '/revise', input, 200, key)).body.data.id, draft.id);
  await f.manager.send('post', '/feed-formulas/' + row.id + '/revise', input, 409, randomUUID());
  assert.equal(JSON.stringify((await FormulaSnapshot.findOne({ versionId: row.id })).toObject()), snapshotBefore);
  assert.equal(await FormulaVersion.countDocuments({ formulaId: row.formulaId }), 2);
  const previousCosting = (await f.operator.agent.get('/api/v1/feed-formulas/' + row.id).expect(200)).body.data.costing;
  assert.equal(previousCosting.totalCost, '1400.00'); assert.equal(previousCosting.rows[0].cost, '600.00');
});
test('formula decimal rounding sums rounded rows and computes bags from the unrounded cost/kg ratio', async () => {
  const f = await formulaFixture();
  let row = (await f.manager.send('patch', '/feed-formulas/' + f.formula.id, { ...f.composition, bagSizeKg: '10000', rows: [{ ...f.composition.rows[0], kg: '3' }], version: 1 })).body.data;
  row = (await f.manager.send('post', '/feed-formulas/' + row.id + '/submit', { version: row.version })).body.data;
  const cost = (await f.operator.send('post', '/feed-formulas/' + row.id + '/preview', { version: row.version, rates: [{ key: 'maize', rate: '0.3333' }] })).body.data;
  assert.equal(cost.totalCost, '1.00'); assert.equal(cost.costPerKg, '0.3333'); assert.equal(cost.costPerBag, '3333.33');
  row = (await f.operator.send('post', '/feed-formulas/' + row.id + '/return', { version: row.version, reason: 'Verify rounded row totals' })).body.data;
  row = (await f.manager.send('patch', '/feed-formulas/' + row.id, { ...f.composition, rows: f.composition.rows.map((r) => ({ ...r, kg: '1' })), version: row.version })).body.data;
  row = (await f.manager.send('post', '/feed-formulas/' + row.id + '/submit', { version: row.version })).body.data;
  const tiny = (await f.operator.send('post', '/feed-formulas/' + row.id + '/preview', { version: row.version, rates: f.rates.map((r) => ({ ...r, rate: '0.005' })) })).body.data;
  assert.equal(tiny.totalCost, '0.02'); assert.ok(tiny.rows.every((r) => r.cost === '0.01'));
});
test('formula scope, date windows, pending exception and granular pricing grants remain enforced', async () => {
  const f = await formulaFixture(daysAgo(3));
  const other = await assigned('operation_manager', 'other-formula-pricer', [f.farmB.id]);
  await other.agent.get('/api/v1/feed-formulas/' + f.formula.id).expect(404);
  await f.operator.agent.get('/api/v1/feed-formulas/' + f.formula.id).expect(403);
  let row = (await admin.send('post', '/feed-formulas/' + f.formula.id + '/submit', { version: 1 })).body.data;
  assert.equal((await f.operator.agent.get('/api/v1/feed-formulas?view=pending').expect(200)).body.data.length, 1);
  await f.operator.agent.get('/api/v1/feed-formulas?view=pending&from=' + daysAgo(3)).expect(422);
  row = (await f.operator.send('put', '/feed-formulas/' + row.id + '/pricing', { version: row.version, rates: f.rates })).body.data;
  const role = await Role.findOne({ code: 'operation_manager' });
  const roleInput = { name: role.name, description: role.description, scopeMode: role.scopeMode, version: role.version, permissions: role.permissions.filter((p) => p !== 'feed-formulas.cost-view') };
  await admin.send('patch', '/roles/' + role._id, roleInput);
  noFormulaPrices((await f.operator.agent.get('/api/v1/feed-formulas/' + row.id).expect(200)).body);
  await f.operator.send('post', '/feed-formulas/' + row.id + '/preview', { version: row.version, rates: f.rates }, 403);
  await f.operator.send('post', '/feed-formulas/' + row.id + '/finalize', { version: row.version }, 403);
  row = (await admin.send('post', '/feed-formulas/' + row.id + '/finalize', { version: row.version })).body.data;
  await f.operator.agent.get('/api/v1/feed-formulas/' + row.id).expect(403);
  const hiddenFarm = { ...f.payload, farmId: f.farmB.id, code: 'FORGED-FARM', businessDate: today() };
  await f.manager.send('post', '/feed-formulas', hiddenFarm, 404, randomUUID());
});
test('formula validation and concurrent finalization protect catalog, stable rows and unique snapshot evidence', async () => {
  const f = await formulaFixture();
  const archiveDenied = await admin.send('patch', '/organization/farms/' + f.farmA.id + '/status', { version: f.farmA.version, archived: true }, 409);
  assert.equal(archiveDenied.body.code, 'UNFINISHED_FORMULAS');
  for (const extra of [{ rows: [{ ...f.composition.rows[0], kg: '1.0001' }] }, { rows: [f.composition.rows[0], f.composition.rows[0]] }, { rows: [{ ...f.composition.rows[0], itemId: reportStock.itemReference }] }, { rows: [{ ...f.composition.rows[0], kg: '-1' }] }, { status: 'finalized' }]) await f.manager.send('patch', '/feed-formulas/' + f.formula.id, { ...f.composition, version: 1, ...extra }, 422);
  let row = (await f.manager.send('post', '/feed-formulas/' + f.formula.id + '/submit', { version: 1 })).body.data;
  row = (await f.operator.send('put', '/feed-formulas/' + row.id + '/pricing', { version: row.version, rates: f.rates })).body.data;
  const clients = await Promise.all([client(owner.email, changedPassword), client(owner.email, changedPassword)]);
  const outcomes = await Promise.allSettled(clients.map((c) => c.send('post', '/feed-formulas/' + row.id + '/finalize', { version: row.version })));
  assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await FormulaSnapshot.countDocuments({ versionId: row.id }), 1);
  const auditRows = await AuditEvent.find({ action: /^formula./ });
  for (const event of auditRows) noFormulaPrices(event.changes);
  const latest = (await admin.agent.get('/api/v1/feed-formulas/' + row.id).expect(200)).body.data;
  const archived = (await f.manager.send('post', '/feed-formulas/' + row.id + '/archive', { version: latest.version, reason: 'Completed planning document' })).body.data;
  assert.equal(archived.archived, true);
  assert.equal((await f.manager.agent.get('/api/v1/feed-formulas?archived=true').expect(200)).body.data.length, 1);
});

async function commerceFixture() {
  const f = await hierarchyFixture(today());
  const operator = await assigned('operation_manager', 'commerce-operator', [f.farmA.id]);
  const reportData = { ...completeReport(0), eggs: { jumbo: 0, starter: 0, standard: 720, small: 0, floor: 10, broken: 3, discard: 2 }, feed: { ...completeReport().feed, bags: 0, bagSizeKg: 0, additionalKg: 0 } };
  let report = await createReport(f, today(), reportData);
  report = (await admin.send('post', '/daily-reports/' + report.id + '/submit', { version: report.version })).body.data;
  const config = await EggPolicy.findOne({ farmId: f.farmA.id });
  const item = await InventoryItem.findOne({ eggCategory: 'standard' });
  const saleInput = (quantity = 1, extra = {}) => ({ farmId: f.farmA.id, locationId: String(config.locationId), businessDate: today(), buyer: 'Verified buyer', paymentStatus: 'pending', lines: [{ key: 'line-a', category: 'standard', quantity, unit: 'peti', unitPrice: '18000' }], ...extra });
  const postSale = async (input = saleInput(), key = randomUUID(), status = 201, actor = operator) => (await actor.send('post', '/sales', input, status, key)).body;
  const balance = async () => (await StockBalance.findOne({ itemId: item._id, locationId: config.locationId })).amount / 1000;
  return { ...f, operator, reportData, report, config, item, saleInput, postSale, balance };
}
test('egg publication derives saleable categories once; whole-Peti sales, retries and overselling reconcile', async () => {
  const f = await commerceFixture();
  assert.equal(await f.balance(), 720); assert.equal(f.report.publishedSummary.saleableEggs, 720);
  await admin.send('post', '/daily-reports/' + f.report.id + '/submit', { version: 1 }, 409);
  assert.equal(await EggPublication.countDocuments({ reportId: f.report.id }), 1);
  const stock = (await f.operator.agent.get('/api/v1/egg-production/farms/' + f.farmA.id + '/stock').expect(200)).body.data.find((r) => r.category === 'standard');
  assert.equal(stock.petiEquivalent, '2.000');
  const key = randomUUID(); const sale = (await f.postSale(f.saleInput(), key)).data;
  assert.equal(sale.total, '18000.00'); assert.equal(sale.totalEggs, 360); assert.equal(await f.balance(), 360);
  assert.equal((await f.postSale(f.saleInput(), key)).data.id, sale.id); assert.equal(await f.balance(), 360);
  await f.postSale(f.saleInput(2), key, 409);
  await f.postSale(f.saleInput(2), randomUUID(), 409);
  await f.postSale(f.saleInput(1, { lines: [{ key: 'a', category: 'standard', quantity: 1, unit: 'egg', unitPrice: '1' }, { key: 'b', category: 'jumbo', quantity: 1, unit: 'egg', unitPrice: '1' }] }), randomUUID(), 409);
  assert.equal(await f.balance(), 360); assert.equal(await Sale.countDocuments(), 1);
  const production = (await admin.agent.get('/api/v1/egg-production').expect(200)).body.data[0];
  assert.equal(production.eggs.floor, 10); assert.equal(production.saleableEggs, 720);
  const evidence = await EggPublication.findOne({ reportId: f.report.id }); evidence.counts = {}; await assert.rejects(evidence.save(), /append-only/);
});
test('sold eggs block report reductions; cancellation restores stock and allows a transactional correction', async () => {
  const f = await commerceFixture(); const sale = (await f.postSale()).data; let report = f.report;
  report = (await admin.send('post', '/daily-reports/' + report.id + '/return', { version: report.version, reason: 'Correct collection evidence' })).body.data;
  report = (await admin.send('patch', '/daily-reports/' + report.id, { version: report.version, data: { ...f.reportData, eggs: { ...f.reportData.eggs, standard: 100 } } })).body.data;
  assert.equal(await f.balance(), 360);
  await admin.send('post', '/daily-reports/' + report.id + '/submit', { version: report.version, reason: 'Counted only one hundred' }, 409);
  assert.equal(await EggPublication.countDocuments({ reportId: report.id }), 1); assert.equal(await ReportRevision.countDocuments({ reportId: report.id }), 1);
  assert.equal((await DailyReport.findById(report.id)).publishedSummary.saleableEggs, 720);
  const cancelled = (await f.operator.send('post', '/sales/' + sale.id + '/cancel', { version: sale.version, reason: 'Cancelled before physical dispatch' })).body.data;
  assert.equal(cancelled.status, 'cancelled'); assert.equal(await f.balance(), 720);
  await f.operator.send('post', '/sales/' + sale.id + '/cancel', { version: cancelled.version, reason: 'No duplicate return to stock' }, 409);
  report = (await admin.send('post', '/daily-reports/' + report.id + '/submit', { version: report.version, reason: 'Corrected after cancelled dispatch' })).body.data;
  assert.equal(await f.balance(), 100); assert.equal(report.publishedSummary.saleableEggs, 100);
  const finance = (await f.operator.agent.get('/api/v1/finance').expect(200)).body.meta.totals; assert.equal(finance.revenue, '0.00');
});
test('concurrent egg sales cannot oversell; dispatched sales and posted content cannot be rewritten', async () => {
  const f = await commerceFixture(); const clients = await Promise.all([client(owner.email, changedPassword), client(owner.email, changedPassword)]);
  const results = await Promise.allSettled(clients.map((c) => f.postSale(f.saleInput(2), randomUUID(), 201, c)));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1); assert.equal(await f.balance(), 0);
  let sale = results.find((r) => r.status === 'fulfilled').value.data;
  const blocked = await admin.send('patch', '/organization/farms/' + f.farmA.id + '/status', { version: f.farmA.version, archived: true }, 409); assert.equal(blocked.body.code, 'UNDISPATCHED_SALES');
  sale = (await f.operator.send('post', '/sales/' + sale.id + '/dispatch', { version: sale.version })).body.data;
  await f.operator.send('post', '/sales/' + sale.id + '/cancel', { version: sale.version, reason: 'Physical return is unsupported' }, 409);
  const snapshot = await Sale.findById(sale.id); snapshot.lines[0].quantity = 3; await assert.rejects(snapshot.save(), /immutable/);
  sale = (await f.operator.send('post', '/sales/' + sale.id + '/payment', { version: sale.version, paymentStatus: 'paid' })).body.data;
  assert.equal(sale.paymentStatus, 'paid'); assert.equal(await f.balance(), 0);
  await f.operator.send('post', '/sales/' + sale.id + '/payment', { version: sale.version - 1, paymentStatus: 'pending' }, 409);
});
test('finance example, payment status, source deduplication and void/replacement produce exact recorded results', async () => {
  const f = await commerceFixture(); let sale = (await f.postSale()).data;
  const source = await StockMovement.findOne({ itemId: reportStock.itemReference, type: 'opening' });
  const input = { farmId: f.farmA.id, businessDate: today(), category: 'feed', amount: '7000', description: 'Recorded feed invoice', reference: 'INV-7000', sourceMovementId: String(source._id) };
  const key = randomUUID(); let expense = (await f.operator.send('post', '/expenses', input, 201, key)).body.data;
  assert.equal((await f.operator.send('post', '/expenses', input, 201, key)).body.data.id, expense.id);
  await f.operator.send('post', '/expenses', { ...input, reference: 'Different invoice same source' }, 409, randomUUID());
  await f.operator.send('post', '/expenses', { ...input, sourceMovementId: null, reference: 'inv-7000' }, 409, randomUUID());
  let totals = (await f.operator.agent.get('/api/v1/finance').expect(200)).body.meta.totals;
  assert.deepEqual(totals, { revenue: '18000.00', unpaid: '18000.00', recordedCost: '7000.00', operatingSurplus: '11000.00', costsIncomplete: true });
  const ingredient = (await admin.send('post', '/inventory/items', { name: 'Financial example ingredient', category: 'ingredient', unit: 'kg' }, 201)).body.data;
  let formula = (await admin.send('post', '/feed-formulas', { farmId: f.farmA.id, code: 'NO-EXPENSE', name: 'Planning only', businessDate: today(), rows: [{ key: 'row', itemId: ingredient.id, kg: '100' }] }, 201, randomUUID())).body.data;
  formula = (await admin.send('post', '/feed-formulas/' + formula.id + '/submit', { version: formula.version })).body.data;
  formula = (await admin.send('put', '/feed-formulas/' + formula.id + '/pricing', { version: formula.version, rates: [{ key: 'row', rate: '14' }] })).body.data;
  await admin.send('post', '/feed-formulas/' + formula.id + '/finalize', { version: formula.version });
  assert.deepEqual((await f.operator.agent.get('/api/v1/finance').expect(200)).body.meta.totals, totals);
  sale = (await f.operator.send('post', '/sales/' + sale.id + '/payment', { version: sale.version, paymentStatus: 'paid' })).body.data;
  totals = (await f.operator.agent.get('/api/v1/finance').expect(200)).body.meta.totals;
  assert.equal(totals.revenue, '18000.00'); assert.equal(totals.unpaid, '0.00');
  const replacementKey = randomUUID(); const replacementInput = { version: expense.version, reason: 'Correct invoiced amount', expense: { ...input, amount: '6000' } };
  const oldId = expense.id;
  expense = (await f.operator.send('post', '/expenses/' + oldId + '/replace', replacementInput, 200, replacementKey)).body.data;
  assert.equal((await f.operator.send('post', '/expenses/' + oldId + '/replace', replacementInput, 200, replacementKey)).body.data.id, expense.id);
  assert.equal((await Expense.findById(oldId)).status, 'voided'); assert.equal(expense.replacesId, oldId);
  totals = (await f.operator.agent.get('/api/v1/finance').expect(200)).body.meta.totals; assert.equal(totals.operatingSurplus, '12000.00');
  await f.operator.send('post', '/expenses/' + expense.id + '/void', { version: expense.version, reason: 'Invoice withdrawn' });
  totals = (await f.operator.agent.get('/api/v1/finance').expect(200)).body.meta.totals; assert.equal(totals.recordedCost, '0.00');
  await f.operator.send('post', '/expenses', input, 409, randomUUID());
  assert.equal(await ExpenseClaim.countDocuments(), 2);
});
test('commerce validates units, categories, source scope and date policies without spending another farm stock', async () => {
  const f = await commerceFixture(); const other = await assigned('operation_manager', 'other-commerce', [f.farmB.id]); const manager = await assigned('farm_manager', 'farm-commerce', [f.farmA.id]);
  await other.agent.get('/api/v1/sales?farmId=' + f.farmA.id).expect(404);
  await other.agent.get('/api/v1/egg-production/farms/' + f.farmA.id + '/stock').expect(404);
  await f.postSale(f.saleInput(), randomUUID(), 404, other);
  await manager.agent.get('/api/v1/finance').expect(403); await f.postSale(f.saleInput(), randomUUID(), 403, manager);
  await f.postSale(f.saleInput(1, { lines: [{ key: 'a', category: 'floor', quantity: 1, unit: 'egg', unitPrice: '10' }] }), randomUUID(), 422);
  await f.postSale(f.saleInput(1, { lines: [{ key: 'a', category: 'standard', quantity: 1.5, unit: 'peti', unitPrice: '10' }] }), randomUUID(), 422);
  await f.postSale(f.saleInput(1, { total: '1' }), randomUUID(), 422);
  await f.postSale(f.saleInput(1, { businessDate: daysAgo(-1) }), randomUUID(), 422);
  await f.operator.agent.get('/api/v1/finance?from=' + daysAgo(3) + '&to=' + today()).expect(403);
  await f.operator.send('post', '/expenses', { farmId: f.farmA.id, businessDate: today(), category: 'other', amount: '1', description: '' }, 422, randomUUID());
  await f.operator.send('put', '/egg-production/farms/' + f.farmA.id + '/policy', { version: 1, locationId: String(f.config.locationId), categories: ['standard'], reason: 'Only supervisors configure policy' }, 403);
  assert.equal(await f.balance(), 720);
});
test('egg policy versions affect future reports while corrected reports retain their original room and saleability', async () => {
  const f = await commerceFixture(); const room = (await admin.send('post', '/inventory/locations', { farmId: f.farmA.id, name: 'New collection room', kind: 'collection' }, 201)).body.data;
  const policy = (await admin.send('put', '/egg-production/farms/' + f.farmA.id + '/policy', { version: 1, locationId: room.id, categories: ['standard'], reason: 'New room for future reports' })).body.data; assert.equal(policy.version, 2);
  let report = (await admin.send('post', '/daily-reports/' + f.report.id + '/return', { version: f.report.version, reason: 'Adjust recorded production' })).body.data;
  report = (await admin.send('patch', '/daily-reports/' + report.id, { version: report.version, data: { ...f.reportData, eggs: { ...f.reportData.eggs, standard: 730, jumbo: 2 } } })).body.data;
  report = (await admin.send('post', '/daily-reports/' + report.id + '/submit', { version: report.version, reason: 'Ten additional counted eggs' })).body.data;
  assert.equal(report.publishedSummary.eggPublication.policyVersion, 1); assert.equal(report.publishedSummary.eggPublication.locationId, String(f.config.locationId)); assert.equal(await f.balance(), 730);
  const details = (await admin.agent.get('/api/v1/daily-reports/' + report.id).expect(200)).body.data;
  assert.equal(details.summary.saleableEggs, 732); assert.equal(details.summary.stockPosting, 'posted');
  const house = await f.create('house', { name: 'Second production house', farmId: f.farmA.id });
  const flock = await f.create('flock', { name: 'Second production flock', houseId: house.id, placementDate: today(), initialCount: 100 });
  let second = await createReport({ flock }, today(), f.reportData);
  second = (await admin.send('post', '/daily-reports/' + second.id + '/submit', { version: second.version })).body.data;
  assert.equal(second.publishedSummary.eggPublication.policyVersion, 2); assert.equal(second.publishedSummary.eggPublication.locationId, room.id);
});

test('legacy egg initialization is explicit, migration-safe, source-controlled and repeatable without duplicate stock', async () => {
  const f = await commerceFixture();
  // Simulate a pre-Phase-8 install: report evidence exists, egg collections do not.
  await StockMovement.deleteMany({ reportId: f.report.id, type: 'report-eggs' });
  await EggPublication.deleteMany({ reportId: f.report.id });
  await StockBalance.deleteMany({ itemId: { $in: (await InventoryItem.find({ category: 'egg' })).map((r) => r._id) } });
  await Migration.deleteOne({ _id: '007-eggs-sales-finance' }); await applyMigrations(config);
  assert.equal(await EggPublication.countDocuments(), 0);
  await f.operator.send('post', '/egg-production/' + f.report.id + '/backfill', { reason: 'Operators cannot initialize unknown old stock' }, 403);
  const first = (await admin.send('post', '/egg-production/' + f.report.id + '/backfill', { reason: 'Verified physical opening excludes these collected eggs' })).body.data;
  const repeat = (await admin.send('post', '/egg-production/' + f.report.id + '/backfill', { reason: 'Retry the verified initialization' })).body.data;
  assert.equal(first.id, repeat.id); assert.equal(await f.balance(), 720);
  assert.equal(await StockMovement.countDocuments({ reportId: f.report.id, type: 'report-eggs' }), 1);
  const source = await StockMovement.findOne({ reportId: f.report.id, type: 'report-eggs' });
  await admin.send('post', '/inventory/movements/' + source._id + '/reverse', { businessDate: today(), reason: 'Production must be corrected from report' }, 409, randomUUID());
});

const imageFixture = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=', 'base64');
const evidencePath = (type, id) => '/evidence/' + type + '/' + id;
test('phase 9 private evidence validates type, limits, scope, comments and sealed report retention', async () => {
  const f = await hierarchyFixture(today()); const report = await createReport(f);
  const manager = await assigned('farm_manager', 'evidence-author', [f.farmA.id]);
  const outsider = await assigned('farm_manager', 'evidence-outsider', [f.farmB.id]);
  const path = evidencePath('report', report.id); const upload = path + '/files?name=postmortem.png&purpose=post-mortem';
  const first = (await manager.upload(upload, imageFixture)).body.data;
  assert.equal(first.storageKey, undefined); assert.equal(first.purpose, 'post-mortem');
  const download = await manager.agent.get('/api/v1' + first.downloadPath).expect(200); assert.equal(download.headers['content-type'], 'image/png'); assert.equal(download.headers['cache-control'], 'no-store'); assert.equal(download.headers['x-content-type-options'], 'nosniff');
  await outsider.agent.get('/api/v1' + first.downloadPath).expect(404);
  await request(app).get('/api/v1' + first.downloadPath).expect(401);
  await manager.upload(upload, imageFixture, 'image/jpeg', 422);
  await manager.upload(upload, Buffer.from('not a PNG'), 'image/png', 422);
  await manager.upload(upload, Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png', 413);
  await manager.send('post', path + '/comments', { text: 'Post-mortem image recorded without inferred diagnosis.' }, 201);
  assert.equal((await manager.agent.get('/api/v1' + path)).body.data.comments[0].authorId, manager.user.id);
  const deletable = (await manager.upload(upload, imageFixture)).body.data;
  await admin.send('delete', '/evidence/files/' + deletable.id, undefined, 403);
  await manager.send('delete', '/evidence/files/' + deletable.id);
  await manager.agent.get('/api/v1' + deletable.downloadPath).expect(404);
  for (let i=0; i<4; i++) await manager.upload(upload, imageFixture);
  const diskBefore = (await readdir(config.uploadDir)).length;
  await manager.upload(upload, imageFixture, 'image/png', 409);
  assert.equal((await readdir(config.uploadDir)).length, diskBefore, 'failed linking cleans its prewritten file');
  let submitted = (await manager.send('post', '/daily-reports/' + report.id + '/submit', { version: report.version })).body.data;
  await manager.upload(upload, imageFixture, 'image/png', 409);
  await manager.send('post', path + '/comments', { text: 'Closed record comment denied' }, 409);
  await admin.send('post', '/daily-reports/' + report.id + '/return', { version: submitted.version, reason: 'Recheck retained evidence' });
  await manager.send('delete', '/evidence/files/' + first.id, undefined, 409);
  assert.ok((await EvidenceFile.findById(first.id)).sealedAt);
  assert.equal(await AuditEvent.countDocuments({ action: 'evidence.draft-deleted' }), 1);
});
test('phase 9 clinical and expense attachments inherit parent locks, permissions and date windows; cleanup preserves linked images', async () => {
  const f = await clinicalFixture(); const path = evidencePath('clinical-visit', f.visit.id);
  const file = (await f.doctor.upload(path + '/files?name=visit.png', imageFixture)).body.data;
  await f.manager.agent.get('/api/v1' + file.downloadPath).expect(403);
  await f.doctor.send('post', '/prescriptions/' + f.prescription.id + '/finalize', { version: 1 });
  await f.doctor.send('delete', '/evidence/files/' + file.id, undefined, 409);
  const expense = (await admin.send('post', '/expenses', { farmId: f.farmA.id, businessDate: today(), category: 'electricity', amount: '10' }, 201, randomUUID())).body.data;
  const receipt = (await admin.upload(evidencePath('expense', expense.id) + '/files?name=receipt.png', imageFixture)).body.data;
  await admin.send('post', '/expenses/' + expense.id + '/void', { version: expense.version, reason: 'Retain original receipt after void' });
  await admin.send('delete', '/evidence/files/' + receipt.id, undefined, 409);
  await admin.agent.get('/api/v1' + receipt.downloadPath).expect(200);
  const orphan = randomUUID() + '.png'; await writeFile(filePath(config, orphan), imageFixture); const old = new Date(Date.now() - 7200000); await utimes(filePath(config, orphan), old, old);
  const linked = await EvidenceFile.findById(receipt.id); await utimes(filePath(config, linked.storageKey), old, old); await cleanupFiles(config);
  assert.equal((await readdir(config.uploadDir)).includes(orphan), false); await admin.agent.get('/api/v1' + receipt.downloadPath).expect(200);
  await ClinicalVisit.updateOne({ _id: f.visit.id }, { $set: { businessDate: daysAgo(5) } });
  const restricted = await assigned('doctor', 'restricted-evidence', [f.farmA.id]); const role = await Role.findOne({ code: 'doctor' }); await Role.updateOne({ _id: role._id }, { $pull: { permissions: 'clinical.history.view' } });
  await restricted.agent.get('/api/v1' + file.downloadPath).expect(403);
  const archivedExpense = (await admin.send('post', '/expenses', { farmId: f.farmA.id, businessDate: today(), category: 'electricity', amount: '1' }, 201, randomUUID())).body.data;
  await H.farm.updateOne({ _id: f.farmA.id }, { $set: { status: 'archived' } });
  await admin.upload(evidencePath('expense', archivedExpense.id) + '/files?name=archived.png', imageFixture, 'image/png', 409);
  assert.equal((await admin.agent.get('/api/v1' + evidencePath('expense', archivedExpense.id)).expect(200)).body.data.editable, false);

});
test('phase 9 medical routing, Owner fallback, independent seen/acknowledgement, response and critical resolution are durable', async () => {
  const f = await hierarchyFixture(today()); const manager = await assigned('farm_manager', 'alert-manager', [f.farmA.id]);
  let fallback = (await manager.send('post', '/notifications', { farmId: f.farmA.id, title: 'No clinician assigned', message: 'Review observed flock change', severity: 'warning' }, 201)).body.data;
  assert.equal(fallback.ownerFallback, true); assert.equal(fallback.doctorCount, 0);
  assert.ok(await NotificationRecipient.exists({ notificationId: fallback.id, userId: owner.id }));
  const doctor = await assigned('doctor', 'alert-doctor', [f.farmA.id]); const other = await assigned('doctor', 'other-doctor', [f.farmB.id]);
  let alert = (await manager.send('post', '/notifications', { farmId: f.farmA.id, title: 'Observed urgent change', message: 'Doctor review requested', severity: 'critical' }, 201)).body.data;
  assert.equal(alert.doctorCount, 1); assert.equal(alert.ownerFallback, false);
  await other.agent.get('/api/v1/notifications/' + alert.id).expect(404);
  await manager.send('post', '/notifications', { farmId: f.farmB.id, title: 'Forbidden farm', message: 'Invalid scope', severity: 'warning' }, 404);
  assert.equal((await doctor.agent.get('/api/v1/notifications/unread')).body.data.count, 1);
  await doctor.send('post', '/notifications/' + alert.id + '/seen', {});
  assert.equal((await doctor.agent.get('/api/v1/notifications/unread')).body.data.count, 0);
  assert.equal((await NotificationRecipient.findOne({ notificationId: alert.id, userId: manager.user.id })).seenAt, undefined);
  await doctor.send('post', '/notifications/' + alert.id + '/resolve', { version: alert.version, note: 'Needs acknowledgement first' }, 409);
  await doctor.send('post', '/notifications/' + alert.id + '/respond', { version: alert.version, note: '' }, 422);
  alert = (await doctor.send('post', '/notifications/' + alert.id + '/acknowledge', { version: alert.version })).body.data;
  await manager.send('post', '/notifications/' + alert.id + '/respond', { version: alert.version, note: 'No clinical response grant' }, 403);
  alert = (await doctor.send('post', '/notifications/' + alert.id + '/respond', { version: alert.version, note: 'Recorded assessment; follow the documented clinical visit.' })).body.data;
  await admin.send('post', '/notifications/' + alert.id + '/resolve', { version: 1, note: 'Stale resolution denied' }, 409);
  alert = (await doctor.send('post', '/notifications/' + alert.id + '/resolve', { version: alert.version, note: 'Follow-up documented and reviewed.' })).body.data;
  const details = (await doctor.agent.get('/api/v1/notifications/' + alert.id).expect(200)).body.data;
  assert.equal(details.status, 'resolved'); assert.deepEqual(details.events.map((r) => r.action), ['raised', 'acknowledge', 'respond', 'resolve']);
  assert.equal(details.events[2].actorId, doctor.user.id); assert.equal(details.events[2].clinical, true);
  assert.equal((await NotificationRecipient.findOne({ notificationId: alert.id, userId: owner.id })).acknowledgedAt, undefined);
  const current = await User.findById(doctor.user.id); await admin.send('put', '/users/' + doctor.user.id + '/scope', { version: current.version, farmIds: [f.farmB.id], siteIds: [] });
  const relogged = await client('alert-doctor@layerflow.test', changedPassword); await relogged.agent.get('/api/v1/notifications/' + alert.id).expect(404);
});
test('phase 9 reminder scans deduplicate concurrent runs, clear source conditions and create a new low-stock episode', async () => {
  const f = await formulaFixture(); let formula = (await f.manager.send('post', '/feed-formulas/' + f.formula.id + '/submit', { version: 1 })).body.data;
  const balance = await StockBalance.findOne({ farmId: f.farmA.id }); await StockBalance.updateOne({ _id: balance._id }, { $set: { minimum: balance.amount + 1000 } });
  const report = await createReport(f, today(), { ...completeReport(15), feed: { bags: 0, bagSizeKg: 0, additionalKg: 0 } }); await admin.send('post', '/daily-reports/' + report.id + '/submit', { version: 1 });
  await Promise.all([runReminders(config), runReminders(config)]); assert.equal(await Notification.countDocuments({ kind: 'low-stock', status: 'open' }), 1); assert.equal(await Notification.countDocuments({ kind: 'awaiting-costing' }), 1); assert.equal(await Notification.countDocuments({ kind: 'mortality' }), 1);
  const low = await Notification.findOne({ kind: 'low-stock' }); await f.operator.send('post', '/notifications/' + low._id + '/resolve', { version: 1, note: 'Must use inventory' }, 409);
  const managerInbox = (await f.manager.agent.get('/api/v1/notifications').expect(200)).body.data; assert.equal(managerInbox.some((r) => r.kind === 'awaiting-costing' || r.kind === 'low-stock'), false);
  formula = (await f.operator.send('post', '/feed-formulas/' + formula.id + '/return', { version: formula.version, reason: 'Composition revision requested' })).body.data;
  await StockBalance.updateOne({ _id: balance._id }, { $set: { minimum: 0 } }); await runReminders(config); assert.equal((await Notification.findById(low._id)).status, 'resolved'); assert.equal(await Notification.countDocuments({ kind: 'awaiting-costing', status: 'resolved' }), 1);
  await StockBalance.updateOne({ _id: balance._id }, { $set: { minimum: balance.amount + 1000 } }); await runReminders(config); assert.equal(await Notification.countDocuments({ kind: 'low-stock' }), 2); assert.equal(await Notification.countDocuments({ kind: 'low-stock', status: 'open' }), 1);
});

test('phase 9 overdue medication reminders retain source authorization and clear only after a real recorded outcome', async () => {
  const f = await clinicalFixture(); await f.doctor.send('post', '/prescriptions/' + f.prescription.id + '/finalize', { version: 1 });
  const task = await MedicationTask.findOne({ prescriptionId: f.prescription.id }).sort({ dueAt: 1 });
  await MedicationTask.updateOne({ _id: task._id }, { $set: { dueAt: new Date(Date.now() - 7200000) } });
  await runReminders(config); await runReminders(config);
  assert.equal(await Notification.countDocuments({ kind: 'overdue-medication', sourceId: task._id, status: 'open' }), 1);
  const reminder = await Notification.findOne({ kind: 'overdue-medication', sourceId: task._id });
  const detail = (await f.manager.agent.get('/api/v1/notifications/' + reminder._id).expect(200)).body.data;
  assert.match(detail.sourcePath, new RegExp('sourceId=' + task._id));
  await f.manager.send('post', '/medication-tasks/' + task._id + '/outcomes', { version: 1, outcome: 'missed', actualAt: new Date().toISOString(), reason: 'Explicit reminder workflow verification' }, 201);
  await runReminders(config); assert.equal((await Notification.findById(reminder._id)).status, 'resolved');
  const medical = (await f.manager.send('post', '/notifications', { farmId: f.farmA.id, title: 'Image with medical alert', message: 'Evidence retained after resolution', severity: 'warning' }, 201)).body.data;
  const image = (await f.manager.upload('/evidence/alert/' + medical.id + '/files?name=alert.png', imageFixture)).body.data;
  await f.doctor.agent.get('/api/v1' + image.downloadPath).expect(200);
  await f.doctor.send('post', '/notifications/' + medical.id + '/resolve', { version: 1, note: 'Review recorded and complete' });
  await f.manager.send('delete', '/evidence/files/' + image.id, undefined, 409);
  await f.doctor.agent.get('/api/v1' + image.downloadPath).expect(200);
});

test('phase 10 reports/dashboard reconcile published eggs, exact finance, weighted measurements, safe exports and print snapshots', async () => {
  const f = await commerceFixture();
  await f.postSale(f.saleInput(1, { buyer: '=HYPERLINK("https://example.test","buyer")' }));
  await f.operator.send('post', '/expenses', { farmId: f.farmA.id, businessDate: today(), category: 'electricity', amount: '7000', reference: 'PHASE10-EXPENSE' }, 201, randomUUID());
  const query = '?farmId=' + f.farmA.id;
  const report = (await admin.agent.get('/api/v1/reports/egg-production' + query).expect(200)).body;
  assert.equal(report.meta.summary.collectedEggs, 735); assert.equal(report.meta.summary.saleableEggs, 720);
  const finance = (await admin.agent.get('/api/v1/reports/financial-results' + query).expect(200)).body;
  assert.equal(finance.meta.summary.revenue, '18000.00'); assert.equal(finance.meta.summary.operatingSurplus, '11000.00');
  const overview = (await admin.agent.get('/api/v1/dashboard' + query).expect(200)).body.data;
  assert.equal(overview.sections['egg-production'].summary.saleableEggs, 720); assert.equal(overview.sections['financial-results'].summary.operatingSurplus, '11000.00');
  for (const [sampleSize, averageWeight, unit] of [[10, 1.6, 'kg'], [30, 1800, 'g']]) await admin.send('post', '/bird-measurements', { flockId: f.flock.id, measuredAt: new Date().toISOString(), sampleSize, averageWeight, unit }, 201);
  const weights = (await admin.agent.get('/api/v1/reports/bird-weight' + query).expect(200)).body;
  assert.equal(weights.meta.summary.weightedAverageGrams, '1750'); assert.equal(weights.meta.summary.sampleSize, 40);
  const exported = await f.operator.agent.get('/api/v1/reports/sales/export' + query).expect(200); assert.match(exported.text, /'=HYPERLINK/); assert.ok(exported.headers['content-type'].includes('text/csv'));
  let returned = (await admin.send('post', '/daily-reports/' + f.report.id + '/return', { version: f.report.version, reason: 'Draft must not alter exported production' })).body.data;
  await admin.send('patch', '/daily-reports/' + returned.id, { version: returned.version, data: { ...f.reportData, eggs: { ...f.reportData.eggs, standard: 999 } } });
  assert.equal((await admin.agent.get('/api/v1/reports/egg-production' + query)).body.meta.summary.saleableEggs, 720);
  const printed = await admin.agent.get('/api/v1/daily-reports/' + f.report.id + '/print').expect(200); assert.match(printed.text, /720/); assert.match(printed.text, /360 eggs/); assert.equal(printed.text.includes('>999<'), false);
});
test('phase 10 aggregation/export permissions, ancestor filters and date policy deny alternate history and cost paths', async () => {
  const f = await formulaFixture(); const query = '?farmId=' + f.farmA.id;
  const other = await assigned('operation_manager', 'insight-other', [f.farmB.id]);
  for (const path of ['/dashboard', '/reports/sales', '/reports/sales/export']) await other.agent.get('/api/v1' + path + query).expect(404);
  for (const path of ['/dashboard', '/reports/sales', '/reports/sales/export']) await f.operator.agent.get('/api/v1' + path + '?from=' + daysAgo(3) + '&to=' + today()).expect(403);
  await f.operator.agent.get('/api/v1/reports/sales?farmId=' + f.farmA.id + '&flockId=' + f.flock.id).expect(422);
  await admin.agent.get('/api/v1/reports/daily-poultry?farmId=' + f.farmB.id + '&flockId=' + f.flock.id).expect(422);
  await f.manager.agent.get('/api/v1/reports/formula-cost').expect(403);
  const managerOverview = (await f.manager.agent.get('/api/v1/dashboard').expect(200)).body.data;
  assert.equal(managerOverview.sections['financial-results'], undefined); assert.equal(managerOverview.sections.sales, undefined); assert.equal(managerOverview.sections.inventory, undefined); noFormulaPrices(managerOverview);
  const catalog = (await f.operator.agent.get('/api/v1/reports/catalog').expect(200)).body.data;
  assert.equal(catalog.some((d) => d.key === 'daily-poultry'), false); assert.ok(catalog.some((d) => d.key === 'formula-cost'));
  const printDenied = await f.manager.agent.get('/api/v1/daily-reports/' + 'a'.repeat(24) + '/print'); assert.equal(printDenied.status, 403);
});
test('phase 10 audit is searchable, scoped to company authority, date constrained, redacted and immutable through API', async () => {
  const f = await clinicalFixture();
  const listed = (await admin.agent.get('/api/v1/audit-events?farmId=' + f.farmA.id + '&action=clinical.visit-created').expect(200)).body;
  assert.equal(listed.meta.total, 1); const event = listed.data[0]; assert.equal(event.farmId, f.farmA.id);
  const detail = (await admin.agent.get('/api/v1/audit-events/' + event.id).expect(200)).body.data;
  assert.equal(JSON.stringify(detail).includes('Recorded clinical assessment'), false); assert.equal(JSON.stringify(detail).includes('passwordHash'), false);
  await f.manager.agent.get('/api/v1/audit-events').expect(403);
  await admin.send('post', '/audit-events', { action: 'forged' }, 404);
  await admin.send('patch', '/audit-events/' + event.id, { changes: {} }, 404);
  await admin.send('delete', '/audit-events/' + event.id, undefined, 404);
  const found = (await admin.agent.get('/api/v1/audit-events?search=clinical.visit-created').expect(200)).body; assert.ok(found.meta.total >= 1);
  await admin.agent.get('/api/v1/audit-events?search[$ne]=x').expect(422);
});

test('phase 11 full demo uses relative dates, all roles, sample clinical labels and repeatable source keys without resets', async () => {
  const seeded = await seedDemoScenario(config, initialPassword); assert.equal(seeded.businessDate, today()); assert.equal(seeded.accounts.length, 6);
  const before = { reports: await DailyReport.countDocuments(), sales: await Sale.countDocuments(), stock: await StockMovement.countDocuments(), files: await EvidenceFile.countDocuments() };
  const again = await seedDemoScenario(config, initialPassword); assert.equal(again.saleId, seeded.saleId);
  assert.deepEqual({ reports: await DailyReport.countDocuments(), sales: await Sale.countDocuments(), stock: await StockMovement.countDocuments(), files: await EvidenceFile.countDocuments() }, before);
  assert.equal(await H.flock.countDocuments({ placementDate: daysAgo(1) }), 2);
  const f = await H.farm.findOne({ nameKey: 'demo farm alpha' });
  assert.equal((await admin.agent.get('/api/v1/reports/financial-results?farmId=' + f._id).expect(200)).body.meta.summary.operatingSurplus, '11000.00');
  assert.equal(await User.countDocuments({ mustChangePassword: true }), 6);
  assert.equal(await Prescription.countDocuments({ status: 'finalized' }), 1); assert.equal(await MedicationTask.countDocuments(), 12);
  await assert.rejects(seedDemoScenario({ ...config, production: true }, initialPassword), /disabled in production/);
});

test('narrow report grants and audit history cannot disclose broader source fields or older source changes', async () => {
  const f = await commerceFixture();
  const role = (await admin.send('post', '/roles', { code: 'narrow_insights', name: 'Narrow insights', description: '', scopeMode: 'company', permissions: ['dashboard.view', 'reports.view', 'reports.export', 'egg-production.view', 'audit.view'] })).body.data;
  const s = await staff(null, 'narrow-insights');
  await admin.send('put', `/users/${s.record._id}/role`, { roleId: role.id, version: s.record.version });
  const viewer = await client('narrow-insights@layerflow.test', changedPassword);
  const eggs = (await viewer.agent.get('/api/v1/reports/egg-production').expect(200)).body;
  assert.equal(eggs.meta.summary.saleableEggs, 720);
  for (const key of ['mortality', 'openingBirds', 'feedKg', 'waterLitres']) { assert.equal(eggs.data[0][key], undefined); assert.equal(eggs.meta.summary[key], undefined); }
  for (const type of ['daily-poultry', 'mortality', 'formula-cost', 'sales', 'financial-results']) await viewer.agent.get('/api/v1/reports/' + type + '/export').expect(403);
  const event = await AuditEvent.findOne({ targetId: f.report.id, action: 'report.submit' }); assert.ok(event);
  const detail = (await viewer.agent.get('/api/v1/audit-events/' + event._id).expect(200)).body.data;
  assert.match(detail.changes.redacted, /Source read permission/);
  await AuditEvent.updateOne({ _id: event._id }, { $set: { businessDate: daysAgo(3) } });
  await viewer.agent.get('/api/v1/audit-events/' + event._id).expect(403);
  const list = (await viewer.agent.get('/api/v1/audit-events?targetId=' + f.report.id).expect(200)).body;
  assert.equal(list.data.some((row) => row.id === String(event._id)), false);
  await viewer.agent.get('/api/v1/audit-events?from=' + daysAgo(3) + '&to=' + today()).expect(403);
});

test('localhost demo picker offers every seeded role through normal login, never exposes bootstrap or changed credentials', async () => {
  assert.deepEqual((await request(app).get('/api/v1/auth/demo-accounts').expect(200)).body.data, []);
  assert.throws(() => readConfig({ NODE_ENV: 'production', LOCAL_DEMO_LOGIN: 'true' }), /non-production/);
  assert.throws(() => readConfig({ HOST: '0.0.0.0', LOCAL_DEMO_LOGIN: 'true' }), /loopback/);
  await seedDemoScenario(config, initialPassword);
  config.demoLoginEnabled = true; config.demoPassword = initialPassword;
  try {
    const rows = (await request(app).get('/api/v1/auth/demo-accounts').expect(200)).body.data;
    assert.equal(rows.length, 6); assert.equal(new Set(rows.map((row) => row.roleLabel)).size, 5);
    assert.equal(rows.some((row) => row.email === owner.email), false);
    assert.equal(JSON.stringify(rows).includes('passwordHash'), false);
    for (const row of rows) {
      assert.equal(row.password, initialPassword);
      const account = await client(row.email, row.password);
      assert.equal(account.user.mustChangePassword, true);
      await account.agent.get('/api/v1/dashboard').expect(403);
    }
    const demoOwner = await client('demo-owner@layerflow.test');
    await demoOwner.send('post', '/auth/change-password', { currentPassword: initialPassword, newPassword: changedPassword });
    const refreshed = (await request(app).get('/api/v1/auth/demo-accounts').expect(200)).body.data;
    assert.equal(refreshed.find((row) => row.email === 'demo-owner@layerflow.test').password, '');
    config.production = true;
    assert.deepEqual((await request(app).get('/api/v1/auth/demo-accounts').expect(200)).body.data, []);
  } finally { config.demoLoginEnabled = false; delete config.demoPassword; config.production = false; }
});
