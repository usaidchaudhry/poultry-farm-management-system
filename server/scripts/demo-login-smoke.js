import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { readConfig } from '../src/config/env.js';
import { connectDatabase, mongoose } from '../src/config/database.js';
import { applyMigrations } from '../src/scripts/migrations.js';
import { bootstrapOwner } from '../src/scripts/bootstrap-service.js';
import { seedDemoScenario } from '../src/scripts/demo-scenario-service.js';
import { createApp } from '../src/app.js';

let replica, http, vite, browser, app;
const origin = 'http://127.0.0.1:5192';
const password = randomBytes(24).toString('hex');
const changed = randomBytes(24).toString('hex');
const errors = [];
try {
  const verification = resolve('../.data/verification'); await mkdir(verification, { recursive: true });
  const root = await mkdtemp(join(verification, 'demo-login-'));
  replica = await MongoMemoryReplSet.create({ binary: { downloadDir: resolve('../.data/mongodb-binaries') }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const config = { ...readConfig({ NODE_ENV: 'test', MONGODB_URI: replica.getUri('layerflow_demo_login_test'), SESSION_SECRET: randomBytes(48).toString('hex'), FRONTEND_ORIGIN: origin, UPLOAD_DIR: join(root, 'images'), LOCAL_DEMO_LOGIN: 'true', DEMO_PASSWORD: password }), loginLimit: 1000 };
  await connectDatabase(config.mongoUri); await applyMigrations(config);
  await bootstrapOwner({ name: 'Bootstrap Owner', email: 'bootstrap@layerflow.test', password });
  app = createApp(config);
  const admin = request.agent(app); const csrf = (await admin.get('/api/v1/auth/csrf')).body.data.csrfToken;
  const signed = (await admin.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf).send({ email: 'bootstrap@layerflow.test', password }).expect(200)).body.data;
  await admin.post('/api/v1/auth/change-password').set('Origin', origin).set('X-CSRF-Token', signed.csrfToken).send({ currentPassword: password, newPassword: changed }).expect(200);
  const seeded = await seedDemoScenario(config, password);
  http = await new Promise((done) => { const server = app.listen(0, '127.0.0.1', () => done(server)); });
  vite = await createServer({ root: resolve('..'), configFile: false, plugins: [react()], define: { 'import.meta.env.VITE_DATA_MODE': JSON.stringify('api'), 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api/v1') }, server: { host: '127.0.0.1', port: 5192, strictPort: true, proxy: { '/api': `http://127.0.0.1:${http.address().port}` } } });
  await vite.listen(); browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const email of seeded.accounts) {
    const context = await browser.newContext({ viewport: { width: email.includes('owner') ? 360 : 1280, height: 900 } });
    const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin + '/login');
    await page.getByRole('button').filter({ hasText: email }).click();
    assert.equal(await page.getByLabel(/^Email\b/).inputValue(), email);
    assert.equal(await page.getByLabel(/^Password\b/).inputValue(), password);
    assert.equal(await page.locator('.demo__item').count(), 6);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (email.includes('owner')) await page.screenshot({ path: join(root, 'demo-picker-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL('**/change-password');
    await page.getByLabel(/^Current password\b/).fill(password); await page.getByLabel(/^New password\b/).fill(changed); await page.getByLabel(/^Confirm new password\b/).fill(changed);
    await page.getByRole('button', { name: 'Save password' }).click(); await page.waitForURL('**/dashboard');
    await page.getByRole('heading', { name: /^Welcome,/ }).waitFor();
    const me = (await (await page.request.get(origin + '/api/v1/auth/me')).json()).data;
    assert.equal(me.email, email); assert.equal(me.mustChangePassword, false); assert.ok(me.role);
    console.log('PASS: seeded picker -> normal login -> password change -> ' + me.role + ' dashboard'); await context.close();
  }
  assert.deepEqual(errors, []); console.log('PASS: all six demo accounts / five roles, no browser errors; artifacts: ' + root);
} finally {
  if (browser) await browser.close(); if (vite) await vite.close();
  if (http) { http.closeAllConnections(); await new Promise((done) => http.close(done)); }
  if (app) await app.locals.sessionStore.close(); await mongoose.disconnect(); if (replica) await replica.stop();
}
