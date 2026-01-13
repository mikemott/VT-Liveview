const NOAA_BASE = 'https://api.weather.gov';
const USER_AGENT = 'VT-Liveview Weather App (mike@mottvt.com)';

const fetchOptions = {
  headers: {
    'User-Agent': USER_AGENT,
    'Accept': 'application/geo+json'
  }
};

// Cache for grid point lookups to avoid repeated API calls
// Max size: 100 entries to prevent unbounded growth
const gridPointCache = new Map();
const cacheTimeouts = new Map();
const MAX_CACHE_SIZE = 100;

async function getGridPoint(lat, lon) {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;

  if (gridPointCache.has(cacheKey)) {
    return gridPointCache.get(cacheKey);
  }

  const response = await fetch(`${NOAA_BASE}/points/${lat},${lon}`, fetchOptions);

  if (!response.ok) {
    throw new Error(`Failed to get grid point: ${response.status}`);
  }

  const data = await response.json();

  // Implement LRU eviction if cache is full
  if (gridPointCache.size >= MAX_CACHE_SIZE) {
    const firstKey = gridPointCache.keys().next().value;
    gridPointCache.delete(firstKey);

    // Clear associated timeout
    const timeout = cacheTimeouts.get(firstKey);
    if (timeout) {
      clearTimeout(timeout);
      cacheTimeouts.delete(firstKey);
    }
  }

  gridPointCache.set(cacheKey, data.properties);

  // Clear cache after 1 hour and store timeout reference
  const timeout = setTimeout(() => {
    gridPointCache.delete(cacheKey);
    cacheTimeouts.delete(cacheKey);
  }, 3600000);

  cacheTimeouts.set(cacheKey, timeout);

  return data.properties;
}

export async function getCurrentWeather(lat, lon) {
  try {
    const gridPoint = await getGridPoint(lat, lon);

    // Get observation stations
    const stationsResponse = await fetch(gridPoint.observationStations, fetchOptions);
    if (!stationsResponse.ok) {
      throw new Error(`Failed to get stations: ${stationsResponse.status}`);
    }

    const stationsData = await stationsResponse.json();
    const stations = stationsData.features;

    if (!stations || stations.length === 0) {
      throw new Error('No observation stations found');
    }

    // Try stations until we get a valid observation
    for (const station of stations.slice(0, 3)) {
      const stationId = station.properties.stationIdentifier;

      try {
        const obsResponse = await fetch(
          `${NOAA_BASE}/stations/${stationId}/observations/latest`,
          fetchOptions
        );

        if (!obsResponse.ok) continue;

        const obsData = await obsResponse.json();
        const props = obsData.properties;

        // Check if we have valid temperature data
        if (props.temperature?.value === null) continue;

        return {
          temperature: props.temperature?.value !== null
            ? celsiusToFahrenheit(props.temperature.value)
            : null,
          temperatureUnit: 'F',
          description: props.textDescription || 'Unknown',
          windSpeed: props.windSpeed?.value !== null
            ? `${Math.round(props.windSpeed.value * 2.237)} mph`
            : null,
          windDirection: props.windDirection?.value !== null
            ? degreesToCardinal(props.windDirection.value)
            : null,
          humidity: props.relativeHumidity?.value ?? null,
          timestamp: props.timestamp || new Date().toISOString(),
          stationName: station.properties.name,
          icon: props.icon
        };
      } catch {
        // Try next station
        continue;
      }
    }

    throw new Error('No valid observations available from nearby stations');
  } catch (error) {
    // Errors are thrown and handled by GraphQL resolver
    throw error;
  }
}

export async function getForecast(lat, lon) {
  try {
    const gridPoint = await getGridPoint(lat, lon);

    const forecastResponse = await fetch(gridPoint.forecast, fetchOptions);

    if (!forecastResponse.ok) {
      throw new Error(`Failed to get forecast: ${forecastResponse.status}`);
    }

    const forecastData = await forecastResponse.json();
    const periods = forecastData.properties.periods || [];

    return periods.map(period => ({
      name: period.name,
      temperature: period.temperature,
      temperatureUnit: period.temperatureUnit,
      shortForecast: period.shortForecast,
      detailedForecast: period.detailedForecast,
      startTime: period.startTime,
      endTime: period.endTime,
      isDaytime: period.isDaytime,
      icon: period.icon,
      windSpeed: period.windSpeed,
      windDirection: period.windDirection
    }));
  } catch (error) {
    // Errors are thrown and handled by GraphQL resolver
    throw error;
  }
}

