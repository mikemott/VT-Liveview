/**
 * GraphQL resolvers for historical data queries.
 * Queries data from PostgreSQL database.
 */

import { eq, gte, lte, and, desc, avg, min, max, count, sql } from 'drizzle-orm';
import {
  getDb,
  weatherObservations,
  weatherAlerts,
  trafficIncidents,
  riverGauges,
} from '../db/index.js';

// Default limit for queries
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

/**
 * Validate and parse date string.
 */
function parseDate(dateStr: string): Date {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return date;
}

/**
 * Get effective limit with bounds checking.
 */
function getLimit(limit?: number | null): number {
  if (!limit || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

export const historicalResolvers = {
  Query: {
    /**
     * Query weather observation history.
     */
    weatherHistory: async (
      _parent: unknown,
      args: {
        stationId?: string;
        startDate: string;
        endDate: string;
        limit?: number;
      }
    ) => {
      const db = getDb();
      if (!db) {
        return [];
      }

      const startDate = parseDate(args.startDate);
      const endDate = parseDate(args.endDate);
      const effectiveLimit = getLimit(args.limit);

      const conditions = [
        gte(weatherObservations.observedAt, startDate),
        lte(weatherObservations.observedAt, endDate),
      ];

      if (args.stationId) {
        conditions.push(eq(weatherObservations.stationId, args.stationId));
      }

      const results = await db
        .select()
        .from(weatherObservations)
        .where(and(...conditions))
        .orderBy(desc(weatherObservations.observedAt))
        .limit(effectiveLimit);

      return results.map((row) => ({
        stationId: row.stationId,
        stationName: row.stationName,
        observedAt: row.observedAt.toISOString(),
        temperatureF: row.temperatureF ? parseFloat(row.temperatureF) : null,
        humidity: row.humidity ? parseFloat(row.humidity) : null,
        windSpeedMph: row.windSpeedMph ? parseFloat(row.windSpeedMph) : null,
        windDirection: row.windDirection,
        pressureMb: row.pressureMb,
        description: row.description,
      }));
    },

    /**
     * Query alert history.
     */
    alertHistory: async (
      _parent: unknown,
      args: {
        eventType?: string;
        startDate: string;
        endDate: string;
        limit?: number;
      }
    ) => {
      const db = getDb();
      if (!db) {
        return [];
      }

      const startDate = parseDate(args.startDate);
      const endDate = parseDate(args.endDate);
      const effectiveLimit = getLimit(args.limit);

      const conditions = [
        gte(weatherAlerts.effectiveAt, startDate),
        lte(weatherAlerts.effectiveAt, endDate),
      ];

      if (args.eventType) {
        conditions.push(eq(weatherAlerts.eventType, args.eventType));
      }

      const results = await db
        .select()
        .from(weatherAlerts)
        .where(and(...conditions))
        .orderBy(desc(weatherAlerts.effectiveAt))
        .limit(effectiveLimit);

      return results.map((row) => ({
        id: String(row.id),
        noaaAlertId: row.noaaAlertId,
        eventType: row.eventType,
        severity: row.severity,
        certainty: row.certainty,
        urgency: row.urgency,
        headline: row.headline,
        areaDesc: row.areaDesc,
        effectiveAt: row.effectiveAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        firstSeenAt: row.firstSeenAt?.toISOString() || null,
        affectedZones: row.affectedZones || [],
      }));
    },

    /**
     * Query incident history.
     */
    incidentHistory: async (
      _parent: unknown,
      args: {
        type?: string;
        startDate: string;
        endDate: string;
        limit?: number;
      }
    ) => {
      const db = getDb();
      if (!db) {
        return [];
      }

      const startDate = parseDate(args.startDate);
      const endDate = parseDate(args.endDate);
      const effectiveLimit = getLimit(args.limit);

      const conditions = [
        gte(trafficIncidents.firstSeenAt, startDate),
        lte(trafficIncidents.firstSeenAt, endDate),
      ];

      if (args.type) {
        conditions.push(eq(trafficIncidents.incidentType, args.type));
      }

      const results = await db
        .select()
        .from(trafficIncidents)
        .where(and(...conditions))
        .orderBy(desc(trafficIncidents.firstSeenAt))
        .limit(effectiveLimit);

      return results.map((row) => ({
        id: String(row.id),
        sourceId: row.sourceId,
        incidentType: row.incidentType,
        severity: row.severity,
        title: row.title,
        description: row.description,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        roadName: row.roadName,
        firstSeenAt: row.firstSeenAt?.toISOString() || null,
        resolvedAt: row.resolvedAt?.toISOString() || null,
      }));
    },

    /**
     * Query gauge reading history.
     */
    gaugeHistory: async (
      _parent: unknown,
      args: {
        siteCode: string;
        startDate: string;
        endDate: string;
        limit?: number;
      }
    ) => {
      const db = getDb();
      if (!db) {
        return [];
      }

      const startDate = parseDate(args.startDate);
      const endDate = parseDate(args.endDate);
      const effectiveLimit = getLimit(args.limit);

      const results = await db
        .select()
        .from(riverGauges)
        .where(
          and(
            eq(riverGauges.siteCode, args.siteCode),
            gte(riverGauges.observedAt, startDate),
            lte(riverGauges.observedAt, endDate)
          )
        )
        .orderBy(desc(riverGauges.observedAt))
        .limit(effectiveLimit);

      return results.map((row) => ({
        siteCode: row.siteCode,
        siteName: row.siteName,
        observedAt: row.observedAt.toISOString(),
        gageHeightFt: parseFloat(row.gageHeightFt),
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
      }));
    },

    /**
     * Get daily weather statistics.
     */
    dailyWeatherStats: async (
      _parent: unknown,
      args: {
        stationId?: string;
        date: string;
      }
    ) => {
      const db = getDb();
      if (!db) {
        return null;
      }

      const date = parseDate(args.date);
      // Use UTC to ensure consistent day boundaries regardless of server timezone
      const startOfDay = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0, 0, 0, 0
      ));
      const endOfDay = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        23, 59, 59, 999
      ));

      const conditions = [
        gte(weatherObservations.observedAt, startOfDay),
        lte(weatherObservations.observedAt, endOfDay),
      ];

      if (args.stationId) {
        conditions.push(eq(weatherObservations.stationId, args.stationId));
      }

      const results = await db
        .select({
          avgTemperature: avg(sql`CAST(${weatherObservations.temperatureF} AS NUMERIC)`),
          minTemperature: min(sql`CAST(${weatherObservations.temperatureF} AS NUMERIC)`),
          maxTemperature: max(sql`CAST(${weatherObservations.temperatureF} AS NUMERIC)`),
          avgHumidity: avg(sql`CAST(${weatherObservations.humidity} AS NUMERIC)`),
          totalReadings: count(),
        })
        .from(weatherObservations)
        .where(and(...conditions));

      const stats = results[0];
      if (!stats || stats.totalReadings === 0) {
        return null;
      }

      return {
        date: args.date,
        stationId: args.stationId || null,
        avgTemperature: stats.avgTemperature ? parseFloat(String(stats.avgTemperature)) : null,
        minTemperature: stats.minTemperature ? parseFloat(String(stats.minTemperature)) : null,
        maxTemperature: stats.maxTemperature ? parseFloat(String(stats.maxTemperature)) : null,
        avgHumidity: stats.avgHumidity ? parseFloat(String(stats.avgHumidity)) : null,
        totalReadings: Number(stats.totalReadings),
      };
    },
  },
};
