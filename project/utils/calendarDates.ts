/**
 * Calendar date helpers. Dates are plain local 'YYYY-MM-DD' strings (matching
 * the `date` column in scheduled_workouts), never Date objects in UTC, so a
 * workout planned for "Nov 12" stays on Nov 12 in every time zone.
 */

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** First and last date keys of the month containing `month`. */
export function monthRange(month: Date): { start: string; end: string } {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { start: toDateKey(start), end: toDateKey(end) };
}

/**
 * The cells of a Sunday-first month grid: leading blanks (null) so the 1st
 * lands under its weekday, then every day of the month.
 */
export function monthGrid(month: Date): (Date | null)[] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const leading = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (Date | null)[] = Array(leading).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, m, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatMonthTitle(month: Date): string {
  return `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;
}

/** e.g. "Thu, Nov 12" */
export function formatShortDate(key: string): string {
  const date = fromDateKey(key);
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
}
