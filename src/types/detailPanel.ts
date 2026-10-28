/**
 * DetailPanel content types
 * Defines the different types of content that can be displayed in the detail panel
 */

import type { TravelIncident } from '../services/travelApi';
import type { ObservationStation } from './weather';
import type { TrafficCamera } from '../services/cameraApi';
import type { RoadWeatherStation } from '../services/roadWeatherApi';
import type { AirQualityMonitor } from '../services/airQualityApi';
import type { RiverGauge } from '../services/riverApi';
import type { EvCharger } from '../services/evChargerApi';
import type { FireDangerAreaView } from '../services/fireDangerApi';
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

/** Something near a "What's here?" point */
export type NearbyItem =
  | { kind: 'roadWeather'; distanceMi: number; data: RoadWeatherStation }
  | { kind: 'camera'; distanceMi: number; data: TrafficCamera }
  | { kind: 'incident'; distanceMi: number; data: TravelIncident };

export interface LocationContext {
  /** Active weather alerts whose area covers the point */
  alerts: AlertFeature[];
  /** Nearest road temp and camera, and closures/accidents close by */
  nearby: NearbyItem[];
}

// Union type for detail panel content
export type DetailPanelContent =
  | { type: 'alert'; data: AlertFeature }
  | { type: 'incident'; data: TravelIncident }
  | { type: 'station'; data: ObservationStation }
  | { type: 'camera'; data: TrafficCamera }
  | { type: 'roadWeather'; data: RoadWeatherStation }
  | { type: 'airQuality'; data: AirQualityMonitor }
  | { type: 'river'; data: RiverGauge }
  | { type: 'evCharger'; data: EvCharger }
  | { type: 'fireDanger'; data: FireDangerAreaView }
  | { type: 'ski'; data: SkiResort }
  | { type: 'beach'; data: Beach }
  | { type: 'creemee'; data: CreemeeStand }
  | { type: 'campground'; data: RecreationSite }
  | { type: 'campingArea'; data: CampingArea }
  | { type: 'darkSky'; data: DarkSkySite }
  | { type: 'seasonalRoad'; data: SeasonalRoad; status: RoadStatus }
  | {
      type: 'location';
      coordinates: { lat: number; lng: number };
      /** What's around the point; filled in from loaded layer data (VTL-65) */
      context?: LocationContext;
    }
  | null;
