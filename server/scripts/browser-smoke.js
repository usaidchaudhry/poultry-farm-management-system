import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { readConfig } from '../src/config/env.js';
import { connectDatabase, mongoose } from '../src/config/database.js';
import { applyMigrations } from '../src/scripts/migrations.js';
import { bootstrapOwner } from '../src/scripts/bootstrap-service.js';
import { createApp } from '../src/app.js';

let replica; let httpServer; let vite; let browser; let inspectionPage;
const evidence = resolve('../.data/verification');
const temporary = randomBytes(24).toString('hex');
const replacement = randomBytes(24).toString('hex');
const staffPassword = randomBytes(24).toString('hex');
const staffReplacement = randomBytes(24).toString('hex');
const origin = 'http://127.0.0.1:5191';

try {
  await mkdir(evidence, { recursive: true });
  replica = await MongoMemoryReplSet.create({ binary: { downloadDir: resolve('../.data/mongodb-binaries') }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const config = readConfig({ NODE_ENV: 'test', MONGODB_URI: replica.getUri('layerflow_browser_test'), SESSION_SECRET: randomBytes(48).toString('hex'), FRONTEND_ORIGIN: origin });
  await connectDatabase(config.mongoUri); await applyMigrations(config);
  await bootstrapOwner({ name: 'Browser Owner', email: 'browser-owner@layerflow.test', password: temporary });
  const app = createApp(config);
  httpServer = await new Promise((resolve) => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  process.env.VITE_DATA_MODE = 'api'; process.env.VITE_API_BASE_URL = '/api/v1';
  vite = await createServer({
    root: resolve('..'), configFile: false, plugins: [react()],
    server: { host: '127.0.0.1', port: 5191, strictPort: true, proxy: { '/api': `http://127.0.0.1:${httpServer.address().port}` } },
  });
  await vite.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  inspectionPage = page;
  const errors = [];
  page.on('pageerror', (error) => { errors.push(error.message); console.error(`Browser runtime error: ${error.message}`); });
  const login = async (page, email, password) => {
    await page.goto(`${origin}/login`);
    await page.getByLabel(/^Email\b/).fill(email);
    await page.getByLabel(/^Password\b/).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  };
  const change = async (page, current, next) => {
    await page.waitForURL('**/change-password');
    await page.getByLabel(/^Current password\b/).fill(current);
    await page.getByLabel(/^New password\b/).fill(next);
    await page.getByLabel(/^Confirm new password\b/).fill(next);
    await page.getByRole('button', { name: 'Save password' }).click();
  };
  await login(page, 'browser-owner@layerflow.test', temporary);
  await change(page, temporary, replacement);
  await page.waitForURL('**/dashboard');
  await page.reload();
  await page.getByText('Welcome, Browser Owner', { exact: true }).waitFor();
  const apiPort = httpServer.address().port;
  await new Promise((resolve) => httpServer.close(resolve));
  httpServer = await new Promise((resolve) => { const server = createApp(config).listen(apiPort, '127.0.0.1', () => resolve(server)); });
  await page.reload();
  await page.getByText('Welcome, Browser Owner', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('pms.session.v2')), null);
  console.log('PASS: clean-browser login, mandatory password change, cookie restoration after API restart, no browser token.');

  await page.goto(`${origin}/roles`);
  await page.getByRole('button', { name: 'Create role', exact: true }).click();
  await page.getByLabel(/^Role name\b/).fill('Browser Reader');
  await page.getByLabel(/^Role code\b/).fill('browser_reader');
  await page.getByLabel('Scope', { exact: true }).selectOption('company');
  await page.getByLabel('dashboard.view', { exact: true }).check();
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Edit Browser Reader', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit Browser Reader', exact: true }).click();
  await page.getByLabel('users.view', { exact: true }).check();
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Edit Browser Reader', exact: true }).waitFor();
  await page.screenshot({ path: resolve(evidence, 'roles-desktop.png'), fullPage: true });
  console.log('PASS: create/edit custom role with API permission catalog.');

  await page.goto(`${origin}/users`);
  await page.getByRole('button', { name: 'Add user', exact: true }).click();
  await page.getByLabel(/^Full name\b/).fill('Browser Staff');
  await page.getByLabel(/^Email\b/).fill('browser-staff@layerflow.test');
  await page.getByLabel(/^Temporary password\b/).fill(staffPassword);
  await page.getByRole('button', { name: 'Create user', exact: true }).click();
  await page.getByRole('button', { name: 'Change role for Browser Staff', exact: true }).waitFor();

  const staffContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const staffPage = await staffContext.newPage();
  staffPage.on('pageerror', (error) => errors.push(error.message));
  await login(staffPage, 'browser-staff@layerflow.test', staffPassword);
  await change(staffPage, staffPassword, staffReplacement);
  await staffPage.waitForURL('**/pending-access');
  await staffPage.getByText('Your access is pending', { exact: true }).waitFor();
  console.log('PASS: unassigned account completes password change and stays outside protected business routes.');

  await page.reload(); // Staff's password change increments its optimistic version.
  await page.getByRole('button', { name: 'Change role for Browser Staff', exact: true }).click();
  await page.getByLabel('Role', { exact: true }).last().selectOption({ label: 'Browser Reader' });
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await staffPage.goto(`${origin}/login`); // Old session is invalidated by assignment.
  await staffPage.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  await login(staffPage, 'browser-staff@layerflow.test', staffReplacement);
  await staffPage.waitForURL('**/dashboard');
  await staffPage.goto(`${origin}/users`);
  await staffPage.getByText('Browser Owner', { exact: true }).waitFor();
  assert.equal(await staffPage.getByRole('button', { name: 'Add user', exact: true }).count(), 0);
  await staffPage.screenshot({ path: resolve(evidence, 'users-mobile.png'), fullPage: true });
  assert(await staffPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  console.log('PASS: role assignment invalidates the previous session; read-only user list works at phone width.');

  await page.goto(`${origin}/roles`);
  await page.getByRole('button', { name: 'Edit Browser Reader', exact: true }).click();
  await page.getByLabel('users.view', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await staffPage.reload();
  await staffPage.getByRole('heading', { name: 'You do not have access to this page', exact: true }).waitFor();
  assert.equal(await staffPage.getByRole('table').count(), 0);
  await page.goto(`${origin}/daily-reports`);
  await page.getByText('Daily reports integration is pending', { exact: true }).waitFor();
  console.log('PASS: permission revocation removes the table; live account never renders mock operations.');

  await page.getByRole('button', { name: /Browser Owner/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await page.waitForURL('**/login');
  await page.reload();
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: logout survives refresh; no browser runtime errors.');
  console.log('Browser verification passed. Screenshots: .data/verification/roles-desktop.png and users-mobile.png');
} catch (error) {
  if (inspectionPage && !inspectionPage.isClosed()) {
    await inspectionPage.screenshot({ path: resolve(evidence, 'browser-failure.png'), fullPage: true }).catch(() => {});
    console.error((await inspectionPage.locator('body').innerText().catch(() => '')).slice(0, 1200));
  }
  throw error;
} finally {
  if (browser) await browser.close();
  if (vite) await vite.close();
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  await mongoose.disconnect();
  if (replica) await replica.stop();
}
