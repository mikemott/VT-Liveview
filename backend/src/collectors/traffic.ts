/**
 * Traffic incidents collector.
 * Fetches VT 511 incident data and stores in database.
 */

import { eq, isNull, notInArray, and } from 'drizzle-orm';
import { getDb, trafficIncidents, type NewTrafficIncident } from '../db/index.js';
import { getEnv, isDev } from '../types/env.js';

// VT 511 API endpoint
const VT_511_BASE = 'https://nec-por.ne-compass.com/NEC.XmlDataPortal/api/c2c';

interface ParsedIncident {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  roadName: string | null;
  affectedLanes: string | null;
  geometry: object | null;
  startedAt: Date | null;
}

/**
 * Collect and store traffic incidents from VT 511.
 * Uses upsert to track lifecycle and marks resolved incidents.
 * Returns the number of incidents processed.
 */
export async function collectTrafficIncidents(): Promise<number> {
  const db = getDb();
  if (!db) {
    if (isDev()) {
      console.log('[Collector:Traffic] Database not configured, skipping');
    }
    return 0;
  }

  const env = getEnv();

  try {
    // Fetch incident XML from VT 511
    const response = await fetch(`${VT_511_BASE}?networks=Vermont&dataTypes=incidentData`, {
      headers: {
        'User-Agent': `VT-Liveview/1.0 (${env.CONTACT_EMAIL ?? 'weather-app'})`,
      },
    });

    if (!response.ok) {
      throw new Error(`VT 511 API returned ${response.status}`);
    }

    const xmlText = await response.text();
    const incidents = parseIncidentXml(xmlText);

    if (incidents.length === 0) {
      if (isDev()) {
        console.log('[Collector:Traffic] No incidents from VT 511');
      }
      return 0;
    }

    const currentIds: string[] = [];
    let processedCount = 0;

    for (const incident of incidents) {
      const sourceId = `vt511-${incident.id}`;
      currentIds.push(sourceId);

      // Check if incident exists
      const existing = await db
        .select()
        .from(trafficIncidents)
        .where(eq(trafficIncidents.sourceId, sourceId))
        .limit(1);

      if (existing.length > 0) {
        // Update last_seen timestamp
        await db
          .update(trafficIncidents)
          .set({ lastSeenAt: new Date() })
          .where(eq(trafficIncidents.sourceId, sourceId));
      } else {
        // Insert new incident
        const newIncident: NewTrafficIncident = {
          sourceId,
          incidentType: incident.type,
          severity: incident.severity,
          title: incident.title,
          description: incident.description,
          latitude: String(incident.latitude),
          longitude: String(incident.longitude),
          roadName: incident.roadName,
          affectedLanes: incident.affectedLanes,
          geometry: incident.geometry,
          startedAt: incident.startedAt,
          source: 'VT 511',
        };

        await db.insert(trafficIncidents).values(newIncident);
      }

      processedCount++;
    }

    // Mark incidents that are no longer active as resolved
    if (currentIds.length > 0) {
      await db
        .update(trafficIncidents)
        .set({ resolvedAt: new Date() })
        .where(
          and(
            isNull(trafficIncidents.resolvedAt),
            notInArray(trafficIncidents.sourceId, currentIds)
          )
        );
    }

    if (isDev()) {
      console.log(`[Collector:Traffic] Processed ${processedCount} incidents`);
    }

    return processedCount;
  } catch (error) {
    console.error('[Collector:Traffic] Failed to collect incidents:', error);
    throw error;
  }
}

/**
 * Parse VT 511 incident XML into structured data.
 * Simplified XML parsing for Node.js (no DOMParser).
 */
function parseIncidentXml(xmlText: string): ParsedIncident[] {
  const incidents: ParsedIncident[] = [];

  // Simple regex-based extraction for incident data
  // Note: In production, consider using a proper XML parser like fast-xml-parser
  const incidentMatches = xmlText.matchAll(/<incident[^>]*>([\s\S]*?)<\/incident>/gi);

  for (const match of incidentMatches) {
    const incidentXml = match[0];

    const id = extractXmlValue(incidentXml, 'id') || `${Date.now()}-${Math.random()}`;
    const headline = extractXmlValue(incidentXml, 'headline') || 'Traffic Incident';
    const description = extractXmlValue(incidentXml, 'description') || '';

    // Parse location (microdegrees to decimal)
    const lat = extractXmlValue(incidentXml, 'lat');
    const lon = extractXmlValue(incidentXml, 'lon');
    const latitude = lat ? parseFloat(lat) / 1000000 : 0;
    const longitude = lon ? parseFloat(lon) / 1000000 : 0;

    // Skip incidents without valid location
    if (latitude === 0 && longitude === 0) continue;

    // Determine incident type from XML attributes
    let type = 'HAZARD';
    if (incidentXml.includes('Construction') || incidentXml.includes('RoadWork')) {
      type = 'CONSTRUCTION';
    } else if (incidentXml.includes('Accident')) {
      type = 'ACCIDENT';
    } else if (incidentXml.includes('BridgeOut') || incidentXml.includes('Closure')) {
      type = 'CLOSURE';
    }

    // Determine severity
    let severity = 'MODERATE';
    const severityVal = extractXmlValue(incidentXml, 'severity');
    if (severityVal) {
      if (severityVal.toLowerCase() === 'low') severity = 'MINOR';
      else if (severityVal.toLowerCase() === 'high') severity = 'MAJOR';
    }

    // Extract road name
    const roadName = extractXmlValue(incidentXml, 'roadName') ||
                     extractXmlValue(incidentXml, 'road') ||
                     extractXmlValue(incidentXml, 'routeDesignator');

    // Extract start time
    const startTimeStr = extractXmlValue(incidentXml, 'startTime');
    const startedAt = startTimeStr ? new Date(startTimeStr) : null;

    incidents.push({
      id,
      type,
      severity,
      title: headline,
      description,
      latitude,
      longitude,
      roadName,
      affectedLanes: extractXmlValue(incidentXml, 'affectedLanes'),
      geometry: null, // Simplified - could parse route geometry if needed
      startedAt: startedAt && !isNaN(startedAt.getTime()) ? startedAt : null,
    });
  }

  return incidents;
}

/**
 * Extract text value from XML element.
 */
function extractXmlValue(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? null;
}
