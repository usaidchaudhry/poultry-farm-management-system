import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key), clear: () => storage.clear() };
const { mockOrganizationService: org } = await import('../src/services/mock/mockOrganizationService.js');
const owner = { id: 'u1', role: 'owner' };

test('a directly assigned site remains visible before it has farms', async () => {
  const site = await org.createEntity('site', { name: 'New Site', location: 'Test' }, owner);
  await org.setAssignment('u3', { siteIds: [site.id], farmIds: [] }, owner);
  const scope = await org.getScopedHierarchy({ id: 'u3', role: 'farm_manager' });
  assert.equal(scope.sites.some((row) => row.id === site.id), true);
  assert.equal(scope.farms.some((row) => row.siteId === site.id), false);
});

test('active children prevent archiving their parent', async () => {
  await assert.rejects(org.setArchived('site', 's1', true, owner), { code: 'HAS_ACTIVE_CHILDREN' });
});
