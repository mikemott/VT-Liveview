/**
 * NWS flood categories for river gauges (VTL-81): names and theme colors.
 * The colors follow the NWS order (action yellow, minor orange, moderate red,
 * major purple) in the app's muted status shades, like the AQI scale.
 * https://water.noaa.gov/about/flood-categories
 */
import type { FloodCategory, FloodStages, RiverGauge } from '../services/riverApi';

export interface FloodLevel {
  name: string;
  /** Tint, outline and marker fill; null: no status color (normal levels) */
  color: string | null;
  /** Text on the light tint (>= 4.5:1; rivers.test.ts checks) */
  ink: string;
  /** Text on the dark tint */
  inkDark: string;
}

export const FLOOD_LEVELS: Record<FloodCategory, FloodLevel> = {
  no_flooding: { name: 'Normal', color: null, ink: '#166534', inkDark: '#86efac' },
  not_defined: { name: 'No flood stages set', color: null, ink: '#475569', inkDark: '#cbd5e1' },
  unknown: { name: 'No current reading', color: null, ink: '#475569', inkDark: '#cbd5e1' },
  action: { name: 'Action stage', color: '#a16207', ink: '#854d0e', inkDark: '#fcd34d' },
  minor: { name: 'Minor flooding', color: '#ea580c', ink: '#9a3412', inkDark: '#fdba74' },
  moderate: { name: 'Moderate flooding', color: '#dc2626', ink: '#b91c1c', inkDark: '#fca5a5' },
  major: { name: 'Major flooding', color: '#9333ea', ink: '#7e22ce', inkDark: '#d8b4fe' },
};

/** Rising order, for "worst of" comparisons */
const SEVERITY: Record<FloodCategory, number> = {
  unknown: 0,
  not_defined: 0,
  no_flooding: 0,
  action: 1,
  minor: 2,
  moderate: 3,
  major: 4,
};

export const floodSeverity = (c: FloodCategory | null): number => (c ? SEVERITY[c] : 0);

/** The worse of the observed and forecast categories */
export function worstCategory(gauge: RiverGauge): FloodCategory {
  const f = gauge.forecastCategory;
  return f && SEVERITY[f] > SEVERITY[gauge.category] ? f : gauge.category;
}

/** CSS variables for an element with the `status-tone` class (src/styles/tone.css) */
export function floodToneVars(category: FloodCategory): Record<string, string> {
  const l = FLOOD_LEVELS[category];
  return {
    // Normal levels use the ski "green"; no reading is plain slate
    '--tone-color': l.color ?? (category === 'no_flooding' ? '#16a34a' : '#64748b'),
    '--tone-ink': l.ink,
    '--tone-ink-dark': l.inkDark,
  };
}

export function formatStage(ft: number | null): string {
  return ft === null ? '—' : `${ft.toFixed(ft >= 100 ? 1 : 2)} ft`;
}

export function formatFlow(cfs: number | null): string {
  return cfs === null ? '—' : `${cfs.toLocaleString('en-US')} cfs`;
}

/** The first flood stage above `stageFt`, e.g. to say "2.6 ft below flood stage" */
export function floodStageFor(stages: FloodStages): number | null {
  return stages.minor ?? stages.moderate ?? stages.major;
}

/**
 * The NWS impact statement for a stage: the highest listed stage at or below
 * it. Below every listed stage, the lowest one, so the panel can say what
 * happens first.
 */
export function impactAt(
  impacts: { stageFt: number; statement: string }[],
  stageFt: number | null,
): { stageFt: number; statement: string; reached: boolean } | null {
  if (impacts.length === 0) return null;
  if (stageFt !== null) {
    const hit = impacts.find((i) => i.stageFt <= stageFt);
    if (hit) return { ...hit, reached: true };
  }
  return { ...impacts[impacts.length - 1]!, reached: false };
}

/** Readings older than this are flagged (gauges report every 15-60 min) */
export const RIVER_READING_STALE_MINUTES = 180;

export function isRiverReadingStale(observedAt: string | null, now: Date = new Date()): boolean {
  if (!observedAt) return true;
  const t = Date.parse(observedAt);
  return Number.isNaN(t) || now.getTime() - t > RIVER_READING_STALE_MINUTES * 60_000;
}
