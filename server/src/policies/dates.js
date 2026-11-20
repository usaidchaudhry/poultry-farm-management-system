import { AppError } from '../lib/errors.js';

export function businessDate(now = new Date(), timezone = 'Asia/Karachi') {
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dateNumber(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError(422, 'INVALID_DATE', 'Use a valid YYYY-MM-DD business date.');
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new AppError(422, 'INVALID_DATE', 'Use a valid calendar date.');
  return time;
}

export function allowedDateRange(actor, { from, to, clinical = false, now = new Date(), timezone = 'Asia/Karachi' } = {}) {
  const today = businessDate(now, timezone);
  const todayTime = dateNumber(today);
  const previous = new Date(todayTime - 86_400_000).toISOString().slice(0, 10);
  const history = actor.permissions.includes('reports.history.view') || (clinical && actor.permissions.includes('clinical.history.view'));
  from ||= history ? today : previous;
  to ||= today;
  const first = dateNumber(from); const last = dateNumber(to);
  if (first > last || last > todayTime || last - first > 89 * 86_400_000) throw new AppError(422, 'INVALID_DATE_RANGE', 'Choose an ordered range of at most 90 days, ending no later than today.');
  if (!history && first < dateNumber(previous)) throw new AppError(403, 'HISTORY_FORBIDDEN', 'Only today and the previous business day are available.');
  return { from, to };
}
