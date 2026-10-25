/**
 * DetailPanel content types
 * Defines the different types of content that can be displayed in the detail panel
 */

import type { TravelIncident } from '../services/travelApi';
import type { ObservationStation } from './weather';
import type { TrafficCamera } from '../services/cameraApi';
import type { RoadWeatherStation } from '../services/roadWeatherApi';
import type { SkiResort } from '../services/skiApi';
import type { Beach } from '../services/beachApi';
import type { CreemeeStand } from '../services/creemeeApi';
import type { RecreationSite } from '../services/recreationApi';
import type { CampingArea } from '../services/campingApi';
import type { DarkSkySite } from './stargazing';
import type { SeasonalRoad } from '../data/seasonalRoads';
import type { RoadStatus } from '../utils/seasonalRoads';

// Alert feature type (from WeatherMap.tsx)
export interface AlertProperties {
  id?: string;
  event: string;
  headline: string | null;
  severity?: string;
  certainty?: string;
  urgency?: string;
  areaDesc: string;
  description?: string;
  instruction?: string | null;
  effective?: string;
  expires?: string;
  // Merged alert properties
  mergedFrom?: string[];
  affectedZoneIds?: string[];
}

// Alert geometry - supports both Polygon and MultiPolygon
export type AlertGeometry =
  | {
      type: 'Polygon';
      coordinates: number[][][];
    }
  | {
      type: 'MultiPolygon';
      coordinates: number[][][][];
    };

export interface AlertFeature {
  type: 'Feature';
  properties: AlertProperties;
  geometry: AlertGeometry | null;
}

// Union type for detail panel content
export type DetailPanelContent =
  | { type: 'alert'; data: AlertFeature }
  | { type: 'incident'; data: TravelIncident }
  | { type: 'station'; data: ObservationStation }
  | { type: 'camera'; data: TrafficCamera }
  | { type: 'roadWeather'; data: RoadWeatherStation }
  | { type: 'ski'; data: SkiResort }
  | { type: 'beach'; data: Beach }
  | { type: 'creemee'; data: CreemeeStand }
  | { type: 'campground'; data: RecreationSite }
  | { type: 'campingArea'; data: CampingArea }
  | { type: 'darkSky'; data: DarkSkySite }
  | { type: 'seasonalRoad'; data: SeasonalRoad; status: RoadStatus }
  | { type: 'location'; coordinates: { lat: number; lng: number } }
  | null;
