/**
 * Traffic Flow API Service
 * Fetches real-time traffic conditions and road network data from NE 511
 * Data source: https://nec-por.ne-compass.com/NEC.XmlDataPortal/
 */

import type {
  TrafficCondition,
  NetworkNode,
  NetworkLink,
  NetworkData,
  TrafficFlowSegment,
  TrafficFlowStatus,
  TrafficFlowFeatureCollection,
} from '@/types';

// =============================================================================
// Constants
// =============================================================================

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// =============================================================================
// XML Parsing Utilities
// =============================================================================

function parseXML(xmlString: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
}

function getElementText(parent: Element | null, tagName: string): string | null {
  if (!parent) return null;
  const element = parent.querySelector(tagName);
  return element?.textContent ?? null;
}

function microDegreesToDecimal(microDegrees: string | null): number {
  if (!microDegrees) return 0;
  const value = parseFloat(microDegrees);
  if (isNaN(value)) return 0;
  return value / 1000000;
}

// =============================================================================
// Traffic Condition Parsing
// =============================================================================

function parseTrafficCondition(element: Element): TrafficCondition | null {
  try {
    const linkId = element.getAttribute('id');
    const networkId = element.getAttribute('netId');

    if (!linkId || !networkId) return null;

    const speedText = getElementText(element, 'speed');
    const volumeText = getElementText(element, 'volume');
    const occupancyText = getElementText(element, 'occupancy');
    const timestamp = getElementText(element, 'timestamp') ?? '';
    const type = getElementText(element, 'type') ?? 'Unknown';

    return {
      linkId,
      networkId,
      type,
      speed: speedText ? parseFloat(speedText) : null,
      volume: volumeText ? parseFloat(volumeText) : null,
      occupancy: occupancyText ? parseFloat(occupancyText) : null,
      timestamp,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Error parsing traffic condition:', error);
    }
    return null;
  }
}

// =============================================================================
// Network Data Parsing
// =============================================================================

function parseNetworkNode(element: Element): NetworkNode | null {
  try {
    const id = element.getAttribute('id');
    const networkId = element.getAttribute('netId');

    if (!id || !networkId) return null;

    const name = getElementText(element, 'name') ?? id;
    const lat = microDegreesToDecimal(getElementText(element, 'lat'));
    const lng = microDegreesToDecimal(getElementText(element, 'lon'));

    if (lat === 0 && lng === 0) return null;

    return { id, networkId, name, lat, lng };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Error parsing network node:', error);
    }
    return null;
  }
}

function parseNetworkLink(element: Element): NetworkLink | null {
  try {
    const id = element.getAttribute('id');
    const networkId = element.getAttribute('netId');

    if (!id || !networkId) return null;

    const name = getElementText(element, 'name') ?? id;
    const roadDesignator = getElementText(element, 'roadDesignator');
    const roadway = getElementText(element, 'roadway');
    const direction = getElementText(element, 'dir');
    const startNodeId = getElementText(element, 'startNodeId') ?? '';
    const endNodeId = getElementText(element, 'endNodeId') ?? '';
    const length = parseFloat(getElementText(element, 'length') ?? '0');
    const speedLimit = parseFloat(getElementText(element, 'speedLimit') ?? '65');
    const laneCount = parseInt(getElementText(element, 'laneCount') ?? '2', 10);

    // Parse midpoints
    const midPoints: Array<{ lat: number; lng: number }> = [];
    const midPointsContainer = element.querySelector('midPoints');
    if (midPointsContainer) {
      const points = midPointsContainer.querySelectorAll('midPoint');
      points.forEach((point) => {
        const lat = microDegreesToDecimal(getElementText(point, 'lat'));
        const lng = microDegreesToDecimal(getElementText(point, 'lon'));
        if (lat !== 0 || lng !== 0) {
          midPoints.push({ lat, lng });
        }
      });
    }

    return {
      id,
      networkId,
      name,
      roadDesignator,
      roadway,
      direction,
      startNodeId,
      endNodeId,
      length,
      speedLimit,
      laneCount,
      midPoints,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Error parsing network link:', error);
    }
    return null;
  }
}

// =============================================================================
// Traffic Flow Status Calculation
// =============================================================================

function calculateFlowStatus(
  currentSpeed: number | null,
  speedLimit: number
): TrafficFlowStatus {
  if (currentSpeed === null) return 'unknown';

  const speedRatio = currentSpeed / speedLimit;

  if (speedRatio >= 0.85) return 'free';
  if (speedRatio >= 0.65) return 'moderate';
  if (speedRatio >= 0.45) return 'slow';
  return 'congested';
}

