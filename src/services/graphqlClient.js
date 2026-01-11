import { GraphQLClient } from 'graphql-request';

// GraphQL endpoint - default to localhost for development
const GRAPHQL_ENDPOINT = import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

export const graphqlClient = new GraphQLClient(GRAPHQL_ENDPOINT);

// Query definitions
export const CURRENT_WEATHER_QUERY = `
  query CurrentWeather($lat: Float!, $lon: Float!) {
    currentWeather(lat: $lat, lon: $lon) {
      temperature
      temperatureUnit
      description
      windSpeed
      windDirection
      humidity
      timestamp
      stationName
      icon
    }
  }
`;

export const FORECAST_QUERY = `
  query Forecast($lat: Float!, $lon: Float!) {
    forecast(lat: $lat, lon: $lon) {
      name
      temperature
      temperatureUnit
      shortForecast
      detailedForecast
      startTime
      endTime
      isDaytime
      icon
      windSpeed
      windDirection
    }
  }
`;

export const ALERTS_QUERY = `
  query Alerts($state: String!) {
    alerts(state: $state) {
      id
      event
      headline
      severity
      certainty
      urgency
      description
      instruction
      areaDesc
      effective
      expires
      geometry {
        type
        coordinates
      }
    }
  }
`;

export const RADAR_INFO_QUERY = `
  query RadarInfo {
    radarInfo {
      baseUrl
      timestamps {
        time
        path
      }
      tilePattern
    }
  }
`;

// Fetch functions
export async function fetchCurrentWeather(lat, lon) {
  const data = await graphqlClient.request(CURRENT_WEATHER_QUERY, { lat, lon });
  return data.currentWeather;
}

export async function fetchForecast(lat, lon) {
  const data = await graphqlClient.request(FORECAST_QUERY, { lat, lon });
  return data.forecast;
}

export async function fetchAlerts(state = 'VT') {
  const data = await graphqlClient.request(ALERTS_QUERY, { state });
  return data.alerts;
}

export async function fetchRadarInfo() {
  const data = await graphqlClient.request(RADAR_INFO_QUERY);
  return data.radarInfo;
}
