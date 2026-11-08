// MOCK DATA ONLY. Company > Site > Farm > House > Flock, stored flat with parent ids
// so it maps directly to database collections later.
export const COMPANY = { id: 'c1', name: 'Green Valley Poultry' };

const stamp = { createdAt: '2026-01-10T08:00:00.000Z', updatedAt: '2026-01-10T08:00:00.000Z' };
const active = { status: 'active', ...stamp };
const archived = { status: 'archived', archivedAt: '2026-09-01T08:00:00.000Z', ...stamp };

export const SEED_ORG = {
  sites: [
    { id: 's1', name: 'North Valley Site', location: 'Sheikhupura', ...active },
    { id: 's2', name: 'Riverside Site', location: 'Kasur', ...active },
    { id: 's3', name: 'Old Mill Site', location: 'Okara', ...archived },
  ],
  farms: [
    { id: 'f1', siteId: 's1', name: 'Farm A', ...active },
    { id: 'f2', siteId: 's1', name: 'Farm B', ...active },
    { id: 'f3', siteId: 's2', name: 'Farm C', ...active },
    { id: 'f4', siteId: 's2', name: 'Farm D', ...active },
    { id: 'f5', siteId: 's3', name: 'Old Mill Farm', ...archived },
  ],
  houses: [
    { id: 'h1', farmId: 'f1', name: 'House A1', capacity: 12000, ...active },
    { id: 'h2', farmId: 'f1', name: 'House A2', capacity: 12000, ...active },
    { id: 'h3', farmId: 'f2', name: 'House B1', capacity: 10000, ...active },
    { id: 'h4', farmId: 'f2', name: 'House B2', capacity: 10000, ...active },
    { id: 'h5', farmId: 'f3', name: 'House C1', capacity: 15000, ...active },
    { id: 'h6', farmId: 'f3', name: 'House C2', capacity: 15000, ...active },
    { id: 'h7', farmId: 'f4', name: 'House D1', capacity: 8000, ...active },
    { id: 'h8', farmId: 'f5', name: 'Mill House 1', capacity: 6000, ...archived },
  ],
  flocks: [
    { id: 'fl1', houseId: 'h1', name: 'Flock 001', birdType: 'Layer', placementDate: '2026-03-10', initialCount: 11500, ...active },
    { id: 'fl2', houseId: 'h2', name: 'Flock 002', birdType: 'Layer', placementDate: '2026-04-02', initialCount: 11800, ...active },
    { id: 'fl3', houseId: 'h3', name: 'Flock 003', birdType: 'Broiler', placementDate: '2026-10-01', initialCount: 9800, ...active },
    { id: 'fl4', houseId: 'h5', name: 'Flock 004', birdType: 'Layer', placementDate: '2026-02-15', initialCount: 14200, ...active },
    { id: 'fl5', houseId: 'h6', name: 'Flock 005', birdType: 'Broiler', placementDate: '2026-10-20', initialCount: 14500, ...active },
    { id: 'fl6', houseId: 'h7', name: 'Flock 006', birdType: 'Layer', placementDate: '2026-06-05', initialCount: 7600, ...active },
    { id: 'fl7', houseId: 'h1', name: 'Flock 000', birdType: 'Layer', placementDate: '2025-08-01', initialCount: 11000, ...archived },
    { id: 'fl8', houseId: 'h8', name: 'Mill Flock 1', birdType: 'Broiler', placementDate: '2025-05-12', initialCount: 5800, ...archived },
  ],
  // userId -> sites (whole site, including all its farms) and individual farms the user is assigned to.
  // Owner and Production Manager are company-wide, so they need no assignment.
  assignments: {
    u3: { siteIds: [], farmIds: ['f1', 'f2'] },
    u4: { siteIds: ['s1', 's2'], farmIds: [] },
    u5: { siteIds: ['s1'], farmIds: ['f3'] },
    u6: { siteIds: [], farmIds: ['f3'] },
  },
};
