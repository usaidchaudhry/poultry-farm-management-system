import { businessDate } from '../src/policies/dates.js';
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
  await page.getByRole('heading', { name: 'No daily reports found', exact: true }).waitFor();
  console.log('PASS: permission revocation removes the table; live account never renders mock operations.');

  // Phase 3: exercise the existing organization screens against the live API.
  const createEntity = async (kind, fill) => {
    await page.goto(`${origin}/organization/${kind}s`);
    await page.getByRole('button', { name: `Add ${kind}`, exact: true }).first().click();
    await fill(page.getByRole('dialog'));
    await page.getByRole('button', { name: `Create ${kind}`, exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  };
  await createEntity('site', async (dialog) => {
    await dialog.getByLabel(/^Site name\b/).fill('Browser Site');
    await dialog.getByLabel(/^Location\b/).fill('Lahore');
  });
  for (const suffix of ['Alpha', 'Beta']) await createEntity('farm', async (dialog) => {
    await dialog.getByLabel(/^Site\b/).selectOption({ label: 'Browser Site' });
    await dialog.getByLabel(/^Farm name\b/).fill(`Browser Farm ${suffix}`);
  });
  await createEntity('house', async (dialog) => {
    await dialog.getByLabel(/^Farm\b/).selectOption({ label: 'Browser Farm Alpha' });
    await dialog.getByLabel(/^House or shed name\b/).fill('Browser House');
    await dialog.getByLabel(/^Capacity\b/).fill('1000');
  });
  await createEntity('flock', async (dialog) => {
    await dialog.getByLabel(/^House\b/).selectOption({ label: 'Browser House' });
    await dialog.getByLabel(/^Flock name\b/).fill('Browser Flock');
    await dialog.getByLabel('Bird type', { exact: true }).selectOption('Layer');
    await dialog.getByLabel(/^Placement date\b/).fill('2026-11-01');
    await dialog.getByLabel(/^Birds placed\b/).fill('500');
  });
  await page.getByRole('button', { name: 'Edit Browser Flock', exact: true }).click();
  assert.equal(await page.getByRole('dialog').getByLabel(/^Birds placed\b/).count(), 0);
  await page.getByRole('dialog').getByLabel(/^Flock name\b/).fill('Browser Flock Renamed');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Archive Browser Flock Renamed', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('switch', { name: 'Show archived', exact: true }).click();
  await page.getByRole('button', { name: 'Restore Browser Flock Renamed', exact: true }).click();
  await page.getByRole('button', { name: 'Archive Browser Flock Renamed', exact: true }).waitFor();
  await page.goto(`${origin}/organization`);
  await page.getByText('Browser Flock Renamed', { exact: true }).waitFor();
  await page.screenshot({ path: resolve(evidence, 'organization-desktop.png'), fullPage: true });
  console.log('PASS: live hierarchy create, flock edit, archive, restore and tree.');

  await page.goto(`${origin}/users`);
  await page.getByRole('button', { name: 'Change role for Browser Staff', exact: true }).click();
  await page.getByLabel('Role', { exact: true }).last().selectOption({ label: 'Farm Manager' });
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Assign sites and farms to Browser Staff', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Browser Farm Alpha', { exact: true }).check();
  await page.getByRole('button', { name: 'Save assignments', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await login(staffPage, 'browser-staff@layerflow.test', staffReplacement);
  await staffPage.waitForURL('**/dashboard');
  await staffPage.goto(`${origin}/organization/farms`);
  await staffPage.getByText('Browser Farm Alpha', { exact: true }).waitFor();
  assert.equal(await staffPage.getByText('Browser Farm Beta', { exact: true }).count(), 0);
  assert.equal(await staffPage.getByRole('button', { name: 'Add farm', exact: true }).count(), 0);
  await staffPage.getByTitle('Choose working area', { exact: true }).click();
  await staffPage.getByRole('dialog').getByLabel('Flock', { exact: true }).selectOption({ label: 'Browser House / Browser Flock Renamed' });
  await staffPage.getByRole('button', { name: 'Done', exact: true }).click();
  await staffPage.reload();
  await staffPage.getByTitle('Choose working area', { exact: true }).filter({ hasText: 'Browser Site / Browser Farm Alpha / Browser House / Browser Flock Renamed' }).waitFor();
  await staffPage.screenshot({ path: resolve(evidence, 'farm-scope-mobile.png'), fullPage: true });
  assert(await staffPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  console.log('PASS: assignment dialog, scoped farm list, phone-width selector and saved selection.');

  // Phase 4: Owner reconciles a gap; assigned manager records a measurement
  // and completes draft/submit/return/correct/resubmit through the browser.
  await page.goto(`${origin}/daily-reports`);
  await page.getByRole('button', { name: 'New daily report', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Flock\b/).selectOption({ label: 'Browser Farm Alpha / Browser Flock Renamed' });
  await dialog.getByText('Record an approved population entry', { exact: true }).click();
  await dialog.getByLabel('Counted available birds', { exact: true }).fill('500');
  await dialog.getByLabel('Population reason', { exact: true }).fill('Physical opening count after missing daily reports');
  await dialog.getByRole('button', { name: 'Record population entry', exact: true }).click();
  await dialog.getByText('Earlier daily reports are missing. Record an opening reconciliation before submission.', { exact: true }).waitFor({ state: 'hidden' });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });

  await staffPage.goto(`${origin}/bird-parameters`);
  await staffPage.getByRole('button', { name: 'New bird measurement', exact: true }).click();
  dialog = staffPage.getByRole('dialog');
  await dialog.getByLabel(/^Flock\b/).selectOption({ label: 'Browser Farm Alpha / Browser Flock Renamed' });
  await dialog.getByLabel(/^Sample size\b/).fill('10');
  await dialog.getByLabel(/^Average weight\b/).fill('1.6');
  await dialog.getByLabel('Weight unit', { exact: true }).selectOption('kg');
  await dialog.getByRole('button', { name: 'Save measurement', exact: true }).click();
  await staffPage.getByRole('dialog').waitFor({ state: 'hidden' });
  await staffPage.getByRole('cell', { name: '1600', exact: true }).waitFor();
  await staffPage.screenshot({ path: resolve(evidence, 'measurements-mobile.png'), fullPage: true });

  await staffPage.goto(`${origin}/daily-reports`);
  await staffPage.getByRole('button', { name: 'New daily report', exact: true }).click();
  dialog = staffPage.getByRole('dialog');
  await dialog.getByLabel(/^Flock\b/).selectOption({ label: 'Browser Farm Alpha / Browser Flock Renamed' });
  assert.equal(await dialog.getByLabel('Sample 9 weight', { exact: true }).count(), 1);
  assert.equal(await dialog.getByText('Record an approved population entry', { exact: true }).count(), 0);
  await dialog.getByRole('button', { name: 'Save draft', exact: true }).click();
  await staffPage.getByRole('dialog').waitFor({ state: 'hidden' });
  const reportButton = () => staffPage.getByRole('button', { name: `View report ${businessDate()}`, exact: true });
  await reportButton().click();
  await staffPage.getByRole('button', { name: 'Submit report', exact: true }).click();
  await staffPage.getByText(/Complete the required report fields before submitting/).waitFor();
  await staffPage.getByRole('button', { name: 'Edit draft', exact: true }).click();
  dialog = staffPage.getByRole('dialog');
  for (const name of ['Jumbo', 'Starter', 'Standard', 'Small', 'Floor', 'Broken', 'Discard']) await dialog.getByLabel(`${name} eggs`, { exact: true }).fill(name === 'Standard' ? '100' : '0');
  await dialog.getByLabel('Mortality count', { exact: true }).fill('2');
  await dialog.getByLabel('Feed bags', { exact: true }).fill('0');
  await dialog.getByLabel('Bag size (kg)', { exact: true }).fill('0');
  await dialog.getByLabel('Additional feed (kg)', { exact: true }).fill('0');
  await dialog.getByLabel('Water (litres)', { exact: true }).fill('100');
  await dialog.getByLabel(/^Light hours/).fill('16');
  await dialog.getByLabel('Sample 1 weight', { exact: true }).fill('62');
  await dialog.getByLabel('Linked bird measurement', { exact: true }).selectOption({ label: await dialog.getByLabel('Linked bird measurement', { exact: true }).locator('option').filter({ hasText: '1600 g' }).textContent() });
  await dialog.getByRole('button', { name: 'Add medicine', exact: true }).click();
  await dialog.getByLabel('Medicine 1 name', { exact: true }).fill('Recorded farm medicine');
  await dialog.getByLabel('Medicine 1 quantity', { exact: true }).fill('1');
  await dialog.getByLabel('Medicine 1 unit', { exact: true }).fill('ml');
  await dialog.getByRole('button', { name: 'Add vaccine', exact: true }).click();
  await dialog.getByLabel('Vaccine 1 name', { exact: true }).fill('Recorded farm vaccine');
  await dialog.getByLabel('Post-mortem observations', { exact: true }).fill('Observed findings, no clinical diagnosis.');
  await dialog.getByRole('button', { name: 'Save draft', exact: true }).click();
  await staffPage.getByRole('dialog').waitFor({ state: 'hidden' });
  await reportButton().click();
  await staffPage.getByRole('button', { name: 'Submit report', exact: true }).click();
  await staffPage.getByRole('button', { name: 'Revision 1', exact: true }).waitFor();
  await staffPage.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();

  await page.reload();
  await page.getByRole('button', { name: `View report ${businessDate()}`, exact: true }).click();
  await page.getByLabel('Submission or return reason', { exact: true }).fill('Recheck the mortality count');
  await page.getByRole('button', { name: 'Return for correction', exact: true }).click();
  await page.getByText(/Returned: Recheck the mortality count/).waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await staffPage.reload();
  await reportButton().click();
  await staffPage.getByRole('button', { name: 'Edit draft', exact: true }).click();
  await staffPage.getByRole('dialog').getByLabel('Mortality count', { exact: true }).fill('3');
  await staffPage.getByRole('dialog').getByRole('button', { name: 'Save draft', exact: true }).click();
  await staffPage.getByRole('dialog').waitFor({ state: 'hidden' });
  await reportButton().click();
  await staffPage.getByLabel('Submission or return reason', { exact: true }).fill('Corrected mortality after recount');
  await staffPage.getByRole('button', { name: 'Submit report', exact: true }).click();
  await staffPage.getByRole('button', { name: 'Revision 2', exact: true }).waitFor();
  await staffPage.getByRole('button', { name: 'Revision 1', exact: true }).click();
  assert.equal(await staffPage.getByRole('dialog').getByText('Mortality', { exact: true }).locator('..').locator('dd').textContent(), '2');
  await staffPage.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await staffPage.goto(`${origin}/mortality`);
  await staffPage.getByRole('cell', { name: '3', exact: true }).waitFor();
  await staffPage.getByRole('cell', { name: 'Observed findings, no clinical diagnosis.', exact: true }).waitFor();
  await staffPage.screenshot({ path: resolve(evidence, 'mortality-mobile.png'), fullPage: true });
  assert(await staffPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.goto(`${origin}/daily-reports`);
  await page.getByRole('button', { name: `View report ${businessDate()}`, exact: true }).click();
  await page.getByRole('button', { name: 'Revision 2', exact: true }).waitFor();
  await page.screenshot({ path: resolve(evidence, 'daily-report-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.goto(`${origin}/users`);
  console.log('PASS: measurement normalization and live report draft validation, submit, return, correction, snapshots and mortality.');


  await page.getByRole('button', { name: 'Assign sites and farms to Browser Staff', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Browser Farm Alpha', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save assignments', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await staffPage.reload();
  await staffPage.waitForURL('**/login');
  await login(staffPage, 'browser-staff@layerflow.test', staffReplacement);
  await staffPage.waitForURL(/\/(dashboard|organization\/farms|mortality)$/);
  await staffPage.goto(`${origin}/organization/farms`);
  await staffPage.getByRole('heading', { name: 'No farms found', exact: true }).waitFor();
  await staffPage.getByTitle('Choose working area', { exact: true }).click();
  await staffPage.getByText('No sites or farms are assigned to you yet. Ask the Owner to assign them.', { exact: true }).waitFor();
  await staffPage.getByRole('button', { name: 'Done', exact: true }).click();
  console.log('PASS: scope revocation ends session and clears inaccessible saved selection.');

  await page.getByRole('button', { name: /^Browser Owner/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await page.waitForURL('**/login');
  await page.reload();
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: logout survives refresh; no browser runtime errors.');
  console.log('Browser verification passed. Screenshots include roles-desktop, users-mobile, organization-desktop, farm-scope-mobile, daily-report-desktop, measurements-mobile and mortality-mobile under .data/verification/.');
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
