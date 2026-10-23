/**
 * How old a weather station's reading is.
 *
 * Some NWS/mesonet stations report irregularly; on Oct 23 a few were 2–4+
 * hours old but displayed exactly like current readings.
 */

/** Readings older than this are flagged as stale. */
export const STALE_OBSERVATION_MINUTES = 90;

export interface ObservationAge {
  /** Whole minutes since the reading, or null if the timestamp is missing/invalid. */
  minutes: number | null;
  isStale: boolean;
  /** e.g. "as of 1:20 PM", or "as of Oct 22, 9:05 PM" for an earlier day. */
  asOf: string | null;
  /** e.g. "35 min ago", "3 hr ago", "2 days ago". */
  ago: string | null;
}

export function getObservationAge(
  timestamp: string | null | undefined,
  now: Date = new Date(),
): ObservationAge {
  const time = timestamp ? new Date(timestamp) : null;
  if (!time || Number.isNaN(time.getTime())) {
    return { minutes: null, isStale: false, asOf: null, ago: null };
  }

  const minutes = Math.max(0, Math.floor((now.getTime() - time.getTime()) / 60_000));
  const sameDay = time.toDateString() === now.toDateString();
  const clock = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const asOf = sameDay
    ? `as of ${clock}`
    : `as of ${time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${clock}`;

  let ago: string;
  if (minutes < 60) ago = `${minutes} min ago`;
  else if (minutes < 48 * 60) ago = `${Math.floor(minutes / 60)} hr ago`;
  else ago = `${Math.floor(minutes / (24 * 60))} days ago`;

  return { minutes, isStale: minutes > STALE_OBSERVATION_MINUTES, asOf, ago };
}
