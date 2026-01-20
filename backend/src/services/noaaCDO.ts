/**
 * NOAA Climate Data Online (CDO) API Service
 * Fetches historical weather observations from NOAA's climate database.
 * Free tier: 1,000 requests/day - requires API token from https://www.ncdc.noaa.gov/cdo-web/token
 */

import { getEnv, isDev } from '../types/index.js';

const NOAA_CDO_BASE = 'https://www.ncei.noaa.gov/cdo-web/api/v2';

// Vermont weather stations (GHCND = Global Historical Climatology Network Daily)
// These are major stations with reliable historical data
interface VTStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

const VT_STATIONS: VTStation[] = [
  { id: 'GHCND:USC00435039', name: 'Montpelier', lat: 44.26, lng: -72.57 },
  { id: 'GHCND:USC00431705', name: 'Burlington Airport', lat: 44.47, lng: -73.15 },
  { id: 'GHCND:USC00437494', name: 'Rutland', lat: 43.61, lng: -72.97 },
  { id: 'GHCND:USC00436928', name: 'Saint Johnsbury', lat: 44.42, lng: -72.01 },
  { id: 'GHCND:USC00431977', name: 'Cavendish', lat: 43.39, lng: -72.61 },
  { id: 'GHCND:USC00437612', name: 'South Lincoln', lat: 44.08, lng: -73.00 },
  { id: 'GHCND:USC00434765', name: 'Irasburg', lat: 44.80, lng: -72.27 },
];

// ============================================================================
// Cache (LRU with max 100 entries, 1-hour TTL)
// ============================================================================

export interface HistoricalWeatherData {
  weather: WeatherDay[];
  stationName: string;
  stationDistance: number;
}

const historicalCache = new Map<string, HistoricalWeatherData>();
const cacheTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const MAX_CACHE_SIZE = 100;
const CACHE_TTL = 3600000; // 1 hour

// ============================================================================
// Types
// ============================================================================

export interface WeatherDay {
  date: string; // YYYY-MM-DD
  tempMin: number | null;
  tempMax: number | null;
  precipitation: number | null; // inches
  snowfall: number | null; // inches
}

interface NOAACDOResponse {
  results?: NOAACDODatapoint[];
}

