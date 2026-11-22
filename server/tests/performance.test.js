import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDatabase, mongoose } from '../src/config/database.js';
import { readConfig } from '../src/config/env.js';
import { applyMigrations } from '../src/scripts/migrations.js';
import { bootstrapOwner } from '../src/scripts/bootstrap-service.js';
import { createApp } from '../src/app.js';
import { hierarchyModels as H } from '../src/modules/organization/models.js';
import { Organization } from '../src/modules/access/models.js';
import { BirdMeasurement } from '../src/modules/reports/models.js';
import { businessDate } from '../src/policies/dates.js';
test('phase 11 measured read/write/report/dashboard targets on 5 farms, 20 flocks and 10000 dated samples', { timeout: 120000 }, async () => {
  let replica;
  try {
    replica = await MongoMemoryReplSet.create({ binary: { downloadDir: resolve('../.data/mongodb-binaries') }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
    const config = readConfig({ NODE_ENV: 'test', MONGODB_URI: replica.getUri('layerflow_performance'), SESSION_SECRET: randomBytes(48).toString('hex') }); await connectDatabase(config.mongoUri); await applyMigrations(config);
    const temporary = randomBytes(24).toString('hex'); const next = randomBytes(24).toString('hex'); const owner = await bootstrapOwner({ name: 'Performance Owner', email: 'performance@layerflow.test', password: temporary });
    const org = await Organization.findOne(); const site = await H.site.create({ organizationId: org._id, name: 'Isolated benchmark site', nameKey: 'benchmark', location: 'Test only' }); const flocks = []; const farms = [];
    const today = businessDate(); const from = new Date(Date.parse(today) - 89 * 86400000).toISOString().slice(0, 10);
    for (let i = 0; i < 5; i++) {
      const farm = await H.farm.create({ organizationId: org._id, siteId: site._id, name: `Benchmark farm ${i}`, nameKey: `benchmark-${i}` }); farms.push(farm);
      for (let j = 0; j < 4; j++) { const house = await H.house.create({ organizationId: org._id, siteId: site._id, farmId: farm._id, name: `House ${j}`, nameKey: `house-${j}` }); flocks.push(await H.flock.create({ organizationId: org._id, siteId: site._id, farmId: farm._id, houseId: house._id, name: 'Benchmark flock', nameKey: 'flock', placementDate: from, initialCount: 500 })); }
    }
    const samples = Array.from({ length: 10000 }, (_, i) => { const flock = flocks[i % flocks.length]; const date = new Date(Date.parse(today) - (Math.floor(i / 20) % 90) * 86400000).toISOString().slice(0, 10); return { organizationId: org._id, siteId: site._id, farmId: flock.farmId, houseId: flock.houseId, flockId: flock._id, businessDate: date, measuredAt: new Date(date + 'T00:00:00Z'), sampleSize: 10, averageWeight: 1500 + i % 10 * 10, grams: 1500 + i % 10 * 10, unit: 'g', notes: 'Generated isolated performance fixture', createdBy: owner.id }; });
    await BirdMeasurement.insertMany(samples);
    const app = createApp(config); const agent = request.agent(app); let csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken;
    csrf = (await agent.post('/api/v1/auth/login').set('X-CSRF-Token', csrf).send({ email: owner.email, password: temporary }).expect(200)).body.data.csrfToken;
    csrf = (await agent.post('/api/v1/auth/change-password').set('X-CSRF-Token', csrf).send({ currentPassword: temporary, newPassword: next }).expect(200)).body.data.csrfToken;
    const query = `?from=${from}&to=${today}`; const baseline = await agent.get('/api/v1/reports/bird-weight' + query).expect(200); assert.equal(baseline.body.meta.total, 10000); assert.equal(baseline.body.meta.summary.weightedAverageGrams, '1545');
    const timing = {};
    for (const [kind, maximum, operation] of [
      ['paginatedRead', 2000, () => agent.get('/api/v1/bird-measurements' + query + '&pageSize=20').expect(200)],
      ['write', 2000, () => agent.post('/api/v1/bird-measurements').set('X-CSRF-Token', csrf).send({ flockId: String(flocks[0]._id), measuredAt: new Date().toISOString(), sampleSize: 10, averageWeight: 1600, unit: 'g' }).expect(201)],
      ['report', 3000, () => agent.get('/api/v1/reports/bird-weight' + query).expect(200)],
      ['dashboard', 3000, () => agent.get('/api/v1/dashboard' + query).expect(200)],
    ]) {
      const durations = []; for (let i = 0; i < 20; i++) { const start = performance.now(); await operation(); durations.push(performance.now() - start); } durations.sort((a, b) => a - b); const p95 = Math.round(durations[Math.ceil(durations.length * .95) - 1]); timing[kind] = { requests: durations.length, p95Ms: p95, targetMs: maximum }; assert.ok(p95 < maximum, `${kind} p95 ${p95}ms exceeded ${maximum}ms`);
    }
    const oversized = await agent.get('/api/v1/reports/bird-weight/export' + query).expect(422); assert.equal(oversized.body.code, 'EXPORT_TOO_LARGE');
    const plan = await BirdMeasurement.find({ organizationId: org._id, farmId: farms[0]._id, businessDate: { $gte: from, $lte: today } }).explain('executionStats'); const serializedPlan = JSON.stringify(plan.queryPlanner.winningPlan); assert.match(serializedPlan, /indexName/);
    const output = { generatedAt: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model, dataset: { farms: 5, flocks: 20, initialDatedRecords: 10000 }, timing, winningPlan: plan.queryPlanner.winningPlan };
    await mkdir(resolve('../.data/verification'), { recursive: true }); await writeFile(resolve('../.data/verification/performance.json'), JSON.stringify(output, null, 2)); console.log('Measured p95 (ms): ' + JSON.stringify(Object.fromEntries(Object.entries(timing).map(([key, value]) => [key, value.p95Ms]))));
  } finally { await mongoose.disconnect(); if (replica) await replica.stop(); }
});
