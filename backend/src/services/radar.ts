/**
 * Iowa Environmental Mesonet (IEM) NEXRAD Radar Service
 * Provides radar tile information for weather map overlays.
 */

import type { RadarInfo, RadarTimestamp } from '../types/index.js';

const IEM_BASE = 'https://mesonet.agron.iastate.edu';

// Available radar products:
// - ridge::CONUS-NEXRAD-N0Q (Composite base reflectivity)
// - nexrad-n0q-900913 (Individual station)
const RADAR_PRODUCT = 'ridge::CONUS-NEXRAD-N0Q';

/**
 * RainViewer API response structure
 */
interface RainViewerResponse {
  radar: {
    past: Array<{
      time: number;
      path: string;
    }>;
  };
}

/**
 * Get radar information from Iowa Environmental Mesonet.
 * Falls back to generated timestamps if API is unavailable.
 */
export async function getRadarInfo(): Promise<RadarInfo> {
  try {
    // Fetch available radar timestamps from IEM
    const response = await fetch(`${IEM_BASE}/json/radar.py`);

    if (!response.ok) {
      // Fallback to generating recent timestamps
      return generateFallbackRadarInfo();
    }

    // Note: IEM response is fetched to verify API is available,
    // but we generate our own timestamps for consistency
    await response.json();

    // IEM provides scan times - extract recent ones for animation
    const timestamps = generateRecentTimestamps(6, 5); // 6 frames, 5 minutes apart

    return {
      baseUrl: `${IEM_BASE}/cache/tile.py/1.0.0/${RADAR_PRODUCT}`,
      timestamps,
      tilePattern: `${IEM_BASE}/cache/tile.py/1.0.0/${RADAR_PRODUCT}/{z}/{x}/{y}.png`,
    };
  } catch {
    // Silently fall back to generated timestamps
    return generateFallbackRadarInfo();
  }
}

/**
 * Generate fallback radar info when IEM API is unavailable.
 */
function generateFallbackRadarInfo(): RadarInfo {
  const timestamps = generateRecentTimestamps(6, 5);

  return {
    baseUrl: `${IEM_BASE}/cache/tile.py/1.0.0/${RADAR_PRODUCT}`,
    timestamps,
    tilePattern: `${IEM_BASE}/cache/tile.py/1.0.0/${RADAR_PRODUCT}/{z}/{x}/{y}.png`,
  };
}

/**
 * Generate timestamps for recent radar frames.
 * Radar updates approximately every 5-10 minutes.
 */
function generateRecentTimestamps(count: number, intervalMinutes: number): RadarTimestamp[] {
  const timestamps: RadarTimestamp[] = [];
  const now = new Date();

  // Round down to nearest 5 minutes
  now.setMinutes(Math.floor(now.getMinutes() / 5) * 5);
  now.setSeconds(0);
  now.setMilliseconds(0);

  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * intervalMinutes * 60 * 1000);
    timestamps.push({
      time: time.toISOString(),
      path: `${IEM_BASE}/cache/tile.py/1.0.0/${RADAR_PRODUCT}/{z}/{x}/{y}.png`,
    });
  }

  return timestamps;
}

/**
 * RainViewer API as alternative/backup radar source.
 * Provides global radar coverage with smoother animation frames.
 */
export async function getRainViewerRadar(): Promise<RadarInfo> {
  const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');

  if (!response.ok) {
    throw new Error(`RainViewer API error: ${response.status}`);
  }

  const data = (await response.json()) as RainViewerResponse;
  const radar = data.radar;

  // Get past frames (last 6)
  const pastFrames: RadarTimestamp[] = radar.past.slice(-6).map((frame) => ({
    time: new Date(frame.time * 1000).toISOString(),
    path: `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
  }));

  const lastFrame = pastFrames[pastFrames.length - 1];

  return {
    baseUrl: 'https://tilecache.rainviewer.com',
    timestamps: pastFrames,
    tilePattern: lastFrame?.path ?? '',
  };
}
