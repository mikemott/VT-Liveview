/**
 * NFDRS fire danger levels (VTL-81): names, the standard color order (green,
 * blue, yellow, orange, red) in the app's muted status shades, and what each
 * level means.
 * https://www.nwcg.gov/publications/pms437/fire-danger/fire-danger-rating-levels
 */

export interface FireLevel {
  name: string;
  color: string;
  /** Text on the light tint (>= 4.5:1; fireDanger.test.ts checks) */
  ink: string;
  inkDark: string;
  meaning: string;
}

export const FIRE_LEVELS: Record<number, FireLevel> = {
  1: {
    name: 'Low',
    color: '#16a34a',
    ink: '#166534',
    inkDark: '#86efac',
    meaning: 'Fuels don’t catch easily from small embers, and fires that start burn slowly.',
  },
  2: {
    name: 'Moderate',
    color: '#2563eb',
    ink: '#1e40af',
    inkDark: '#93c5fd',
    meaning: 'Fires can start from most accidental causes, but spread at a moderate rate.',
  },
  3: {
    name: 'High',
    color: '#a16207',
    ink: '#854d0e',
    inkDark: '#fcd34d',
    meaning:
      'Fires start easily from most causes. Unattended brush and campfires are likely to escape.',
  },
  4: {
    name: 'Very High',
    color: '#ea580c',
    ink: '#9a3412',
    inkDark: '#fdba74',
    meaning: 'Fires start easily from all causes, spread rapidly and intensify quickly.',
  },
  5: {
    name: 'Extreme',
    color: '#dc2626',
    ink: '#b91c1c',
    inkDark: '#fca5a5',
    meaning: 'Fires start quickly, spread furiously and burn intensely. Any fire can be serious.',
  },
};

export const UNRATED: FireLevel = {
  name: 'Not rated',
  color: '#64748b',
  ink: '#475569',
  inkDark: '#cbd5e1',
  meaning: 'No rating has been posted for this area.',
};

export const fireLevel = (rating: number | null): FireLevel =>
  (rating !== null && FIRE_LEVELS[rating]) || UNRATED;

/** CSS variables for an element with the `status-tone` class (src/styles/tone.css) */
export function fireToneVars(rating: number | null): Record<string, string> {
  const l = fireLevel(rating);
  return { '--tone-color': l.color, '--tone-ink': l.ink, '--tone-ink-dark': l.inkDark };
}

/**
 * FPR edits the statewide record every morning in season (March 20 to
 * November 30). Older than this, the ratings are out of date: off season, or
 * not yet posted after a gap.
 */
export const FIRE_DANGER_STALE_HOURS = 72;

export function isFireDangerStale(updatedAt: string | null, now: Date = new Date()): boolean {
  if (!updatedAt) return true;
  const t = Date.parse(updatedAt);
  return Number.isNaN(t) || now.getTime() - t > FIRE_DANGER_STALE_HOURS * 3600_000;
}
