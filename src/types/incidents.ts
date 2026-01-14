/**
 * Incident and travel data type definitions
 * Based on VT 511 API and USGS data
 */

import type { Feature, Point, FeatureCollection } from 'geojson';

/** Incident type categories */
export type IncidentType =
  | 'ACCIDENT'
  | 'CONSTRUCTION'
  | 'CLOSURE'
  | 'FLOODING'
  | 'HAZARD';

/** Incident severity levels for zoom-based filtering */
export type IncidentSeverity =
  | 'CRITICAL'
  | 'MAJOR'
  | 'MODERATE'
  | 'MINOR';

/** Data source identifier */
export type IncidentSource = 'VT511' | 'USGS';

/** Color configuration for incident types */
export interface IncidentColor {
  primary: string;
  background: string;
  name: string;
}

/** Incident color map type */
export type IncidentColorMap = Record<IncidentType, IncidentColor>;

/** Base incident data */
export interface Incident {
  id: string;
  type: IncidentType;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  source: IncidentSource;
  severity: IncidentSeverity;
  startTime?: string;
  endTime?: string;
  road?: string;
  direction?: string;
  lastUpdated: string;
}

/** VT 511 specific incident data */
export interface VT511Incident extends Incident {
  source: 'VT511';
  eventType?: string;
  eventSubType?: string;
}

/** USGS flood gauge data */
export interface USGSGauge extends Incident {
  source: 'USGS';
  type: 'FLOODING';
  siteCode: string;
  siteName: string;
  currentLevel: number;
  floodStage: number | null;
  unit: string;
}

/** GeoJSON Feature for incidents */
export type IncidentFeature = Feature<Point, Incident>;

/** GeoJSON FeatureCollection for incidents */
export type IncidentFeatureCollection = FeatureCollection<Point, Incident>;

/** Filter state for incident layer */
export interface IncidentFilters {
  showAccidents: boolean;
  showConstruction: boolean;
  showClosures: boolean;
  showFlooding: boolean;
  showHazards: boolean;
}

/** Default filter state - all enabled */
export const DEFAULT_INCIDENT_FILTERS: IncidentFilters = {
  showAccidents: true,
  showConstruction: true,
  showClosures: true,
  showFlooding: true,
  showHazards: true,
} as const;