interface NOAACDODatapoint {
  date: string; // YYYY-MM-DD
  datatype: 'TMAX' | 'TMIN' | 'PRCP' | 'SNOW';
  value: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in miles
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find nearest weather station to given coordinates
 */
function findNearestStation(lat: number, lng: number): VTStation & { distance: number } {
  const firstStation = VT_STATIONS[0];
  if (!firstStation) {
    throw new Error('No Vermont stations configured');
  }

  let nearest: VTStation = firstStation;
  let minDistance = calculateDistance(lat, lng, nearest.lat, nearest.lng);

  for (let i = 1; i < VT_STATIONS.length; i++) {
    const station = VT_STATIONS[i];
    if (!station) continue;
    const distance = calculateDistance(lat, lng, station.lat, station.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = station;
    }
  }

  return { ...nearest, distance: minDistance };
}

/**
 * Format date as YYYY-MM-DD for NOAA CDO API
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Process raw NOAA CDO data into structured weather days
 */
function processWeatherData(datapoints: NOAACDODatapoint[]): WeatherDay[] {
  // Group by date
  const byDate = new Map<string, Partial<WeatherDay>>();

  for (const point of datapoints) {
    if (!byDate.has(point.date)) {
      byDate.set(point.date, { date: point.date });
    }

    const day = byDate.get(point.date)!;

    switch (point.datatype) {
      case 'TMAX':
        day.tempMax = Math.round(point.value); // Already in Fahrenheit from API
        break;
      case 'TMIN':
        day.tempMin = Math.round(point.value);
        break;
      case 'PRCP':
        day.precipitation = Math.round(point.value * 100) / 100; // Already in inches
        break;
      case 'SNOW':
        day.snowfall = Math.round(point.value * 100) / 100; // Already in inches
        break;
    }
  }

  // Convert to array and fill in nulls for missing data
  const days: WeatherDay[] = [];
  for (const [date, data] of byDate) {
    days.push({
      date,
      tempMin: data.tempMin ?? null,
      tempMax: data.tempMax ?? null,
      precipitation: data.precipitation ?? null,
      snowfall: data.snowfall ?? null,
    });
  }

  // Sort by date (oldest first)
  days.sort((a, b) => a.date.localeCompare(b.date));

  return days;
}

// ============================================================================
// Main API Function
// ============================================================================

/**
 * Get historical weather data for the past 7 days near given coordinates.
 * Results are cached for 1 hour with LRU eviction.
 */
export async function getHistoricalWeather(
  lat: number,
  lng: number
): Promise<HistoricalWeatherData> {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;

  // Check cache
  const cached = historicalCache.get(cacheKey);
  if (cached) {
    if (isDev()) {
      console.log(`[Historical Weather] Cache hit for ${cacheKey}`);
    }
    return cached;
  }

  // Find nearest station
  const station = findNearestStation(lat, lng);

  if (isDev()) {
    console.log(
      `[Historical Weather] Nearest station to (${lat}, ${lng}): ${station.name} (${station.distance.toFixed(1)}mi away)`
    );
  }

  // Calculate date range (past 7 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  // Get NOAA CDO API token
  const env = getEnv();
  const token = env.NOAA_CDO_TOKEN;

  if (!token) {
    throw new Error(
      'NOAA_CDO_TOKEN environment variable is required. Get a free token at https://www.ncdc.noaa.gov/cdo-web/token'
    );
  }

  // Fetch historical data
  const url =
    `${NOAA_CDO_BASE}/data?` +
    `datasetid=GHCND&` +
    `stationid=${station.id}&` +
    `startdate=${startDateStr}&` +
    `enddate=${endDateStr}&` +
    `datatypeid=TMAX,TMIN,PRCP,SNOW&` +
    `units=standard&` + // Returns temps in F, precip in inches
    `limit=1000`;

  if (isDev()) {
    console.log(`[Historical Weather] Fetching from NOAA CDO: ${url}`);
  }

  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        token: token,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NOAA CDO API error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('NOAA CDO API timeout: Request took longer than 10 seconds');
    }
    throw error;
  }

  const data = (await response.json()) as NOAACDOResponse;

  if (!data.results || data.results.length === 0) {
    if (isDev()) {
      console.warn(`[Historical Weather] No data returned from NOAA CDO for station ${station.name}`);
    }
    // Return empty weather days for the requested range
    const emptyDays: WeatherDay[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      emptyDays.push({
        date: formatDate(new Date(d)),
        tempMin: null,
        tempMax: null,
        precipitation: null,
        snowfall: null,
      });
    }
    const result: HistoricalWeatherData = {
      weather: emptyDays,
      stationName: station.name,
      stationDistance: station.distance,
    };

    // Cache empty results with LRU eviction to avoid repeated API calls
    if (historicalCache.size >= MAX_CACHE_SIZE) {
      const firstKey = historicalCache.keys().next().value as string;
      historicalCache.delete(firstKey);
      const timeout = cacheTimeouts.get(firstKey);
      if (timeout) {
        clearTimeout(timeout);
        cacheTimeouts.delete(firstKey);
      }
    }

    historicalCache.set(cacheKey, result);

    // Clear cache after 1 hour
    const timeout = setTimeout(() => {
      historicalCache.delete(cacheKey);
      cacheTimeouts.delete(cacheKey);
    }, CACHE_TTL);

    cacheTimeouts.set(cacheKey, timeout);

    return result;
  }

  const weatherDays = processWeatherData(data.results);

  if (isDev()) {
    console.log(`[Historical Weather] Retrieved ${weatherDays.length} days of data`);
  }

  const result: HistoricalWeatherData = {
    weather: weatherDays,
    stationName: station.name,
    stationDistance: station.distance,
  };

  // Cache with LRU eviction
  if (historicalCache.size >= MAX_CACHE_SIZE) {
    const firstKey = historicalCache.keys().next().value;
    if (firstKey !== undefined) {
      historicalCache.delete(firstKey);

      // Clear associated timeout
      const timeout = cacheTimeouts.get(firstKey);
      if (timeout) {
        clearTimeout(timeout);
        cacheTimeouts.delete(firstKey);
      }
    }
  }

  historicalCache.set(cacheKey, result);

  // Clear cache after 1 hour
  const timeout = setTimeout(() => {
    historicalCache.delete(cacheKey);
    cacheTimeouts.delete(cacheKey);
  }, CACHE_TTL);

  cacheTimeouts.set(cacheKey, timeout);

  return result;
}
