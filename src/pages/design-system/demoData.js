// Demo rows used only by the design-system page. Real mock data arrives in Phase 5.
const HOUSES = ['House A1', 'House A2', 'House B1', 'House B2', 'House C1'];
const STATUSES = ['active', 'active', 'active', 'pending', 'archived'];

export const DEMO_FLOCKS = Array.from({ length: 23 }, (_, index) => {
  const day = String((index % 27) + 1).padStart(2, '0');
  return {
    id: index + 1,
    name: `Flock ${String(index + 1).padStart(3, '0')}`,
    house: HOUSES[index % HOUSES.length],
    birds: 4000 + ((index * 731) % 5200),
    status: STATUSES[index % STATUSES.length],
    placedOn: `2026-0${(index % 9) + 1}-${day}`,
  };
});

export const DEMO_CHART_DATA = [
  { label: 'Mon', value: 12 },
  { label: 'Tue', value: 9 },
  { label: 'Wed', value: 15 },
  { label: 'Thu', value: 7 },
  { label: 'Fri', value: 11 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 10 },
];

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'archived', label: 'Archived' },
];
