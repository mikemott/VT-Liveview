import { useMemo } from 'react';
import { SEASONAL_LAYERS, type LayerConfig } from '../config/seasonalLayers';

/**
 * useSeasonalLayers Hook
 *
 * Determines which seasonal layers should be visible based on current month.
 * Returns categorized layers (in-season vs out-of-season) and utility functions.
 *
 * Usage:
 *   const { inSeason, outOfSeason, isInSeason } = useSeasonalLayers();
 *   const shouldShow = isInSeason(config);
 */

interface UseSeasonalLayersResult {
  /** Layers currently in their defined season */
  inSeason: LayerConfig[];
  /** Layers currently out of their defined season */
  outOfSeason: LayerConfig[];
  /** Check if a specific layer config is in season */
  isInSeason: (config: LayerConfig) => boolean;
  /** Get current month (1-12) for debugging */
  currentMonth: number;
}

export function useSeasonalLayers(): UseSeasonalLayersResult {
  const currentMonth = new Date().getMonth() + 1; // 1-12

  const result = useMemo(() => {
    const isInSeason = (config: LayerConfig): boolean => {
      // Layers without a season are always "in season" (always available)
      if (!config.season) return true;

      // Check if current month is in the layer's season months
      return config.season.months.includes(currentMonth);
    };

    const inSeason = SEASONAL_LAYERS.filter(isInSeason);
    const outOfSeason = SEASONAL_LAYERS.filter(config => !isInSeason(config));

    return {
      inSeason,
      outOfSeason,
      isInSeason,
      currentMonth
    };
  }, [currentMonth]);

  return result;
}
