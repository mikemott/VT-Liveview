import { ComponentType } from 'react';
import { Mountain, IceCream } from 'lucide-react';
import SkiLayer from '../components/SkiLayer';
import CreemeeLayer from '../components/CreemeeLayer';
// LakeConditionsLayer will be added in future phases (will need Waves icon)

/**
 * Seasonal Layer System Configuration
 *
 * This file defines all seasonal map layers and their visibility rules.
 * Layers with a `season` property auto-show during their defined months.
 *
 * Adding a new seasonal layer:
 * 1. Define the layer config below
 * 2. Create the component (follow SkiLayer.tsx pattern)
 * 3. Add to SEASONAL_LAYERS array
 */

// =============================================================================
// Types
// =============================================================================

export interface SeasonConfig {
  months: number[];  // 1-12 (January = 1, December = 12)
  label: string;     // Human-readable season name
}

export interface LayerProps {
  map: any;  // MapLibreMap type from ../types
  visible: boolean;
}

export interface LayerConfig {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  season?: SeasonConfig;  // undefined = always available
  component: ComponentType<LayerProps>;
}

// =============================================================================
// Layer Definitions
// =============================================================================

export const SEASONAL_LAYERS: LayerConfig[] = [
  {
    id: 'skiResorts',
    label: 'Ski Resorts',
    icon: Mountain,
    season: {
      months: [11, 12, 1, 2, 3],  // November - March
      label: 'Ski Season'
    },
    component: SkiLayer
  },
  {
    id: 'creemeeStands',
    label: 'Creemee Stands',
    icon: IceCream,
    season: {
      months: [4, 5, 6, 7, 8, 9],  // April - September
      label: 'Creemee Season'
    },
    component: CreemeeLayer
  },
  // Uncomment when LakeConditionsLayer is implemented (future)
  // {
  //   id: 'lakeConditions',
  //   label: 'Lake Conditions',
  //   icon: Waves,
  //   season: {
  //     months: [6, 7, 8],  // June - August
  //     label: 'Lake Season'
  //   },
  //   component: LakeConditionsLayer
  // },
];

/**
 * Core (non-seasonal) layers - always available
 * These don't auto-show/hide based on dates
 */
export interface CoreLayerConfig {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

// Core layers will be defined here as we refactor TravelLayer
// For now, weather stations remain in TravelLayer
