interface ColorInput {
  snowfall24hr: number | null;
  trailsOpen: number;
  trailsTotal: number;
  liftsOpen: number;
  liftsTotal: number;
}

/**
 * Calculate marker color for a ski resort based on conditions
 *
 * Algorithm matches backend logic (backend/src/services/skiConditions.ts):
 * - Green: Good snow (≥2") AND good operations (≥70%)
 * - Yellow: Decent snow (≥0.5") AND decent operations (≥40%), OR decent operations alone
 * - Red: Everything else (poor conditions)
 *
 * Operations percentage is the MINIMUM of trails% and lifts% to avoid misleading
 * situations (e.g., 90% trails but only 20% lifts = limited access)
 */
export function calculateResortColor(input: ColorInput): 'green' | 'yellow' | 'red' {
  const { snowfall24hr, trailsOpen, trailsTotal, liftsOpen, liftsTotal } = input;

  // Step 1: Check snow quality
  const hasGoodSnow = snowfall24hr !== null && snowfall24hr >= 2;
  const hasDecentSnow = snowfall24hr !== null && snowfall24hr >= 0.5;

  // Step 2: Check operational status
  const trailsPercent = (trailsOpen / trailsTotal) * 100;
  const liftsPercent = (liftsOpen / liftsTotal) * 100;
  const operationsPercent = Math.min(trailsPercent, liftsPercent);

  const goodOperations = operationsPercent >= 70;
  const decentOperations = operationsPercent >= 40;

  // Step 3: Combine (tiered priority)
  if (hasGoodSnow && goodOperations) return 'green';
  if (hasDecentSnow && decentOperations) return 'yellow';
  if (decentOperations) return 'yellow';
  return 'red';
}

/**
 * Color palette for ski resort markers
 * Matches Tailwind CSS utility colors for consistency
 */
export const SKI_COLORS = {
  green: '#22c55e',  // Tailwind green-500
  yellow: '#eab308', // Tailwind yellow-500
  red: '#ef4444',    // Tailwind red-500
} as const;
