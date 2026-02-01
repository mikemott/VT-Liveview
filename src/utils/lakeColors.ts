/**
 * Color coding for lake temperature comfort levels
 */

export const LAKE_COLORS = {
  cold: '#3b82f6',        // Blue - too cold for most swimmers (< 65°F)
  comfortable: '#22c55e', // Green - ideal swimming temperature (65-75°F)
  warm: '#f97316',        // Orange - warm water (> 75°F)
} as const;

export type ComfortLevel = keyof typeof LAKE_COLORS;
