/**
 * Database schema definitions using Drizzle ORM.
 * Defines tables for historical storage of weather, alerts, traffic, and gauge data.
 */

import {
  pgTable,
  bigserial,
  varchar,
  decimal,
  timestamp,
  text,
  integer,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';

/**
 * Weather observations from NOAA stations.
 * Collected every 5 minutes from Vermont observation stations.
 */
export const weatherObservations = pgTable(
  'weather_observations',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    stationId: varchar('station_id', { length: 20 }).notNull(),
    stationName: varchar('station_name', { length: 255 }).notNull(),
    latitude: decimal('latitude', { precision: 9, scale: 6 }).notNull(),
    longitude: decimal('longitude', { precision: 9, scale: 6 }).notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    temperatureF: decimal('temperature_f', { precision: 5, scale: 1 }),
    humidity: decimal('humidity', { precision: 5, scale: 2 }),
    windSpeedMph: decimal('wind_speed_mph', { precision: 5, scale: 1 }),
    windDirection: varchar('wind_direction', { length: 3 }),
    pressureMb: integer('pressure_mb'),
    description: varchar('description', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('uq_weather_obs_station_time').on(table.stationId, table.observedAt),
    index('idx_weather_obs_observed_at').on(table.observedAt),
  ]
);

/**
 * Weather alerts from NOAA.
 * Tracks alert history with first_seen and last_seen timestamps.
 */
export const weatherAlerts = pgTable(
  'weather_alerts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    noaaAlertId: varchar('noaa_alert_id', { length: 255 }).notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    severity: varchar('severity', { length: 20 }).notNull(),
    certainty: varchar('certainty', { length: 20 }).notNull(),
    urgency: varchar('urgency', { length: 20 }).notNull(),
    headline: text('headline'),
    description: text('description'),
    instruction: text('instruction'),
    areaDesc: text('area_desc'),
    affectedZones: text('affected_zones').array(), // Array of zone IDs
    geometry: jsonb('geometry'), // GeoJSON MultiPolygon
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('uq_weather_alerts_noaa_id').on(table.noaaAlertId),
    index('idx_alerts_event_type').on(table.eventType),
    index('idx_alerts_expires').on(table.expiresAt),
    index('idx_alerts_severity').on(table.severity),
  ]
);

/**
 * Traffic incidents from VT 511.
 * Tracks incident lifecycle with first_seen, last_seen, and resolved timestamps.
 */
export const trafficIncidents = pgTable(
  'traffic_incidents',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sourceId: varchar('source_id', { length: 100 }).notNull(), // e.g., "vt511-incident-12345"
    incidentType: varchar('incident_type', { length: 50 }).notNull(), // ACCIDENT, CONSTRUCTION, CLOSURE, HAZARD
    severity: varchar('severity', { length: 20 }).notNull(), // MINOR, MODERATE, MAJOR, CRITICAL
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    latitude: decimal('latitude', { precision: 9, scale: 6 }).notNull(),
    longitude: decimal('longitude', { precision: 9, scale: 6 }).notNull(),
    roadName: varchar('road_name', { length: 255 }),
    affectedLanes: varchar('affected_lanes', { length: 255 }),
    geometry: jsonb('geometry'), // GeoJSON LineString for route geometry
    startedAt: timestamp('started_at', { withTimezone: true }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }), // NULL if still active
    source: varchar('source', { length: 50 }).notNull().default('VT 511'),
  },
  (table) => [
    unique('uq_traffic_incidents_source_id').on(table.sourceId),
    index('idx_incidents_type').on(table.incidentType),
    index('idx_incidents_active').on(table.resolvedAt),
    index('idx_incidents_time').on(table.firstSeenAt),
  ]
);

/**
 * River gauge readings from USGS.
 * Time-series data for water levels at monitoring stations.
 */
export const riverGauges = pgTable(
  'river_gauges',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    siteCode: varchar('site_code', { length: 20 }).notNull(),
    siteName: varchar('site_name', { length: 255 }).notNull(),
    latitude: decimal('latitude', { precision: 9, scale: 6 }).notNull(),
    longitude: decimal('longitude', { precision: 9, scale: 6 }).notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    gageHeightFt: decimal('gage_height_ft', { precision: 8, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique('uq_river_gauges_site_time').on(table.siteCode, table.observedAt),
    index('idx_gauges_observed_at').on(table.observedAt),
  ]
);

// Type exports for use in collectors and resolvers
export type WeatherObservation = typeof weatherObservations.$inferSelect;
export type NewWeatherObservation = typeof weatherObservations.$inferInsert;

export type WeatherAlert = typeof weatherAlerts.$inferSelect;
export type NewWeatherAlert = typeof weatherAlerts.$inferInsert;

export type TrafficIncident = typeof trafficIncidents.$inferSelect;
export type NewTrafficIncident = typeof trafficIncidents.$inferInsert;

export type RiverGauge = typeof riverGauges.$inferSelect;
export type NewRiverGauge = typeof riverGauges.$inferInsert;
