/**
 * EV charging station helpers (VTL-81).
 */
import type { EvCharger } from '../services/evChargerApi';

/** Level 2 stations show from this zoom in (about a town across) */
export const LEVEL2_MIN_ZOOM = 11;

export const isFastCharger = (s: EvCharger): boolean => s.dcFastPorts > 0;

/** "8 DC fast (150 kW)", "2 Level 2", "4 DC fast, 2 Level 2" */
export function describePorts(s: EvCharger): string {
  return [
    s.dcFastPorts > 0 && `${s.dcFastPorts} DC fast${s.maxKw ? ` (${s.maxKw} kW)` : ''}`,
    s.level2Ports > 0 && `${s.level2Ports} Level 2`,
  ]
    .filter(Boolean)
    .join(', ');
}
