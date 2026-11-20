import { AppError } from '../../lib/errors.js';
const localParts = (date, timezone) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const p = Object.fromEntries(parts.map((r) => [r.type, r.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
// Resolve explicit local clock times using actual timezone offsets. Ambiguous
// or nonexistent DST times are rejected instead of silently shifting a dose.
export function localInstant(date, time, timezone) {
  const desired = `${date}T${time}`; const naive = Date.parse(`${desired}:00Z`); const offsets = new Set();
  for (const hours of [-36, -12, 12, 36]) {
    const instant = naive + hours * 3600000;
    offsets.add(Date.parse(`${localParts(new Date(instant), timezone)}:00Z`) - instant);
  }
  const candidates = [...offsets].map((offset) => new Date(naive - offset)).filter((d) => localParts(d, timezone) === desired);
  if (candidates.length !== 1) throw new AppError(422, 'AMBIGUOUS_SCHEDULE', `Choose another clock time: ${desired} is ambiguous or unavailable in ${timezone}.`);
  return candidates[0];
}
export function occurrences(items, timezone) {
  const rows = [];
  for (const item of items) for (let day = 0; day < item.durationDays; day += 1) {
    const date = new Date(Date.parse(item.startDate) + day * 86400000).toISOString().slice(0, 10);
    for (const time of [...item.times].sort()) rows.push({ itemKey: item.key, occurrenceKey: `${date}T${time}`, dueAt: localInstant(date, time, timezone), dueBusinessDate: date, medicine: item.medicine });
  }
  return rows.sort((a, b) => a.dueAt - b.dueAt || a.itemKey.localeCompare(b.itemKey));
}
