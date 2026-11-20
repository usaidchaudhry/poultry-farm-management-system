import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import request from 'supertest';
import { createDevelopmentDatabase } from '../scripts/database-helper.js';
import { readConfig } from '../src/config/env.js';
import { connectDatabase, mongoose } from '../src/config/database.js';
import { applyMigrations } from '../src/scripts/migrations.js';
import { bootstrapOwner } from '../src/scripts/bootstrap-service.js';
import { createApp } from '../src/app.js';
import { hierarchyModels as H } from '../src/modules/organization/models.js';
import { User, Role } from '../src/modules/access/models.js';
import { businessDate } from '../src/policies/dates.js';
import { BirdMovement, PublicationIntent } from '../src/modules/reports/models.js';

test('development database files, roles, user, hierarchy, assignments, and authenticated session survive a full MongoDB restart', { timeout: 120000 }, async () => {
  const root = resolve('../.data/verification');
  await mkdir(root, { recursive: true });
  const dbPath = await mkdtemp(`${root}${sep}persistence-`);
  let replica;
  try {
    replica = await createDevelopmentDatabase({ dbPath, port: 0, name: 'layerflow_persistence_test' });
    const port = replica.servers[0].instanceInfo.port;
    const config = readConfig({ NODE_ENV: 'test', MONGODB_URI: replica.getUri('layerflow_persistence_test'), SESSION_SECRET: randomBytes(48).toString('hex') });
    await connectDatabase(config.mongoUri); await applyMigrations(config);
    const initial = randomBytes(24).toString('hex'); const next = randomBytes(24).toString('hex');
    const owner = await bootstrapOwner({ name: 'Persistence Owner', email: 'persistence@layerflow.test', password: initial });
    const agent = request.agent(createApp(config));
    const token = (await agent.get('/api/v1/auth/csrf').expect(200)).body.data.csrfToken;
    const login = await agent.post('/api/v1/auth/login').set('X-CSRF-Token', token).send({ email: owner.email, password: initial }).expect(200);
    const changed = await agent.post('/api/v1/auth/change-password').set('X-CSRF-Token', login.body.data.csrfToken).send({ currentPassword: initial, newPassword: next }).expect(200);
    const cookie = changed.headers['set-cookie'][0].split(';')[0];
    const site = (await agent.post('/api/v1/organization/sites').set('X-CSRF-Token', changed.body.data.csrfToken).send({ name: 'Persistent Site', location: 'Lahore' }).expect(201)).body.data;
    const farm = (await agent.post('/api/v1/organization/farms').set('X-CSRF-Token', changed.body.data.csrfToken).send({ name: 'Persistent Farm', siteId: site.id }).expect(201)).body.data;
    await User.updateOne({ _id: owner.id }, { $set: { farmIds: [farm.id] } });
    const write = (path, input) => agent.post(`/api/v1${path}`).set('X-CSRF-Token', changed.body.data.csrfToken).send(input);
    const house = (await write('/organization/houses', { name: 'Persistent House', farmId: farm.id }).expect(201)).body.data;
    const flock = (await write('/organization/flocks', { name: 'Persistent Flock', houseId: house.id, placementDate: businessDate(), initialCount: 100 }).expect(201)).body.data;
    const measurement = (await write('/bird-measurements', { flockId: flock.id, measuredAt: new Date().toISOString(), sampleSize: 10, averageWeight: 1.6, unit: 'kg' }).expect(201)).body.data;
    const report = (await write('/daily-reports', { flockId: flock.id, businessDate: businessDate(), data: { eggs: { jumbo: 0, starter: 0, standard: 80, small: 0, floor: 0, broken: 0, discard: 0 }, mortality: 1, feed: { bags: 0, bagSizeKg: 0, additionalKg: 0 }, waterLitres: 0, lightHours: 0, measurementId: measurement.id } }).expect(201)).body.data;
    await write(`/daily-reports/${report.id}/submit`, { version: report.version }).expect(200);
    await mongoose.disconnect();
    await replica.stop({ doCleanup: false });
    replica = await createDevelopmentDatabase({ dbPath, port, name: 'layerflow_persistence_test' });
    await connectDatabase(replica.getUri('layerflow_persistence_test'));
    await applyMigrations(config);
    const restored = await request(createApp(config)).get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
    assert.equal(restored.body.data.id, owner.id);
    assert.equal(restored.body.data.mustChangePassword, false);
    assert.equal(await User.countDocuments(), 1);
    assert.equal(await Role.countDocuments(), 5);
    assert.equal(await H.farm.countDocuments(), 1);
    assert.deepEqual(restored.body.data.farmIds, [farm.id]);
    const hierarchy = await request(createApp(config)).get('/api/v1/organization/hierarchy').set('Cookie', cookie).expect(200);
    assert.equal(hierarchy.body.data.farms[0].id, farm.id);
    const reportRestored = (await request(createApp(config)).get(`/api/v1/daily-reports/${report.id}`).set('Cookie', cookie).expect(200)).body.data;
    assert.equal(reportRestored.status, 'submitted');
    assert.equal(reportRestored.revisions.length, 1);
    assert.equal(reportRestored.summary.closingBirds, 99);
    assert.equal(reportRestored.summary.measurement.grams, 1600);
    assert.equal(await BirdMovement.countDocuments({ flockId: flock.id }), 2);
    assert.equal(await PublicationIntent.countDocuments({ reportId: report.id }), 1);
  } finally {
    await mongoose.disconnect();
    if (replica) await replica.stop({ doCleanup: false });
    // This test owns only its generated child directory; never remove the
    // developer's persistent .data/mongodb directory or a configured database.
    const target = resolve(dbPath);
    if (!target.startsWith(`${root}${sep}`)) throw new Error('Refusing cleanup outside the verification directory.');
    await rm(target, { recursive: true, force: true });
  }
});
