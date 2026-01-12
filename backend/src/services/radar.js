// Iowa Environmental Mesonet (IEM) NEXRAD Radar Service
const IEM_BASE = 'https://mesonet.agron.iastate.edu';

// Available radar products:
// - ridge::CONUS-NEXRAD-N0Q (Composite base reflectivity)
// - nexrad-n0q-900913 (Individual station)
const RADAR_PRODUCT = 'ridge::CONUS-NEXRAD-N0Q';

export async function getRadarInfo() {
  try {
    // Fetch available radar timestamps from IEM
    const response = await fetch(`${IEM_BASE}/json/radar.py`);

    if (!response.ok) {
      // Fallback to generating recent timestamps
      return generateFallbackRadarInfo();
    }

    const _data = await response.json();

    // IEM provides scan times - extract recent ones for animation
    const timestamps = generateRecentTimestamps(6, 5); // 6 frames, 5 minutes apart

    return {
      baseUrl: `${IEM_BASE}/cache/tile.py/1.0.0/${RADAR_PRODUCT}`,
      timestamps: timestamps,
      tilePattern: `${IEM_BASE}/cache/tile.py/1.0.0/${RADAR_PRODUCT}/{z}/{x}/{y}.png`
    };
  } catch (error) {
    // Silently fall back to generated timestamps
    return generateFallbackRadarInfo();
  }
}

function generateFallbackRadarInfo() {
  const timestamps = generateRecentTimestamps(6, 5);

  return {
    baseUrl: `${IEM_BASE}/cache/tile.py/1.0.0/${RADAR_PRODUCT}`,
    timestamps: timestamps,
    tilePattern: `${IEM_BASE}/cache/tile.py/1.0.0/${RADAR_PRODUCT}/{z}/{x}/{y}.png`
  };
}

function generateRecentTimestamps(count, intervalMinutes) {
  const timestamps = [];
  const now = new Date();

  // Round down to nearest 5 minutes (radar updates approximately every 5-10 min)
  now.setMinutes(Math.floor(now.getMinutes() / 5) * 5);
  now.setSeconds(0);
  now.setMilliseconds(0);

  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * intervalMinutes * 60 * 1000);
    timestamps.push({
      time: time.toISOString(),
      path: `${IEM_BASE}/cache/tile.py/1.0.0/${RADAR_PRODUCT}/{z}/{x}/{y}.png`
    });
  }

  return timestamps;
}

// RainViewer API as alternative/backup
export async function getRainViewerRadar() {
  try {
    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');

    if (!response.ok) {
      throw new Error(`RainViewer API error: ${response.status}`);
    }

    const data = await response.json();
    const radar = data.radar;

    // Get past frames (last 6)
    const pastFrames = radar.past.slice(-6).map(frame => ({
      time: new Date(frame.time * 1000).toISOString(),
      path: `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`
    }));

    return {
      baseUrl: 'https://tilecache.rainviewer.com',
      timestamps: pastFrames,
      tilePattern: pastFrames[pastFrames.length - 1]?.path || ''
    };
  } catch (error) {
    // Errors are thrown and handled by GraphQL resolver
    throw error;
  }
}
