import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createServer as tlsServer } from 'node:https';
import { request as upstreamRequest } from 'node:http';
import { createServer as portServer } from 'node:net';
import { chromium } from 'playwright-core';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { readConfig } from '../src/config/env.js';
import { connectDatabase, mongoose } from '../src/config/database.js';
import { applyMigrations } from '../src/scripts/migrations.js';
import { bootstrapOwner } from '../src/scripts/bootstrap-service.js';
import { seedDemoScenario } from '../src/scripts/demo-scenario-service.js';
import { backupApplication, restoreApplication } from '../src/scripts/backup-service.js';
import { hierarchyModels as H } from '../src/modules/organization/models.js';
import { DailyReport } from '../src/modules/reports/models.js';
import { EvidenceFile } from '../src/modules/evidence/models.js';
import { testTls } from './test-tls.js';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const listen = (server) => new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
const artifacts = resolve('../.data/verification'); await mkdir(artifacts, { recursive: true }); const root = await mkdtemp(join(artifacts, 'release-'));
const initial = randomBytes(24).toString('hex'); const changed = randomBytes(24).toString('hex'); const staffPassword = randomBytes(24).toString('hex'); const staffChanged = randomBytes(24).toString('hex'); const sessionSecret = randomBytes(48).toString('hex');
let replica; let gateway; let browser; let child; let inspection; let origin; let apiPort; let config;
const errors = []; const checks = [];
const pass = (name) => { checks.push(name); console.log('PASS: ' + name); };
const stop = async () => { if (!child || child.exitCode !== null) return; const process = child; child = null; await new Promise((r) => { process.once('exit', r); process.kill('SIGTERM'); }); };
async function start(uri, uploadDir) {
  let stderr = '';
  const serverRoot = resolve(process.env.VERIFY_SERVER_ROOT || '.');
  child = spawn(process.execPath, ['src/server.js'], { cwd: serverRoot, env: { ...process.env, NODE_ENV: 'production', MONGODB_URI: uri, SESSION_SECRET: sessionSecret, FRONTEND_ORIGIN: origin, HOST: '127.0.0.1', PORT: String(apiPort), COOKIE_SECURE: 'true', COOKIE_SAME_SITE: 'lax', TRUST_PROXY: '1', UPLOAD_DIR: uploadDir, SERVE_SPA: 'true', SPA_DIR: resolve(serverRoot, '../dist') }, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-2000); });
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error('Production process exited: ' + stderr);
    try { if ((await fetch(`http://127.0.0.1:${apiPort}/ready`, { signal: AbortSignal.timeout(500) })).ok) return; } catch { /* startup */ }
    await delay(250);
  }
  throw new Error('Production API did not become ready.');
}
const login = async (page, email, password, newPassword) => {
  inspection = page; await page.goto(origin + '/login'); await page.getByLabel(/^Email\b/).fill(email); await page.getByLabel(/^Password\b/).fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  if (newPassword) { await page.waitForURL('**/change-password'); await page.getByLabel(/^Current password\b/).fill(password); await page.getByLabel(/^New password\b/).fill(newPassword); await page.getByLabel(/^Confirm new password\b/).fill(newPassword); await page.getByRole('button', { name: 'Save password', exact: true }).click(); }
  await page.waitForURL('**/dashboard'); await page.getByRole('button', { name: 'Refresh dashboard', exact: true }).waitFor();
};
try {
  replica = await MongoMemoryReplSet.create({ binary: { downloadDir: resolve('../.data/mongodb-binaries') }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const uri = replica.getUri('layerflow_release'); config = readConfig({ NODE_ENV: 'test', MONGODB_URI: uri, SESSION_SECRET: sessionSecret, UPLOAD_DIR: join(root, 'images') });
  await connectDatabase(uri); await applyMigrations(config); await bootstrapOwner({ name: 'Release Owner', email: 'release-owner@layerflow.test', password: initial });
  const socket = portServer(); apiPort = await listen(socket); await new Promise((r) => socket.close(r));
  gateway = tlsServer(await testTls(root), (req, res) => {
    const upstream = upstreamRequest({ hostname: '127.0.0.1', port: apiPort, path: req.url, method: req.method, headers: { ...req.headers, 'x-forwarded-proto': 'https', 'x-forwarded-for': req.socket.remoteAddress } }, (response) => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
    upstream.on('error', () => { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"code":"UPSTREAM_UNAVAILABLE","message":"API restarting"}'); }); req.pipe(upstream);
  });
  origin = `https://127.0.0.1:${await listen(gateway)}`; await start(uri, config.uploadDir);
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ignoreHTTPSErrors: true }); const page = await context.newPage(); page.on('pageerror', (e) => errors.push(e.message));
  await login(page, 'release-owner@layerflow.test', initial, changed);
  await page.getByText('No records', { exact: true }).first().waitFor();
  const cookie = (await context.cookies()).find((c) => c.name === 'layerflow.sid'); assert.ok(cookie?.secure && cookie.httpOnly); assert.equal(cookie.sameSite, 'Lax');
  const wrongOrigin = await page.request.post(origin + '/api/v1/auth/logout', { headers: { Origin: 'https://forbidden.example' }, data: {} }); assert.equal(wrongOrigin.status(), 403);
  const missing = await page.request.get(origin + '/api/v1/not-a-route'); assert.equal(missing.status(), 404); assert.match(missing.headers()['content-type'], /application\/json/);
  pass('production process serves the API-only SPA over HTTPS; secure cookies, CSRF/origin, empty dashboard and JSON API errors');
  const seeded = await seedDemoScenario(config, staffPassword); await page.reload(); await page.getByText('11000.00', { exact: true }).waitFor();
  const farm = await H.farm.findOne({ nameKey: 'demo farm alpha' }); const otherFarm = await H.farm.findOne({ nameKey: 'demo farm beta' }); const flock = await H.flock.findOne({ farmId: farm._id }); const report = await DailyReport.findOne({ flockId: flock._id, businessDate: seeded.businessDate }); const evidence = await EvidenceFile.findOne({ parentId: report._id, deletedAt: null });
  await page.screenshot({ path: join(root, 'dashboard-desktop.png'), fullPage: true, animations: 'disabled' });
  const roles = [['Farm Manager', 'demo-alpha@layerflow.test', 360], ['Operation Manager', 'demo-operations@layerflow.test', 390], ['Doctor', 'demo-doctor@layerflow.test', 768], ['Production Manager', 'demo-production@layerflow.test', 768]];
  for (const [role, email, width] of roles) {
    const staff = await browser.newContext({ viewport: { width, height: 900 }, ignoreHTTPSErrors: true }); const staffPage = await staff.newPage(); staffPage.on('pageerror', (e) => errors.push(e.message)); await login(staffPage, email, staffPassword, staffChanged);
    await staffPage.getByRole('heading', { name: /^Welcome,/ }).waitFor(); await staffPage.getByRole('status').filter({ hasText: 'Loading dashboard...' }).waitFor({ state: 'hidden' });
    assert.equal(await staffPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    if (role === 'Farm Manager') { assert.equal(await staffPage.getByText('Recorded revenue (PKR)', { exact: true }).count(), 0); assert.equal((await staffPage.request.get(origin + '/api/v1/dashboard?farmId=' + otherFarm._id)).status(), 404); }
    if (role === 'Operation Manager') { assert.equal(await staffPage.getByLabel('Dashboard farm', { exact: true }).locator('option').count(), 3); await staffPage.goto(origin + '/analytics'); await staffPage.getByLabel('Report type', { exact: true }).selectOption('financial-results'); await staffPage.getByRole('cell', { name: '11000.00', exact: true }).waitFor(); const downloaded = staffPage.waitForEvent('download'); await staffPage.getByRole('button', { name: 'Download CSV', exact: true }).click(); await (await downloaded).saveAs(join(root, 'financial-results.csv')); }
    if (role === 'Doctor') assert.equal((await staffPage.request.get(origin + '/api/v1/finance')).status(), 403);
    if (role === 'Production Manager') { assert.equal((await staffPage.request.get(origin + '/api/v1/reports/sales?from=' + new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10) + '&to=' + seeded.businessDate)).status(), 403); assert.equal((await staffPage.request.get(origin + '/api/v1/reports/formula-cost')).status(), 403); }
    await staffPage.screenshot({ path: join(root, role.toLowerCase().replaceAll(' ', '-') + '.png'), fullPage: true, animations: 'disabled' }); pass(role + ' production workflow, permissions and ' + width + 'px layout'); await staff.close();
  }
  inspection = page;
  await page.goto(origin + '/analytics'); await page.getByLabel('Report type', { exact: true }).selectOption('financial-results'); await page.getByLabel('Report farm', { exact: true }).selectOption(String(farm._id)); await page.getByRole('cell', { name: '11000.00', exact: true }).waitFor(); await page.screenshot({ path: join(root, 'reports-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.goto(origin + '/api/v1/daily-reports/' + report._id + '/print'); await page.getByRole('heading', { name: /daily poultry report/ }).waitFor(); await page.screenshot({ path: join(root, 'daily-print-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.goto(origin + '/audit'); await page.getByLabel('Audit action', { exact: true }).fill('report.submit'); await page.getByRole('button', { name: 'View audit change', exact: true }).first().click(); const dialog = page.getByRole('dialog'); await dialog.getByRole('heading', { name: 'Redacted changes', exact: true }).waitFor(); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('[role="dialog"]'))), true); await page.screenshot({ path: join(root, 'audit-desktop.png'), fullPage: true, animations: 'disabled' }); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); assert.match(await page.evaluate(() => document.activeElement.textContent), /View audit change/);
  pass('live report totals/CSV, printable published revision and searchable read-only audit with keyboard focus restoration');
  await page.goto(origin + '/dashboard'); await page.getByText('11000.00', { exact: true }).waitFor();
  await page.route('**/api/v1/dashboard*', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_UNAVAILABLE', message: 'Temporary verification failure' }) })); await page.getByRole('button', { name: 'Refresh dashboard', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Temporary verification failure' }).waitFor(); assert.equal(await page.getByText('11000.00', { exact: true }).count(), 0); await page.unroute('**/api/v1/dashboard*'); await page.getByRole('button', { name: 'Retry dashboard', exact: true }).click(); await page.getByText('11000.00', { exact: true }).waitFor();
  await stop(); await start(uri, config.uploadDir); await page.reload(); await page.getByRole('heading', { name: 'Welcome, Release Owner', exact: true }).waitFor(); assert.equal((await page.request.get(origin + '/api/v1/evidence/files/' + evidence._id)).status(), 200);
  pass('API failure clears stale metrics, retry recovers, and production restart preserves session and private evidence');
  await backupApplication(config, join(root, 'backup')); const restoredUri = replica.getUri('layerflow_release_restored'); const restoredUploads = join(root, 'restored-images'); await restoreApplication(join(root, 'backup'), restoredUri, restoredUploads); await stop(); await start(restoredUri, restoredUploads); await page.reload(); await page.waitForURL('**/login'); await login(page, 'release-owner@layerflow.test', changed); await page.getByText('11000.00', { exact: true }).waitFor(); assert.equal((await page.request.get(origin + '/api/v1/evidence/files/' + evidence._id)).status(), 200);
  const csrf = (await (await page.request.get(origin + '/api/v1/auth/csrf')).json()).data.csrfToken; assert.equal((await page.request.post(origin + '/api/v1/auth/logout', { headers: { 'X-CSRF-Token': csrf, Origin: origin }, data: {} })).status(), 204); await page.getByRole('button', { name: 'Refresh dashboard', exact: true }).click(); await page.waitForURL('**/login');
  pass('restored database/files run in production, require reauthentication, preserve totals, and expired sessions return to login');
  assert.deepEqual(errors, []); await writeFile(join(root, 'results.json'), JSON.stringify({ checks, browserErrors: errors, production: true, liveMongoDB: true, publicDeployment: false }, null, 2)); console.log('Release verification passed; artifacts: ' + root);
} catch (error) { if (inspection && !inspection.isClosed()) { await inspection.screenshot({ path: join(root, 'release-failure.png'), fullPage: true, animations: 'disabled' }).catch(() => {}); console.error((await inspection.locator('body').innerText().catch(() => '')).slice(0, 1600)); } throw error; }
finally { if (browser) await browser.close(); await stop(); if (gateway) { gateway.closeAllConnections(); await new Promise((r) => gateway.close(r)); } await mongoose.disconnect(); if (replica) await replica.stop(); }