// =============================================================================
// Data Fetching Functions
// =============================================================================

export async function fetchTrafficConditions(): Promise<TrafficCondition[]> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/vt511/traffic-conditions`);

    if (!response.ok) {
      return [];
    }

    const xmlText = await response.text();
    const xmlDoc = parseXML(xmlText);

    const conditions = xmlDoc.querySelectorAll('trafficCond');
    return Array.from(conditions)
      .map(parseTrafficCondition)
      .filter((c): c is TrafficCondition => c !== null);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error fetching traffic conditions:', error);
    }
    return [];
  }
}

export async function fetchNetworkData(): Promise<NetworkData> {
  const nodes = new Map<string, NetworkNode>();
  const links = new Map<string, NetworkLink>();

  try {
    const response = await fetch(`${BACKEND_URL}/api/vt511/network`);

    if (!response.ok) {
      return { nodes, links };
    }

    const xmlText = await response.text();
    const xmlDoc = parseXML(xmlText);

    // Parse nodes
    const nodeElements = xmlDoc.querySelectorAll('node');
    nodeElements.forEach((element) => {
      const node = parseNetworkNode(element);
      if (node) {
        nodes.set(node.id, node);
      }
    });

    // Parse links
    const linkElements = xmlDoc.querySelectorAll('link');
    linkElements.forEach((element) => {
      const link = parseNetworkLink(element);
      if (link) {
        links.set(link.id, link);
      }
    });

    return { nodes, links };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error fetching network data:', error);
    }
    return { nodes, links };
  }
}

// =============================================================================
// Combined Traffic Flow Data
// =============================================================================

function buildSegmentCoordinates(
  link: NetworkLink,
  nodes: Map<string, NetworkNode>
): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [];

  // Start node
  const startNode = nodes.get(link.startNodeId);
  if (startNode) {
    coordinates.push([startNode.lng, startNode.lat]);
  }

  // Midpoints
  link.midPoints.forEach((point) => {
    coordinates.push([point.lng, point.lat]);
  });

  // End node
  const endNode = nodes.get(link.endNodeId);
  if (endNode) {
    coordinates.push([endNode.lng, endNode.lat]);
  }

  return coordinates;
}

function formatRoadName(link: NetworkLink): string {
  if (link.roadDesignator) {
    const dir = link.direction ? ` ${link.direction}` : '';
    return `${link.roadDesignator}${dir}`;
  }
  if (link.roadway) {
    const dir = link.direction ? ` ${link.direction}` : '';
    return `${link.roadway}${dir}`;
  }
  return link.name;
}

export async function fetchTrafficFlowData(): Promise<TrafficFlowSegment[]> {
  const [conditions, networkData] = await Promise.all([
    fetchTrafficConditions(),
    fetchNetworkData(),
  ]);

  const segments: TrafficFlowSegment[] = [];

  for (const condition of conditions) {
    const link = networkData.links.get(condition.linkId);
    if (!link) continue;

    const coordinates = buildSegmentCoordinates(link, networkData.nodes);
    if (coordinates.length < 2) continue;

    const status = calculateFlowStatus(condition.speed, link.speedLimit);

    segments.push({
      linkId: condition.linkId,
      roadName: formatRoadName(link),
      direction: link.direction,
      speedLimit: link.speedLimit,
      currentSpeed: condition.speed,
      volume: condition.volume,
      occupancy: condition.occupancy,
      status,
      coordinates,
      timestamp: condition.timestamp,
    });
  }

  return segments;
}

// =============================================================================
// GeoJSON Conversion
// =============================================================================

export function trafficFlowToGeoJSON(
  segments: TrafficFlowSegment[]
): TrafficFlowFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: segments.map((segment) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: segment.coordinates,
      },
      properties: {
        linkId: segment.linkId,
        roadName: segment.roadName,
        direction: segment.direction,
        speedLimit: segment.speedLimit,
        currentSpeed: segment.currentSpeed,
        volume: segment.volume,
        occupancy: segment.occupancy,
        status: segment.status,
        timestamp: segment.timestamp,
      },
    })),
  };
}

// =============================================================================
// Combined Fetch + GeoJSON
// =============================================================================

export async function fetchTrafficFlowGeoJSON(): Promise<TrafficFlowFeatureCollection> {
  const segments = await fetchTrafficFlowData();
  return trafficFlowToGeoJSON(segments);
}