export async function getAlerts(state) {
  try {
    const response = await fetch(
      `${NOAA_BASE}/alerts/active?area=${state}`,
      fetchOptions
    );

    if (!response.ok) {
      throw new Error(`Failed to get alerts: ${response.status}`);
    }

    const data = await response.json();
    const features = data.features || [];

    return features.map(feature => {
      const props = feature.properties;
      return {
        id: props.id,
        event: props.event,
        headline: props.headline,
        severity: props.severity,
        certainty: props.certainty,
        urgency: props.urgency,
        description: props.description,
        instruction: props.instruction,
        areaDesc: props.areaDesc,
        effective: props.effective,
        expires: props.expires,
        geometry: feature.geometry ? {
          type: feature.geometry.type,
          coordinates: feature.geometry.coordinates
        } : null
      };
    });
  } catch (error) {
    // Errors are thrown and handled by GraphQL resolver
    throw error;
  }
}

// Helper functions
function celsiusToFahrenheit(celsius) {
  return Math.round((celsius * 9/5) + 32);
}

function degreesToCardinal(degrees) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

// Cache for observation stations
const stationsCache = {
  data: null,
  timestamp: null,
  ttl: 900000 // 15 minutes (reduced from 1 hour to prevent stale data)
};

// Clear the stations cache (for admin endpoint)
export function clearStationsCache() {
  stationsCache.data = null;
  stationsCache.timestamp = null;
  return { cleared: true, timestamp: new Date().toISOString() };
}

export async function getObservationStations() {
  try {
    // Check cache first
    if (stationsCache.data && stationsCache.timestamp) {
      const age = Date.now() - stationsCache.timestamp;
      if (age < stationsCache.ttl) {
        return stationsCache.data;
      }
    }

    // Fetch all Vermont observation stations
    const stationsResponse = await fetch(
      `${NOAA_BASE}/stations?state=VT&limit=50`,
      fetchOptions
    );

    if (!stationsResponse.ok) {
      throw new Error(`Failed to get stations: ${stationsResponse.status}`);
    }

    const stationsData = await stationsResponse.json();
    const stations = stationsData.features || [];

    // Fetch latest observation for each station (in parallel, limited to first 50 stations)
    const stationsWithWeather = await Promise.all(
      stations.slice(0, 50).map(async (station) => {
        try {
          const stationId = station.properties.stationIdentifier;
          const obsResponse = await fetch(
            `${NOAA_BASE}/stations/${stationId}/observations/latest`,
            fetchOptions
          );

          if (!obsResponse.ok) {
            return null;
          }

          const obsData = await obsResponse.json();
          const props = obsData.properties;

          // Only include stations with valid temperature data
          if (props.temperature?.value === null) {
            return null;
          }

          return {
            id: stationId,
            name: station.properties.name,
            location: {
              lat: station.geometry.coordinates[1],
              lng: station.geometry.coordinates[0]
            },
            elevation: station.properties.elevation?.value
              ? Math.round(station.properties.elevation.value * 3.28084) // Convert m to ft
              : null,
            weather: {
              temperature: celsiusToFahrenheit(props.temperature.value),
              temperatureUnit: 'F',
              description: props.textDescription || 'Unknown',
              windSpeed: props.windSpeed?.value !== null
                ? `${Math.round(props.windSpeed.value * 2.237)} mph`
                : null,
              windDirection: props.windDirection?.value !== null
                ? degreesToCardinal(props.windDirection.value)
                : null,
              humidity: props.relativeHumidity?.value ?? null,
              dewpoint: props.dewpoint?.value !== null
                ? celsiusToFahrenheit(props.dewpoint.value)
                : null,
              pressure: props.barometricPressure?.value !== null
                ? Math.round(props.barometricPressure.value / 100) // Convert Pa to mb
                : null,
              timestamp: props.timestamp || new Date().toISOString()
            }
          };
        } catch (error) {
          // Skip stations with errors
          return null;
        }
      })
    );

    // Filter out null results and cache
    const validStations = stationsWithWeather.filter(s => s !== null);

    stationsCache.data = validStations;
    stationsCache.timestamp = Date.now();

    return validStations;
  } catch (error) {
    // If fetch fails, return cached data if available
    if (stationsCache.data) {
      return stationsCache.data;
    }
    throw error;
  }
}
