/**
 * Beach water quality color constants
 * Matches the color system from backend service
 */

export const BEACH_COLORS = {
  green: '#10b981', // Safe - Good water quality
  yellow: '#f59e0b', // Advisory - Moderate concerns
  red: '#ef4444',    // Closed - Unsafe conditions
} as const;

export type BeachColor = keyof typeof BEACH_COLORS;
