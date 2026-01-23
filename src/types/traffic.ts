/**
 * Traffic flow data type definitions
 * Based on NE 511 Traffic Conditions and Network Data APIs
 */

import type { Feature, LineString, FeatureCollection } from 'geojson';

/** Traffic flow status based on speed relative to speed limit */
export type TrafficFlowStatus = 'free' | 'moderate' | 'slow' | 'congested' | 'unknown';

/** Traffic condition from NE 511 API */
export interface TrafficCondition {
  linkId: string;
  networkId: string;
  type: string;
  speed: number | null;
  volume: number | null;
  occupancy: number | null;
  timestamp: string;
}

/** Road network node (start/end point of a link) */
export interface NetworkNode {
  id: string;
  networkId: string;
  name: string;
  lat: number;
  lng: number;
}

/** Road network link (road segment) */
export interface NetworkLink {
  id: string;
  networkId: string;
  name: string;
  roadDesignator: string | null;
  roadway: string | null;
  direction: string | null;
  startNodeId: string;
  endNodeId: string;
  length: number;
  speedLimit: number;
  laneCount: number;
  midPoints: Array<{ lat: number; lng: number }>;
}

/** Parsed network data from NE 511 */
export interface NetworkData {
  nodes: Map<string, NetworkNode>;
  links: Map<string, NetworkLink>;
}

/** Combined traffic flow data for a road segment */
export interface TrafficFlowSegment {
  linkId: string;
  roadName: string;
  direction: string | null;
  speedLimit: number;
  currentSpeed: number | null;
  volume: number | null;
  occupancy: number | null;
  status: TrafficFlowStatus;
  coordinates: Array<[number, number]>;
  timestamp: string;
}

/** GeoJSON properties for traffic flow features */
export interface TrafficFlowProperties {
  linkId: string;
  roadName: string;
  direction: string | null;
  speedLimit: number;
  currentSpeed: number | null;
  volume: number | null;
  occupancy: number | null;
  status: TrafficFlowStatus;
  timestamp: string;
}

/** GeoJSON Feature for traffic flow */
export type TrafficFlowFeature = Feature<LineString, TrafficFlowProperties>;

/** GeoJSON FeatureCollection for traffic flow */
export type TrafficFlowFeatureCollection = FeatureCollection<LineString, TrafficFlowProperties>;

/** Color configuration for traffic flow status */
export interface TrafficFlowColor {
  line: string;
  glow: string;
  name: string;
}

/** Traffic flow color map type */
export type TrafficFlowColorMap = Record<TrafficFlowStatus, TrafficFlowColor>;

/** Traffic flow layer visibility settings */
export interface TrafficFlowSettings {
  enabled: boolean;
  showLabels: boolean;
}

/** Default traffic flow settings */
export const DEFAULT_TRAFFIC_FLOW_SETTINGS: TrafficFlowSettings = {
  enabled: false,
  showLabels: false,
} as const;

/** Traffic flow colors - Google Maps style */
export const TRAFFIC_FLOW_COLORS: TrafficFlowColorMap = {
  free: {
    line: '#00c853',
    glow: '#00e676',
    name: 'Free flow',
  },
  moderate: {
    line: '#ffab00',
    glow: '#ffd740',
    name: 'Moderate',
  },
  slow: {
    line: '#ff6d00',
    glow: '#ff9100',
    name: 'Slow',
  },
  congested: {
    line: '#d50000',
    glow: '#ff1744',
    name: 'Congested',
  },
  unknown: {
    line: '#9e9e9e',
    glow: '#bdbdbd',
    name: 'No data',
  },
} as const;
