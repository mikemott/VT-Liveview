/**
 * What a beach marker/popup should say, given its water-quality data.
 *
 * Only some beaches are monitored (currently Burlington's), and testing stops
 * after Labor Day. Without this, unmonitored beaches showed the yellow
 * "advisory" color all year and a September "Open" result looked current in
 * October.
 */
import { BEACH_COLORS } from './beachColors';
import type { Beach } from '../services/beachApi';

/** Results older than this are treated as stale. */
export const BEACH_RESULT_STALE_DAYS = 14;

/** Months (1-12) when Vermont beaches are typically tested. */
const TESTING_SEASON_MONTHS = [6, 7, 8, 9];

export type BeachDisplayState = 'open' | 'alert' | 'closed' | 'stale' | 'unmonitored' | 'unknown';

export interface BeachDisplay {
  state: BeachDisplayState;
  label: string;
  emoji: string;
  color: string;
  /** Extra context shown under the status, e.g. when it was last tested. */
  detail: string | null;
}

const STATUS_DISPLAY: Record<'open' | 'alert' | 'closed', Omit<BeachDisplay, 'detail'>> = {
  open: { state: 'open', label: 'Open', emoji: '✅', color: BEACH_COLORS.green },
  alert: { state: 'alert', label: 'Alert', emoji: '⚠️', color: BEACH_COLORS.yellow },
  closed: { state: 'closed', label: 'Closed', emoji: '🚫', color: BEACH_COLORS.red },
};

/**
 * Parse the test timestamp. The feed uses "MM/DD/YYYY hh:mm AM" (which not
 * every browser's Date parser accepts); ISO strings are also handled.
 */
export function parseBeachTestDate(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*([AP]M))?$/i.exec(
    value.trim(),
  );
  if (match) {
    const [, mm, dd, yyyy, hh, min, ampm] = match;
    const month = Number(mm);
    const day = Number(dd);
    const year = Number(yyyy);
    const hour12 = hh ? Number(hh) : 12;
    const minute = min ? Number(min) : 0;
    // Reject out-of-range parts: Date would silently roll "13/21" into next year
    if (month < 1 || month > 12 || hour12 < 1 || hour12 > 12 || minute > 59) return null;
    const hours = (hour12 % 12) + (ampm?.toUpperCase() === 'PM' ? 12 : 0);
    const date = new Date(year, month - 1, day, hours, minute);
    // Catches day overflow such as 02/30 or 09/31
    if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatBeachTestDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isKnownStatus(status: string): status is keyof typeof STATUS_DISPLAY {
  return Object.prototype.hasOwnProperty.call(STATUS_DISPLAY, status);
}

export function getBeachDisplay(beach: Beach, now: Date = new Date()): BeachDisplay {
  const tested = parseBeachTestDate(beach.lastTested);
  // Treat anything unexpected from upstream as unknown rather than crashing
  const status = isKnownStatus(beach.status) ? beach.status : 'unknown';

  if (!tested && status === 'unknown') {
    return {
      state: 'unmonitored',
      label: 'Not monitored',
      emoji: 'ℹ️',
      color: BEACH_COLORS.gray,
      detail: 'No water-quality testing data for this beach.',
    };
  }

  const ageDays = tested ? (now.getTime() - tested.getTime()) / 86_400_000 : 0;
  if (tested && ageDays > BEACH_RESULT_STALE_DAYS) {
    const inSeason = TESTING_SEASON_MONTHS.includes(now.getMonth() + 1);
    const lastResult = status !== 'unknown' ? ` (${STATUS_DISPLAY[status].label})` : '';
    return {
      state: 'stale',
      label: inSeason ? 'No recent test' : 'Season over',
      emoji: '🗓️',
      color: BEACH_COLORS.gray,
      detail: `Last tested ${formatBeachTestDate(tested)}${lastResult}`,
    };
  }

  if (status === 'unknown') {
    return {
      state: 'unknown',
      label: 'Unknown status',
      emoji: '❓',
      color: BEACH_COLORS.gray,
      detail: tested ? `Last tested ${formatBeachTestDate(tested)}` : null,
    };
  }

  return {
    ...STATUS_DISPLAY[status],
    detail: tested ? `Tested ${formatBeachTestDate(tested)}` : null,
  };
}
